// src/MainApp.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

import Navigation from "./components/Navigation.jsx";
import TournamentSelector from "./components/TournamentSelector.jsx";
import MatchSelector from "./components/MatchSelector.jsx";
import MatchList from "./components/MatchList.jsx";
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

import {
  createMatchAuto,
  listMatches,
  listTournaments,
  listMyEditableTournaments,
  listAllTeams,
  deleteMatch,
} from "./utils/firestore.js";
import { useAuth } from "./hooks/useAuth.jsx";

export default function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [tournamentId, setTournamentId] = useState("");
  const [matchId, setMatchId] = useState(null);
  const [availableTournaments, setAvailableTournaments] = useState([]);

  // --- MATCH STATES ---
  // We keep 'allMatches' for the selector, but we also filter for the lists.
  const [allMatches, setAllMatches] = useState([]);
  const [ongoingMatches, setOngoingMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [finishedMatches, setFinishedMatches] = useState([]);

  const [allTeams, setAllTeams] = useState([]);

  const isMatchesPage =
    location.pathname === "/" || location.pathname === "/scoreboard";

  const navigateToScoring = (tid, mid) => {
    navigate(`/live/${tid}/${mid}`);
  };

  // RBAC Loading
  useEffect(() => {
    async function loadInitialData() {
      listAllTeams().then(setAllTeams);
      if (user) {
        try {
          const myTournaments = await listMyEditableTournaments(user.uid);
          setAvailableTournaments(myTournaments);
        } catch (e) {
          console.error(e);
        }
      } else {
        listTournaments().then(setAvailableTournaments);
      }
    }
    loadInitialData();
  }, [user]);

  // Fetch Matches & Categorize
  useEffect(() => {
    if (!tournamentId) {
      setAllMatches([]);
      setOngoingMatches([]);
      setUpcomingMatches([]);
      setFinishedMatches([]);
      return;
    }

    const fetchData = async () => {
      const matches = await listMatches(tournamentId);
      setAllMatches(matches);

      // --- FILTERING LOGIC ---
      const live = matches.filter(
        (m) => m.status === "in-progress" || m.status === "ongoing"
      );
      const finished = matches.filter((m) => m.status === "finished");
      // Upcoming is anything not live and not finished (e.g. "upcoming", "created", "scheduled")
      const upcoming = matches.filter(
        (m) => !live.includes(m) && !finished.includes(m)
      );

      setOngoingMatches(live);
      setFinishedMatches(finished);
      setUpcomingMatches(upcoming);
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
      alert("Failed to create match. Permission denied.");
    }
  }

  // Delete and Refresh
  const handleDeleteWrapper = async (matchIdToDelete) => {
    if (!window.confirm("Are you sure you want to delete this match?")) return;
    try {
      await deleteMatch(tournamentId, matchIdToDelete);

      // Re-fetch to update all lists
      const matches = await listMatches(tournamentId);
      setAllMatches(matches);

      const live = matches.filter(
        (m) => m.status === "in-progress" || m.status === "ongoing"
      );
      const finished = matches.filter((m) => m.status === "finished");
      const upcoming = matches.filter(
        (m) => !live.includes(m) && !finished.includes(m)
      );

      setOngoingMatches(live);
      setFinishedMatches(finished);
      setUpcomingMatches(upcoming);

      if (matchId === matchIdToDelete) setMatchId(null);
    } catch (err) {
      alert("Error deleting match: " + err.message);
    }
  };

  function handleMatchesPageSelect(tournament, matchIdSelected) {
    navigateToScoring(tournament, matchIdSelected);
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200 font-sans">
      <Navigation />
      <div className="container mx-auto px-4 pb-10">
        {isMatchesPage && user && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Top Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                availableMatches={allMatches} // Selector shows ALL matches
              />
            </div>

            {/* 1. LIVE MATCHES (High Priority) */}
            {ongoingMatches.length > 0 && (
              <div className="mt-8 mb-8">
                <h5 className="text-red-500 font-black text-xl mb-4 border-b border-gray-800 pb-2 flex items-center gap-2 animate-pulse">
                  <span>🔴</span> LIVE ACTION
                </h5>
                <MatchList
                  availableMatches={ongoingMatches}
                  matchId={matchId}
                  onClickMatch={(id) => navigateToScoring(tournamentId, id)}
                  readOnly={!user}
                  onDelete={handleDeleteWrapper}
                />
              </div>
            )}

            {/* 2. UPCOMING MATCHES */}
            <div className="mt-8">
              <h5 className="text-blue-400 font-bold text-lg mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
                <span>📅</span> Upcoming Fixtures
                <span className="text-sm text-gray-500 font-normal ml-auto">
                  Click to Start Toss
                </span>
              </h5>
              <MatchList
                availableMatches={upcomingMatches}
                matchId={matchId}
                onClickMatch={(id) => navigateToScoring(tournamentId, id)}
                readOnly={!user}
                onDelete={handleDeleteWrapper}
              />
            </div>

            {/* 3. FINISHED MATCHES */}
            {finishedMatches.length > 0 && (
              <div className="mt-8">
                <h5 className="text-gray-500 font-bold text-sm mb-4 border-b border-gray-800 pb-2 uppercase tracking-widest">
                  Past Results
                </h5>
                <MatchList
                  availableMatches={finishedMatches}
                  matchId={matchId}
                  onClickMatch={(id) =>
                    navigate(`/tournaments/${tournamentId}/scorecard/${id}`)
                  }
                  readOnly={!user}
                  onDelete={handleDeleteWrapper}
                />
              </div>
            )}
          </div>
        )}

        <Routes>
          {user ? (
            <Route
              path="/"
              element={
                !matchId || matchId !== "new" ? (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                      <div className="absolute -inset-1 bg-cyan-500 rounded-full blur opacity-20 animate-pulse"></div>
                      <div className="relative text-7xl">🏏</div>
                    </div>
                    <div>
                      <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                        Ready to{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                          Score?
                        </span>
                      </h1>
                      <p className="text-gray-400 max-w-md mx-auto">
                        Select a match above to enter the Live Console.
                      </p>
                      <button
                        onClick={() => setMatchId("new")}
                        className="mt-6 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all">
                        + Start New Match
                      </button>
                    </div>
                  </div>
                ) : (
                  <MatchSetup
                    onCreate={handleCreate}
                    tournamentId={tournamentId}
                    allTeams={allTeams}
                    availableTournaments={availableTournaments}
                  />
                )
              }
            />
          ) : (
            <Route path="/" element={<Dashboard  />} />
          )}
          <Route
            path="/live/:tournamentId/:matchId"
            element={<LiveScoring />}
          />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-tournament" element={<CreateTournament />} />
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
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
