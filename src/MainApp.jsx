// src/MainApp.jsx
import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./utils/firebase";

// --- COMPONENTS ---
import Navigation from "./components/Navigation.jsx";
import TournamentSelector from "./components/TournamentSelector.jsx";
import MatchSelector from "./components/MatchSelector.jsx";
import MatchScheduler from "./components/MatchScheduler";
import Scoreboard from "./components/Scoreboard.jsx";
import MatchesPage from "./components/Matches.jsx";
import TeamsManager from "./components/TeamManager.jsx";
import Profile from "./components/Profile.jsx";
import Login from "./components/Login.jsx";
import Register from "./components/Register.jsx";
import Dashboard from "./components/Dashboard.jsx";
import BroadcastLayer from "./components/Overlay/BroadcastLayer.jsx";
import OverlayControllerWrapper from "./components/Overlay/OverlayControllerWrapper.jsx";
import RequireAuth from "./components/guards/RequireAuth.jsx";
import RequireTournamentAccess from "./components/guards/RequireTournamentAccess.jsx";
import { useAuth } from "./hooks/useAuth.jsx";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import PublicAuctionViewer from "./components/PublicAuctionViewer.jsx";
import PlayerPhotoUpload from "./components/TournamentTabs/PlayerPhotoUpload.jsx";
import BracketBuilder from "./components/BracketBuilder.jsx";
import Broadcaster from "./components/Overlay/Broadcaster.jsx";
import ObsReceiver from "./components/Overlay/ObsReceiver.jsx";
import RemoteControl from "./components/Overlay/RemoteControl.jsx";

