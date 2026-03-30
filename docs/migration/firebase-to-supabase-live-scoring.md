# Firebase → Supabase Live Scoring Compatibility Guide

This document maps the current scoring behavior to the Supabase event + reducer model.

## Source of truth in current app

- `applyBallLogic` creates a new ball event, handles crossing logic, wicket survivor slots, over-end swap, and appends timeline.
- `recalculateInningsState` replays timeline to rebuild innings totals and player/bowler stats.
- `checkFinishAndSetResult` decides innings completion and final result text.

These behaviors are implemented in `src/hooks/useScoring.js` and currently persisted via Firestore transaction wrappers in `src/utils/firestore.js`.

## Compatibility event types

The Supabase reducer should support these event types (same action map as app):

- `BALL`
- `EXTRA_BALL_RUNS`
- `NEW_BATSMAN`
- `CONFIRM_BOWLER`
- `CHANGE_BOWLER`
- `STRIKE_CHANGE`
- `END_INNINGS`
- `UNDO`
- `FINISH`

## Recommended payload shape for BALL / EXTRA_BALL_RUNS

```json
{
  "newBall": {
    "code": "1|2|3|4|6|W|WD|NB",
    "runs": 1,
    "physicalRuns": 0,
    "isWicket": false,
    "isWide": false,
    "isNoBall": false,
    "isBye": false,
    "isLegBye": false,
    "batter": "Player A",
    "bowler": "Player B",
    "isLegalOverride": false,
    "whoOut": null,
    "nextStriker": "Player A",
    "nextNonStriker": "Player C",
    "nextBowler": "Player D"
  },
  "recalculated": {
    "score": 12,
    "wickets": 1,
    "over": 1,
    "overBallCount": 3,
    "extras": { "wides": 1, "noBalls": 0, "byes": 0, "legByes": 0 },
    "batsmenStats": {},
    "bowlerStats": {},
    "fallOfWickets": [],
    "awaitingNewBatsman": false,
    "awaitingNewBowler": false
  }
}
```

## Undo semantics

- Mark most recent non-undone scoring event as `is_undone=true`.
- Insert an `UNDO` event.
- Rebuild state from nearest snapshot + remaining active events.

## Idempotency

- Every event should include `actionId`.
- RPC `scoring_append_ball_event` and `scoring_undo_last_event` return success without side effects when action id repeats.

## Rollout

1. Keep Firebase live writes.
2. Enable Supabase dual-write for ball events.
3. Shadow compare states.
4. Cut read path to `match_score_state`.
5. Cut write path after stable tournament cycle.
