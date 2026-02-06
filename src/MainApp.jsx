// src/MainApp.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

// --- COMPONENTS ---
import Navigation from "./components/Navigation.jsx";
import TournamentSelector from "./components/TournamentSelector.jsx";
import MatchSelector from "./components/MatchSelector.jsx";
import MatchSetup from "./components/MatchSetup.jsx";
import LiveScoring from "./components/LiveScoring.jsx";
import Scoreboard from "./components/Scoreboard.jsx";
import MatchesPage from "./components/Matches.jsx";
import TeamsManager from "./components/TeamManager.jsx";
import Profile from "./components/Profile.jsx";
import Login from "./components/Login.jsx";
import Register from "./components/Register.jsx";
import TournamentDetails from "./components/TournamentDetails.jsx";
import MatchScorecard from "./components/MatchScorecard.jsx";
import Dashboard from "./components/Dashboard.jsx";
import CreateTournament from "./components/CreateTournament.jsx";
import GlobalPlayersView from "./components/GlobalPlayersView.jsx";
import MigrationTool from "./components/MigrationTool.jsx";
import AuctionDashboard from "./components/AuctionDashboard.jsx";
import GlobalPlayerRegistration from "./components/GlobalPlayerRegistration.jsx";
import PastLeague from "./components/PastLeague.jsx";
import MatchOverlay from "./components/Overlay/MatchOverlay.jsx";
import TournamentBanner from "./components/Overlay/TournamentBanner";

// --- UTILS & HOOKS ---
import {
  createMatchAuto,
  listMatches,
  listTournaments,
  listAllTeams,
} from "./utils/firestore.js";
import { useAuth } from "./hooks/useAuth.jsx";

// --- 🎨 IMPORT THEME CONTEXT ---
import { ThemeProvider, useTheme } from "./context/ThemeContext";


