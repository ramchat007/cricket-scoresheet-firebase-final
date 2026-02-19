// src/MainApp.jsx
import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./utils/firebase";

// --- COMPONENTS ---
import Navigation from "./components/Navigation.jsx";
import TournamentSelector from "./components/TournamentSelector.jsx";
import MatchSelector from "./components/MatchSelector.jsx";
import MatchScheduler from "./components/MatchScheduler"; // ✅ Unified Scheduler
const LiveScoring = lazy(() => import("./components/LiveScoring.jsx"));
import Scoreboard from "./components/Scoreboard.jsx";
import MatchesPage from "./components/Matches.jsx";
import TeamsManager from "./components/TeamManager.jsx";
import Profile from "./components/Profile.jsx";
import Login from "./components/Login.jsx";
import Register from "./components/Register.jsx";
const TournamentDetails = lazy(
  () => import("./components/TournamentDetails.jsx"),
);
const MatchScorecard = lazy(() => import("./components/MatchScorecard.jsx"));
import Dashboard from "./components/Dashboard.jsx";
const CreateTournament = lazy(
  () => import("./components/CreateTournament.jsx"),
);
const GlobalPlayersView = lazy(
  () => import("./components/GlobalPlayersView.jsx"),
);
const MigrationTool = lazy(() => import("./components/MigrationTool.jsx"));
const AuctionDashboard = lazy(
  () => import("./components/AuctionDashboard.jsx"),
);
const GlobalPlayerRegistration = lazy(
  () => import("./components/GlobalPlayerRegistration.jsx"),
);
const TournamentPlayerList = lazy(
  () => import("./components/TournamentPlayerList.jsx"),
);
const PastLeague = lazy(() => import("./components/PastLeague.jsx"));
const MatchOverlay = lazy(
  () => import("./components/Overlay/MatchOverlay.jsx"),
);
const TournamentBanner = lazy(
  () => import("./components/Overlay/TournamentBanner"),
);
import RequireAuth from "./components/guards/RequireAuth.jsx";
import RequireTournamentAccess from "./components/guards/RequireTournamentAccess.jsx";

import { useAuth } from "./hooks/useAuth.jsx";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

