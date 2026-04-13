# Step 3 — Deterministic Replay + Telemetry

Date: 2026-04-13

## Replay harness

Run deterministic scoring replay validation:

```bash
npm run step3:replay
```

This executes 200 generated ball-event sequences with a fixed seed and checks:
- replay determinism (same timeline => same final score summary)
- summary validity (no negative/invalid over-ball states)
- undo sanity (removing the last event should not increase score/wickets)

## Telemetry signals (localStorage)

Telemetry key: `cricsync_scoring_metrics_v1`

Tracked events:
- `BALL_APPLIED`
- `UNDO_APPLIED`
- `SCORING_ACTION_SUCCESS`
- `SCORING_ACTION_FAILED`
- `BROADCAST_DIVERGENCE_DETECTED`

These metrics provide baseline evidence for Step-4 datastore decision gates (latency, divergence frequency, and rollback behavior).

