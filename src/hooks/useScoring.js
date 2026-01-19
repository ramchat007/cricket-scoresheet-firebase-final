import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";

// Helper: Normalize keys
const norm = (k) => String(k || "").trim().toLowerCase();

// ✅ 1. SANITIZE SQUAD (Prevents Firestore Crash)
const sanitizeSquadImages = (squad) => {
  if (!Array.isArray(squad)) return [];
  return squad.map((p) => ({
    ...p,
    photoURL: p.photoURL && p.photoURL.startsWith("data:image") ? "" : p.photoURL,
  }));
};

// ✅ 2. SNAPSHOT CREATOR (For RAM Undo Stack & Ball Context)
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
 * 🧠 3. ROBUST RECALCULATION ENGINE (Self-Healing)
 * Replays history with 100% accuracy.
 */
function recalculateInningsState(inn) {
  if (!inn) return inn;

  // A. Reset Totals
  inn.score = 0;
  inn.wickets = 0;
  inn.over = 0;
  inn.overBallCount = 0;
  inn.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  inn.fallOfWickets = [];
  inn.awaitingNewBatsman = false;
  inn.awaitingNewBowler = false;

  // B. Reset Stats
  inn.batsmenStats = inn.batsmenStats || {};
  inn.bowlerStats = inn.bowlerStats || {};
  
  Object.values(inn.batsmenStats).forEach((p) => {
    p.runs = 0; p.balls = 0; p.fours = 0; p.sixes = 0;
    p.thirties = 0; p.fifties = 0; p.centuries = 0; // ✅ Reset Milestones
    p.out = null; p.wicketType = null; p.fielderName = null; p.bowler = null; // Clear dismissal details
  });
  
  Object.values(inn.bowlerStats).forEach((b) => {
    b.runs = 0; b.balls = 0; b.wickets = 0;
  });

  // C. Replay History
  const history = inn.timeline || [];

  history.forEach((ball, index) => {
    let runVal = ball.runs || 0;
    const { isWicket, isWide, isNoBall, isBye, isLegBye, batter, bowler } = ball;

    if (batter && !inn.batsmenStats[batter])
      inn.batsmenStats[batter] = { runs: 0, balls: 0, fours: 0, sixes: 0, thirties: 0, fifties: 0, centuries: 0 };
    if (bowler && !inn.bowlerStats[bowler])
      inn.bowlerStats[bowler] = { runs: 0, balls: 0, wickets: 0 };

    inn.score += runVal;
    if (isWide) inn.extras.wides += runVal;
    else if (isNoBall) inn.extras.noBalls += 1;
    else if (isBye) inn.extras.byes += runVal;
    else if (isLegBye) inn.extras.legByes += runVal;

    // Batter Math
    if (batter && inn.batsmenStats[batter]) {
      const p = inn.batsmenStats[batter];
      if (!isWide) p.balls += 1;
      if (!isWide && !isBye && !isLegBye) {
        const r = isNoBall ? Math.max(0, runVal - 1) : runVal;
        p.runs += r;
        if (r === 4) p.fours += 1;
        if (r === 6) p.sixes += 1;
      }
    }

    // Bowler Math (Pre-wicket check)
    if (bowler && inn.bowlerStats[bowler]) {
      const b = inn.bowlerStats[bowler];
      if (!isBye && !isLegBye) b.runs += runVal;
      if (!isWide && !isNoBall) b.balls += 1;
    }

    // Over logic
    let isOverComplete = false;
    if (!isWide && !isNoBall) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
        isOverComplete = true;
      }
    }

    // ☝️ WICKET ENGINE (Standardized for Overlay & Scorecard)
    if (isWicket && ball.wicketType !== "retiredhurt") {
      inn.wickets += 1;
      const victim = ball.whoOut || batter;
      const wType = ball.wicketType || "out";
      const fielder = ball.fielderName || ball.fielder || "";

      inn.fallOfWickets.push({
        score: inn.score,
        wicketNo: inn.wickets,
        over: `${inn.over}.${inn.overBallCount}`,
        batsman: victim,
      });

      if (inn.batsmenStats[victim]) {
        inn.batsmenStats[victim].out = "out";
        inn.batsmenStats[victim].wicketType = wType;
        inn.batsmenStats[victim].fielderName = fielder;
        
        // Run outs/retired outs don't credit a bowler
        if (!["runout", "retiredout"].includes(wType)) {
          inn.batsmenStats[victim].bowler = bowler;
          if (inn.bowlerStats[bowler]) inn.bowlerStats[bowler].wickets += 1;
        }
      }
    }

    // 🚨 STATE RECOVERY 🚨
    if (index === history.length - 1) {
      inn.striker = ball.nextStriker || inn.striker;
      inn.nonStriker = ball.nextNonStriker || inn.nonStriker;
      inn.currentBowler = ball.nextBowler || inn.currentBowler;
      inn.awaitingNewBatsman = isWicket && !ball.nextStriker;
      inn.awaitingNewBowler = isOverComplete;
    }
  });

  // ✅ FINAL MILESTONE CHECK (30s, 50s, 100s)
  Object.values(inn.batsmenStats).forEach((p) => {
    if (p.runs >= 100) {
      p.centuries = 1; p.fifties = 0; p.thirties = 0;
    } else if (p.runs >= 50) {
      p.fifties = 1; p.thirties = 0;
    } else if (p.runs >= 30) {
      p.thirties = 1;
    }
  });

  return inn;
}