// ----------------------------------------------------------------------
// 1. APP CONTENT (Inner Component)
// ----------------------------------------------------------------------
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, lightMode } = useTheme();

  // Global State
  const [tournamentId, setTournamentId] = useState("");
  const [matchId, setMatchId] = useState(null);

  // Data States
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [allTeams, setAllTeams] = useState([]); // ✅ Populates Scheduler Dropdowns

  // Route Helpers
  const isOverlay = location.pathname.startsWith("/overlay");
  const isRegistration = location.pathname.startsWith("/register-player");
  const isMatchesPage =
    location.pathname === "/" || location.pathname === "/scoreboard";

  const navigateToScoring = (tid, mid) => {
    navigate(`/live/${tid}/${mid}`);
  };

  // --- 🔄 1. REAL-TIME DATA LISTENER (Fixes Empty Dropdowns) ---
  useEffect(() => {
    // A. Listen for Teams (Real-time)
    const teamsQuery = query(collection(db, "teams"), orderBy("name", "asc"));
    const unsubTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllTeams(teamsData);
    });

    // B. Listen for Tournaments (Real-time)
    const tournamentsQuery = query(collection(db, "tournaments"));
    const unsubTournaments = onSnapshot(tournamentsQuery, (snapshot) => {
      const tourneys = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableTournaments(tourneys);

      // Auto-select first tournament if none selected
      if (tourneys.length > 0 && !tournamentId) {
        setTournamentId(tourneys[0].id);
      }
    });

    return () => {
      unsubTeams();
      unsubTournaments();
    };
  }, []); // Run once on mount

  function handleMatchesPageSelect(tournament, matchIdSelected) {
    navigateToScoring(tournament, matchIdSelected);
  }

  // ✅ OVERLAY VIEW (No Theme/Layout)
  if (isOverlay) {
    return (
      <div className="w-full h-screen bg-transparent font-sans overflow-hidden">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Loading overlay...
            </div>
          }>
          <Routes>
            <Route
              path="/overlay/:tournamentId/active"
              element={<MatchOverlay />}
            />
            <Route
              path="/overlay/tournament-banner/:tournamentId"
              element={<TournamentBanner />}
            />
          </Routes>
        </Suspense>
      </div>
    );
  }
  if (isRegistration) {
    return (
      <Routes>
        <Route path="/register-player" element={<GlobalPlayerRegistration />} />
        <Route
          path="/register/:tournamentId"
          element={<GlobalPlayerRegistration />}
        />
        <Route
          path="/view-players/:tournamentId"
          element={<TournamentPlayerList />}
        />
      </Routes>
    );
  }

  // ✅ MAIN APPLICATION LAYOUT
  return (
    <div
      className={`min-h-screen ${theme.bg} ${theme.text} font-sans transition-colors duration-300`}>
      <Navigation />

      <div className="container mx-auto px-4 pb-24 md:pb-10 pt-4">
        {/* --- ADMIN DASHBOARD (Mobile Optimized) --- */}
        {isMatchesPage && user && (
          <div
            className={`${theme.card} rounded-3xl p-5 mb-8 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-500`}>
            <div className="flex items-center justify-between mb-6">
              <h2
                className={`text-sm font-black ${theme.text} uppercase tracking-widest flex items-center gap-2`}>
                <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
                Admin Console
              </h2>
              <span
                className={`text-[10px] ${theme.sub} font-bold bg-white/5 px-2 py-1 rounded-full uppercase border ${lightMode ? "border-gray-200" : "border-white/5"}`}>
                Live Sync
              </span>
            </div>

            {/* Selectors Section */}
            <div className="grid grid-cols-1 gap-3 mb-6">
              <div
                className={`p-1 rounded-2xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/5"}`}>
                <TournamentSelector
                  tournamentId={tournamentId}
                  setTournamentId={setTournamentId}
                  availableTournaments={availableTournaments}
                />
              </div>

              <div
                className={`p-1 rounded-2xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/5"}`}>
                <MatchSelector
                  matchId={matchId}
                  setMatchId={(id) => {
                    setMatchId(id);
                    if (id && id !== "new") navigateToScoring(tournamentId, id);
                  }}
                  tournamentId={tournamentId}
                />
              </div>
            </div>

            {/* Analytics Button */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (tournamentId) navigate(`/tournaments/${tournamentId}`);
                  else alert("Select a tournament first.");
                }}
                className={`flex items-center gap-3 p-4 border rounded-2xl transition-all active:scale-95 group shadow-lg ${lightMode ? "bg-indigo-50 border-indigo-100 hover:border-indigo-300" : "bg-gradient-to-br from-indigo-900/20 to-indigo-900/10 border-indigo-500/20 hover:border-indigo-400"}`}>
                <div className="bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.4)] w-10 h-10 rounded-xl flex items-center justify-center text-xl group-hover:rotate-12 transition-transform text-white">
                  📊
                </div>
                <div className="text-left overflow-hidden">
                  <h3
                    className={`font-black text-xs uppercase tracking-tight truncate ${lightMode ? "text-indigo-900" : "text-white"}`}>
                    Analytics
                  </h3>
                  <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider truncate">
                    View Dashboard
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* --- ROUTES --- */}
        <Suspense
          fallback={
            <div
              className={`min-h-[50vh] flex items-center justify-center text-xs font-black uppercase tracking-[0.3em] ${theme.sub}`}>
              Loading module...
            </div>
          }>
          <Routes>
            {user ? (
              <Route
                path="/"
                element={
                  matchId === "new" ? (
                    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in duration-300 p-4">
                      {/* Scheduler Header */}
                      <div className="flex justify-between items-end mb-8">
                        <div>
                          <h2
                            className={`text-3xl font-black ${theme.text} uppercase tracking-tighter italic`}>
                            Match Control
                          </h2>
                          <p
                            className={`text-[10px] ${theme.sub} font-bold uppercase tracking-widest`}>
                            {tournamentId
                              ? `Scheduling for: ${availableTournaments.find((t) => t.id === tournamentId)?.name || "Selected Tournament"}`
                              : "Select a Tournament to Schedule"}
                          </p>
                        </div>
                      </div>

                      {/* ✅ UNIFIED SCHEDULER: Ensures Teams & ID are passed */}
                      {tournamentId ? (
                        <MatchScheduler
                          tournamentId={tournamentId}
                          teams={allTeams} // <--- Fixes Empty Dropdown
                          onCancel={() => setMatchId(null)}
                        />
                      ) : (
                        <div
                          className={`p-8 rounded-2xl text-center border border-dashed ${lightMode ? "bg-red-50 border-red-200 text-red-600" : "bg-red-900/10 border-red-500/30 text-red-400"}`}>
                          <h3 className="font-bold uppercase tracking-widest mb-2">
                            Tournament Required
                          </h3>
                          <p className="text-xs opacity-70">
                            Please select a tournament from the dropdown above
                            to start scheduling matches.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Default Dashboard State
                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6">
                      <div
                        className={`w-20 h-20 ${theme.card} rounded-3xl flex items-center justify-center text-3xl animate-bounce shadow-2xl`}>
                        🚀
                      </div>
                      <div>
                        <h3
                          className={`font-black uppercase tracking-tighter text-lg ${theme.text}`}>
                          System Ready
                        </h3>
                        <p
                          className={`text-[10px] ${theme.sub} font-bold uppercase tracking-widest mt-1`}>
                          Select an action above to start scoring
                        </p>
                      </div>
                    </div>
                  )
                }
              />
            ) : (
              <Route path="/" element={<Dashboard />} />
            )}

            {/* Sub-Pages */}
            <Route
              path="/live/:tournamentId/:matchId"
              element={
                <RequireTournamentAccess>
                  <LiveScoring />
                </RequireTournamentAccess>
              }
            />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/create-tournament"
              element={
                <RequireAuth>
                  <CreateTournament />
                </RequireAuth>
              }
            />
            <Route
              path="/tournaments/:id/auction"
              element={
                <RequireTournamentAccess requireEdit>
                  <AuctionDashboard />
                </RequireTournamentAccess>
              }
            />
            <Route
              path="/matches"
              element={
                <MatchesPage
                  availableTournaments={availableTournaments}
                  onSelect={handleMatchesPageSelect}
                  readOnly={!user}
                />
              }
            />
            <Route path="/players" element={<GlobalPlayersView />} />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/migrate"
              element={
                <RequireAuth>
                  <MigrationTool />
                </RequireAuth>
              }
            />
            <Route
              path="/tournaments/:id"
              element={
                <RequireTournamentAccess>
                  <TournamentDetails />
                </RequireTournamentAccess>
              }
            />
            <Route
              path="/tournaments/:tournamentId/scorecard/:matchId"
              element={
                <RequireTournamentAccess>
                  <MatchScorecard />
                </RequireTournamentAccess>
              }
            />
            <Route
              path="/teams"
              element={
                <RequireAuth>
                  <TeamsManager />
                </RequireAuth>
              }
            />
            <Route
              path="/past-leagues"
              element={
                <RequireAuth>
                  <PastLeague />
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. MAIN EXPORT
// ----------------------------------------------------------------------
export default function MainApp() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
