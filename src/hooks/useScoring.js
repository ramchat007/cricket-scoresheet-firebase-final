// src/hooks/useScoring.js
import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";

// Helper: Normalize keys for robust lookup (Case Insensitive)
const norm = (k) =>
  String(k || "")
    .trim()
    .toLowerCase();

/**
 * 🧠 SELF-HEALING SCORING ENGINE (Robust)
 */
function recalculateInningsState(inn) {
  if (!inn) return inn;

  // 1. Reset Totals
  inn.score = 0;
  inn.wickets = 0;
  inn.over = 0;
  inn.overBallCount = 0;
  inn.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

  // 2. Reset Arrays (Rebuild FOW from scratch)
  inn.fallOfWickets = [];

  // 3. Initialize/Clear Stats Containers
  inn.batsmenStats = inn.batsmenStats || {};
  inn.bowlerStats = inn.bowlerStats || {};

  // Reset existing stats to 0
  Object.values(inn.batsmenStats).forEach((p) => {
    p.runs = 0;
    p.balls = 0;
    p.fours = 0;
    p.sixes = 0;
    p.out = null;
    p.wicketType = null;
    p.bowler = null;
  });
  Object.values(inn.bowlerStats).forEach((b) => {
    b.runs = 0;
    b.balls = 0;
    b.wickets = 0;
  });

  // 4. Replay History
  const history = inn.timeline || inn.ballsLog || [];

  history.forEach((ball) => {
    let runVal = 0;
    let isW = false,
      isWD = false,
      isNB = false,
      isB = false,
      isLB = false;
    let batterName = inn.striker;
    let bowlerName = inn.currentBowler;
    let whoOutName = inn.striker;

    if (typeof ball === "object") {
      runVal = ball.runs || 0;
      isW = ball.isWicket;
      isWD = ball.isWide;
      isNB = ball.isNoBall;
      isB = ball.isBye;
      isLB = ball.isLegBye;
      if (ball.batter) batterName = ball.batter;
      if (ball.bowler) bowlerName = ball.bowler;
      if (ball.whoOut) whoOutName = ball.whoOut;
      else whoOutName = batterName;
    } else {
      const code = String(ball);
      if (code === "W") isW = true;
      else if (code.includes("WD")) {
        isWD = true;
        runVal = 1 + (parseInt(code.replace("WD", "")) || 0);
      } else if (code.includes("NB")) {
        isNB = true;
        runVal = 1 + (parseInt(code.replace("NB", "")) || 0);
      } else runVal = parseInt(code) || 0;
    }

    if (batterName && !inn.batsmenStats[batterName])
      inn.batsmenStats[batterName] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    if (bowlerName && !inn.bowlerStats[bowlerName])
      inn.bowlerStats[bowlerName] = { runs: 0, balls: 0, wickets: 0 };

    inn.score += runVal;

    if (isWD) inn.extras.wides += runVal;
    else if (isNB) {
      inn.extras.noBalls += 1;
      if (!isB && !isLB) inn.score += runVal - 1;
    } else if (isB) inn.extras.byes += runVal;
    else if (isLB) inn.extras.legByes += runVal;

    if (batterName && inn.batsmenStats[batterName]) {
      const p = inn.batsmenStats[batterName];
      if (!isWD) p.balls += 1;
      if (!isWD && !isB && !isLB) {
        const batRuns = isNB ? runVal - 1 : runVal;
        p.runs += batRuns;
        if (batRuns === 4) p.fours += 1;
        if (batRuns === 6) p.sixes += 1;
      }
    }

    if (bowlerName && inn.bowlerStats[bowlerName]) {
      const b = inn.bowlerStats[bowlerName];
      if (!isB && !isLB) b.runs += runVal;
      if (!isWD && !isNB) b.balls += 1;
      if (isW && !isDataRunOut(ball)) b.wickets += 1;
    }

    if (!isWD && !isNB) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
      }
    }

    if (isW) {
      inn.wickets += 1;
      inn.fallOfWickets.push({
        score: inn.score,
        wicketNo: inn.wickets,
        over: `${inn.over}.${inn.overBallCount}`,
        batsman: whoOutName,
      });

      if (whoOutName && !inn.batsmenStats[whoOutName])
        inn.batsmenStats[whoOutName] = {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
        };

      if (whoOutName && inn.batsmenStats[whoOutName]) {
        const wType =
          (typeof ball === "object" ? ball.wicketType : "bowled") || "bowled";
        const fielder =
          (typeof ball === "object" ? ball.fielderName : "") || "";
        let outText = `b ${bowlerName}`;
        if (wType === "caught") outText = `c ${fielder} b ${bowlerName}`;
        else if (wType === "runout") outText = `run out (${fielder})`;
        else if (wType === "stumped") outText = `st ${fielder} b ${bowlerName}`;
        else if (wType === "lbw") outText = `lbw b ${bowlerName}`;
        else if (wType === "hitwicket") outText = `hit wicket b ${bowlerName}`;

        inn.batsmenStats[whoOutName].out = outText;
        inn.batsmenStats[whoOutName].wicketType = wType;
        inn.batsmenStats[whoOutName].bowler = bowlerName;
        inn.batsmenStats[whoOutName].fielder = fielder;
      }
    }
  });

  return inn;
}

