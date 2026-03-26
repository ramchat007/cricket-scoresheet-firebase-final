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