// --- LOGIC: Apply New Ball with Snapshot Context ---
function applyBallLogic(s, code, extraData = {}, physicalRuns = 0) {
  const inn = s.innings?.[s.currentInnings || 0];
  if (!inn || inn.completed) return s;

  if (s.teamASquad) s.teamASquad = sanitizeSquadImages(s.teamASquad);
  if (s.teamBSquad) s.teamBSquad = sanitizeSquadImages(s.teamBSquad);

  s.undoStack = s.undoStack || [];
  s.undoStack.push(createSnapshot(inn));
  if (s.undoStack.length > 50) s.undoStack.shift();

  const isWD = code === "WD" || extraData.isWide;
  const isNB = code === "NB" || extraData.isNoBall;
  const totalRuns = isWD || isNB ? 1 + physicalRuns : parseInt(code) || physicalRuns || 0;

  const newBall = {
    id: Date.now(),
    code: code,
    runs: totalRuns,
    physicalRuns: physicalRuns,
    isWicket: code === "W" || extraData.isWicket,
    isWide: isWD,
    isNoBall: isNB,
    batter: inn.striker,
    bowler: inn.currentBowler,
    ...extraData,
  };

  let nextS = inn.striker;
  let nextNS = inn.nonStriker;

  let shouldSwap = (physicalRuns || (code !== "W" && parseInt(code))) % 2 !== 0;
  if (shouldSwap) [nextS, nextNS] = [nextNS, nextS];

  const isLegal = !isWD && !isNB;
  const overEnding = inn.overBallCount + (isLegal ? 1 : 0) === 6;

  // Suspend over-end swap if wicket fell
  if (overEnding && !newBall.isWicket) {
    [nextS, nextNS] = [nextNS, nextS];
  }

  newBall.nextStriker = newBall.isWicket ? null : nextS;
  newBall.nextNonStriker = nextNS;
  newBall.nextBowler = overEnding ? null : inn.currentBowler;

  // ✅ SAFEGUARD: Ensure timeline exists
  inn.timeline = inn.timeline || [];
  inn.timeline.push(newBall);

  recalculateInningsState(inn);
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
    s.meta.result = `${inn.battingTeam} won by ${teamSize - inn.wickets} wickets`;
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

export function useScoring({ tournamentId, matchId, match, setMatch }) {
  const performOptimisticUpdate = (actionFn) => {
    if (setMatch && match) {
      const matchDraft = JSON.parse(JSON.stringify(match));
      const updatedMatch = actionFn(matchDraft);
      setMatch(updatedMatch);
    }
  };

  const runScoringAction = async (actionFn) => {
    performOptimisticUpdate((s) => {
      const inn = s.innings?.[s.currentInnings || 0];
      if (!inn) return s;
      s.undoStack = s.undoStack || [];
      s.undoStack.push(createSnapshot(inn));
      return actionFn(s);
    });

    try {
      await ballTransaction(tournamentId, matchId, (s) => {
        const inn = s.innings?.[s.currentInnings || 0];
        if (!inn) return s;
        s.undoStack = s.undoStack || [];
        s.undoStack.push(createSnapshot(inn));
        return actionFn(s);
      });
    } catch (e) {
      console.error("Sync Failed", e);
    }
  };

  return {
    handleBall: (code, extraData, physicalRuns) =>
      runScoringAction((s) => applyBallLogic(s, code, extraData, physicalRuns)),
    handleExtraBallRuns: (type, runs) =>
      runScoringAction((s) =>
        applyBallLogic(
          s,
          type === "wides" ? "WD" : "NB",
          { isWide: type === "wides", isNoBall: type === "noBalls" },
          runs,
        ),
      ),
    handleNewBatsman: (p) =>
      runScoringAction((s) => {
        const inn = s.innings[s.currentInnings];
        inn.striker = p;
        inn.awaitingNewBatsman = false;

        // ✅ FIXED: Safe access to timeline
        if (inn.timeline && inn.timeline.length > 0) {
          const lastBall = inn.timeline[inn.timeline.length - 1];
          if (
            inn.overBallCount === 0 &&
            inn.over > 0 &&
            !lastBall.isWide &&
            !lastBall.isNoBall
          ) {
            const currentS = inn.striker;
            inn.striker = inn.nonStriker;
            inn.nonStriker = currentS;
            lastBall.nextStriker = inn.striker;
            lastBall.nextNonStriker = inn.nonStriker;
          } else {
            lastBall.nextStriker = p;
          }
        }
        return s;
      }),
    handleConfirmBowler: (p) =>
      runScoringAction((s) => {
        const inn = s.innings[s.currentInnings];
        inn.currentBowler = p;
        inn.awaitingNewBowler = false;
        // ✅ FIXED: Safe access to timeline
        if (inn.timeline && inn.timeline.length > 0)
          inn.timeline[inn.timeline.length - 1].nextBowler = p;
        return s;
      }),
    handleChangeBowler: (p) =>
      runScoringAction((s) => {
        s.innings[s.currentInnings].currentBowler = p;
        return s;
      }),
    handleStrikeChange: (s, ns) =>
      runScoringAction((st) => {
        const inn = st.innings[st.currentInnings];
        inn.striker = s;
        inn.nonStriker = ns;
        // ✅ FIXED: Safe access to timeline prevents crash on empty timeline
        if (inn.timeline && inn.timeline.length > 0) {
          inn.timeline[inn.timeline.length - 1].nextStriker = s;
          inn.timeline[inn.timeline.length - 1].nextNonStriker = ns;
        }
        return st;
      }),
    handleEndInnings: () =>
      runScoringAction((s) => {
        s.innings[s.currentInnings].completed = true;
        checkFinishAndSetResult(s, s.currentInnings);
        return s;
      }),
    handleUndo: () => {
      performOptimisticUpdate((s) => {
        const inn = s.innings?.[s.currentInnings || 0];
        if (!inn) return s;
        if (s.undoStack && s.undoStack.length > 0) {
          const snapshot = s.undoStack.pop();
          s.innings[s.currentInnings] = { ...inn, ...snapshot };
        } else if (inn.timeline && inn.timeline.length > 0) {
          inn.timeline.pop();
          recalculateInningsState(inn);
        }
        return s;
      });
      undoLast(tournamentId, matchId);
    },
    handleFinishMatch: async (r) => {
      await finishMatch(tournamentId, matchId, match.meta?.teamA, r);
      await syncMatchStatsToGlobalPlayers(tournamentId, matchId, match);
    },
    handleDeleteMatch: () => deleteMatch(tournamentId, matchId),
  };
}