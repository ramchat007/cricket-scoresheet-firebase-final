import React, { useEffect, useState, useMemo } from "react";
import { listMatchesForTournament } from "../utils/firestore"; 

export default function MatchSelector({
  matchId,
  setMatchId,
  tournamentId,
}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch Matches with Error Boundary logic
  useEffect(() => {
    if (!tournamentId) {
      setMatches([]);
      return;
    }

    const fetchMatches = async () => {
      setLoading(true);
      try {
        const matchesData = await listMatchesForTournament(tournamentId);
        // Ensure matchesData is always an array
        setMatches(Array.isArray(matchesData) ? matchesData : []);
      } catch (err) {
        console.error("Error fetching matches for selector:", err);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [tournamentId]);

  // 2. Categorization Logic Refined
  const groupedMatches = useMemo(() => {
    const live = [];
    const upcoming = [];
    const finished = [];

    matches.forEach((m) => {
      const status = (m.status || m.meta?.status || "upcoming").toLowerCase();

      if (["finished", "completed", "done"].includes(status)) {
        finished.push(m);
      } else if (["in-progress", "ongoing", "live", "started"].includes(status)) {
        live.push(m);
      } else {
        upcoming.push(m);
      }
    });

    return {
      live,
      // Upcoming: Soonest first
      upcoming: upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)),
      // Finished: Most recent first
      finished: finished.sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
  }, [matches]);

  // Helper for Clean Mobile Labels
  const getMatchLabel = (m) => {
    const teamA = m.teamAName || m.meta?.teamAName || m.teamA || "Team A";
    const teamB = m.teamBName || m.meta?.teamBName || m.teamB || "Team B";
    
    // Format Date for Mobile space (e.g., "10 Jan")
    let displayDate = "";
    if (m.date) {
        const d = new Date(m.date);
        displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }

    return `${displayDate} | ${teamA} vs ${teamB}`;
  };

  return (
    <div className="mb-4 group">
      {/* Label with Refined Sync State */}
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-1 flex justify-between items-center">
        <span>Fixture Selection</span>
        {loading ? (
          <span className="text-cyan-400 animate-pulse font-bold tracking-normal flex items-center gap-1">
            <span className="w-1 h-1 bg-cyan-400 rounded-full animate-ping"></span>
            Syncing...
          </span>
        ) : (
          <span className="text-gray-600 font-bold">{matches.length} Total</span>
        )}
      </label>

      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <select
            value={matchId || ""}
            onChange={(e) => setMatchId(e.target.value)}
            disabled={loading || !tournamentId}
            className={`
              w-full appearance-none rounded-2xl px-5 py-4 text-sm font-black transition-all border
              outline-none ring-0
              ${
                loading || !tournamentId
                  ? "bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed italic"
                  : "bg-black border-white/10 text-white hover:border-cyan-500/50 cursor-pointer focus:border-cyan-500 shadow-2xl"
              }
            `}
          >
            <option value="" className="text-gray-500 bg-gray-900">
              {loading ? "Refreshing Arena..." : matches.length === 0 ? "No Matches Found" : "-- Select Active Match --"}
            </option>

            {/* 🔴 LIVE GROUP */}
            {groupedMatches.live.length > 0 && (
              <optgroup label={`🔴 LIVE ACTION (${groupedMatches.live.length})`} className="bg-gray-900 text-cyan-400 font-bold">
                {groupedMatches.live.map((m) => (
                  <option key={m.id} value={m.id} className="bg-gray-900 text-white py-2">
                    ⚡ {getMatchLabel(m)}
                  </option>
                ))}
              </optgroup>
            )}

            {/* 📅 UPCOMING GROUP */}
            {groupedMatches.upcoming.length > 0 && (
              <optgroup label={`📅 UPCOMING (${groupedMatches.upcoming.length})`} className="bg-gray-900 text-gray-400 font-bold">
                {groupedMatches.upcoming.map((m) => (
                  <option key={m.id} value={m.id} className="bg-gray-900 text-white py-2">
                    {getMatchLabel(m)}
                  </option>
                ))}
              </optgroup>
            )}

            {/* ✅ FINISHED GROUP */}
            {groupedMatches.finished.length > 0 && (
              <optgroup label={`✅ COMPLETED (${groupedMatches.finished.length})`} className="bg-gray-900 text-green-500 font-bold">
                {groupedMatches.finished.map((m) => (
                  <option key={m.id} value={m.id} className="bg-gray-900 text-white py-2">
                    🏁 {getMatchLabel(m)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Custom Neon Arrow Icon */}
          <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none">
            <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <button
          onClick={() => setMatchId("new")}
          disabled={!tournamentId}
          className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-cyan-900/20 active:scale-[0.98] transition-all border border-cyan-400/20 disabled:opacity-20"
        >
          + Initialize New Match
        </button>
      </div>
    </div>
  );
}