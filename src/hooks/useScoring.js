// src/hooks/useScoring.js
import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";
import {
  addPendingAction,
  isActionProcessed,
  markActionProcessed,
} from "../utils/offlineQueue";

// Helper: Normalize keys
const norm = (k) =>
  String(k || "")
    .trim()
    .toLowerCase();

// ✅ 1. SANITIZE SQUAD
const sanitizeSquadImages = (squad) => {
  if (!Array.isArray(squad)) return [];
  return squad.map((p) => ({
    ...p,
    photoURL:
      p.photoURL && p.photoURL.startsWith("data:image") ? "" : p.photoURL,
  }));
};

// ✅ 2. SNAPSHOT CREATOR
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
    }),
  );
};

/**
 * 🧠 3. ROBUST RECALCULATION ENGINE
 * Handles Standard Rules + Legal Override + Extras Logic
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
    p.runs = 0;
    p.balls = 0;
    p.fours = 0;
    p.sixes = 0;
    p.thirties = 0;
    p.fifties = 0;
    p.centuries = 0;
    p.out = null;
    p.wicketType = null;
    p.fielderName = null;
    p.bowler = null;
  });

  Object.values(inn.bowlerStats).forEach((b) => {
    b.runs = 0;
    b.balls = 0;
    b.wickets = 0;
  });

  // C. Replay History
  const history = inn.timeline || [];

  history.forEach((ball, index) => {
    let runVal = ball.runs || 0;
    const {
      isWicket,
      isWide,
      isNoBall,
      isBye,
      isLegBye,
      batter,
      bowler,
      isLegalOverride,
    } = ball;

    // Initialize stats
    if (batter && !inn.batsmenStats[batter])
      inn.batsmenStats[batter] = {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        thirties: 0,
        fifties: 0,
        centuries: 0,
      };
    if (bowler && !inn.bowlerStats[bowler])
      inn.bowlerStats[bowler] = { runs: 0, balls: 0, wickets: 0 };

    // --- 1. TEAM SCORE ---
    inn.score += runVal;

    // --- 2. EXTRAS CALCULATION ---
    if (isWide) {
      inn.extras.wides += runVal;
    } else if (isNoBall) {
      inn.extras.noBalls += 1;
      
      // 🟢 NEW LOGIC: Handle custom Runs Completed on a Wicket
      let physicalRuns = 0;
      if (isWicket && ball.wicketType === "runout" && ball.physicalRuns > 0) {
        physicalRuns = ball.physicalRuns; 
        inn.score += physicalRuns; // Add these completed runs to the team total!
      } else {
        physicalRuns = Math.max(0, runVal - 1);
      }

      if (isBye) inn.extras.byes += physicalRuns;
      else if (isLegBye) inn.extras.legByes += physicalRuns;
      else {
        // Runs off bat on NB
        if (batter && inn.batsmenStats[batter]) {
          const p = inn.batsmenStats[batter];
          p.runs += physicalRuns;
          p.balls += 1;
          if (physicalRuns === 4) p.fours += 1;
          if (physicalRuns === 6) p.sixes += 1;
        }
      }
    } else {
      // Legal Delivery
      if (isBye) inn.extras.byes += runVal;
      else if (isLegBye) inn.extras.legByes += runVal;
      else {
        if (batter && inn.batsmenStats[batter]) {
          const p = inn.batsmenStats[batter];
          p.runs += runVal;
          p.balls += 1;
          if (runVal === 4) p.fours += 1;
          if (runVal === 6) p.sixes += 1;
        }
      }
    }

    // --- 3. BOWLER STATS ---
    if (bowler && inn.bowlerStats[bowler]) {
      const b = inn.bowlerStats[bowler];
      let runsConceded = 0;

      if (isWide) runsConceded = runVal;
      else if (isNoBall) {
        runsConceded = 1;
        if (!isBye && !isLegBye) runsConceded += Math.max(0, runVal - 1);
      } else if (!isBye && !isLegBye) {
        runsConceded = runVal;
      }
      b.runs += runsConceded;

      // Count ball if Legal OR Override (Underarm Rule)
      const countBall = (!isWide && !isNoBall) || isLegalOverride;
      if (countBall) b.balls += 1;
    }

    // --- 4. OVER COUNT ---
    const countBall = (!isWide && !isNoBall) || isLegalOverride || ball.isValidBall;
    let isOverComplete = false;

    if (countBall) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
        isOverComplete = true;
      }
    }

    // --- 5. WICKET LOGIC ---
    if (isWicket && ball.wicketType !== "retiredhurt") {
      const victim = ball.whoOut || batter;
      const wType = ball.wicketType || "out";
      const fielder = ball.fielderName || ball.fielder || "";

      if (wType !== "retiredhurt") {
        inn.wickets += 1;
        inn.fallOfWickets.push({
          score: inn.score,
          wicketNo: inn.wickets,
          over: `${inn.over}.${inn.overBallCount}`,
          batsman: victim,
        });
      }

      if (inn.batsmenStats[victim]) {
        inn.batsmenStats[victim].out = "out";
        inn.batsmenStats[victim].wicketType = wType;
        inn.batsmenStats[victim].fielderName = fielder;

        const creditToBowler = [
          "bowled",
          "caught",
          "lbw",
          "stumped",
          "hitwicket",
        ].includes(wType);

        if (creditToBowler) {
          inn.batsmenStats[victim].bowler = bowler;
          if (inn.bowlerStats[bowler]) inn.bowlerStats[bowler].wickets += 1;
        }
      }
    }

    // --- 6. STATE RECOVERY ---
    if (index === history.length - 1) {
      // 🔥 FIX 1: Strict undefined checks so we don't accidentally override a valid 'null'
      inn.striker =
        ball.nextStriker !== undefined ? ball.nextStriker : inn.striker;
      inn.nonStriker =
        ball.nextNonStriker !== undefined
          ? ball.nextNonStriker
          : inn.nonStriker;
      inn.currentBowler =
        ball.nextBowler !== undefined ? ball.nextBowler : inn.currentBowler;

      // 🔥 FIX 2: Awaiting new batsman if EITHER slot is strictly null after a wicket
      inn.awaitingNewBatsman =
        isWicket && (inn.striker === null || inn.nonStriker === null);

      inn.awaitingNewBowler = isOverComplete;
    }
  });

  // Milestones
  Object.values(inn.batsmenStats).forEach((p) => {
    if (p.runs >= 100) {
      p.centuries = 1;
      p.fifties = 0;
      p.thirties = 0;
    } else if (p.runs >= 50) {
      p.fifties = 1;
      p.thirties = 0;
    } else if (p.runs >= 30) {
      p.thirties = 1;
    }
  });

  return inn;
}

// --- LOGIC: Apply New Ball (With Smart Survivor Logic) ---
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

  // Calculate Total Runs (Penalty + Physical)
  const totalRuns =
    isWD || isNB ? 1 + physicalRuns : parseInt(code) || physicalRuns || 0;

  const newBall = {
    id: Date.now(),
    code,
    runs: totalRuns,
    physicalRuns,
    isWicket: code === "W" || extraData.isWicket,
    isWide: isWD,
    isNoBall: isNB,
    isBye: extraData.isBye || false,
    isLegBye: extraData.isLegBye || false,
    batter: inn.striker,
    bowler: inn.currentBowler,
    isLegalOverride: extraData.isLegalOverride || false,
    whoOut: extraData.whoOut, // Critical for survivor logic
    ...extraData,
  };

  // 1. Determine positions AFTER running (crossing)
  let tempStriker = inn.striker;
  let tempNonStriker = inn.nonStriker;

  let runsForSwap = physicalRuns;
  if (!isWD && !isNB && !isNaN(parseInt(code))) {
    runsForSwap = parseInt(code);
  }

  // Swap ends if odd runs
  if (runsForSwap % 2 !== 0) {
    [tempStriker, tempNonStriker] = [tempNonStriker, tempStriker];
  }

  // 2. Identify Survivor (If Wicket)
  let nextS = tempStriker;
  let nextNS = tempNonStriker;

  if (newBall.isWicket) {
    const victim = newBall.whoOut || tempStriker; // Fallback to current striker if undefined

    // If the person currently at Striker end got out:
    if (victim === tempStriker) {
      nextS = null; // Striker slot empty (for new bat)
      nextNS = tempNonStriker; // Non-striker survives
    }
    // If the person currently at Non-Striker end got out:
    else {
      nextS = tempStriker; // Striker survives
      nextNS = null; // Non-striker slot empty (for new bat)
    }
  }

  // 3. Handle Over End Logic
  // Check legal or override
  const isLegal = (!isWD && !isNB) || newBall.isLegalOverride;
  const overEnding = inn.overBallCount + (isLegal ? 1 : 0) === 6;

  const maxOvers = parseInt(s.meta?.overs || 20);
  const isInningsFinishedByOvers = overEnding && inn.over + 1 >= maxOvers;

  if (overEnding) {
    // End of over: Swap ends.
    // If wicket fell, we simply swap the calculated survivor slots
    [nextS, nextNS] = [nextNS, nextS];
  }

  newBall.nextStriker = nextS;
  newBall.nextNonStriker = nextNS;
  newBall.nextBowler =
    overEnding && !isInningsFinishedByOvers ? null : inn.currentBowler;

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
    inn.awaitingNewBowler = false;
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

  // 🔥 IMPORTANT: Ensure we keep references to the squads
  const teamASquad = s.teamASquad || [];
  const teamBSquad = s.teamBSquad || [];

  if (!s.innings[1]) {
    s.innings[1] = {
      battingTeam: nextBat,
      bowlingTeam: nextBowl,
      score: 0,
      wickets: 0,
      over: 0,
      overBallCount: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      striker: null,
      nonStriker: null,
      currentBowler: null,
      batsmenStats: {},
      bowlerStats: {},
      timeline: [],
      fallOfWickets: [],
    };
  }

  s.currentInnings = 1;
  // 🔥 Force the match to retain the squads during the transition
  s.teamASquad = teamASquad;
  s.teamBSquad = teamBSquad;

  s.innings[1].awaitingNewBowler = false;
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

  const runScoringAction = (actionFn, queuePayload = null) => {
    performOptimisticUpdate((s) => {
      return actionFn(s);
    });

    try {
      ballTransaction(tournamentId, matchId, actionFn);

      if (queuePayload?.actionId) {
        markActionProcessed(queuePayload.actionId);
      }
    } catch (e) {
      console.error("Sync Failed", e);

      if (queuePayload && !isActionProcessed(queuePayload.actionId)) {
        addPendingAction(queuePayload);
      }
    }
  };

  const processQueuedAction = async (action) => {
    if (!action || action.type !== "scoringAction") return;
    if (isActionProcessed(action.actionId)) return;
    if (action.tournamentId !== tournamentId || action.matchId !== matchId)
      return;

    const { actionType, payload = {} } = action;

    const actionMap = {
      BALL: (s) =>
        applyBallLogic(
          s,
          payload.code,
          payload.extraData || {},
          payload.physicalRuns,
        ),
      EXTRA_BALL_RUNS: (s) =>
        applyBallLogic(
          s,
          payload.type === "wides" ? "WD" : "NB",
          {
            isWide: payload.type === "wides",
            isNoBall: payload.type === "noBalls",
          },
          payload.runs,
        ),
      NEW_BATSMAN: (s) => {
        const inn = s.innings[s.currentInnings];

        // 🔥 SMART SLOT FILLING
        if (inn.nonStriker === null) {
          inn.nonStriker = payload.player;
        } else {
          inn.striker = payload.player;
        }

        inn.awaitingNewBatsman = false;

        if (inn.timeline && inn.timeline.length > 0) {
          const lastBall = inn.timeline[inn.timeline.length - 1];
          // Update the exact slot in the timeline
          if (lastBall.nextNonStriker === null) {
            lastBall.nextNonStriker = payload.player;
          } else if (lastBall.nextStriker === null) {
            lastBall.nextStriker = payload.player;
          }
        }
        return s;
      },
      CONFIRM_BOWLER: (s) => {
        const inn = s.innings[s.currentInnings];
        inn.currentBowler = payload.player;
        inn.awaitingNewBowler = false;
        if (inn.timeline && inn.timeline.length > 0)
          inn.timeline[inn.timeline.length - 1].nextBowler = payload.player;
        return s;
      },
      CHANGE_BOWLER: (s) => {
        s.innings[s.currentInnings].currentBowler = payload.player;
        return s;
      },
      STRIKE_CHANGE: (st) => {
        const inn = st.innings[st.currentInnings];
        inn.striker = payload.striker;
        inn.nonStriker = payload.nonStriker;
        if (inn.timeline && inn.timeline.length > 0) {
          inn.timeline[inn.timeline.length - 1].nextStriker = payload.striker;
          inn.timeline[inn.timeline.length - 1].nextNonStriker =
            payload.nonStriker;
        }
        return st;
      },
      END_INNINGS: (s) => {
        s.innings[s.currentInnings].completed = true;
        checkFinishAndSetResult(s, s.currentInnings);
        return s;
      },
      UNDO: async () => {
        await undoLast(action.tournamentId, action.matchId);
      },
    };

    const handler = actionMap[actionType];
    if (!handler) return;

    if (actionType === "UNDO") {
      await handler();
      markActionProcessed(action.actionId);
      return;
    }

    await ballTransaction(action.tournamentId, action.matchId, handler);
    markActionProcessed(action.actionId);
  };

  const createQueuePayload = (actionType, payload = {}) => ({
    type: "scoringAction",
    actionType,
    payload,
    tournamentId,
    matchId,
    actionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });

  return {
    handleBall: (code, extraData, physicalRuns) =>
      runScoringAction(
        (s) => applyBallLogic(s, code, extraData, physicalRuns),
        createQueuePayload("BALL", { code, extraData, physicalRuns }),
      ),

    handleExtraBallRuns: (type, runs) =>
      runScoringAction(
        (s) =>
          applyBallLogic(
            s,
            type === "wides" ? "WD" : "NB",
            { isWide: type === "wides", isNoBall: type === "noBalls" },
            runs,
          ),
        createQueuePayload("EXTRA_BALL_RUNS", { type, runs }),
      ),

    handleNewBatsman: (p) =>
      runScoringAction(
        (s) => {
          const inn = s.innings[s.currentInnings];

          // 🔥 SMART SLOT FILLING
          if (inn.nonStriker === null) {
            inn.nonStriker = p;
          } else {
            inn.striker = p;
          }

          inn.awaitingNewBatsman = false;

          if (inn.timeline && inn.timeline.length > 0) {
            const lastBall = inn.timeline[inn.timeline.length - 1];
            // Update the exact slot in the timeline
            if (lastBall.nextNonStriker === null) {
              lastBall.nextNonStriker = p;
            } else if (lastBall.nextStriker === null) {
              lastBall.nextStriker = p;
            }
          }
          return s;
        },
        createQueuePayload("NEW_BATSMAN", { player: p }),
      ),
    handleConfirmBowler: (p) =>
      runScoringAction(
        (s) => {
          const inn = s.innings[s.currentInnings];
          inn.currentBowler = p;
          inn.awaitingNewBowler = false;
          if (inn.timeline && inn.timeline.length > 0)
            inn.timeline[inn.timeline.length - 1].nextBowler = p;
          return s;
        },
        createQueuePayload("CONFIRM_BOWLER", { player: p }),
      ),

    handleChangeBowler: (p) =>
      runScoringAction(
        (s) => {
          s.innings[s.currentInnings].currentBowler = p;
          return s;
        },
        createQueuePayload("CHANGE_BOWLER", { player: p }),
      ),

    handleStrikeChange: (s, ns) =>
      runScoringAction(
        (st) => {
          const inn = st.innings[st.currentInnings];
          inn.striker = s;
          inn.nonStriker = ns;
          if (inn.timeline && inn.timeline.length > 0) {
            inn.timeline[inn.timeline.length - 1].nextStriker = s;
            inn.timeline[inn.timeline.length - 1].nextNonStriker = ns;
          }
          return st;
        },
        createQueuePayload("STRIKE_CHANGE", { striker: s, nonStriker: ns }),
      ),

    handleEndInnings: () =>
      runScoringAction((s) => {
        s.innings[s.currentInnings].completed = true;
        checkFinishAndSetResult(s, s.currentInnings);
        return s;
      }, createQueuePayload("END_INNINGS")),

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
      const queuePayload = createQueuePayload("UNDO");
      undoLast(tournamentId, matchId)
        .then(() => markActionProcessed(queuePayload.actionId))
        .catch((e) => {
          console.error("Undo sync failed", e);
          addPendingAction(queuePayload);
        });
    },

    handleFinishMatch: async (r) => {
      await finishMatch(tournamentId, matchId, match.meta?.teamA, r);
      await syncMatchStatsToGlobalPlayers(tournamentId, matchId, match);
    },

    handleDeleteMatch: () => deleteMatch(tournamentId, matchId),
    processQueuedAction,
  };
}
