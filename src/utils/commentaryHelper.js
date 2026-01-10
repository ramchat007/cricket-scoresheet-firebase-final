// src/utils/commentaryHelper.js

// --- 1. SMART COMMENTARY GENERATOR ---
export const generateCommentary = (ball, batter, bowler) => {
  if (!ball) return "";

  // Handle Object structure from new engine
  const runs = ball.runs || 0;
  // Fallback to 0 if physicalRuns isn't set (legacy support)
  const physical = (ball.physicalRuns !== undefined) ? ball.physicalRuns : 0;
  
  const isWicket = ball.isWicket;
  const isWide = ball.isWide;
  const isNB = ball.isNoBall;
  const isB = ball.isBye;
  const isLB = ball.isLegBye;

  // --- WICKET SCENARIOS ---
  if (isWicket) {
    if (isNB) return `NO BALL! But disaster strikes! There's a RUN OUT! ${batter} has to walk back.`;
    if (isWide) return `WIDE ball, but the batsmen get mixed up... RUN OUT! ${batter} is gone!`;
    if (ball.wicketType === "bowled") return `BOWLED HIM! ${bowler} crashes through the defenses of ${batter}!`;
    if (ball.wicketType === "caught") return `EDGED AND TAKEN! ${bowler} gets the wicket of ${batter}.`;
    if (ball.wicketType === "lbw") return `Up goes the finger! ${batter} is trapped LBW by ${bowler}.`;
    return `OUT! ${bowler} strikes! ${batter} is walking back to the pavilion.`;
  }

  // --- NO BALL SCENARIOS ---
  if (isNB) {
    if (physical === 6) return `NO BALL! And ${batter} punishes it! Massive SIX over the ropes! (7 runs total)`;
    if (physical === 4) return `NO BALL! ${batter} finds the gap for FOUR! Costly error by ${bowler}.`;
    if (physical > 0) return `NO BALL! They scramble for ${physical} run${physical > 1 ? 's' : ''} off the extra delivery.`;
    return `NO BALL! ${bowler} oversteps. Free hit coming up.`;
  }

  // --- WIDE SCENARIOS ---
  if (isWide) {
    if (physical >= 4) return `WIDE! And it races away to the boundary for ${physical} byes! 5 runs to the total.`;
    if (physical > 0) return `WIDE! It beats the keeper and they steal ${physical} extra run${physical > 1 ? 's' : ''}.`;
    return `Wide ball. ${bowler} loses their line outside off.`;
  }

  // --- BYES / LEG BYES ---
  if (isB || isLB) {
    const type = isB ? "Byes" : "Leg Byes";
    if (physical >= 4) return `The keeper misses it! ${physical} ${type} to the boundary.`;
    return `${physical} ${type} taken. Good alertness by the batsmen.`;
  }

  // --- STANDARD RUNS ---
  if (runs === 6) return `MAXIMUM! ${batter} launches ${bowler} into the stands! What a shot!`;
  if (runs === 4) return `FOUR! Beautifully timed by ${batter}, it races away to the fence.`;
  if (runs === 3) return `Good running! They push hard and come back for a three.`;
  if (runs === 2) return `Played into the gap, easy two runs for ${batter}.`;
  if (runs === 1) return `Single taken. ${batter} rotates the strike.`;
  if (runs === 0) return `Good length delivery from ${bowler}, played defensively. Dot ball.`;

  return `${runs} run${runs > 1 ? "s" : ""} added to the score.`;
};

// --- 2. LIVE UI NARRATIVE (Preserved) ---
export const getLiveNarrative = (match, m) => {
  if (!match || !m) return "⚡ System ready. Awaiting match actions...";

  if (match.meta?.toss?.winner && m.over === 0 && m.overBallCount === 0 && (!m.timeline || m.timeline.length === 0)) {
    return `📢 ${match.meta.toss.winner} won the toss and elected to ${match.meta.toss.decision} first.`;
  }

  if (!m.striker || !m.nonStriker) return "🏏 Waiting for batsmen to take position...";
  if (!m.currentBowler) return "🥎 Setting up the bowler for the next over...";

  if (m.awaitingNewBatsman) return `☝️ Wicket! A big blow for ${m.battingTeam}. Waiting for the new batsman...`;
  if (m.awaitingNewBowler) return `🥎 Over complete. ${m.currentBowler} finishes a good over. Change of ends...`;

  return `🏏 ${m.striker} is on strike, ${m.nonStriker} at the non-striker's end. ${m.currentBowler} is ready to bowl.`;
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