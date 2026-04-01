/**
 * Supabase adapter for gradual migration from Firebase.
 *
 * Expected RPCs (created in supabase/migrations):
 * - scoring_append_ball_event
 * - scoring_undo_last_event
 */
export function createSupabaseAdapter(supabaseClient) {
  if (!supabaseClient) {
    throw new Error(
      "createSupabaseAdapter requires a Supabase client instance",
    );
  }
  let rpcUnavailable = false;
  let warnedUnavailable = false;

  const shouldDisableRpcMirror = (error) => {
    const msg = String(error?.message || "");
    return msg.includes("(404)") || msg.includes("404");
  };

  const handleRpcError = (error, rpcName) => {
    if (shouldDisableRpcMirror(error)) {
      rpcUnavailable = true;
      if (!warnedUnavailable) {
        warnedUnavailable = true;
        console.warn(
          `[Supabase Mirror Disabled] ${rpcName} is not available (404). ` +
            "Deploy SQL RPCs or set VITE_USE_SUPABASE_SCORING=false.",
        );
      }
      return { skipped: true, reason: "rpc_missing" };
    }
    throw error;
  };

  return {
    async ballTransaction(tournamentId, matchId, payload) {
      if (rpcUnavailable) {
        return { skipped: true, reason: "rpc_missing" };
      }
      const actionId =
        payload?.actionId ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const eventType = payload?.eventType || "BALL";
      const eventPayload = payload?.payload || payload || {};

      const { data, error } = await supabaseClient.rpc(
        "scoring_append_ball_event",
        {
          p_match_id: matchId,
          p_tournament_id: tournamentId,
          p_action_id: actionId,
          p_event_type: eventType,
          p_payload: eventPayload,
          p_expected_version: payload?.expectedVersion ?? null,
          p_actor_user_id: payload?.actorUserId || null,
        },
      );

      if (error) return handleRpcError(error, "scoring_append_ball_event");
      return data;
    },

    async undoLast(tournamentId, matchId, actionId = null, actorUserId = null) {
      if (rpcUnavailable) {
        return { skipped: true, reason: "rpc_missing" };
      }
      const undoActionId =
        actionId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const { data, error } = await supabaseClient.rpc(
        "scoring_undo_last_event",
        {
          p_match_id: matchId,
          p_tournament_id: tournamentId,
          p_action_id: undoActionId,
          p_actor_user_id: actorUserId,
        },
      );

      if (error) return handleRpcError(error, "scoring_undo_last_event");
      return data;
    },

    async finishMatch(
      tournamentId,
      matchId,
      winner,
      reason,
      mom = null,
      opts = {},
    ) {
      const result = `${winner} won (${reason})`;
      const payload = {
        winner,
        reason,
        result,
        mom,
      };
      return this.ballTransaction(tournamentId, matchId, {
        actionId: opts.actionId,
        eventType: "FINISH",
        payload,
        actorUserId: opts.actorUserId,
      });
    },

    async deleteMatch(tournamentId, matchId) {
      const { error } = await supabaseClient
        .from("matches")
        .delete()
        .eq("id", matchId)
        .eq("tournament_id", tournamentId);
      if (error) throw error;
    },

    subscribeMatchLite(tournamentId, matchId, cb) {
      console.log(`🔌 Opening WebSocket for match: ${matchId}`);

      const channel = supabaseClient
        .channel(`score:${tournamentId}:${matchId}`) // Put the normal channel name back
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "match_score_state",
            filter: `match_id=eq.${matchId}`, // 🟢 ADD THIS BACK (No quotes!)
          },
          (payload) => {
            // console.log("🔥 SUPABASE PAYLOAD ARRIVED:", payload);

            // We still only want to update the UI if it's the right match
            if (payload?.new?.match_id === matchId) {
              const state = payload?.new?.state;
              if (!state) return cb(null);
              cb(state);
            }
          },
        )
        .subscribe((status, err) => {
          // console.log("📡 WebSocket Status:", status);
          if (err) console.error("WebSocket Error:", err);
        });

      return () => {
        // console.log("🛑 Closing Supabase WebSocket");
        supabaseClient.removeChannel(channel);
      };
    },
  };
}
