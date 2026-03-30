import { assertScoringAdapter } from "./scoringAdapterContract";
import { firebaseAdapter } from "./firebaseAdapter";
import { createSupabaseAdapter } from "./supabaseAdapter";

/**
 * Returns a scoring adapter based on runtime config.
 * Defaults to Firebase for safe gradual rollout.
 */
export function getScoringAdapter({
  useSupabase = false,
  supabaseClient = null,
} = {}) {
  if (useSupabase) {
    return assertScoringAdapter(createSupabaseAdapter(supabaseClient));
  }
  return assertScoringAdapter(firebaseAdapter);
}

export { firebaseAdapter, createSupabaseAdapter };
