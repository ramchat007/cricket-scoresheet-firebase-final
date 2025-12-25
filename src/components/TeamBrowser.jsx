// src/components/TeamBrowser.jsx
import React, { useEffect, useState } from "react";
import { listAllTeams, listMatchesForTeam } from "../utils/firestore.js";

export default function TeamBrowser({ style, onMatchSelect }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [matches, setMatches] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Load all teams once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingTeams(true);
        const res = await listAllTeams();
        if (alive) setTeams(Array.isArray(res) ? res : []);
      } finally {
        if (alive) setLoadingTeams(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load matches when team changes
  useEffect(() => {
    let alive = true;
    if (!selectedTeam) {
      setMatches([]);
      return;
    }
    (async () => {
      try {
        setLoadingMatches(true);
        const res = await listMatchesForTeam(selectedTeam);
        if (alive) setMatches(Array.isArray(res) ? res : []);
      } finally {
        if (alive) setLoadingMatches(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedTeam]);

  // --- STYLES ---
  const cardClass =
    "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg h-full";
  const selectClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none cursor-pointer";
  const matchItemClass =
    "w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-cyan-500/50 rounded-lg p-4 transition-all duration-200 group relative overflow-hidden";

  return (
    <div className={cardClass} style={style}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-cyan-500 text-2xl">🔍</span> Match Finder
        </h2>
        {selectedTeam && (
          <span className="text-sm font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded">
            {matches.length} Matches Found
          </span>
        )}
      </div>

      {/* Team Selector */}
      <div className="mb-6 relative">
        {loadingTeams ? (
          <div className="animate-pulse h-12 bg-gray-800 rounded-lg w-full"></div>
        ) : (
          <div className="relative">
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className={selectClass}>
              <option value="" className="text-gray-400">
                -- Select a Team --
              </option>
              {teams.map((team) => (
                <option key={team} value={team} className="bg-gray-900">
                  {team}
                </option>
              ))}
            </select>
            {/* Custom Arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
              ▼
            </div>
          </div>
        )}
      </div>

      {/* Match List Area */}
      <div className="space-y-3">
        {selectedTeam ? (
          <>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 pl-1">
              Recent Matches for{" "}
              <span className="text-cyan-400">{selectedTeam}</span>
            </h3>

            {loadingMatches ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-800/50 rounded-lg animate-pulse border border-gray-800"></div>
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-800 rounded-lg">
                <p className="text-gray-500 text-sm">
                  No matches found for this team.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {matches.map((m) => {
                  const teamA = m.meta?.teamA || m.teams?.[0] || "Team A";
                  const teamB = m.meta?.teamB || m.teams?.[1] || "Team B";
                  const date = m.date || m.meta?.date || "Date TBA";

                  return (
                    <button
                      key={m.id}
                      onClick={() => onMatchSelect?.(m)}
                      className={matchItemClass}>
                      {/* Hover Gradient Line */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-bold text-gray-200 group-hover:text-white mb-1 text-sm">
                            <span
                              className={
                                teamA === selectedTeam ? "text-cyan-400" : ""
                              }>
                              {teamA}
                            </span>
                            <span className="text-gray-600 mx-2 text-sm">
                              vs
                            </span>
                            <span
                              className={
                                teamB === selectedTeam ? "text-cyan-400" : ""
                              }>
                              {teamB}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 font-mono flex items-center gap-2">
                            <span>📅 {date}</span>
                            {m.status === "finished" && (
                              <span className="text-green-500/50 text-[10px] border border-green-500/20 px-1 rounded">
                                FINAL
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-gray-600 group-hover:text-cyan-400 transform group-hover:translate-x-1 transition-all">
                          →
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10 opacity-50">
            <div className="text-4xl mb-2">🏏</div>
            <p className="text-gray-500 text-sm">
              Select a team above to browse their history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
