/**
 * Supabase adapter for gradual migration from Firebase.
 *
 * Expected RPCs (created in supabase/migrations):
 * - scoring_append_ball_event
 * - scoring_undo_last_event
 */
export function createSupabaseAdapter(supabaseClient) {
  if (!supabaseClient) {
    throw new Error("createSupabaseAdapter requires a Supabase client instance");
  }

  return {
    async ballTransaction(tournamentId, matchId, payload) {
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
          p_actor_user_id: payload?.actorUserId ?? null,
        },
      );

      if (error) throw error;
      return data;
    },

    async undoLast(tournamentId, matchId, actionId = null, actorUserId = null) {
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

      if (error) throw error;
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
      const channel = supabaseClient
        .channel(`score:${tournamentId}:${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "match_score_state",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            const state = payload?.new?.state;
            if (!state) return cb(null);
            cb({
              battingTeam: state.battingTeam || "",
              score: state.score || 0,
              wickets: state.wickets || 0,
              over: state.over || 0,
              overBallCount: state.overBallCount || 0,
              striker: state.striker,
              nonStriker: state.nonStriker,
              currentBowler: state.currentBowler,
              status: state.status,
            });
          },
        )
        .subscribe();

      return () => {
        supabaseClient.removeChannel(channel);
      };
    },
  };
}