// --- LAZY IMPORTS ---
const LiveScoring = lazy(() => import("./components/LiveScoring.jsx"));
const TournamentDetails = lazy(
  () => import("./components/TournamentDetails.jsx"),
);
const MatchScorecard = lazy(() => import("./components/MatchScorecard.jsx"));
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
const TournamentPlayersView = lazy(
  () => import("./components/TournamentPlayersView.jsx"),
);
const PastLeague = lazy(() => import("./components/PastLeague.jsx"));
const MatchOverlay = lazy(
  () => import("./components/Overlay/MatchOverlay.jsx"),
);
const TournamentBanner = lazy(
  () => import("./components/Overlay/TournamentBanner.jsx"),
);
const CinematicLanding = lazy(
  () => import("./components/landing/CinematicLanding.jsx"),
);

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
  const obsCast =
    location.pathname === "/broadcast" ||
    location.pathname.startsWith("/obs") ||
    location.pathname.startsWith("/remote");
  const isRegistration =
    location.pathname.startsWith("/register-player") ||
    location.pathname.startsWith("/view-players");
  const isMatchesPage =
    location.pathname === "/" || location.pathname === "/scoreboard";

  // --- 🔄 1. REAL-TIME DATA LISTENER ---
  useEffect(() => {
    const teamsQuery = query(collection(db, "teams"), orderBy("name", "asc"));
    const unsubTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllTeams(teamsData);
    });

    const tournamentsQuery = query(collection(db, "tournaments"));
    const unsubTournaments = onSnapshot(tournamentsQuery, (snapshot) => {
      const tourneys = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableTournaments(tourneys);

      if (tourneys.length > 0 && !tournamentId) {
        setTournamentId(tourneys[0].id);
      }
    });

    return () => {
      unsubTeams();
      unsubTournaments();
    };
  }, []);

  // 🚦 SMART ROUTING: Directs clicks based on Auth Status
  function handleMatchesPageSelect(tournament, matchIdSelected) {
    if (user) {
      // Logged in: Go straight to the Scoring Input Console
      navigate(`/live/${tournament}/${matchIdSelected}`);
    } else {
      // Public: Go to the beautifully formatted Match Scorecard
      navigate(`/tournaments/${tournament}/scorecard/${matchIdSelected}`);
    }
  }

  // ✅ OVERLAY & BROADCAST VIEWS
  if (isOverlay) {
    return (
      <div className="w-full h-screen bg-transparent font-sans overflow-hidden">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Loading overlay...
            </div>
          }
        >
          <Routes>
            <Route
              path="/overlay/:tournamentId/:matchId"
              element={<MatchOverlay />}
            />
            <Route
              path="/overlay/tournament-banner/:tournamentId"
              element={<TournamentBanner />}
            />
            <Route
              path="/overlay/:tournamentId/broadcast/active"
              element={<BroadcastLayer />}
            />
          </Routes>
        </Suspense>
      </div>
    );
  }

  if (obsCast) {
    return (
      <div className="w-full h-screen bg-transparent font-sans overflow-hidden">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Loading broadcast...
            </div>
          }
        >
          <Routes>
            <Route path="/broadcast" element={<Broadcaster />} />
            <Route path="/obs/:streamId" element={<ObsReceiver />} />
            <Route path="/remote/:streamId" element={<RemoteControl />} />
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
          path="/register-player/:tournamentId"
          element={<GlobalPlayerRegistration />}
        />
        <Route
          path="/view-players/:tournamentId"
          element={<TournamentPlayersView />}
        />
      </Routes>
    );
  }

  // ✅ MAIN APPLICATION LAYOUT
  return (
    <div
      className={`min-h-screen ${theme.bg} ${theme.text} font-sans transition-colors duration-300 relative`}
    >
      {/* --- LAYER 1: CINEMATIC BACKGROUND (Visible to Everyone on Root) --- */}
      {isMatchesPage && (
        <div className="fixed inset-0 z-0 pointer-events-auto overflow-hidden">
          {/* 🏟️ THE STADIUM BACKGROUND */}
          <div
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
              // PRO-TIP: Replace these URLs with real stadium images from your public folder later!
              lightMode
                ? 'bg-[url("/light-stadium.jpg")] opacity-30'
                : 'bg-[url("/dark-stadium.jpg")] opacity-20'
            }`}
          />

          {/* 🌓 VIGNETTE (Keeps text legible over the stadium) */}
          <div
            className={`absolute inset-0 z-10 pointer-events-none transition-colors duration-500 ${
              lightMode
                ? "bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(243,244,246,0.95)_100%)]"
                : "bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,5,0.95)_100%)]"
            }`}
          />

          <Suspense fallback={<div className="w-full h-full bg-transparent" />}>
            <CinematicLanding lightMode={lightMode} />
          </Suspense>
        </div>
      )}

      {/* --- LAYER 2: UI OVERLAY --- */}
      <div className="relative z-10">
        <Navigation className="pointer-events-auto" />

        <div className="container mx-auto px-4 pb-24 md:pb-10 pt-4">
          <Suspense
            fallback={
              <div
                className={`min-h-[50vh] flex items-center justify-center text-xs font-black uppercase tracking-[0.3em] ${theme.sub}`}
              >
                Loading module...
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <div className="flex flex-col w-full pointer-events-none">
                    {/* --- SCROLL 1: HERO --- */}
                    <section className="h-[100vh] flex items-center px-4 md:px-10">
                      <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <h1
                          className={`text-7xl md:text-9xl font-black italic uppercase leading-none drop-shadow-2xl ${lightMode ? "text-gray-900" : "text-white"}`}
                        >
                          CricSync <br />{" "}
                          <span className="text-cyan-500">Live</span>
                        </h1>
                        <p
                          className={`text-xl md:text-2xl font-bold uppercase tracking-[0.3em] mt-6 ${lightMode ? "text-gray-500" : "text-white/70"}`}
                        >
                          The Complete Tournament OS
                        </p>
                        <div className="mt-12 text-sm font-bold tracking-widest text-cyan-500/50 uppercase animate-pulse">
                          Scroll to explore ↓
                        </div>
                      </div>
                    </section>

                    {/* --- SCROLL 2: LIVE SCORING --- */}
                    <section className="h-[100vh] flex items-center justify-start px-4 md:px-10">
                      <div className="max-w-xl">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-px w-12 bg-teal-500"></div>
                          <span className="text-teal-500 font-bold uppercase tracking-widest text-xs">
                            Module 01
                          </span>
                        </div>
                        <h2
                          className={`text-5xl md:text-7xl font-black uppercase italic mb-6 drop-shadow-lg ${lightMode ? "text-gray-900" : "text-white"}`}
                        >
                          Real-Time <br />{" "}
                          <span className="text-teal-500">Precision</span>
                        </h2>
                        <p
                          className={`text-lg font-medium drop-shadow-md ${lightMode ? "text-gray-600" : "text-gray-300"}`}
                        >
                          Low-latency scoring updates with comprehensive player
                          and tournament statistics. Track individual and team
                          performances both locally and across the global
                          leaderboards.
                        </p>
                      </div>
                    </section>

                    {/* --- SCROLL 3: BROADCAST OVERLAYS --- */}
                    <section className="h-[100vh] flex items-center justify-end px-4 md:px-10 text-right">
                      <div className="max-w-xl flex flex-col items-end">
                        <div className="flex items-center gap-4 mb-4">
                          <span className="text-red-500 font-bold uppercase tracking-widest text-xs">
                            Module 02
                          </span>
                          <div className="h-px w-12 bg-red-500"></div>
                        </div>
                        <h2
                          className={`text-5xl md:text-7xl font-black uppercase italic mb-6 drop-shadow-lg ${lightMode ? "text-gray-900" : "text-white"}`}
                        >
                          Broadcast <br />{" "}
                          <span className="text-red-600">Graphics</span>
                        </h2>
                        <p
                          className={`text-lg font-medium drop-shadow-md ${lightMode ? "text-gray-600" : "text-gray-300"}`}
                        >
                          Cloud-controlled OBS overlays. Instantly push
                          TV-quality lower thirds, live score bugs, and dynamic
                          player profiles to your streams using our remote
                          broadcast director.
                        </p>
                      </div>
                    </section>

                    {/* --- SCROLL 4: AUCTION PLATFORM --- */}
                    <section className="h-[100vh] flex items-center justify-start px-4 md:px-10">
                      <div className="max-w-xl">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-px w-12 bg-amber-500"></div>
                          <span className="text-amber-500 font-bold uppercase tracking-widest text-xs">
                            Module 03
                          </span>
                        </div>
                        <h2
                          className={`text-5xl md:text-7xl font-black uppercase italic mb-6 drop-shadow-lg ${lightMode ? "text-gray-900" : "text-white"}`}
                        >
                          Live <br />{" "}
                          <span className="text-amber-500">Auctions</span>
                        </h2>
                        <p
                          className={`text-lg font-medium drop-shadow-md ${lightMode ? "text-gray-600" : "text-gray-300"}`}
                        >
                          Host IPL-style mega auctions. Manage global player
                          registrations, organize squads, and execute intense
                          live bidding wars with a real-time public viewer.
                        </p>
                      </div>
                    </section>

                    {/* --- SCROLL 5: TOURNAMENT BRACKETS --- */}
                    <section className="h-[100vh] flex items-center justify-end px-4 md:px-10 text-right">
                      <div className="max-w-xl flex flex-col items-end">
                        <div className="flex items-center gap-4 mb-4">
                          <span className="text-fuchsia-500 font-bold uppercase tracking-widest text-xs">
                            Module 04
                          </span>
                          <div className="h-px w-12 bg-fuchsia-500"></div>
                        </div>
                        <h2
                          className={`text-5xl md:text-7xl font-black uppercase italic mb-6 drop-shadow-lg ${lightMode ? "text-gray-900" : "text-white"}`}
                        >
                          Auto <br />{" "}
                          <span className="text-fuchsia-600">Brackets</span>
                        </h2>
                        <p
                          className={`text-lg font-medium drop-shadow-md ${lightMode ? "text-gray-600" : "text-gray-300"}`}
                        >
                          Generate visual knockout trees and fixtures. Keep
                          teams and fans automatically updated as the tournament
                          progresses from qualifiers to the grand finale.
                        </p>
                      </div>
                    </section>

                    {/* --- SCROLL 6: MATCH CENTER (Destination) --- */}
                    <section
                      className={`min-h-screen relative z-20 pointer-events-auto pt-24 pb-20 px-4 md:px-10 bg-gradient-to-b ${
                        lightMode
                          ? "from-transparent via-gray-50 to-gray-100"
                          : "from-transparent via-[#0f0f0f] to-[#050505]"
                      }`}
                    >
                      <div className="max-w-7xl mx-auto">
                        <div className="mb-12 text-center relative flex flex-col items-center justify-center">
                          <h2 className="text-sm font-black tracking-[0.4em] uppercase text-cyan-500 mb-2">
                            Match Center
                          </h2>
                          <div className="h-1 w-24 bg-cyan-500 rounded-full opacity-50 mb-8"></div>

                          {/* 🌍 GLOBAL FILTER & ACTIONS */}
                          <div className="flex flex-wrap justify-center items-center gap-4 w-full max-w-2xl mx-auto">
                            {/* Selector is now visible to everyone and filters the UI */}
                            <div className="flex-1 min-w-[250px]">
                              <TournamentSelector
                                tournamentId={tournamentId}
                                setTournamentId={setTournamentId}
                                availableTournaments={availableTournaments}
                              />
                            </div>

                            {/* 👑 ADMIN ONLY: Create Match Button */}
                            {user && (
                              <button
                                onClick={() => setMatchId("new")}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 active:scale-95 whitespace-nowrap border border-cyan-400/50"
                              >
                                + Create Match
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 👑 ADMIN ONLY: Match Scheduler Dropdown */}
                        {user && matchId === "new" && (
                          <div
                            className={`mb-12 p-6 border rounded-3xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 shadow-2xl ${
                              lightMode
                                ? "bg-white/80 border-cyan-200"
                                : "bg-black/60 border-cyan-500/30"
                            }`}
                          >
                            <div
                              className={`flex justify-between items-center mb-6 border-b pb-4 ${lightMode ? "border-gray-200" : "border-white/10"}`}
                            >
                              <h3
                                className={`text-xl font-black italic uppercase tracking-tight ${theme.text}`}
                              >
                                Schedule New Match
                              </h3>
                              <button
                                onClick={() => setMatchId(null)}
                                className="text-gray-400 hover:text-cyan-500 text-xs font-bold uppercase tracking-widest transition-colors"
                              >
                                Close ✕
                              </button>
                            </div>
                            {tournamentId ? (
                              <MatchScheduler
                                tournamentId={tournamentId}
                                teams={allTeams}
                                onCancel={() => setMatchId(null)}
                              />
                            ) : (
                              <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl text-center">
                                <span className="text-red-400 text-sm font-bold uppercase tracking-widest">
                                  ⚠️ Please select a tournament from the
                                  dropdown above first.
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* UNIVERSAL MATCH LIST (Now dynamically filtered!) */}
                        <div
                          className={`border rounded-3xl p-8 backdrop-blur-md shadow-2xl ${
                            lightMode
                              ? "bg-white/50 border-gray-200"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          <MatchesPage
                            // This ensures the MatchesPage only renders the tournament selected in the dropdown!
                            availableTournaments={availableTournaments.filter(
                              (t) => t.id === tournamentId,
                            )}
                            teams={allTeams}
                            onSelect={handleMatchesPageSelect}
                            readOnly={!user}
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                }
              />

              {/* Keep your existing other Sub-Pages here... */}
              <Route
                path="/live/:tournamentId/:matchId"
                element={
                  <RequireTournamentAccess>
                    <LiveScoring />
                  </RequireTournamentAccess>
                }
              />
              <Route
                path="/broadcast-control/:tournamentId/:matchId"
                element={<OverlayControllerWrapper />}
              />
              <Route
                path="/broadcast-control/:tournamentId/"
                element={<OverlayControllerWrapper />}
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
                path="/tournaments/:id/auction/live"
                element={<PublicAuctionViewer />}
              />
              <Route
                path="/tournaments/:id/upload-photo"
                element={<PlayerPhotoUpload />}
              />
              <Route
                path="/matches"
                element={
                  <MatchesPage
                    availableTournaments={availableTournaments}
                    teams={allTeams}
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
              <Route path="/tournaments/:id" element={<TournamentDetails />} />
              <Route
                path="/tournaments/:tournamentId/scorecard/:matchId"
                element={<MatchScorecard />}
              />
              <Route
                path="/tournaments/:id/bracket"
                element={<BracketBuilder />}
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
    </div>
  );
}

export default function MainApp() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
