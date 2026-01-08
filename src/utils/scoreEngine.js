// src/utils/scoreEngine.js

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
  };

  // Helper to init player stats
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

  timeline.forEach((ball) => {
    // 1. Extract Data
    // Handle both old string format ("1", "WD") and new Object format
    let ballData = {};
    if (typeof ball === "string") {
      // Legacy support
      ballData = { runs: parseInt(ball) || 0, isWicket: ball === "W" };
      if (ball.includes("WD")) {
        ballData.isWide = true;
        ballData.runs = 1;
      }
      if (ball.includes("NB")) {
        ballData.isNoBall = true;
        ballData.runs = 1;
      }
    } else {
      ballData = ball;
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
    } = ballData;
    const currentStriker = ballData.batter || stats.striker;
    const currentBowler = ballData.bowler || stats.currentBowler;

    initBat(currentStriker);
    initBowl(currentBowler);

    // 2. Logic Flags
    // A ball is "Legal" (counts towards over) if it's NOT Wide and NOT No-Ball
    const isLegalBall = !isWide && !isNoBall;

    // A ball counts as "faced" by batsman if it's Legal OR it's a No-Ball (Batsman plays NB, but it doesn't count to over)
    // Wait! Standard Rule: No Ball does NOT count as ball faced for strike rate usually,
    // BUT runs scored off bat on NB DO count.
    // The Review suggested: "No-ball... incorrectly increments batsman's balls faced".
    // FIX: We will ONLY increment balls faced if isLegalBall is true.
    // (Note: This depends on specific tournament rules, but standard is NB doesn't count as ball faced).

    // 3. Calculate Runs
    let batterRuns = 0;
    let bowlerRuns = 0;
    let totalBallRuns = 0;

    if (isWide) {
      stats.extras.wides += 1 + runs; // 1 wide + extra runs
      bowlerRuns += 1 + runs;
      totalBallRuns += 1 + runs;
      // Batter gets 0 runs, 0 balls
    } else if (isNoBall) {
      stats.extras.noBalls += 1;
      bowlerRuns += 1; // Penalty
      totalBallRuns += 1;

      // Runs off bat during NB
      if (isBye) {
        stats.extras.byes += runs;
        totalBallRuns += runs;
      } else if (isLegBye) {
        stats.extras.legByes += runs;
        totalBallRuns += runs;
      } else {
        batterRuns += runs; // Runs off bat
        bowlerRuns += runs; // Bowler hit for runs
        totalBallRuns += runs;
      }
    } else {
      // Legal Delivery
      if (isBye) {
        stats.extras.byes += runs;
        totalBallRuns += runs;
      } else if (isLegBye) {
        stats.extras.legByes += runs;
        totalBallRuns += runs;
      } else {
        batterRuns += runs;
        bowlerRuns += runs;
        totalBallRuns += runs;
      }
    }

    // 4. Update Stats
    stats.score += totalBallRuns;

    if (currentStriker) {
      stats.batsmenStats[currentStriker].runs += batterRuns;
      // ✅ FIX: Only increment balls faced if it is a LEGAL delivery (No Wides, No NBs)
      if (isLegalBall) {
        stats.batsmenStats[currentStriker].balls += 1;
      }
      if (batterRuns === 4) stats.batsmenStats[currentStriker].fours += 1;
      if (batterRuns === 6) stats.batsmenStats[currentStriker].sixes += 1;
    }

    if (currentBowler) {
      stats.bowlerStats[currentBowler].runs += bowlerRuns;
      // Only legal balls count for bowler's over count
      if (isLegalBall) {
        stats.bowlerStats[currentBowler].balls += 1;
      }
    }

    // 5. Wickets
    if (isWicket) {
      stats.wickets += 1;
      const victim = outBatsman || currentStriker;
      if (stats.batsmenStats[victim]) {
        stats.batsmenStats[victim].out = wicketType || "out";
      }

      // Run outs don't count for bowler
      if (wicketType !== "runout" && currentBowler) {
        stats.bowlerStats[currentBowler].wickets += 1;
      }

      stats.fallOfWickets.push({
        score: stats.score,
        wicketNo: stats.wickets,
        batsman: victim,
        over: `${stats.over}.${stats.overBallCount + (isLegalBall ? 1 : 0)}`, // Approx
      });
    }

    // 6. Over Count
    if (isLegalBall) {
      stats.overBallCount += 1;
      if (stats.overBallCount === 6) {
        stats.over += 1;
        stats.overBallCount = 0;
      }
    }
  });

  return stats;
};
