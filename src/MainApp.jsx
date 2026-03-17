// src/MainApp.jsx
import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./utils/firebase";

// --- ICONS ---
import { Activity, PlayCircle, PlusCircle, Trophy, Users } from "lucide-react";

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
const TournamentDetails = lazy(() => import("./components/TournamentDetails.jsx"));
const MatchScorecard = lazy(() => import("./components/MatchScorecard.jsx"));
import Dashboard from "./components/Dashboard.jsx";
const CreateTournament = lazy(() => import("./components/CreateTournament.jsx"));
const GlobalPlayersView = lazy(() => import("./components/GlobalPlayersView.jsx"));
const MigrationTool = lazy(() => import("./components/MigrationTool.jsx"));
const AuctionDashboard = lazy(() => import("./components/AuctionDashboard.jsx"));
const GlobalPlayerRegistration = lazy(() => import("./components/GlobalPlayerRegistration.jsx"));
const TournamentPlayersView = lazy(() => import("./components/TournamentPlayersView.jsx"));
const PastLeague = lazy(() => import("./components/PastLeague.jsx"));
const MatchOverlay = lazy(() => import("./components/Overlay/MatchOverlay.jsx"));
const TournamentBanner = lazy(() => import("./components/Overlay/TournamentBanner"));

import BroadcastLayer from "./components/Overlay/BroadcastLayer.jsx";
import OverlayControllerWrapper from "./components/Overlay/OverlayControllerWrapper.jsx";

import RequireAuth from "./components/guards/RequireAuth.jsx";
import RequireTournamentAccess from "./components/guards/RequireTournamentAccess.jsx";

