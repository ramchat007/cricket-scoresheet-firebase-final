# CricSyncLive — Backup + Dual Migration Plan (Supabase-first and Firebase-stable)

Date: 2026-04-13

## 0) Backup Snapshot (do this first)

- Create immutable backup tag:
  - `backup-2026-04-13-pre-dual-migration`
- Create safety branch:
  - `backup/pre-dual-migration-2026-04-13`
- Export Firebase data (Firestore collections + Storage assets) and store in cloud bucket + local encrypted archive.
- Export Supabase schema + table snapshots (if used) as SQL + CSV.
- Save `.env` variants (without secrets in git) and deployment config (`firebase.json`, hosting rewrites, build config).

## 1) Fix scoreboard vs broadcast mismatch (highest priority)

### Problem
Score Input / Score Card and Broadcast Overlay can diverge.

### Plan
1. Define **single source of truth** for computed match state using `scoreEngine` output.
2. Ensure both `MatchScorecard` and `MatchOverlay` consume the same derived payload model.
3. Add event sequence IDs (`eventIndex`) and revision IDs (`stateVersion`) to detect stale render.
4. Add consistency checks:
   - `scoreInputState` vs `broadcastState`
   - block broadcast publish if checksum mismatch.
5. Add a debug panel for admins showing:
   - last event id,
   - last undo id,
   - current striker/non-striker,
   - over.ball pointer,
   - derived totals.

### Acceptance
- 200 random event simulations show no divergence.
- Live update latency < 1.5s for overlay refresh.

## 2) Undo and recalculation correctness (runs, balls, wickets, extras)

### Problem
Undo state can remain in memory and recalculation is not always reflected everywhere.

### Plan
1. Centralize undo in one reducer/service (`applyEvent`, `undoEvent`, `replayEvents`).
2. After every undo:
   - rebuild derived state from event ledger,
   - sync all dependent slices (batting, bowling, partnerships, over summary, required run rate).
3. Clear stale in-memory undo flags on:
   - match change,
   - innings change,
   - reconnect,
   - hard refresh.
4. Add deterministic test scenarios:
   - wicket + no-ball + runout combos,
   - penalty runs,
   - overthrows,
   - innings closure + undo reopen.

### Acceptance
- Undo/redo parity in local simulation and persisted state.
- No stale undo button after navigation/reconnect.

## 3) Data layer decision: fully Supabase vs fully Firebase

## Immediate recommendation
Use **one runtime primary** for writes. Do not continue mixed-primary writes.

### Option A: Supabase-first (target architecture)
- PostgreSQL as canonical store.
- Realtime channels for overlay + viewers.
- RPCs for append event / undo event.
- Edge Functions for secured admin actions.

### Option B: Firebase-stable (parallel fallback)
- Firestore remains canonical.
- Harden offline queue and merge conflict handling.
- Disable Supabase mirror until verification is complete.

### Decision gate criteria
- P95 write latency
- conflict rate
- reconnect recovery reliability
- operational cost
- team comfort/maintainability

## 4) Net Run Rate (NRR) module across competition levels

### Scope
- Team-level per tournament/league/stage.
- Dynamic recalculation after each completed innings.
- Remaining matches projections.

### Formula baseline
- NRR = (Total runs scored / Total overs faced) - (Total runs conceded / Total overs bowled)
- All-outs count as full quota overs where tournament rules require it.

### Deliverables
1. Shared `nrr` utility with rule toggles.
2. Standings table integration.
3. “What-if” projection tool for remaining fixtures.
4. Validation against sample historical tournaments.

## 5) Builder auto-update issue

### Problem
Builder remove/update actions are unstable due to auto-update behavior.

### Plan
1. Identify all auto-save/autofetch triggers in builder components.
2. Introduce transactional update pattern:
   - optimistic UI with revision token,
   - reject stale updates,
   - conflict toast + retry path.
3. Debounce frequent updates and isolate side effects.
4. Add audit log for builder mutations.

### Acceptance
- No phantom reinsertions/removals in 100 mutation test cases.

## 6) Upgrade path: browser app to React Native (Android + iOS)

### Strategy
Create shared domain core and keep platform UIs separate.

### Proposed architecture
- `packages/domain` (scoring logic, undo, NRR, validation)
- `apps/web` (existing Vite app)
- `apps/mobile` (React Native / Expo)
- Supabase or Firebase adapters via interface pattern.

### Mobile capabilities
- offline-first event queue
- background sync
- push notifications (wicket/start/innings)
- secure auth + token refresh

### Milestones
1. Extract shared scoring core.
2. Build RN scoring screen + live scoreboard.
3. Add sync + conflict handling.
4. Release beta to scorers/admins.

## 7) Execution roadmap (recommended order)

1. Backup snapshot + baseline metrics.
2. Score/overlay consistency fix.
3. Undo correctness hardening.
4. Data layer decision gate (Supabase vs Firebase primary).
5. NRR + standings projection.
6. Builder stability fixes.
7. Mobile program kickoff.

## 8) Sprint-0 checklist (next 3-5 days)

- [ ] Implement consistency checksum between score state and broadcast payload.
- [ ] Build event replay harness for 200 random ball-event sequences.
- [ ] Instrument latency and conflict metrics.
- [ ] Finalize write-primary decision memo (Supabase or Firebase).
- [ ] Create NRR utility interface and test vectors.
- [ ] Patch builder update race conditions.

