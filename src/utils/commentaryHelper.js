// src/utils/commentaryHelper.js

// --- 1. AI COMMENTARY GENERATOR ---
export const generateCommentary = (ball, batter, bowler) => {
  // Handle Legacy String format ("1", "WD", "W")
  let runs = 0;
  let isWicket = false;
  let isWide = false;
  let isNoBall = false;
  let isBoundary = false;

  if (typeof ball === "string") {
    isWicket = ball.includes("W") && !ball.includes("WD");
    isWide = ball.includes("WD");
    isNoBall = ball.includes("NB");
    runs = parseInt(ball) || 0;
  } else {
    // Handle Object format
    runs = ball.runs || 0;
    isWicket = ball.isWicket;
    isWide = ball.isWide;
    isNoBall = ball.isNoBall;
  }

  if (runs === 4) isBoundary = true;
  if (runs === 6) isBoundary = true;

  // --- PHRASE BANK ---
  const phrases = {
    six: [
      `MAXIMUM! ${batter} clears the boundary with ease!`,
      `That's massive! ${bowler} watches it sail into the crowd.`,
      `Clean strike! Six runs added to the total.`,
      `Pick that one up from the parking lot! 6 Runs!`,
    ],
    four: [
      `Beautiful timing by ${batter}, races away for four.`,
      `Cracking shot! Finds the gap perfectly.`,
      `One bounce and over the rope. 4 runs.`,
      `Poor delivery from ${bowler} and punished appropriately.`,
    ],
    wicket: [
      `OUT! ${bowler} strikes! ${batter} has to walk back.`,
      `Gone! Clean bowled! The stumps are flying!`,
      `Up in the air... and TAKEN! A massive breakthrough.`,
      `Run out! A tragedy of errors between the wickets.`,
    ],
    dot: [
      `Good length delivery, played defensively.`,
      `Swing and a miss! ${bowler} getting some movement.`,
      `Straight to the fielder, no run.`,
      `Solid defense from ${batter}.`,
    ],
    single: [
      `Pushed into the gap for a single.`,
      `Quick run taken, good calling.`,
      `Rotating the strike.`,
    ],
    wide: [
      `Wide ball. ${bowler} loses their line.`,
      `Way outside off, umpire signals wide.`,
    ],
  };

  // --- SELECTOR LOGIC ---
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (isWicket) return pick(phrases.wicket);
  if (runs === 6) return pick(phrases.six);
  if (runs === 4) return pick(phrases.four);
  if (isWide) return pick(phrases.wide);
  if (runs === 0 && !isWide && !isNoBall) return pick(phrases.dot);
  if (runs === 1 || runs === 2 || runs === 3) return pick(phrases.single);

  return `${runs} run${runs > 1 ? "s" : ""} added to the score.`;
};

// --- 2. MATCH INSIGHTS & FORECASTING ---
export const getMatchInsights = (match) => {
  if (!match || !match.innings) return null;

  const currentIdx = match.currentInnings || 0;
  const inn = match.innings[currentIdx];
  if (!inn) return null;

  const oversBowled = inn.over + inn.overBallCount / 6;
  const totalOvers = parseFloat(match.meta?.overs || 10); // Default to 10 if missing
  const crr = oversBowled > 0 ? (inn.score / oversBowled).toFixed(2) : 0;

  // SCENARIO 1: First Innings (Projected Score)
  if (currentIdx === 0) {
    if (oversBowled === 0)
      return {
        type: "info",
        text: "Match just started. Looking for a solid foundation.",
      };

    const projScore = Math.round(crr * totalOvers);
    const aggressiveScore = Math.round((parseFloat(crr) + 2) * totalOvers); // If they accelerate

    return {
      type: "projection",
      title: "🔎 Projected Score",
      text: `At current rate (${crr}), projected score is ${projScore}. If they accelerate, they could reach ${aggressiveScore}.`,
    };
  }

  // SCENARIO 2: Second Innings (Chase Guidance)
  if (currentIdx === 1) {
    const target = match.meta?.target || 0;
    const runsNeeded = target - inn.score;
    const ballsRemaining = totalOvers * 6 - (inn.over * 6 + inn.overBallCount);

    if (runsNeeded <= 0)
      return {
        type: "success",
        text: "Match Won! Target chased successfully.",
      };
    if (ballsRemaining <= 0)
      return { type: "error", text: "Innings Complete. Target missed." };

    const rrr = ((runsNeeded / ballsRemaining) * 6).toFixed(2);

    // AI "Coach" Logic
    let advice = "";
    if (rrr < 6) {
      advice = "Sensible batting required. Ones and twos will do it.";
    } else if (rrr < 10) {
      advice = "Needs a boundary every over to keep up.";
    } else if (rrr < 15) {
      advice = "High pressure! Needs 2 boundaries per over.";
    } else {
      advice = "Miracle needed. Every ball must go to the fence.";
    }

    return {
      type: "chase",
      title: "🎯 Chase Equation",
      text: `Need ${runsNeeded} runs off ${ballsRemaining} balls. RRR: ${rrr}.`,
      subText: `Coach says: "${advice}"`,
    };
  }

  return null;
};
