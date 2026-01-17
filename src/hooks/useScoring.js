import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";

// Helper: Normalize keys
const norm = (k) =>
  String(k || "")
    .trim()
    .toLowerCase();

// ✅ NEW HELPER: Sanitize Squad (Removes Base64 Images that crash Firestore)
const sanitizeSquadImages = (squad) => {
  if (!Array.isArray(squad)) return [];
  return squad.map((p) => ({
    ...p,
    // If photoURL contains a massive Base64 string, remove it to save the match
    photoURL:
      p.photoURL && p.photoURL.startsWith("data:image") ? "" : p.photoURL,
  }));
};

// Helper: Create a "Lite" Snapshot for the Stack
const createSnapshot = (inn) => {
  return JSON.parse(
    JSON.stringify({
      score: inn.score,
      wickets: inn.wickets,
      over: inn.over,
      overBallCount: inn.overBallCount,
      striker: inn.striker,
      nonStriker: inn.nonStriker,
      currentBowler: inn.currentBowler,
      bowlerStats: inn.bowlerStats,
      batsmenStats: inn.batsmenStats,
      extras: inn.extras,
      timeline: inn.timeline || [],
      fallOfWickets: inn.fallOfWickets || [],
      awaitingNewBatsman: inn.awaitingNewBatsman || false,
      awaitingNewBowler: inn.awaitingNewBowler || false,
      completed: inn.completed || false,
    })
  );
};

/**
 * 🧠 CORE LOGIC: RECALCULATE STATS
 * This must be a pure function to work for both Local State and Firebase
 */
function recalculateInningsState(inn) {
  if (!inn) return inn;

  // 1. Reset Totals
  inn.score = 0;
  inn.wickets = 0;
  inn.over = 0;
  inn.overBallCount = 0;
  inn.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  inn.fallOfWickets = [];

  // 🚨 Reset flags before replay
  inn.awaitingNewBatsman = false;
  inn.awaitingNewBowler = false;

  // 2. Clear Player Stats
  inn.batsmenStats = inn.batsmenStats || {};
  inn.bowlerStats = inn.bowlerStats || {};

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

  // 3. Replay History
  const history = inn.timeline || inn.ballsLog || [];

  history.forEach((ball, index) => {
    let runVal = 0;
    let isW = false,
      isWD = false,
      isNB = false,
      isB = false,
      isLB = false;
    let batterName = ball.batter || inn.striker;
    let bowlerName = ball.bowler || inn.currentBowler;
    let whoOutName = ball.whoOut || batterName;

    if (typeof ball === "object") {
      runVal = ball.runs || 0;
      isW = ball.isWicket;
      isWD = ball.isWide;
      isNB = ball.isNoBall;
      isB = ball.isBye;
      isLB = ball.isLegBye;
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

    // Init Stats
    if (batterName && !inn.batsmenStats[batterName])
      inn.batsmenStats[batterName] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    if (bowlerName && !inn.bowlerStats[bowlerName])
      inn.bowlerStats[bowlerName] = { runs: 0, balls: 0, wickets: 0 };

    // Update Totals
    inn.score += runVal;
    if (isWD) inn.extras.wides += runVal;
    else if (isNB) inn.extras.noBalls += 1;
    else if (isB) inn.extras.byes += runVal;
    else if (isLB) inn.extras.legByes += runVal;

    // Player Stats
    if (batterName && inn.batsmenStats[batterName]) {
      const p = inn.batsmenStats[batterName];
      if (!isWD) p.balls += 1;
      if (!isWD && !isB && !isLB) {
        const batRuns = isNB ? Math.max(0, runVal - 1) : runVal;
        p.runs += batRuns;
        if (batRuns === 4) p.fours += 1;
        if (batRuns === 6) p.sixes += 1;
      }
    }

    if (bowlerName && inn.bowlerStats[bowlerName]) {
      const b = inn.bowlerStats[bowlerName];
      if (!isB && !isLB) b.runs += runVal;
      if (!isWD && !isNB) b.balls += 1;
      const wType = ball.wicketType || "bowled";
      if (isW && !["runout", "retiredhurt", "retiredout"].includes(wType)) {
        b.wickets += 1;
      }
    }

    // Over Calculation
    if (!isWD && !isNB) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
      }
    }

    // Wickets
    if (isW) {
      const wType = ball.wicketType || "bowled";
      if (wType !== "retiredhurt") {
        inn.wickets += 1;
        inn.fallOfWickets.push({
          score: inn.score,
          wicketNo: inn.wickets,
          over: `${inn.over}.${inn.overBallCount}`,
          batsman: whoOutName,
        });
      }
      if (inn.batsmenStats[whoOutName]) {
        inn.batsmenStats[whoOutName].out = `out`;
      }
    }

    // State Recovery (Last ball logic)
    if (index === history.length - 1) {
      if (isW && ball.next) {
        inn.striker = ball.next;
        inn.awaitingNewBatsman = false;
      } else if (isW && !ball.next) {
        inn.awaitingNewBatsman = true;
      } else {
        if (ball.batter) inn.striker = ball.batter;
      }

      if (inn.overBallCount === 0 && inn.over > 0 && !isWD && !isNB) {
        inn.awaitingNewBowler = true;
      } else {
        inn.currentBowler = bowlerName;
        inn.awaitingNewBowler = false;
      }
    }
  });

  return inn;
}