import { useAuth } from "./hooks/useAuth.jsx";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import PublicAuctionViewer from "./components/PublicAuctionViewer.jsx";
import PlayerPhotoUpload from "./components/TournamentTabs/PlayerPhotoUpload.jsx";
import Broadcaster from "./components/Overlay/Broadcaster.jsx";
import ObsReceiver from "./components/Overlay/ObsReceiver.jsx";

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
  const [allTeams, setAllTeams] = useState([]);

  // Route Helpers
  const isOverlay = location.pathname.startsWith("/overlay");
  const obsCast = location.pathname === "/broadcast" || location.pathname.startsWith("/obs");  
  const isRegistration =
    location.pathname.startsWith("/register-player") ||
    location.pathname.startsWith("/view-players");
  const isMatchesPage =
    location.pathname === "/" || location.pathname === "/scoreboard";

  const navigateToScoring = (tid, mid) => {
    navigate(`/live/${tid}/${mid}`);
  };

  // --- 🔄 1. REAL-TIME DATA LISTENER ---
  useEffect(() => {
    // A. Listen for Teams
    const teamsQuery = query(collection(db, "teams"), orderBy("name", "asc"));
    const unsubTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllTeams(teamsData);
    });

    // B. Listen for Tournaments
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
  }, []);

  function handleMatchesPageSelect(tournament, matchIdSelected) {
    navigateToScoring(tournament, matchIdSelected);
  }

  // ✅ OVERLAY VIEW
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
            <Route path="/overlay/:tournamentId/:matchId" element={<MatchOverlay />} />
            <Route path="/overlay/tournament-banner/:tournamentId" element={<TournamentBanner />} />
            <Route path="/overlay/:tournamentId/broadcast/active" element={<BroadcastLayer />} />
            {/* <Route path="/overlay/:tournamentId/auction/live" element={<PublicAuctionViewer />} /> */}
          </Routes>
        </Suspense>
      </div>
    );
  }

  if(obsCast) {
    return (
      <div className="w-full h-screen bg-transparent font-sans overflow-hidden">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            Loading broadcast...
          </div>
        }>
          <Routes>
            <Route path="/broadcast" element={<Broadcaster />} />
            <Route path="/obs/:streamId" element={<ObsReceiver />} />
          </Routes>
        </Suspense>
      </div>
    );
  }


  if (isRegistration) {
    return (
      <Routes>
        <Route path="/register-player" element={<GlobalPlayerRegistration />} />
        <Route path="/register-player/:tournamentId" element={<GlobalPlayerRegistration />} />
        <Route path="/view-players/:tournamentId" element={<TournamentPlayersView />} />
      </Routes>
    );
  }

  // ✅ MAIN APPLICATION LAYOUT
  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans transition-colors duration-300`}>
      <Navigation />

      <div className="container mx-auto px-4 pb-24 md:pb-10 pt-4">
        
        {/* --- IMPROVED ADMIN DASHBOARD --- */}
        {isMatchesPage && user && (
          <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-top-6 duration-700">
            {/* 1. WELCOME & SELECTORS */}
            <div className={`${theme.card} rounded-3xl p-6 shadow-2xl border ${lightMode ? "border-gray-100" : "border-white/5"}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className={`text-2xl font-black ${theme.text} tracking-tight`}>
                    Hello, {user?.firstName || user?.email?.split("@")[0]} 👋
                  </h1>
                  <p className={`text-xs mt-1 font-bold uppercase tracking-widest ${theme.sub}`}>
                    Ready for the next ball?
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Activity size={24} />
                </div>
              </div>

              {/* QUICK SELECTORS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 rounded-2xl bg-black/5 dark:bg-black/20">
                <TournamentSelector
                  tournamentId={tournamentId}
                  setTournamentId={setTournamentId}
                  availableTournaments={availableTournaments}
                />
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

            {/* 2. SMART ACTION TILES */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* ACTION: RESUME MATCH */}
              <button
                onClick={() => {
                  if (tournamentId && matchId && matchId !== "new") {
                    navigateToScoring(tournamentId, matchId);
                  } else {
                    alert("Please select an active match from the dropdown first.");
                  }
                }}
                className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group
                  ${lightMode ? "bg-teal-50 border-teal-100 hover:bg-teal-100" : "bg-gradient-to-br from-teal-900/20 to-transparent border-teal-500/20 hover:border-teal-500/40"}`}>
                <div className="bg-teal-500 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <PlayCircle size={20} fill="currentColor" />
                </div>
                <div>
                  <h3 className={`font-black text-xs uppercase tracking-widest ${theme.text}`}>Resume</h3>
                  <p className="text-[10px] text-teal-500 font-bold opacity-80 uppercase">Active Match</p>
                </div>
              </button>

              {/* ACTION: NEW MATCH */}
              <button
                onClick={() => {
                  if (!tournamentId) {
                    alert("Please select a tournament first.");
                    return;
                  }
                  setMatchId("new");
                  navigate("/"); // Triggers the MatchScheduler logic below
                }}
                className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group
                  ${lightMode ? "bg-cyan-50 border-cyan-100 hover:bg-cyan-100" : "bg-gradient-to-br from-cyan-900/20 to-transparent border-cyan-500/20 hover:border-cyan-500/40"}`}>
                <div className="bg-cyan-500 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h3 className={`font-black text-xs uppercase tracking-widest ${theme.text}`}>Create</h3>
                  <p className="text-[10px] text-cyan-500 font-bold opacity-80 uppercase">New Match</p>
                </div>
              </button>

              {/* ACTION: TOURNAMENT STANDINGS */}
              <button
                onClick={() => {
                  if (tournamentId) navigate(`/tournaments/${tournamentId}`);
                  else alert("Select a tournament first.");
                }}
                className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group
                  ${lightMode ? "bg-indigo-50 border-indigo-100 hover:bg-indigo-100" : "bg-gradient-to-br from-indigo-900/20 to-transparent border-indigo-500/20 hover:border-indigo-500/40"}`}>
                <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className={`font-black text-xs uppercase tracking-widest ${theme.text}`}>Rankings</h3>
                  <p className="text-[10px] text-indigo-500 font-bold opacity-80 uppercase">View Table</p>
                </div>
              </button>

              {/* ACTION: MANAGE SQUADS */}
              <button
                onClick={() => navigate(`/teams`)}
                className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group
                  ${lightMode ? "bg-orange-50 border-orange-100 hover:bg-orange-100" : "bg-gradient-to-br from-orange-900/20 to-transparent border-orange-500/20 hover:border-orange-500/40"}`}>
                <div className="bg-orange-500 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className={`font-black text-xs uppercase tracking-widest ${theme.text}`}>Squads</h3>
                  <p className="text-[10px] text-orange-500 font-bold opacity-80 uppercase">Edit Players</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* --- ROUTES --- */}
        <Suspense
          fallback={
            <div className={`min-h-[50vh] flex items-center justify-center text-xs font-black uppercase tracking-[0.3em] ${theme.sub}`}>
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
                          <h2 className={`text-3xl font-black ${theme.text} uppercase tracking-tighter italic`}>
                            Match Control
                          </h2>
                          <p className={`text-[10px] ${theme.sub} font-bold uppercase tracking-widest`}>
                            {tournamentId
                              ? `Scheduling for: ${availableTournaments.find((t) => t.id === tournamentId)?.name || "Selected Tournament"}`
                              : "Select a Tournament to Schedule"}
                          </p>
                        </div>
                      </div>

                      {/* ✅ UNIFIED SCHEDULER */}
                      {tournamentId ? (
                        <MatchScheduler
                          tournamentId={tournamentId}
                          teams={allTeams}
                          onCancel={() => setMatchId(null)}
                        />
                      ) : (
                        <div className={`p-8 rounded-2xl text-center border border-dashed ${lightMode ? "bg-red-50 border-red-200 text-red-600" : "bg-red-900/10 border-red-500/30 text-red-400"}`}>
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
                    // Default Dashboard State (Now much cleaner since actions are above)
                    <div className="flex flex-col items-center justify-center min-h-[30vh] text-center space-y-6">
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
            <Route path="/live/:tournamentId/:matchId" element={<RequireTournamentAccess><LiveScoring /></RequireTournamentAccess>} />
            <Route path="/broadcast-control/:tournamentId/:matchId" element={<OverlayControllerWrapper />} />            
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-tournament" element={<RequireAuth><CreateTournament /></RequireAuth>} />
            <Route path="/tournaments/:id/auction" element={<RequireTournamentAccess requireEdit><AuctionDashboard /></RequireTournamentAccess>} />
            <Route path="/tournaments/:id/auction/live" element={<PublicAuctionViewer />} />
            <Route path="/tournaments/:id/upload-photo" element={<PlayerPhotoUpload />} />
            <Route path="/matches" element={<MatchesPage availableTournaments={availableTournaments} onSelect={handleMatchesPageSelect} readOnly={!user} />} />
            <Route path="/players" element={<GlobalPlayersView />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/migrate" element={<RequireAuth><MigrationTool /></RequireAuth>} />
            <Route path="/tournaments/:id" element={<TournamentDetails />} />
            <Route path="/tournaments/:tournamentId/scorecard/:matchId" element={<RequireTournamentAccess><MatchScorecard /></RequireTournamentAccess>} />
            <Route path="/teams" element={<RequireAuth><TeamsManager /></RequireAuth>} />
            <Route path="/past-leagues" element={<RequireAuth><PastLeague /></RequireAuth>} />
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