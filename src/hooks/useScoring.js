// src/hooks/useScoring.js
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";
import {
  addPendingAction,
  isActionProcessed,
  markActionProcessed,
} from "../utils/offlineQueue";
import { getManOfTheMatch } from "../utils/statsHelper"; // Adjust path if needed
import { getScoringAdapter } from "../services/scoringAdapters";
import { supabase } from "../utils/supabase";

// Helper: Normalize keys
const norm = (k) =>
  String(k || "")
    .trim()
    .toLowerCase();

// ✅ 1. SANITIZE SQUAD
const sanitizeSquadImages = (squad) => {
  if (!Array.isArray(squad)) return [];
  return squad.map((p) => {
    const cleanPlayer = { ...p };
    // Completely delete the image data so it doesn't bloat the match
    delete cleanPlayer.photoURL;
    delete cleanPlayer.image;
    return cleanPlayer;
  });
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
    const {
      isWicket,
      isWide,
      isNoBall,
      isBye,
      isLegBye,
      batter,
      bowler,
      isLegalOverride,
      isValidBall,
      physicalRuns,
    } = ball;

    // Initialize stats if missing
    if (batter && !inn.batsmenStats[batter])
      inn.batsmenStats[batter] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    if (bowler && !inn.bowlerStats[bowler])
      inn.bowlerStats[bowler] = { runs: 0, balls: 0, wickets: 0 };

    // 🟢 THE CORE MATH ENGINE
    let ballRunsForTeam = 0;
    let ballRunsForBatter = 0;
    const pRuns = Number(physicalRuns || 0);

    if (isWide) {
      ballRunsForTeam = 1 + pRuns;
      inn.extras.wides += 1 + pRuns;
    } else if (isNoBall) {
      ballRunsForTeam = 1 + pRuns; // 1 (NB Penalty) + whatever was ran
      inn.extras.noBalls += 1;

      if (isBye) {
        inn.extras.byes += pRuns;
      } else if (isLegBye) {
        // 🟢 LEG BYE ON NB:
        // Batter gets 0 runs, but team gets the physical runs as LB extras.
        inn.extras.legByes += pRuns;
        ballRunsForBatter = 0;
      } else {
        // Runs off bat
        ballRunsForBatter = pRuns;
      }
    } else {
      // Legal Delivery
      ballRunsForTeam = pRuns || Number(ball.runs || 0);
      if (isBye) inn.extras.byes += ballRunsForTeam;
      else if (isLegBye) inn.extras.legByes += ballRunsForTeam;
      else ballRunsForBatter = ballRunsForTeam;
    }

    // 1. Update Team Score
    inn.score += ballRunsForTeam;

    // 2. Update Batter Stats
    if (batter && inn.batsmenStats[batter]) {
      const p = inn.batsmenStats[batter];
      p.runs += ballRunsForBatter;
      // Batter faces a ball if it's NOT a Wide
      if (!isWide) p.balls += 1;
      if (ballRunsForBatter === 4) p.fours += 1;
      if (ballRunsForBatter === 6) p.sixes += 1;
    }

    // 3. Update Bowler Stats
    if (bowler && inn.bowlerStats[bowler]) {
      const b = inn.bowlerStats[bowler];
      b.runs += ballRunsForTeam; // Local rules usually charge all runs to bowler

      const countsAsLegal =
        (!isWide && !isNoBall) || isLegalOverride || isValidBall;
      if (countsAsLegal) b.balls += 1;
    }

    // 4. Over Count
    const countsAsLegal =
      (!isWide && !isNoBall) || isLegalOverride || isValidBall;
    let isOverComplete = false;
    if (countsAsLegal) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
        isOverComplete = true;
      }
    }

    // 5. Wicket Logic
    if (isWicket && ball.wicketType !== "retiredhurt") {
      const victim = ball.whoOut || batter;
      inn.wickets += 1;
      inn.fallOfWickets.push({
        score: inn.score,
        wicketNo: inn.wickets,
        over: `${inn.over}.${inn.overBallCount}`,
        batsman: victim,
      });
      if (inn.batsmenStats[victim]) {
        inn.batsmenStats[victim].out = "out";
        inn.batsmenStats[victim].wicketType = ball.wicketType;

        // 🟢 ADD THESE TWO LINES SO THE UI CAN SEE THEM:
        inn.batsmenStats[victim].fielderName =
          ball.fielderName || ball.fielder || "";
        inn.batsmenStats[victim].bowler = bowler || "";

        if (["bowled", "caught", "lbw", "stumped"].includes(ball.wicketType)) {
          if (inn.bowlerStats[bowler]) inn.bowlerStats[bowler].wickets += 1;
        }
      }
    }

    // 6. End of Ball Slot Updates
    if (index === history.length - 1) {
      inn.striker =
        ball.nextStriker !== undefined ? ball.nextStriker : inn.striker;
      inn.nonStriker =
        ball.nextNonStriker !== undefined
          ? ball.nextNonStriker
          : inn.nonStriker;
      inn.currentBowler =
        ball.nextBowler !== undefined ? ball.nextBowler : inn.currentBowler;
      inn.awaitingNewBatsman = isWicket && (!inn.striker || !inn.nonStriker);
      inn.awaitingNewBowler = isOverComplete;
    }
  });

  return inn;
}

