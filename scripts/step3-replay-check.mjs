import { runDeterministicReplayHarness } from "../src/utils/replayHarness.js";

const result = runDeterministicReplayHarness({
  seed: 20260413,
  sequences: 200,
  ballsPerSequence: 30,
});

if (result.passed) {
  console.log(
    `✅ Step 3 replay harness passed (${result.sequences} sequences, seed=${result.seed}).`,
  );
  process.exit(0);
}

console.error(
  `❌ Step 3 replay harness failed with ${result.failures.length} failures.`,
);
console.error(JSON.stringify(result.failures.slice(0, 10), null, 2));
process.exit(1);