// ----------------------------------------------------------------------
// 1. INNER COMPONENT (Contains your existing logic + Theme Consumption)
// ----------------------------------------------------------------------
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // ✅ Consume Theme
  const { theme, lightMode } = useTheme();

  const [tournamentId, setTournamentId] = useState("");
  const [matchId, setMatchId] = useState(null);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [allTeams, setAllTeams] = useState([]);

  // ✅ DETECT OVERLAY ROUTE
  const isOverlay = location.pathname.startsWith("/overlay");

  const isMatchesPage =
    location.pathname === "/" || location.pathname === "/scoreboard";

  const navigateToScoring = (tid, mid) => {
    navigate(`/live/${tid}/${mid}`);
  };

  useEffect(() => {
    async function loadInitialData() {
      listAllTeams().then(setAllTeams);
      try {
        const allTournaments = await listTournaments();
        setAvailableTournaments(allTournaments);
        if (allTournaments.length > 0 && !tournamentId) {
          setTournamentId(allTournaments[0].id);
        }
      } catch (e) {
        console.error("Error loading tournaments:", e);
      }
    }
    loadInitialData();
  }, [user]);

  useEffect(() => {
    if (!tournamentId) {
      setAllMatches([]);
      return;
    }
    const fetchData = async () => {
      try {
        const matches = await listMatches(tournamentId);
        matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllMatches(matches);
      } catch (err) {
        console.error("Error fetching matches:", err);
      }
    };
    fetchData();
  }, [tournamentId]);

  async function handleCreate({ payload, tournament }) {
    if (!user) {
      alert("Login required.");
      return;
    }
    const tid = tournament || tournamentId;
    if (!tid) {
      alert("Tournament required.");
      return;
    }
    try {
      const newMatchId = await createMatchAuto(tid, payload);
      navigateToScoring(tid, newMatchId);
    } catch (err) {
      console.error(err);
      alert("Failed to create match. Check permissions.");
    }
  }

  function handleMatchesPageSelect(tournament, matchIdSelected) {
    navigateToScoring(tournament, matchIdSelected);
  }

  // ✅ CONDITIONAL RENDER: If Overlay, return plain wrapper (Ignore Theme Background)
  if (isOverlay) {
    return (
      <div className="w-full h-screen bg-transparent font-sans overflow-hidden">
        <Routes>
          <Route
            path="/overlay/:tournamentId/:matchId"
            element={<MatchOverlay />}
          />
          <Route
            path="/overlay/tournament-banner/:tournamentId"
            element={<TournamentBanner />}
          />
        </Routes>
      </div>
    );
  }

  // ✅ STANDARD APP LAYOUT
  // Note: We replaced 'bg-black text-gray-200' with dynamic 'theme.bg theme.text'
  return (
    <div
      className={`min-h-screen ${theme.bg} ${theme.text} font-sans selection:bg-cyan-500/30 transition-colors duration-300`}>
      <Navigation />

      <div className="container mx-auto px-4 pb-24 md:pb-10 pt-4">
        {/* --- MOBILE-OPTIMIZED ADMIN COMMAND CENTER --- */}
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
              {/* 👇 UPDATED CLASS HERE 
         Dark: bg-black/40
         Light: bg-gray-50 (Clean separation from the white card)
      */}
              <div
                className={`p-1 rounded-2xl border ${
                  lightMode
                    ? "bg-gray-50 border-gray-200"
                    : "bg-black/40 border-white/5"
                }`}>
                <TournamentSelector
                  tournamentId={tournamentId}
                  setTournamentId={setTournamentId}
                  availableTournaments={availableTournaments}
                />
              </div>

              <div
                className={`p-1 rounded-2xl border ${
                  lightMode
                    ? "bg-gray-50 border-gray-200"
                    : "bg-black/40 border-white/5"
                }`}>
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

            {/* Quick Action Cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (tournamentId) navigate(`/tournaments/${tournamentId}`);
                  else alert("Select a tournament first.");
                }}
                className={`flex items-center gap-3 p-4 border rounded-2xl transition-all active:scale-95 group shadow-lg ${
                  lightMode
                    ? "bg-indigo-50 border-indigo-100 hover:border-indigo-300"
                    : "bg-gradient-to-br from-indigo-900/20 to-indigo-900/10 border-indigo-500/20 hover:border-indigo-400"
                }`}>
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
        <Routes>
          {user ? (
            <Route
              path="/"
              element={
                matchId === "new" ? (
                  <div className="animate-in fade-in zoom-in duration-300 max-w-2xl mx-auto">
                    <div className="flex justify-between items-end mb-6 px-2">
                      <div>
                        <h2
                          className={`text-3xl font-black ${theme.text} uppercase tracking-tighter italic`}>
                          Match Setup
                        </h2>
                        <p
                          className={`text-[10px] ${theme.sub} font-bold uppercase tracking-widest`}>
                          Configuration Phase
                        </p>
                      </div>
                      <button
                        onClick={() => setMatchId(null)}
                        className={`bg-white/5 hover:bg-white/10 ${theme.text} px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all`}>
                        Cancel
                      </button>
                    </div>
                    <div className={`${theme.card} rounded-[2.5rem] p-2`}>
                      <MatchSetup
                        onCreate={handleCreate}
                        tournamentId={tournamentId}
                        allTeams={allTeams}
                        availableTournaments={availableTournaments}
                      />
                    </div>
                  </div>
                ) : (
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

          <Route
            path="/live/:tournamentId/:matchId"
            element={<LiveScoring />}
          />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-tournament" element={<CreateTournament />} />
          <Route
            path="/tournaments/:id/auction"
            element={<AuctionDashboard />}
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
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/register-player"
            element={<GlobalPlayerRegistration />}
          />
          <Route path="/migrate" element={<MigrationTool />} />
          <Route path="/tournaments/:id" element={<TournamentDetails />} />
          <Route
            path="/tournaments/:tournamentId/scorecard/:matchId"
            element={<MatchScorecard />}
          />
          <Route path="/teams" element={<TeamsManager />} />
          <Route path="/past-leagues" element={<PastLeague />} />
        </Routes>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. MAIN EXPORT (Wraps Everything in ThemeProvider)
// ----------------------------------------------------------------------
export default function MainApp() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