// --- LOGIC: Apply New Ball (With Smart Survivor Logic) ---
function applyBallLogic(s, code, extraData = {}, physicalRuns = 0) {
  const inn = s.innings?.[s.currentInnings || 0];
  if (!inn || inn.completed) return s;

  // 🟢 The mid-match bouncer protecting the document size
  if (s.teamASquad) s.teamASquad = sanitizeSquadImages(s.teamASquad);
  if (s.teamBSquad) s.teamBSquad = sanitizeSquadImages(s.teamBSquad);
  if (s.meta?.teamASquad)
    s.meta.teamASquad = sanitizeSquadImages(s.meta.teamASquad);
  if (s.meta?.teamBSquad)
    s.meta.teamBSquad = sanitizeSquadImages(s.meta.teamBSquad);

  s.undoStack = s.undoStack || [];
  s.undoStack.push(createSnapshot(inn));
  if (s.undoStack.length > 50) s.undoStack.shift();

  const isWD = code === "WD" || extraData.isWide;
  const isNB = code === "NB" || extraData.isNoBall;

  // Calculate Total Runs (Penalty + Physical)
  let totalRuns = 0;
  if (isNB || isWD) {
    totalRuns = 1 + Number(physicalRuns || 0); // 1 Penalty + whatever they ran
  } else {
    // If just a wicket with no extras, totalRuns is just the physical runs completed
    totalRuns = code === "W" ? Number(physicalRuns || 0) : parseInt(code) || 0;
  }

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
    physicalRuns: Number(physicalRuns || 0),
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
  const useSupabaseScoring =
    import.meta.env.VITE_USE_SUPABASE_SCORING === "true";
  const scoringAdapter = getScoringAdapter({
    useSupabase: false, // Keep Firebase as primary write path.
    supabaseClient: supabase,
  });
  let supabaseAdapter = null;
  if (useSupabaseScoring && supabase) {
    supabaseAdapter = getScoringAdapter({
      useSupabase: true,
      supabaseClient: supabase,
    });
  }

  const buildSupabaseEventPayload = (
    actionType,
    payload = {},
    currentMatch,
  ) => {
    const inn =
      currentMatch?.innings?.[currentMatch?.currentInnings || 0] || {};
    const lastBall =
      Array.isArray(inn.timeline) && inn.timeline.length > 0
        ? inn.timeline[inn.timeline.length - 1]
        : null;

    const recalculated = {
      score: inn.score || 0,
      wickets: inn.wickets || 0,
      over: inn.over || 0,
      overBallCount: inn.overBallCount || 0,
      extras: inn.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      batsmenStats: inn.batsmenStats || {},
      bowlerStats: inn.bowlerStats || {},
      fallOfWickets: inn.fallOfWickets || [],
      awaitingNewBatsman: !!inn.awaitingNewBatsman,
      awaitingNewBowler: !!inn.awaitingNewBowler,
    };

    return {
      eventType: actionType,
      payload: {
        ...payload,
        newBall:
          actionType === "BALL" || actionType === "EXTRA_BALL_RUNS"
            ? lastBall
            : undefined,
        recalculated,
      },
    };
  };

  const performOptimisticUpdate = (actionFn) => {
    if (setMatch && match) {
      const matchDraft = JSON.parse(JSON.stringify(match));
      const updatedMatch = actionFn(matchDraft);
      updatedMatch.lastUpdate = Date.now() + 5000;
      setMatch(updatedMatch);
      return updatedMatch;
    }
    return null;
  };

  const runScoringAction = (actionFn, queuePayload = null) => {
    const optimisticState = performOptimisticUpdate((s) => {
      return actionFn(s);
    });

    try {
      scoringAdapter.ballTransaction(tournamentId, matchId, actionFn);

      if (supabaseAdapter && queuePayload?.actionType && optimisticState) {
        const supabasePayload = buildSupabaseEventPayload(
          queuePayload.actionType,
          queuePayload.payload || {},
          optimisticState,
        );
        supabaseAdapter
          .ballTransaction(tournamentId, matchId, {
            actionId: queuePayload.actionId,
            eventType: supabasePayload.eventType,
            payload: supabasePayload.payload,
          })
          .catch((err) => {
            console.error("Supabase mirror write failed:", err);
          });
      }

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

        // 🟢 FIX: Smart Slot Filling using falsy check
        if (!inn.nonStriker) {
          inn.nonStriker = payload.player;
        } else {
          inn.striker = payload.player;
        }

        inn.awaitingNewBatsman = false;

        if (inn.timeline && inn.timeline.length > 0) {
          const lastBall = inn.timeline[inn.timeline.length - 1];
          // Update the exact slot in the timeline
          if (!lastBall.nextNonStriker) {
            lastBall.nextNonStriker = payload.player;
          } else {
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
        await scoringAdapter.undoLast(action.tournamentId, action.matchId);
      },
    };

    const handler = actionMap[actionType];
    if (!handler) return;

    if (actionType === "UNDO") {
      await handler();
      markActionProcessed(action.actionId);
      return;
    }

    await scoringAdapter.ballTransaction(
      action.tournamentId,
      action.matchId,
      handler,
    );

    if (supabaseAdapter) {
      const localDraft = match ? JSON.parse(JSON.stringify(match)) : null;
      const optimisticState = localDraft ? handler(localDraft) : null;
      const supabasePayload = buildSupabaseEventPayload(
        actionType,
        payload,
        optimisticState,
      );
      await supabaseAdapter.ballTransaction(
        action.tournamentId,
        action.matchId,
        {
          actionId: action.actionId,
          eventType: supabasePayload.eventType,
          payload: supabasePayload.payload,
        },
      );
    }

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

          // 🟢 FIX: Smart Slot Filling using falsy check
          if (!inn.nonStriker) {
            inn.nonStriker = p;
          } else {
            inn.striker = p;
          }

          inn.awaitingNewBatsman = false;

          if (inn.timeline && inn.timeline.length > 0) {
            const lastBall = inn.timeline[inn.timeline.length - 1];
            if (!lastBall.nextNonStriker) {
              lastBall.nextNonStriker = p;
            } else {
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
      scoringAdapter
        .undoLast(tournamentId, matchId)
        .then(() => markActionProcessed(queuePayload.actionId))
        .catch((e) => {
          console.error("Undo sync failed", e);
          addPendingAction(queuePayload);
        });

      if (supabaseAdapter) {
        supabaseAdapter
          .undoLast(tournamentId, matchId, queuePayload.actionId)
          .catch((err) => console.error("Supabase undo mirror failed:", err));
      }
    },

    handleFinishMatch: async (r, mustBeFromWinningTeam = true) => {
      const mom = getManOfTheMatch(match, mustBeFromWinningTeam);
      await scoringAdapter.finishMatch(
        tournamentId,
        matchId,
        match.meta?.teamA,
        r,
        mom,
      );

      if (supabaseAdapter) {
        await supabaseAdapter.finishMatch(
          tournamentId,
          matchId,
          match.meta?.teamA,
          r,
          mom,
          { actionId: `finish-${Date.now()}` },
        );
      }

      // 3. Sync player stats
      await syncMatchStatsToGlobalPlayers(tournamentId, matchId, match);
    },

    handleDeleteMatch: async () => {
      await scoringAdapter.deleteMatch(tournamentId, matchId);
      if (supabaseAdapter) {
        await supabaseAdapter.deleteMatch(tournamentId, matchId);
      }
    },
    processQueuedAction,
  };
}
