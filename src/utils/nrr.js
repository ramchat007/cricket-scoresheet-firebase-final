export const oversToBalls = (over = 0, ballCount = 0) => {
  const o = Number(over || 0);
  const b = Number(ballCount || 0);
  return Math.max(0, o * 6 + b);
};

export const inningsBallsFaced = (
  innings = {},
  {
    maxOvers = 20,
    totalWickets = 10,
    treatAllOutAsFullQuota = true,
  } = {},
) => {
  const actualBalls = oversToBalls(innings.over, innings.overBallCount);
  const fullQuotaBalls = Number(maxOvers || 20) * 6;
  const wickets = Number(innings.wickets || 0);
  const isAllOut = innings.isAllOut || wickets >= Number(totalWickets || 10);

  if (treatAllOutAsFullQuota && isAllOut) return fullQuotaBalls;
  return actualBalls;
};

export const calculateNRR = ({
  runsScored = 0,
  ballsFaced = 0,
  runsConceded = 0,
  ballsBowled = 0,
} = {}) => {
  if (!ballsFaced) return "0.000";
  const runRateFor = (Number(runsScored || 0) / Number(ballsFaced || 0)) * 6;
  const runRateAgainst = ballsBowled
    ? (Number(runsConceded || 0) / Number(ballsBowled || 0)) * 6
    : 0;
  return (runRateFor - runRateAgainst).toFixed(3);
};

