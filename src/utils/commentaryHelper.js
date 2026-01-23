// src/utils/commentaryHelper.js

// --- 0. COMMENTARY SLANG DICTIONARY ---
const SLANG = {
  boundary: [
    "CRACKED!",
    "TIMED TO PERFECTION!",
    "TOP SHOT!",
    "PIERCED THE GAP!",
    "RACING AWAY!",
    "BEAUTIFUL STROKE!"
  ],
  six: [
    "ALL THE WAY!",
    "HUGE!",
    "OUT OF THE PARK!",
    "MAJESTIC!",
    "INTO THE STANDS!",
    "MAXIMUM!"
  ],
  dot: [
    "Solid defense.",
    "No run.",
    "Straight to the fielder.",
    "Beaten!",
    "Good line and length.",
    "Respect shown to the bowler."
  ],
  wicket: [
    "GONE!",
    "BITES THE DUST!",
    "BIG WICKET!",
    "HUGE BLOW!",
    "WALKING BACK!",
    "CLEANED HIM UP!"
  ],
  maiden: [
    "Maiden over! What a spell!",
    "Six dots in a row! Pressure is building!",
    "Absolute gold dust in this format!",
    "The batter had no answers there."
  ],
  expensive: [
    "Expensive over! The batter is shifting gears!",
    "Costly one for the bowler.",
    "Big over! Momentum shifting to the batting side!",
    "Leakage of runs here!"
  ],
  running: [
    "Good running!",
    "Quick single.",
    "They push hard for it.",
    "Excellent communication between the wickets."
  ]
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- 1. DETERMINISTIC COMMENTARY ENGINE (The Brain) ---
/**
 * Generates instant commentary based on the ball data and recent history.
 * @param {Object} ball - Current ball object
 * @param {Array} last6Balls - (Optional) Array of last 6 balls for momentum checks
 * @param {String} batterName - Name of striker
 * @param {String} bowlerName - Name of bowler
 */
export const getDeterministicCommentary = (ball, last6Balls = [], batterName = null, bowlerName = null) => {
  if (!ball) return "";

  // 1. Data Normalization
  const batter = batterName || ball.batter || "The batter";
  const bowler = bowlerName || ball.bowler || "The bowler";
  const runs = ball.runs || 0;
  const physical = (ball.physicalRuns !== undefined) ? ball.physicalRuns : (runs - (ball.isWide || ball.isNoBall ? 1 : 0));
  
  const { isWicket, isWide, isNoBall, isBye, isLegBye, wicketType } = ball;

  // --- 2. MOMENTUM CHECKS (End of Over) ---
  // If this ball completes an over (overBallCount === 0), check the context
  if (ball.overBallCount === 0 && last6Balls && last6Balls.length >= 6) {
    // Grab strictly the last 6 balls (the current over)
    const validBalls = last6Balls.slice(-6); 
    const totalRunsInOver = validBalls.reduce((acc, b) => acc + (b.runs || 0), 0);
    const wicketsInOver = validBalls.filter(b => b.isWicket).length;
    const isMaiden = totalRunsInOver === 0 && !validBalls.some(b => b.isWide || b.isNoBall);

    // Maiden Over
    if (isMaiden) {
      return `${getRandom(SLANG.maiden)} ${bowler} has tied them down completely.`;
    }
    // Double Wicket Over
    if (wicketsInOver >= 2) {
      return `Double strike! ${bowler} turns the game on its head with ${wicketsInOver} wickets in this over!`;
    }
    // Expensive Over (15+ runs)
    if (totalRunsInOver >= 15) {
      return `${getRandom(SLANG.expensive)} ${totalRunsInOver} runs off the over. ${batter} is on fire!`;
    }
  }

  // --- 3. WICKET EVENTS ---
  if (isWicket) {
    const prefix = getRandom(SLANG.wicket);
    if (isWide || isNoBall) {
      return `DRAMA! ${isWide ? "Wide" : "No Ball"} called, but there's a RUN OUT! ${batter} falls amidst the confusion.`;
    }
    switch (wicketType) {
      case 'bowled': return `${prefix} Clean bowled! ${bowler} crashes through the defenses of ${batter}!`;
      case 'caught': return `${prefix} ${batter} tries to clear the field but finds the fielder! Simple catch.`;
      case 'runout': return `${prefix} Sharp work in the field! ${batter} is caught short of the crease.`;
      case 'lbw': return `${prefix} Plumb in front! Up goes the finger. ${bowler} gets the breakthrough.`;
      case 'stumped': return `${prefix} Deceived in flight! The keeper whips the bails off. ${batter} is gone.`;
      default: return `${prefix} ${batter} has to walk back. Big wicket for ${bowler}!`;
    }
  }

  // --- 4. EXTRAS ---
  if (isNoBall) {
    if (physical === 6) return `NO BALL! And ${batter} punishes it! Massive SIX over the ropes! Free hit coming up.`;
    if (physical === 4) return `NO BALL! ${batter} finds the gap for FOUR! Costly error by ${bowler}.`;
    return `Front foot over the line! No ball called. Free hit loading...`;
  }

  if (isWide) {
    if (physical >= 4) return `WIDE! And it races away to the boundary for ${physical} runs! Bonus runs for the batting side.`;
    return `Wide ball. ${bowler} loses their radar outside off.`;
  }

  if (isBye || isLegBye) {
    const type = isBye ? "Byes" : "Leg Byes";
    if (physical >= 4) return `The keeper misses it! ${physical} ${type} down to the boundary.`;
    return `${physical} ${type} taken. Good alertness by the batsmen.`;
  }

  // --- 5. STANDARD RUNS (With Slang) ---
  if (runs === 0) {
    return `${getRandom(SLANG.dot)} ${bowler} keeping things tight.`;
  }
  if (runs === 1) {
    return `Tucked away for a single. ${batter} rotates the strike.`;
  }
  if (runs === 2) {
    return `${getRandom(SLANG.running)} ${batter} pushes hard and gets back for two.`;
  }
  if (runs === 3) {
    return `Great placement! Deep fielders have to chase, and they come back for three.`;
  }
  if (runs === 4) {
    return `${getRandom(SLANG.boundary)} ${batter} finds the rope with a beautiful stroke!`;
  }
  if (runs === 6) {
    return `${getRandom(SLANG.six)} ${batter} launches that over the boundary! What a hit!`;
  }

  // Fallback
  return `${runs} run${runs > 1 ? "s" : ""} added to the score.`;
};

// --- LEGACY WRAPPER (To prevent breaking existing imports) ---
export const generateCommentary = (ball, batter, bowler) => {
  return getDeterministicCommentary(ball, [], batter, bowler);
};

// --- 2. LIVE UI NARRATIVE (Preserved) ---
export const getLiveNarrative = (match, m) => {
  if (!match || !m) return "⚡ System ready. Awaiting match actions...";

  if (match.meta?.toss?.winner && m.over === 0 && m.overBallCount === 0 && (!m.timeline || m.timeline.length === 0)) {
    return `📢 ${match.meta.toss.winner} won the toss and elected to ${match.meta.toss.decision} first.`;
  }

  if (match.status === "finished") {
    return `🏆 Match Concluded. ${match.meta?.result || "Check scorecard for details."}`;
  }

  if (!m.striker || !m.nonStriker) return "🏏 Waiting for batsmen to take position...";
  if (!m.currentBowler) return "🥎 Setting up the bowler for the next over...";

  if (m.awaitingNewBatsman) return `☝️ Wicket! A big blow for ${m.battingTeam}. Waiting for the new batsman...`;
  if (m.awaitingNewBowler) return `🥎 Over complete. ${m.currentBowler} finishes a good over. Change of ends...`;

  return `🏏 ${m.striker} is on strike, ${m.nonStriker} at non-striker's end. ${m.currentBowler} bowling.`;
};

// --- 3. MATCH INSIGHTS & FORECASTING (Preserved) ---
export const getMatchInsights = (match, viewingIndex = null) => {
  if (!match || !match.innings)
    return { title: "Match Status", text: "Waiting for data..." };

  const targetIndex = viewingIndex !== null ? viewingIndex : match.currentInnings || 0;
  const inn = match.innings[targetIndex];
  const meta = match.meta || {};
  const isMatchFinished = meta.matchStatus === "finished" || match.status === "finished";

  if (!inn) return { title: "Pre-Match", text: "Toss done. Play starting soon." };

  const score = inn.score || 0;
  const wickets = inn.wickets || 0;
  const overs = inn.over || 0;
  const balls = inn.overBallCount || 0;
  const maxOvers = parseInt(meta.overs || 10);
  const totalBallsBowled = overs * 6 + balls;

  if (targetIndex === 0) {
    if (isMatchFinished || match.currentInnings > 0) {
      return {
        title: "1st Innings Complete",
        text: `${inn.battingTeam} scored ${score}/${wickets} in ${overs}.${balls} overs.\nTarget set: ${score + 1}`,
      };
    }
    const crr = totalBallsBowled > 0 ? (score / totalBallsBowled) * 6 : 0;
    const projected = Math.round(crr * maxOvers);
    if (totalBallsBowled === 0) return { title: "1st Innings", text: "Match just started." };
    return { title: `1st Innings - CRR: ${crr.toFixed(2)}`, text: `Projected Score: ${projected} - ${projected + 10} at this rate.` };
  }

  if (targetIndex === 1) {
    const inn1 = match.innings[0];
    const target = (inn1?.score || 0) + 1;
    const runsNeeded = target - score;
    const totalBallsInInnings = maxOvers * 6;
    const ballsRemaining = totalBallsInInnings - totalBallsBowled;

    if (isMatchFinished) {
      return { title: "🏆 Match Result", text: meta.result || "Match Concluded" };
    }
    if (score >= target) {
      return { title: "Result", text: `${meta.teamB} wins!` };
    }
    const rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 99.99;
    let advice = "Keep rotating strike.";
    if (rrr > 12) advice = "Need boundaries now!";
    else if (rrr > 8) advice = "Accelerate slightly.";
    return { title: `Target: ${target}`, text: `Need ${runsNeeded} runs in ${ballsRemaining} balls.\nReq. Rate: ${rrr.toFixed(2)}\nCoach: "${advice}"` };
  }
  return { title: "Match Status", text: "In Progress" };
};