// --- LOGIC: Apply Ball Update (Shared by Optimistic & DB) ---
// ✅ FIX 1: Added default value for extraData = {} to prevent "isWide" undefined error
function applyBallLogic(s, code, extraData = {}, physicalRuns = 0) {
  const inn = s.innings?.[s.currentInnings || 0];
  if (!inn || inn.completed) return s;

  // ✅ FIX 2: Self-Healing! Clean huge images from squad to prevent Firebase crash
  if (s.teamASquad) s.teamASquad = sanitizeSquadImages(s.teamASquad);
  if (s.teamBSquad) s.teamBSquad = sanitizeSquadImages(s.teamBSquad);

  const isWD = code === "WD" || extraData.isWide;
  const isNB = code === "NB" || extraData.isNoBall;
  const isB = code === "B" || extraData.isBye;
  const isLB = code === "LB" || extraData.isLegBye;

  let displayCode = code;
  if (isWD) displayCode = `1wd${physicalRuns > 0 ? "+" + physicalRuns : ""}`;
  if (isNB) displayCode = `1nb${physicalRuns > 0 ? "+" + physicalRuns : ""}`;
  if (extraData.isWicket && extraData.wicketType === "retiredhurt")
    displayCode = "Ret.H";
  if (extraData.isWicket && extraData.wicketType === "retiredout")
    displayCode = "Ret.O";

  const totalRuns =
    isWD || isNB ? 1 + physicalRuns : parseInt(code) || physicalRuns || 0;

  const newBall = {
    id: Date.now(),
    code: displayCode,
    runs: totalRuns,
    physicalRuns: physicalRuns,
    isWicket: code === "W" || extraData.isWicket,
    isWide: isWD,
    isNoBall: isNB,
    isBye: isB,
    isLegBye: isLB,
    batter: inn.striker,
    bowler: inn.currentBowler,
    ...extraData,
  };

  inn.timeline = inn.timeline || [];
  inn.timeline.push(newBall);

  // Recalculate stats immediately
  recalculateInningsState(inn);

  // Swap Logic
  let shouldSwap = (physicalRuns || (code !== "W" && parseInt(code))) % 2 !== 0;
  const isLegal = !isWD && !isNB;
  if (isLegal && inn.overBallCount === 0 && inn.over > 0) {
    shouldSwap = !shouldSwap;
    inn.awaitingNewBowler = true;
  }

  if (shouldSwap) {
    const t = inn.striker;
    inn.striker = inn.nonStriker;
    inn.nonStriker = t;
  }
  if (newBall.isWicket) inn.awaitingNewBatsman = true;

  // Check Match Finish
  checkFinishAndSetResult(s, s.currentInnings || 0);
  return s;
}

function checkFinishAndSetResult(s, idx) {
  const inn = s.innings?.[idx];
  const target = s.meta?.target;
  const teamSize = inn.batsmenList?.length || 11;
  const maxWickets = Math.max(1, teamSize - 1);
  const maxOvers = parseInt(s.meta?.overs || 20);

  if (idx === 1 && target && inn.score >= target) {
    inn.completed = true;
    s.meta.matchStatus = "finished";
    s.meta.result = `${inn.battingTeam} won by ${
      teamSize - inn.wickets
    } wickets`;
    return;
  }

  if (inn.wickets >= maxWickets || inn.over >= maxOvers || inn.completed) {
    inn.completed = true;
    if (idx === 0) {
      s.meta.target = inn.score + 1;
      initializeSecondInnings(s);
    } else {
      s.meta.matchStatus = "finished";
      const diff = (s.innings[0].score || 0) - inn.score;
      s.meta.result =
        diff > 0
          ? `${s.meta.teamA} won by ${diff} runs`
          : diff === 0
          ? "Match Tied"
          : `${s.meta.teamB} won`;
    }
  }
}

function initializeSecondInnings(s) {
  const prev = s.innings[0];
  const nextBat = prev.bowlingTeam;
  const nextBowl = prev.battingTeam;
  const batSquad = nextBat === s.meta.teamA ? s.teamASquad : s.teamBSquad;
  const bowlSquad = nextBowl === s.meta.teamA ? s.teamASquad : s.teamBSquad;

  if (!s.innings[1]) {
    s.innings[1] = {
      battingTeam: nextBat,
      bowlingTeam: nextBowl,
      batsmenList: batSquad || [],
      bowlersList: bowlSquad || [],
      score: 0,
      wickets: 0,
      over: 0,
      overBallCount: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      striker: batSquad?.[0]?.name,
      nonStriker: batSquad?.[1]?.name,
      currentBowler: bowlSquad?.[0]?.name,
      batsmenStats: {},
      bowlerStats: {},
      timeline: [],
      fallOfWickets: [],
    };
  }
  s.currentInnings = 1;
  s.innings[1].awaitingNewBowler = true;
  return s;
}

