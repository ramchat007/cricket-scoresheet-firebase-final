// src/utils/scoreEngine.js

/**
 * 🧠 THE CORE CALCULATION ENGINE
 * This function takes the full history (timeline) and calculates the exact score,
 * stats, and current match state from scratch.
 */
export const calculateMatchStats = (timeline, matchMeta) => {
  const stats = {
    score: 0,
    wickets: 0,
    over: 0,
    overBallCount: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    batsmenStats: {},
    bowlerStats: {},
    fallOfWickets: [],
    striker: matchMeta?.initialStriker || "",
    nonStriker: matchMeta?.initialNonStriker || "",
    currentBowler: matchMeta?.initialBowler || "",
    battingOrder: [],
    awaitingNewBatsman: false, // ✅ Added for UI recovery
    awaitingNewBowler: false, // ✅ Added for UI recovery
  };

  const initBat = (name) => {
    if (!name) return;
    if (!stats.batsmenStats[name]) {
      stats.batsmenStats[name] = {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: null,
      };
      if (!stats.battingOrder.includes(name)) stats.battingOrder.push(name);
    }
  };
  const initBowl = (name) => {
    if (!name) return;
    if (!stats.bowlerStats[name]) {
      stats.bowlerStats[name] = { runs: 0, balls: 0, wickets: 0, maidens: 0 };
    }
  };

  timeline.forEach((ball, index) => {
    // 1. Extract Data
    let ballData = typeof ball === "string" ? {} : ball;
    if (typeof ball === "string") {
      ballData = { runs: parseInt(ball) || 0, isWicket: ball === "W" };
      if (ball.includes("WD")) {
        ballData.isWide = true;
        ballData.runs = 1;
      }
      if (ball.includes("NB")) {
        ballData.isNoBall = true;
        ballData.runs = 1;
      }
    }

    const {
      runs = 0,
      isWide,
      isNoBall,
      isWicket,
      isBye,
      isLegBye,
      wicketType,
      outBatsman,
      physicalRuns = 0,
    } = ballData;

    // ✅ CRITICAL: Replay the history using the batter/bowler recorded at the time
    // If not found in ball data, fall back to current calculated state
    const currentStriker = ballData.striker?.name || ballData.batter || (typeof stats.striker === 'object' ? stats.striker.name : stats.striker);
    const currentBowler = ballData.bowler?.name || ballData.bowler || (typeof stats.currentBowler === 'object' ? stats.currentBowler.name : stats.currentBowler);

    initBat(currentStriker);
    initBowl(currentBowler);

    const isLegalBall = !isWide && !isNoBall;

    // 2. Calculate Runs
    let batterRuns = 0;
    let bowlerRuns = 0;
    let totalBallRuns = 0;

    if (isWide) {
      stats.extras.wides += 1 + runs;
      bowlerRuns += 1 + runs;
      totalBallRuns += 1 + runs;
    } else if (isNoBall) {
      stats.extras.noBalls += 1;
      bowlerRuns += 1;
      totalBallRuns += 1;
      if (isBye) stats.extras.byes += runs;
      else if (isLegBye) stats.extras.legByes += runs;
      else {
        batterRuns += runs;
        bowlerRuns += runs;
      }
      totalBallRuns += runs;
    } else {
      if (isBye) stats.extras.byes += runs;
      else if (isLegBye) stats.extras.legByes += runs;
      else {
        batterRuns += runs;
        bowlerRuns += runs;
      }
      totalBallRuns += runs;
    }

    // 3. Update Stats
    stats.score += totalBallRuns;
    if (currentStriker) {
      stats.batsmenStats[currentStriker].runs += batterRuns;
      if (isLegalBall || isNoBall)
        stats.batsmenStats[currentStriker].balls += 1; // Standard: NB counts as ball faced
      if (batterRuns === 4) stats.batsmenStats[currentStriker].fours += 1;
      if (batterRuns === 6) stats.batsmenStats[currentStriker].sixes += 1;
    }
    if (currentBowler) {
      stats.bowlerStats[currentBowler].runs += bowlerRuns;
      if (isLegalBall) stats.bowlerStats[currentBowler].balls += 1;
    }

    // 4. Wickets
    if (isWicket) {
      stats.wickets += 1;
      const victim = outBatsman || currentStriker;
      if (stats.batsmenStats[victim])
        stats.batsmenStats[victim].out = wicketType || "out";
      if (
        wicketType !== "runout" &&
        wicketType !== "retiredhurt" &&
        currentBowler
      )
        stats.bowlerStats[currentBowler].wickets += 1;
      stats.fallOfWickets.push({
        score: stats.score,
        wicketNo: stats.wickets,
        batsman: victim,
        over: `${stats.over}.${stats.overBallCount + (isLegalBall ? 1 : 0)}`,
      });
    }

    // 5. Strike Rotation Logic (The "Heart" Fix)
    // We only perform rotation if it's NOT the last ball, OR if we have the explicit next states
    if (ballData.nextStriker) stats.striker = ballData.nextStriker;
    if (ballData.nextNonStriker) stats.nonStriker = ballData.nextNonStriker;
    if (ballData.nextBowler) stats.currentBowler = ballData.nextBowler;
    
    // Fallback: If no explicit next state, calculate based on runs
    if (!ballData.nextStriker && !ballData.nextNonStriker) {
      let shouldSwap = (physicalRuns || batterRuns) % 2 !== 0;
      if (shouldSwap) {
        const temp = stats.striker;
        stats.striker = stats.nonStriker;
        stats.nonStriker = temp;
      }
    }

    // 6. Over Count & Over End Rotation
    if (isLegalBall) {
      stats.overBallCount += 1;
      if (stats.overBallCount === 6) {
        stats.over += 1;
        stats.overBallCount = 0;

        // ✅ Only rotate strike on over end if NO wicket fell on this ball
        if (!isWicket && !ballData.nextStriker) {
          const temp = stats.striker;
          stats.striker = stats.nonStriker;
          stats.nonStriker = temp;
        }
      }
    }

    // 7. UI Flag Recovery (For the final ball in the timeline)
    if (index === timeline.length - 1) {
      stats.awaitingNewBatsman = isWicket && !ballData.nextStriker;
      stats.awaitingNewBowler =
        stats.overBallCount === 0 && stats.over > 0 && isLegalBall;
    }
  });

  return stats;
};


/**
 * 🛠️ DATA HELPER
 * Standardizes the Ball Object before it goes into the timeline.
 * This is used by ScoreInput.jsx to keep data clean.
 */
export const createBallObject = (data, currentContext) => {
    return {
        // Core Scoring Data
        runs: data.runs || 0,
        extras: data.extras || 0,
        isWide: data.isWide || false,
        isNoBall: data.isNoBall || false,
        extraType: data.extraType || null,
        
        // Wicket Data
        isWicket: data.isWicket || false,
        wicketType: data.wicketType || null,
        playerOutId: data.playerOutId || null,
        
        // Context Snapshots (Who did what)
        striker: currentContext.striker, 
        nonStriker: currentContext.nonStriker,
        bowler: currentContext.bowler,
        
        // Timestamps & Meta
        timestamp: new Date().toISOString()
    };
};