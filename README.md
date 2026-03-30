# DFL Scoresheet — Firebase Extended

==========================================

⚛️ App.jsx / Frontend Improvements

1. Offline-first Enhancements
   You already cache match data in localStorage.
   Consider:
   Adding "sync pending actions" (e.g., if scorer adds a ball offline, queue it and sync when back online).
   Show an "Offline mode" banner if Firestore disconnects.
2. Match History & Replay
   Create a page that replays the entire timeline ball-by-ball from history.
3. User Roles / Permissions
   Scorer role vs Viewer role.
   Prevent accidental edits by viewers.
4. UI/UX Improvements
   Persistent sidebar navigation (instead of just <Navigation />).
   Add Dark mode toggle.
   Show match progress indicator (overs completed %, wickets fallen, required run rate, etc.).
5. Match Analytics
   Simple charts with Recharts or Chart.js:
   Run rate over time.
   Partnership charts.
   Bowler economy comparison.
6. Team Management Page
   /teams route currently loads TeamsManager.
   Expand it to allow:
   Adding/removing players with role-based inputs.
   Assigning captains/wicket-keepers.
   Linking teams to tournaments.
7. Global Search
   Search for a player name or team name across all tournaments and navigate directly.
8. Live Commentary Bot: Auto-generate textual commentary from scoring events.

THEME CHANGE
git checkout feature/theme-engine-upgrade
git merge main

## Supabase connection (gradual live-scoring migration)

You can enable Supabase scoring mirroring with environment variables.

1. Create a local env file:

```bash
cp .env.example .env
```

2. Set these values:

- `VITE_USE_SUPABASE_SCORING=false` (default)
  - keep `false` until your Supabase migration SQL + RPCs are deployed.
- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<your-anon-key>`

3. When ready for mirrored writes, set:

```env
VITE_USE_SUPABASE_SCORING=true
```

With this setup, Firebase remains the primary write path and Supabase receives mirrored scoring events for gradual validation/cutover.

### Troubleshooting

- If you see `404` for `scoring_append_ball_event` or `scoring_undo_last_event`,
  your Supabase project does not yet have the RPC SQL deployed.
- The app will auto-disable Supabase mirror writes after the first RPC 404 and continue using Firebase.
- Deploy `supabase/migrations/20260330_live_scoring_schema_and_rpcs.sql` (or set `VITE_USE_SUPABASE_SCORING=false`).