/**
 * 🚀 OPTIMIZED HOOK
 * Accepts 'setMatch' for instant UI updates
 */
export function useScoring({ tournamentId, matchId, match, setMatch }) {
  // --- ⚡ OPTIMISTIC UPDATE HELPER ---
  const performOptimisticUpdate = (actionFn) => {
    // 1. Instant UI Update
    if (setMatch && match) {
      const matchDraft = JSON.parse(JSON.stringify(match)); // Deep Clone
      const updatedMatch = actionFn(matchDraft); // Apply logic
      setMatch(updatedMatch); // Update Screen immediately
    }
  };

  // --- HANDLERS ---

  async function handleBall(code, extraData = {}, physicalRuns = 0) {
    if (!tournamentId || !matchId) return;

    // 1. Optimistic Update (Instant)
    performOptimisticUpdate((s) =>
      applyBallLogic(s, code, extraData, physicalRuns)
    );

    // 2. Database Sync (Background)
    try {
      await ballTransaction(tournamentId, matchId, (s) =>
        applyBallLogic(s, code, extraData, physicalRuns)
      );
    } catch (e) {
      console.error("Ball Sync Failed", e);
    }
  }

  const handleNewBatsman = (p) => {
    performOptimisticUpdate((s) => {
      s.innings[s.currentInnings].striker = p;
      s.innings[s.currentInnings].awaitingNewBatsman = false;
      return s;
    });
    ballTransaction(tournamentId, matchId, (s) => {
      s.innings[s.currentInnings].striker = p;
      s.innings[s.currentInnings].awaitingNewBatsman = false;
      return s;
    });
  };

  const handleConfirmBowler = (p) => {
    performOptimisticUpdate((s) => {
      s.innings[s.currentInnings].currentBowler = p;
      s.innings[s.currentInnings].awaitingNewBowler = false;
      return s;
    });
    ballTransaction(tournamentId, matchId, (s) => {
      s.innings[s.currentInnings].currentBowler = p;
      s.innings[s.currentInnings].awaitingNewBowler = false;
      return s;
    });
  };

  const handleChangeBowler = (p) => {
    performOptimisticUpdate((s) => {
      s.innings[s.currentInnings].currentBowler = p;
      return s;
    });
    ballTransaction(tournamentId, matchId, (s) => {
      s.innings[s.currentInnings].currentBowler = p;
      s.innings[s.currentInnings].awaitingNewBowler = false;
      return s;
    });
  };

  const handleStrikeChange = (sName, nsName) => {
    performOptimisticUpdate((st) => {
      st.innings[st.currentInnings].striker = sName;
      st.innings[st.currentInnings].nonStriker = nsName;
      return st;
    });
    ballTransaction(tournamentId, matchId, (st) => {
      st.innings[st.currentInnings].striker = sName;
      st.innings[st.currentInnings].nonStriker = nsName;
      return st;
    });
  };

  const handleUndo = () => {
    performOptimisticUpdate((s) => {
      const inn = s.innings?.[s.currentInnings || 0];
      if (!inn || !inn.timeline || inn.timeline.length === 0) return s;

      // 1. Remove last ball
      const lastBall = inn.timeline.pop();

      // 2. Revert specific flags based on what the last ball was
      if (lastBall.isWicket) {
        // If we undo a wicket, revive the batsman
        const whoOut = lastBall.whoOut || inn.striker;
        if (inn.batsmenStats[whoOut]) {
          inn.batsmenStats[whoOut].out = null;
        }
        // Restore them as striker (approximate logic, usually correct)
        inn.striker = whoOut;
        inn.awaitingNewBatsman = false;
      }

      // 3. Full Recalculate to ensure scores/overs are perfect
      recalculateInningsState(inn);

      return s;
    });

    // Sync with DB
    undoLast(tournamentId, matchId);
  };

  const handleEndInnings = () => {
    performOptimisticUpdate((s) => {
      s.innings[s.currentInnings].completed = true;
      checkFinishAndSetResult(s, s.currentInnings);
      return s;
    });
    ballTransaction(tournamentId, matchId, (s) => {
      s.innings[s.currentInnings].completed = true;
      checkFinishAndSetResult(s, s.currentInnings);
      return s;
    });
  };

  return {
    handleBall,
    handleExtraBallRuns: (type, runs) =>
      handleBall(
        type === "wides" ? "WD" : "NB",
        { isWide: type === "wides", isNoBall: type === "noBalls" },
        runs
      ),
    handleUndo: () => undoLast(tournamentId, matchId), // Undo is tricky to optimize, keep as-is
    handleNewBatsman,
    handleConfirmBowler,
    handleChangeBowler,
    handleStrikeChange,
    handleEndInnings,
    handleFinishMatch: async (r) => {
      await finishMatch(tournamentId, matchId, match.meta?.teamA, r);
      await syncMatchStatsToGlobalPlayers(tournamentId, matchId, match);
    },
    handleDeleteMatch: () => deleteMatch(tournamentId, matchId),
  };
}
