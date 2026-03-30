/**
 * Scoring adapter contract for backend-agnostic scoring operations.
 *
 * Implementations should provide:
 * - ballTransaction(tournamentId, matchId, updateFnOrPayload)
 * - undoLast(tournamentId, matchId, actionId?)
 * - finishMatch(tournamentId, matchId, winner, reason, mom?)
 * - deleteMatch(tournamentId, matchId)
 * - subscribeMatchLite?(tournamentId, matchId, cb)
 */

export const SCORING_ADAPTER_METHODS = [
  "ballTransaction",
  "undoLast",
  "finishMatch",
  "deleteMatch",
  "subscribeMatchLite",
];

export function assertScoringAdapter(adapter) {
  const missing = SCORING_ADAPTER_METHODS.filter(
    (m) => m !== "subscribeMatchLite" && typeof adapter?.[m] !== "function",
  );
  if (missing.length > 0) {
    throw new Error(`Invalid scoring adapter. Missing: ${missing.join(", ")}`);
  }
  return adapter;
}
