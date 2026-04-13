import { calculateMatchStats } from "./scoreEngine.js";

const makeRng = (seed) => {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

const toSummary = (s) => ({
  score: Number(s?.score || 0),
  wickets: Number(s?.wickets || 0),
  over: Number(s?.over || 0),
  overBallCount: Number(s?.overBallCount || 0),
});

const isValidSummary = (s) => {
  return (
    Number.isFinite(s.score) &&
    Number.isFinite(s.wickets) &&
    Number.isFinite(s.over) &&
    Number.isFinite(s.overBallCount) &&
    s.score >= 0 &&
    s.wickets >= 0 &&
    s.over >= 0 &&
    s.overBallCount >= 0 &&
    s.overBallCount <= 5
  );
};

const generateSequence = (rng, balls = 30) => {
  const batters = Array.from({ length: 11 }, (_, i) => `BAT-${i + 1}`);
  const bowlers = ["BWL-1", "BWL-2", "BWL-3", "BWL-4", "BWL-5"];
  const timeline = [];

  let striker = batters[0];
  let nonStriker = batters[1];
  let currentBowler = bowlers[0];
  let nextBatterIndex = 2;
  let legalInOver = 0;

  for (let i = 0; i < balls; i += 1) {
    const r = rng();
    const isWide = r < 0.08;
    const isNoBall = !isWide && r >= 0.08 && r < 0.14;
    const isWicket = !isWide && r >= 0.14 && r < 0.2;
    const physicalRuns = isWicket ? 0 : Math.floor(rng() * 7);

    const ball = {
      striker,
      nonStriker,
      bowler: currentBowler,
      batter: striker,
      physicalRuns,
      runs: physicalRuns,
      isWide,
      isNoBall,
      isWicket,
      wicketType: isWicket ? "bowled" : null,
      whoOut: isWicket ? striker : null,
    };

    if (isWide) {
      ball.runs = physicalRuns;
    } else if (isNoBall) {
      ball.runs = physicalRuns;
    }

    const isLegal = !isWide && !isNoBall;
    const swapRuns = physicalRuns % 2 !== 0;
    let nextStriker = striker;
    let nextNonStriker = nonStriker;

    if (swapRuns && !isWicket) {
      nextStriker = nonStriker;
      nextNonStriker = striker;
    }

    if (isWicket) {
      nextStriker = batters[nextBatterIndex] || striker;
      nextBatterIndex += 1;
    }

    if (isLegal) {
      legalInOver += 1;
      if (legalInOver === 6) {
        legalInOver = 0;
        [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
        currentBowler = pick(rng, bowlers.filter((b) => b !== currentBowler));
        ball.nextBowler = currentBowler;
      }
    }

    ball.nextStriker = nextStriker;
    ball.nextNonStriker = nextNonStriker;

    striker = nextStriker;
    nonStriker = nextNonStriker;

    timeline.push(ball);
  }

  return timeline;
};

export const runDeterministicReplayHarness = ({
  seed = 20260413,
  sequences = 200,
  ballsPerSequence = 30,
} = {}) => {
  const rng = makeRng(seed);
  const failures = [];

  for (let i = 0; i < sequences; i += 1) {
    const timeline = generateSequence(rng, ballsPerSequence);
    const initialMeta = {
      initialStriker: "BAT-1",
      initialNonStriker: "BAT-2",
      initialBowler: "BWL-1",
    };

    const first = toSummary(calculateMatchStats(timeline, initialMeta));
    const second = toSummary(calculateMatchStats(timeline, initialMeta));
    const undo = toSummary(
      calculateMatchStats(timeline.slice(0, Math.max(0, timeline.length - 1)), initialMeta),
    );

    if (!isValidSummary(first)) {
      failures.push({ type: "invalid_summary", index: i, first });
      continue;
    }

    if (
      first.score !== second.score ||
      first.wickets !== second.wickets ||
      first.over !== second.over ||
      first.overBallCount !== second.overBallCount
    ) {
      failures.push({ type: "non_deterministic_replay", index: i, first, second });
      continue;
    }

    if (undo.score > first.score || undo.wickets > first.wickets) {
      failures.push({ type: "undo_not_reducing_state", index: i, first, undo });
    }
  }

  return {
    passed: failures.length === 0,
    seed,
    sequences,
    ballsPerSequence,
    failures,
  };
};
