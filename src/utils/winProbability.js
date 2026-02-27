export const calculateWinProbability = (match) => {
  if (!match || !match.innings) return { bat: 50, bowl: 50 };

  const activeIndex = match.currentInnings || 0;
  const isSecondInnings = activeIndex === 1;
  const currentInn = match.innings[activeIndex];
  const inn1 = match.innings[0];

  const totalOvers = parseInt(match.meta?.overs || 20);
  const totalWickets = parseInt(match.meta?.totalWickets || 10);
  const totalBalls = totalOvers * 6;
  const ballsBowled = currentInn.over * 6 + currentInn.overBallCount;

  let batProb = 50;

  if (!isSecondInnings) {
    // --- 1ST INNINGS LOGIC ---
    if (ballsBowled === 0) return { bat: 50, bowl: 50 };

    const crr = currentInn.score / (ballsBowled / 6);
    const expectedScore = crr * totalOvers;
    const parScore = totalOvers * 8.5; // Assume 8.5 RPO is an average par score

    // Gain/Lose 1% for every 2 runs above or below par
    let scoreShift = (expectedScore - parScore) / 2;

    // Wicket impact: Compare actual wickets lost vs expected wickets lost by this over
    const expectedWicketsLost = (ballsBowled / totalBalls) * totalWickets;
    const wicketShift = (expectedWicketsLost - currentInn.wickets) * 3; // 3% swing per wicket

    batProb = 50 + scoreShift + wicketShift;
  } else {
    // --- 2ND INNINGS LOGIC ---
    const target = inn1.score + 1;
    const runsNeeded = target - currentInn.score;
    const ballsRemaining = totalBalls - ballsBowled;
    const wicketsRemaining = totalWickets - currentInn.wickets;

    // Instant Win/Loss conditions
    if (runsNeeded <= 0) return { bat: 99, bowl: 1 };
    if (wicketsRemaining <= 0 || ballsRemaining <= 0)
      return { bat: 1, bowl: 99 };

    const rrr = runsNeeded / (ballsRemaining / 6);

    // Average achievable RRR is around 8.5. If it's higher, pressure is on batters.
    const pressureIndex = rrr - 8.5;
    let rrrShift = -pressureIndex * 4; // 4% penalty for every run above 8.5 RRR

    // Wickets matter exponentially more in the 2nd innings
    const expectedWicketsLeft = (ballsRemaining / totalBalls) * totalWickets;
    const wicketShift = (wicketsRemaining - expectedWicketsLeft) * 6;

    batProb = 50 + rrrShift + wicketShift;
  }

  // Clamp probabilities between 1% and 99% to look realistic
  batProb = Math.max(1, Math.min(99, Math.round(batProb)));
  const bowlProb = 100 - batProb;

  return { bat: batProb, bowl: bowlProb };
};
