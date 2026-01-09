// src/utils/commentaryHelper.js

// --- 1. FALLBACK COMMENTARY GENERATOR (Rule-Based) ---
export const generateCommentary = (ball, batter, bowler) => {
  let runs = 0;
  let isWicket = false;
  let isWide = false;
  let isNoBall = false;

  // Handle Object vs Legacy String
  if (typeof ball === "object") {
    runs = ball.runs || 0;
    isWicket = ball.isWicket;
    isWide = ball.isWide;
    isNoBall = ball.isNoBall;
  } else {
    const s = String(ball);
    isWicket = s.includes("W") && !s.includes("WD");
    isWide = s.includes("WD");
    isNoBall = s.includes("NB");
    runs = parseInt(s) || 0;
  }

  // Phrase Bank
  const phrases = {
    six: [
      `MAXIMUM! ${batter} clears the boundary with ease!`,
      `That's massive! ${bowler} watches it sail into the crowd.`,
      `Clean strike! Six runs added to the total.`,
    ],
    four: [
      `Beautiful timing by ${batter}, races away for four.`,
      `Cracking shot! Finds the gap perfectly.`,
      `One bounce and over the rope. 4 runs.`,
    ],
    wicket: [
      `OUT! ${bowler} strikes! ${batter} has to walk back.`,
      `Gone! Clean bowled! The stumps are flying!`,
      `Up in the air... and TAKEN! A massive breakthrough.`,
    ],
    dot: [
      `Good length delivery, played defensively.`,
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

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (isWicket) return pick(phrases.wicket);
  if (runs === 6) return pick(phrases.six);
  if (runs === 4) return pick(phrases.four);
  if (isWide) return pick(phrases.wide);
  if (runs === 0 && !isWide && !isNoBall) return pick(phrases.dot);
  if (runs === 1 || runs === 2 || runs === 3) return pick(phrases.single);

  return `${runs} run${runs > 1 ? "s" : ""} added.`;
};

// --- 2. MATCH INSIGHTS & FORECASTING (Logic Engine) ---
export const getMatchInsights = (match, viewingIndex = null) => {
  if (!match || !match.innings)
    return { title: "Match Status", text: "Waiting for data..." };

  // Use the requested index (tab) or default to current live innings
  const targetIndex =
    viewingIndex !== null ? viewingIndex : match.currentInnings || 0;
  const inn = match.innings[targetIndex];
  const meta = match.meta || {};
  const isMatchFinished =
    meta.matchStatus === "finished" || match.status === "finished";

  if (!inn)
    return { title: "Pre-Match", text: "Toss done. Play starting soon." };

  // Calculate Overs & Balls
  const score = inn.score || 0;
  const wickets = inn.wickets || 0;
  const overs = inn.over || 0;
  const balls = inn.overBallCount || 0;
  const maxOvers = parseInt(meta.overs || 10);
  const totalBallsBowled = overs * 6 + balls;

  // --- 1ST INNINGS LOGIC ---
  if (targetIndex === 0) {
    // If viewing 1st innings and match is finished (or 2nd innings started)
    if (isMatchFinished || match.currentInnings > 0) {
      return {
        title: "1st Innings Complete",
        text: `${
          inn.battingTeam
        } scored ${score}/${wickets} in ${overs}.${balls} overs.\nTarget set: ${
          score + 1
        }`,
      };
    }

    // Live Projection
    const crr = totalBallsBowled > 0 ? (score / totalBallsBowled) * 6 : 0;
    const projected = Math.round(crr * maxOvers);

    if (totalBallsBowled === 0)
      return { title: "1st Innings", text: "Match just started." };

    return {
      title: `1st Innings - CRR: ${crr.toFixed(2)}`,
      text: `Projected Score: ${projected} - ${projected + 10} at this rate.\n${
        meta.teamA
      } is batting.`,
    };
  }

  // --- 2ND INNINGS LOGIC ---
  if (targetIndex === 1) {
    const inn1 = match.innings[0];
    const target = (inn1?.score || 0) + 1;
    const runsNeeded = target - score;
    const totalBallsInInnings = maxOvers * 6;
    const ballsRemaining = totalBallsInInnings - totalBallsBowled;

    // If viewing 2nd innings and match is finished -> SHOW RESULT
    if (isMatchFinished) {
      return {
        title: "🏆 Match Result",
        text:
          meta.result ||
          (match.winner ? `${match.winner} won!` : "Match Concluded"),
      };
    }

    // Live Chase Equation
    if (score >= target) {
      return {
        title: "Result",
        text: `${meta.teamB} wins by ${10 - wickets} wickets!`,
      };
    }

    const rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 99.99;

    let advice = "Keep rotating strike.";
    if (rrr > 12) advice = "Need boundaries now!";
    else if (rrr > 8) advice = "Accelerate slightly.";
    else if (rrr < 6) advice = "Easy singles will do it.";

    return {
      title: `Target: ${target}`,
      text: `Need ${runsNeeded} runs in ${ballsRemaining} balls.\nReq. Rate: ${rrr.toFixed(
        2
      )}\nCoach: "${advice}"`,
    };
  }

  return { title: "Match Status", text: "In Progress" };
};