function isDataRunOut(ball) {
  if (typeof ball !== "object") return false;
  return ball.wicketType === "runout";
}

/**
 * MAIN SCORING HOOK
 */
export function useScoring({ tournamentId, matchId, match }) {
  function initializeSecondInnings(s) {
    const prevInn = s.innings[0];
    const newInnIndex = 1;
    const newBattingTeam = prevInn.bowlingTeam;
    const newBowlingTeam = prevInn.battingTeam;

    let newBattingSquad = [];
    let newBowlingSquad = [];

    if (newBattingTeam === s.meta.teamA) {
      newBattingSquad = s.teamASquad || [];
      newBowlingSquad = s.teamBSquad || [];
    } else {
      newBattingSquad = s.teamBSquad || [];
      newBowlingSquad = s.teamASquad || [];
    }

    s.innings[newInnIndex] = {
      battingTeam: newBattingTeam,
      bowlingTeam: newBowlingTeam,
      batsmenList: newBattingSquad,
      bowlersList: newBowlingSquad,
      score: 0,
      wickets: 0,
      over: 0,
      overBallCount: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      striker: newBattingSquad[0]?.name || "",
      nonStriker: newBattingSquad[1]?.name || "",
      currentBowler: newBowlingSquad[0]?.name || "",
      batsmenStats: {},
      bowlerStats: {},
      ballsLog: [],
      timeline: [],
      battingOrder: [newBattingSquad[0]?.name, newBattingSquad[1]?.name].filter(
        Boolean
      ),
      fallOfWickets: [],
    };

    const opener1 = s.innings[newInnIndex].striker;
    const opener2 = s.innings[newInnIndex].nonStriker;
    if (opener1)
      s.innings[newInnIndex].batsmenStats[opener1] = {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
      };
    if (opener2)
      s.innings[newInnIndex].batsmenStats[opener2] = {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
      };

    s.currentInnings = newInnIndex;
    s.innings[newInnIndex].awaitingNewBowler = true;
    s.innings[newInnIndex].awaitingNewBatsman = false;
    return s;
  }

  function addToBattingOrder(inn, playerName) {
    if (!inn || !playerName) return;
    if (!inn.battingOrder) inn.battingOrder = [];
    if (!inn.battingOrder.includes(playerName)) {
      inn.battingOrder.push(playerName);
    }
  }

  async function handleBall(code, extraData = {}, extraRuns = 0) {
    if (!tournamentId || !matchId || !match) return;

    try {
      await ballTransaction(tournamentId, matchId, (s) => {
        const idx = s.currentInnings || 0;
        const inn = s.innings?.[idx];
        if (!inn || inn.completed) return s;

        const striker = inn.striker;
        const bowler = inn.currentBowler;

        const newBall = {
          id: Date.now(),
          code: code,
          runs: 0,
          isWicket: code === "W",
          isWide: code === "WD",
          isNoBall: code === "NB",
          isBye: code === "B",
          isLegBye: code === "LB",
          batter: striker,
          bowler: bowler,
          ...extraData,
        };

        if (newBall.isWide || newBall.isNoBall) newBall.runs = 1 + extraRuns;
        else if (newBall.isBye || newBall.isLegBye) newBall.runs = extraRuns;
        else if (!newBall.isWicket) newBall.runs = parseInt(code) || 0;

        inn.timeline = inn.timeline || [];
        inn.ballsLog = inn.ballsLog || [];
        inn.timeline.push(newBall);
        inn.ballsLog.push(code);

        recalculateInningsState(inn);
        addToBattingOrder(inn, inn.striker);
        addToBattingOrder(inn, inn.nonStriker);

        let shouldSwap = false;
        const runsPhysical = extraRuns || newBall.runs;
        if (runsPhysical % 2 !== 0) shouldSwap = true;

        const isLegal = !newBall.isWide && !newBall.isNoBall;
        if (isLegal && inn.overBallCount === 0 && inn.over > 0) {
          shouldSwap = !shouldSwap;
          inn.awaitingNewBowler = true;
        }

        if (shouldSwap) {
          const t = inn.striker;
          inn.striker = inn.nonStriker;
          inn.nonStriker = t;
        }

        if (newBall.isWicket) {
          inn.awaitingNewBatsman = true;
          // FOW is handled in recalculateInningsState
        }

        checkFinishAndSetResult(s, idx);

        return s;
      });
    } catch (e) {
      console.error("Scoring Error:", e);
      alert("Error: " + e.message);
    }
  }

  // --- LOGIC: Check Finish / All Out ---
  function checkFinishAndSetResult(s, idx) {
    const inn = s.innings?.[idx];
    const target = s.meta?.target;
    const teamSize = inn.batsmenList?.length || 11;
    const maxWickets = Math.max(1, teamSize - 1);

    if (idx === 1 && target && inn.score >= target) {
      inn.completed = true;
      s.meta.matchStatus = "finished";
      s.meta.result = `${inn.battingTeam} won by ${
        teamSize - inn.wickets
      } wickets`;
      inn.awaitingNewBatsman = false;
      inn.awaitingNewBowler = false;
      return;
    }

    const maxOvers = parseInt(s.meta?.overs || 20);
    const isAllOut = inn.wickets >= maxWickets;
    const isOversDone = inn.over >= maxOvers;

    // 🔥 FIX: Added 'inn.completed' check to support manual End Innings
    if (isAllOut || isOversDone || inn.completed) {
      inn.completed = true;
      inn.awaitingNewBatsman = false;
      inn.awaitingNewBowler = false;

      if (idx === 0) {
        s.meta.target = inn.score + 1;
        // Auto-switch
        initializeSecondInnings(s);
      } else {
        s.meta.matchStatus = "finished";
        const runDiff = (s.innings[0].score || 0) - inn.score;
        if (runDiff > 0)
          s.meta.result = `${s.meta.teamA} won by ${runDiff} runs`;
        else if (runDiff === 0) s.meta.result = "Match Tied";
        else s.meta.result = "Match result calculated";
      }
    }
  }

  const handleExtraBallRuns = (type, runs) => {
    let code = "WD";
    if (type === "noBalls") code = "NB";
    if (type === "byes") code = "B";
    if (type === "legByes") code = "LB";
    handleBall(code, {}, runs);
  };

  const handleUndo = async () => {
    await undoLast(tournamentId, matchId);
  };

  const handleNewBatsman = async (player) => {
    await ballTransaction(tournamentId, matchId, (s) => {
      const inn = s.innings[s.currentInnings];
      inn.striker = player;
      inn.awaitingNewBatsman = false;
      return s;
    });
  };

  const handleConfirmBowler = async (player) => {
    await ballTransaction(tournamentId, matchId, (s) => {
      const inn = s.innings[s.currentInnings];
      inn.currentBowler = player;
      inn.awaitingNewBowler = false; // Force clear
      return s;
    });
  };

  const handleChangeBowler = handleConfirmBowler;

  const handleStrikeChange = async (s, ns) => {
    await ballTransaction(tournamentId, matchId, (state) => {
      const inn = state.innings[state.currentInnings];
      inn.striker = s;
      inn.nonStriker = ns;
      inn.awaitingNewBatsman = false; // Force clear
      return state;
    });
  };

  const handleEndInnings = async () => {
    await ballTransaction(tournamentId, matchId, (s) => {
      const inn = s.innings[s.currentInnings];
      inn.completed = true; // Mark as done manually
      checkFinishAndSetResult(s, s.currentInnings); // Trigger switch logic
      return s;
    });
  };

  const handleFinishMatch = async (reason) => {
    await finishMatch(tournamentId, matchId, match.meta?.teamA, reason);
    await syncMatchStatsToGlobalPlayers(tournamentId, matchId, match);
  };

  const handleDeleteMatch = async () => {
    await deleteMatch(tournamentId, matchId);
  };

  return {
    handleBall,
    handleExtraBallRuns,
    handleUndo,
    handleNewBatsman,
    handleConfirmBowler,
    handleChangeBowler,
    handleStrikeChange,
    handleEndInnings,
    handleFinishMatch,
    handleDeleteMatch,
  };
}
