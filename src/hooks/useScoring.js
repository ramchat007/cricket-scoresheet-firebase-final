// src/hooks/useScoring.js
import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";
const norm = (k) => String(k || "").trim();
function recalculateInningsState(inn) {
  if (!inn) return inn;

  // 1. Reset Totals
  inn.score = 0;
  inn.wickets = 0;
  inn.over = 0;
  inn.overBallCount = 0;
  inn.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

  // 2. Map Normalized Names to Real Keys
  // This allows us to find "Roshan " even if the key is "Roshan"
  const batterKeyMap = {};
  Object.keys(inn.batsmenStats || {}).forEach((key) => {
    batterKeyMap[norm(key)] = key;
    // Reset stats while we're here
    inn.batsmenStats[key].runs = 0;
    inn.batsmenStats[key].balls = 0;
    inn.batsmenStats[key].fours = 0;
    inn.batsmenStats[key].sixes = 0;
  });

  const bowlerKeyMap = {};
  Object.keys(inn.bowlerStats || {}).forEach((key) => {
    bowlerKeyMap[norm(key)] = key;
    // Reset stats
    inn.bowlerStats[key].runs = 0;
    inn.bowlerStats[key].balls = 0;
    inn.bowlerStats[key].wickets = 0;
  });

  // 3. Replay History
  const history = inn.timeline || inn.ballsLog || [];

  history.forEach((ball) => {
    // Normalize Ball Data
    let runVal = 0;
    let isW = false,
      isWD = false,
      isNB = false,
      isB = false,
      isLB = false;

    // Default to current striker if missing (Edge case fallback)
    let batterName = inn.striker;
    let bowlerName = inn.currentBowler;

    if (typeof ball === "object") {
      runVal = ball.runs || 0;
      isW = ball.isWicket;
      isWD = ball.isWide;
      isNB = ball.isNoBall;
      isB = ball.isBye;
      isLB = ball.isLegBye;
      // Prefer the name stored in the event
      if (ball.batter) batterName = ball.batter;
      if (ball.bowler) bowlerName = ball.bowler;
    } else {
      // Legacy String Format
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

    // Lookup real keys using normalized names
    const batterKey = batterKeyMap[norm(batterName)];
    const bowlerKey = bowlerKeyMap[norm(bowlerName)];

    // --- CALCULATION LOGIC ---

    // 1. Total Score
    inn.score += runVal;

    // 2. Extras
    if (isWD) {
      inn.extras.wides += runVal;
    } else if (isNB) {
      inn.extras.noBalls += 1;
      // If runs were scored off the bat on a NB, add them to score (penalty already added)
      if (!isB && !isLB) {
        inn.score += runVal - 1;
      }
    } else if (isB) {
      inn.extras.byes += runVal;
    } else if (isLB) {
      inn.extras.legByes += runVal;
    }

    // 3. Batting Stats
    if (batterKey && inn.batsmenStats[batterKey]) {
      // Legal ball count
      if (!isWD) {
        inn.batsmenStats[batterKey].balls += 1;
      }
      // Runs off bat
      if (!isWD && !isB && !isLB) {
        const batRuns = isNB ? runVal - 1 : runVal; // Remove NB penalty from batter's runs
        inn.batsmenStats[batterKey].runs += batRuns;

        if (batRuns === 4) inn.batsmenStats[batterKey].fours += 1;
        if (batRuns === 6) inn.batsmenStats[batterKey].sixes += 1;
      }
    }

    // 4. Bowling Stats
    if (bowlerKey && inn.bowlerStats[bowlerKey]) {
      // Bowler runs (exclude byes/legbyes)
      if (!isB && !isLB) {
        inn.bowlerStats[bowlerKey].runs += runVal;
      }
      // Legal ball count
      if (!isWD && !isNB) {
        inn.bowlerStats[bowlerKey].balls += 1;
      }
      // Wickets (exclude runouts)
      if (isW && !isDataRunOut(ball)) {
        inn.bowlerStats[bowlerKey].wickets += 1;
      }
    }

    // 5. Overs & Wickets
    if (isW) inn.wickets += 1;

    if (!isWD && !isNB) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
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
  function addToBattingOrder(inn, playerName) {
    if (!inn || !playerName) return;
    if (!inn.battingOrder) inn.battingOrder = [];
    if (!inn.battingOrder.includes(playerName)) {
      inn.battingOrder.push(playerName);
    }
  }

  // --- 1. HANDLE BALL ---
  async function handleBall(code, extraData = {}, extraRuns = 0) {
    if (!tournamentId || !matchId || !match) return;

    try {
      await ballTransaction(tournamentId, matchId, (s) => {
        const idx = s.currentInnings || 0;
        const inn = s.innings?.[idx];
        if (!inn || inn.completed) return s;

        // Ensure stats objects exist for current players
        const striker = inn.striker;
        const bowler = inn.currentBowler;

        if (striker && (!inn.batsmenStats || !inn.batsmenStats[striker])) {
          inn.batsmenStats = inn.batsmenStats || {};
          inn.batsmenStats[striker] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
        }
        if (bowler && (!inn.bowlerStats || !inn.bowlerStats[bowler])) {
          inn.bowlerStats = inn.bowlerStats || {};
          inn.bowlerStats[bowler] = { runs: 0, balls: 0, wickets: 0 };
        }

        // 1. Prepare New Ball Object
        const newBall = {
          id: Date.now(),
          code: code,
          runs: 0,
          isWicket: code === "W",
          isWide: code === "WD",
          isNoBall: code === "NB",
          isBye: code === "B",
          isLegBye: code === "LB",
          batter: striker, // Save exact string from DB
          bowler: bowler, // Save exact string from DB
          ...extraData,
        };

        if (newBall.isWide || newBall.isNoBall) {
          newBall.runs = 1 + extraRuns;
        } else if (newBall.isBye || newBall.isLegBye) {
          newBall.runs = extraRuns;
        } else if (!newBall.isWicket) {
          newBall.runs = parseInt(code) || 0;
        }

        // 2. Add to Timeline
        inn.timeline = inn.timeline || [];
        inn.ballsLog = inn.ballsLog || [];

        inn.timeline.push(newBall);
        inn.ballsLog.push(code);

        // 3. AUTO-HEAL
        recalculateInningsState(inn);

        // 4. Update Strike & Order
        addToBattingOrder(inn, inn.striker);
        addToBattingOrder(inn, inn.nonStriker);

        let shouldSwap = false;
        const runsPhysical = extraRuns || newBall.runs;

        // Simple odd/even swap (ignoring boundary logic for robustness)
        if (runsPhysical % 2 !== 0) shouldSwap = true;

        // End of Over Swap
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
          inn.fallOfWickets = inn.fallOfWickets || [];
          inn.fallOfWickets.push({
            score: inn.score,
            wicketNo: inn.wickets,
            over: `${inn.over}.${inn.overBallCount}`,
            batsman: extraData.whoOut || inn.striker,
          });
        }

        checkFinishAndSetResult(s, idx);
        return s;
      });
    } catch (e) {
      console.error("Scoring Error:", e);
      alert("Error: " + e.message);
    }
  }

  // --- LOGIC: Check Finish ---
  function checkFinishAndSetResult(s, idx) {
    const inn = s.innings?.[idx];
    const target = s.meta?.target;

    if (idx === 1 && target && inn.score >= target) {
      inn.completed = true;
      s.meta.matchStatus = "finished";
      s.meta.result = `${inn.battingTeam} won by ${10 - inn.wickets} wickets`;
    }

    const maxOvers = parseInt(s.meta?.overs || 20);
    const isAllOut = inn.wickets >= 10;
    const isOversDone = inn.over >= maxOvers;

    if (isAllOut || isOversDone) {
      inn.completed = true;
      inn.awaitingNewBowler = false;

      if (idx === 0) {
        s.meta.target = inn.score + 1;
      } else {
        s.meta.matchStatus = "finished";
        const runDiff = (s.innings[0].score || 0) - inn.score;
        if (runDiff > 0)
          s.meta.result = `${s.meta.teamA} won by ${runDiff} runs`;
        else s.meta.result = "Match Tied";
      }
    }
  }

  // --- WRAPPERS ---
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
      inn.awaitingNewBowler = false;
      return s;
    });
  };

  const handleChangeBowler = handleConfirmBowler;

  const handleStrikeChange = async (s, ns) => {
    await ballTransaction(tournamentId, matchId, (state) => {
      const inn = state.innings[state.currentInnings];
      inn.striker = s;
      inn.nonStriker = ns;
      return state;
    });
  };

  const handleEndInnings = async () => {
    await ballTransaction(tournamentId, matchId, (s) => {
      const inn = s.innings[s.currentInnings];
      inn.completed = true;
      checkFinishAndSetResult(s, s.currentInnings);
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
