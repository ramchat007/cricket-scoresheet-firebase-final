// src/components/MatchSelector.jsx
import React, { useEffect, useState, useMemo } from "react";
import { listMatchesForTournament } from "../utils/firestore"; // Import the correct fetcher

export default function MatchSelector({
  matchId,
  setMatchId,
  tournamentId, // Now requires tournamentId to fetch data
}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch Matches (Logic copied from TournamentDetails)
  useEffect(() => {
    if (!tournamentId) {
      setMatches([]);
      return;
    }

    const fetchMatches = async () => {
      setLoading(true);
      try {
        // Use the same function as TournamentDetails
        const matchesData = await listMatchesForTournament(tournamentId);
        setMatches(matchesData);
      } catch (err) {
        console.error("Error fetching matches for selector:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [tournamentId]);

  // 2. Categorization & Sorting (Logic copied from TournamentDetails)
  const groupedMatches = useMemo(() => {
    const live = [];
    const upcoming = [];
    const finished = [];

    matches.forEach((m) => {
      // Robust status check
      const status = m.status || m.meta?.status || "upcoming";
      const normStatus = status.toLowerCase();

      if (normStatus === "finished" || normStatus === "completed") {
        finished.push(m);
      } else if (
        normStatus === "in-progress" ||
        normStatus === "ongoing" ||
        normStatus === "live"
      ) {
        live.push(m);
      } else {
        upcoming.push(m);
      }
    });

    return {
      live,
      // Sort Upcoming: Earliest Date First (Ascending)
      upcoming: upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)),
      // Sort Finished: Latest Date First (Descending)
      finished: finished.sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
  }, [matches]);

  // Helper to format the display name
  const getMatchLabel = (m) => {
    const teamA = m.teamA || m.meta?.teamA || "Team A";
    const teamB = m.teamB || m.meta?.teamB || "Team B";
    const name = m.name || m.meta?.name || `${teamA} vs ${teamB}`;
    return `${m.date} : ${name}`;
  };

  return (
    <div className="mb-4">
      <label className="block text-gray-400 text-sm font-medium mb-2 uppercase tracking-wider">
        Select Match{" "}
        {loading && (
          <span className="text-cyan-500 animate-pulse text-xs ml-2">
            Loading...
          </span>
        )}
      </label>

      <div className="flex flex-col md:flex-row gap-3">
        <select
          value={matchId || ""}
          onChange={(e) => setMatchId(e.target.value)}
          disabled={loading}
          className="w-full md:flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer max-w-full disabled:opacity-50">
          <option value="" className="text-gray-500">
            -- Choose a Match --
          </option>

          {/* 🔴 LIVE GROUP */}
          {groupedMatches.live.length > 0 && (
            <optgroup label="🔴 LIVE ACTION">
              {groupedMatches.live.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-gray-800 font-bold">
                  ⚡ {getMatchLabel(m)}
                </option>
              ))}
            </optgroup>
          )}

          {/* 📅 UPCOMING GROUP */}
          {groupedMatches.upcoming.length > 0 && (
            <optgroup label="📅 UPCOMING">
              {groupedMatches.upcoming.map((m) => (
                <option key={m.id} value={m.id} className="bg-gray-800">
                  {getMatchLabel(m)}
                </option>
              ))}
            </optgroup>
          )}

          {/* ✅ FINISHED GROUP */}
          {groupedMatches.finished.length > 0 && (
            <optgroup label="✅ COMPLETED">
              {groupedMatches.finished.map((m) => (
                <option key={m.id} value={m.id} className="bg-gray-800">
                  🏁 {getMatchLabel(m)}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <button
          onClick={() => setMatchId("new")}
          className="w-full md:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg shadow-[0_0_10px_rgba(8,145,178,0.5)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] transition-all whitespace-nowrap border border-transparent">
          + Start New Match
        </button>
      </div>
    </div>
  );
}
