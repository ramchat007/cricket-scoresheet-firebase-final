import { calculateMatchStats } from "./scoreEngine";

const cleanName = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || value.playerName || "";
  return String(value).trim();
};

const normalizeInningsArray = (match) => {
  if (!match?.innings) return [];
  if (Array.isArray(match.innings)) return match.innings.filter(Boolean);
  return [match.innings?.[0], match.innings?.[1]].filter(Boolean);
};

const hashString = (input) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

export const deriveCanonicalInnings = (innings) => {
  if (!innings) return null;
  const timeline = innings.timeline || innings.ballsLog || [];
  const calculated = calculateMatchStats(timeline, {
    initialStriker: cleanName(innings.striker),
    initialNonStriker: cleanName(innings.nonStriker),
    initialBowler: cleanName(innings.currentBowler),
  });

  return {
    ...innings,
    timeline,
    score: calculated.score,
    wickets: calculated.wickets,
    over: calculated.over,
    overBallCount: calculated.overBallCount,
    extras: calculated.extras,
    batsmenStats: calculated.batsmenStats,
    bowlerStats: calculated.bowlerStats,
    fallOfWickets: calculated.fallOfWickets,
    striker: calculated.striker || innings.striker,
    nonStriker: calculated.nonStriker || innings.nonStriker,
    currentBowler: calculated.currentBowler || innings.currentBowler,
  };
};

export const deriveCanonicalInningsList = (match) => {
  return normalizeInningsArray(match).map((inn) => deriveCanonicalInnings(inn));
};

export const buildLiveStateSnapshot = (match) => {
  const inningsList = normalizeInningsArray(match);
  const currentInningsIndex =
    typeof match?.currentInnings === "number" ? match.currentInnings : 0;
  const rawInnings = inningsList[currentInningsIndex] || null;
  const canonicalInnings = deriveCanonicalInnings(rawInnings);

  if (!rawInnings || !canonicalInnings) {
    return {
      currentInningsIndex,
      rawInnings,
      canonicalInnings,
      eventIndex: 0,
      stateVersion: "0:0:0.0:0/0",
      checksum: "0",
      hasDivergence: false,
      divergence: {},
    };
  }

  const eventIndex = canonicalInnings.timeline?.length || 0;
  const rawSummary = {
    score: Number(rawInnings.score || 0),
    wickets: Number(rawInnings.wickets || 0),
    over: Number(rawInnings.over || 0),
    overBallCount: Number(rawInnings.overBallCount || 0),
  };
  const canonicalSummary = {
    score: Number(canonicalInnings.score || 0),
    wickets: Number(canonicalInnings.wickets || 0),
    over: Number(canonicalInnings.over || 0),
    overBallCount: Number(canonicalInnings.overBallCount || 0),
  };

  const divergence = {
    score: rawSummary.score !== canonicalSummary.score,
    wickets: rawSummary.wickets !== canonicalSummary.wickets,
    over: rawSummary.over !== canonicalSummary.over,
    overBallCount: rawSummary.overBallCount !== canonicalSummary.overBallCount,
  };

  const stateVersion = `${currentInningsIndex}:${eventIndex}:${canonicalSummary.over}.${canonicalSummary.overBallCount}:${canonicalSummary.score}/${canonicalSummary.wickets}`;
  const checksum = hashString(JSON.stringify(canonicalSummary));

  return {
    currentInningsIndex,
    rawInnings,
    canonicalInnings,
    eventIndex,
    stateVersion,
    checksum,
    hasDivergence: Object.values(divergence).some(Boolean),
    divergence,
  };
};

