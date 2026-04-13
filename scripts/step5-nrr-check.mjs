import { calculateNRR, inningsBallsFaced } from "../src/utils/nrr.js";

const vectors = [
  {
    name: "equal run rates",
    input: { runsScored: 120, ballsFaced: 120, runsConceded: 120, ballsBowled: 120 },
    expected: "0.000",
  },
  {
    name: "positive nrr",
    input: { runsScored: 160, ballsFaced: 120, runsConceded: 130, ballsBowled: 120 },
    expected: "1.500",
  },
  {
    name: "negative nrr",
    input: { runsScored: 110, ballsFaced: 120, runsConceded: 150, ballsBowled: 120 },
    expected: "-2.000",
  },
];

const oversCheck = {
  allOut: inningsBallsFaced({ over: 18, overBallCount: 2, wickets: 10 }, { maxOvers: 20, totalWickets: 10 }),
  notOut: inningsBallsFaced({ over: 18, overBallCount: 2, wickets: 5 }, { maxOvers: 20, totalWickets: 10 }),
};

const failures = [];
vectors.forEach((v) => {
  const got = calculateNRR(v.input);
  if (got !== v.expected) failures.push({ vector: v.name, expected: v.expected, got });
});

if (oversCheck.allOut !== 120) failures.push({ vector: "allOutBalls", expected: 120, got: oversCheck.allOut });
if (oversCheck.notOut !== 110) failures.push({ vector: "notOutBalls", expected: 110, got: oversCheck.notOut });

if (failures.length) {
  console.error("❌ Step 5 NRR checks failed");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log("✅ Step 5 NRR checks passed");

