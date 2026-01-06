// src/MainApp.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

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

import {
  createMatchAuto,
  listMatches,
  listTournaments,
  listMyEditableTournaments, // Kept import if needed later for specific filtering
  listAllTeams,
  deleteMatch,
} from "./utils/firestore.js";
import { useAuth } from "./hooks/useAuth.jsx";
import MigrationTool from "./components/MigrationTool.jsx";
import AuctionDashboard from "./pages/AuctionDashboard.jsx";

export default function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [tournamentId, setTournamentId] = useState("");
  const [matchId, setMatchId] = useState(null);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [allMatches, setAllMatches] = useState([]); // Needed for the dropdown only
  const [allTeams, setAllTeams] = useState([]);

  const isMatchesPage =
    location.pathname === "/" || location.pathname === "/scoreboard";

  const navigateToScoring = (tid, mid) => {
    navigate(`/live/${tid}/${mid}`);
  };

  // 1. Initial Data Loading (Updated to fetch ALL tournaments)
  useEffect(() => {
    async function loadInitialData() {
      // Load Teams
      listAllTeams().then(setAllTeams);

      // Load Tournaments
      try {
        // FIX: Previously this used listMyEditableTournaments(user.uid) which hid other tournaments.
        // Now using listTournaments() to ensure 'generic' and others show up.
        const allTournaments = await listTournaments();
        setAvailableTournaments(allTournaments);

        // Auto-select the first one if nothing is selected yet
        if (allTournaments.length > 0 && !tournamentId) {
          setTournamentId(allTournaments[0].id);
        }
      } catch (e) {
        console.error("Error loading tournaments:", e);
      }
    }
    loadInitialData();
  }, [user]); // Re-run if user auth state changes, though logic is now unified

  // 2. Fetch Matches (ONLY for the Dropdown Selector)
  useEffect(() => {
    if (!tournamentId) {
      setAllMatches([]);
      return;
    }
    const fetchData = async () => {
      try {
        const matches = await listMatches(tournamentId);
        // Sort: Most recent / Live matches first for the dropdown
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
      alert(
        "Failed to create match. You might not have permission for this tournament."
      );
    }
  }

  function handleMatchesPageSelect(tournament, matchIdSelected) {
    navigateToScoring(tournament, matchIdSelected);
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200 font-sans">
      <Navigation />
      <div className="container mx-auto px-4 pb-10">
        {/* --- ADMIN COMMAND CENTER --- */}
        {isMatchesPage && user && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-cyan-500">⚡</span> Admin Command Center
            </h2>

            {/* 1. Selectors (To jump to an existing match) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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

            {/* 2. Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Create New Match */}
              <button
                onClick={() => setMatchId("new")}
                className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-cyan-900/40 to-gray-900 border border-cyan-500/30 rounded-xl hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-900/20 transition-all group">
                <div className="bg-cyan-500/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                  <span className="text-3xl">🏏</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">New Match</h3>
                <p className="text-sm text-gray-400 text-center">
                  Schedule or start a game immediately
                </p>
              </button>

              {/* Card B: View Full Dashboard */}
              <button
                onClick={() => {
                  if (tournamentId) navigate(`/tournaments/${tournamentId}`);
                  else alert("Please select a tournament first.");
                }}
                className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-900/40 to-gray-900 border border-purple-500/30 rounded-xl hover:border-purple-400 hover:shadow-lg hover:shadow-purple-900/20 transition-all group">
                <div className="bg-purple-500/20 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  View Full Dashboard
                </h3>
                <p className="text-sm text-gray-400 text-center">
                  See Standings, Stats & Match Lists
                </p>
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
                  // Show Setup UI only when "New Match" is active
                  <div className="animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-white">
                        Match Setup
                      </h2>
                      <button
                        onClick={() => setMatchId(null)}
                        className="text-gray-400 hover:text-white underline text-sm">
                        Cancel
                      </button>
                    </div>
                    <MatchSetup
                      onCreate={handleCreate}
                      tournamentId={tournamentId}
                      allTeams={allTeams}
                      availableTournaments={availableTournaments}
                    />
                  </div>
                ) : (
                  // Default Welcome State
                  <div className="flex flex-col items-center justify-center min-h-[30vh] text-center space-y-4 opacity-50">
                    <p className="text-sm text-gray-500">
                      Select an action above to begin.
                    </p>
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
          <Route path="/tournaments/:id/auction" element={<AuctionDashboard />} />

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
          <Route path="/migrate" element={<MigrationTool />} />
          <Route path="/tournaments/:id" element={<TournamentDetails />} />
          <Route
            path="/tournaments/:tournamentId/scorecard/:matchId"
            element={<MatchScorecard />}
          />
          <Route path="/teams" element={<TeamsManager />} />
        </Routes>
      </div>
    </div>
  );
}
