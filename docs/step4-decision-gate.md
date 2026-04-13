# Step 4 — Datastore Decision Gate (Locked Primary)

Date: 2026-04-13

## Decision

- **Primary datastore selected:** `firebase`
- **Status:** Locked for current production path
- **Supabase role:** non-primary (not used for mirror writes in runtime scoring path)

## Evidence used

1. Deterministic replay harness passed (`npm run step3:replay`) across 200 seeded sequences.
2. Scoring telemetry instrumentation is active for action success/failure, undo behavior, and divergence events.
3. Existing app path and environment defaults already align with Firebase as stable primary.

## Gate criteria status

- Replay determinism: ✅ pass
- Undo rollback consistency: ✅ pass in harness checks
- Divergence telemetry availability: ✅ instrumented
- Write-primary lock (no dual writes): ✅ enforced in `useScoring`

## Runtime config

Use `.env` / deployment config:

```env
VITE_SCORING_PRIMARY=firebase
```

To switch in the future (after a separate gate review):

```env
VITE_SCORING_PRIMARY=supabase
```

## Next checkpoint

Collect telemetry over real matches, then re-open gate only if:
- divergence rate remains near zero,
- action failure rates are stable,
- operational readiness for Supabase primary is fully validated.

