// src/components/Matches.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  listTournaments,
  subscribeMatches,
  deleteMatch,
} from "../utils/firestore.js";

/**
 * Matches page: shows tournaments and their matches grouped by status.
 * Styled with Tailwind CSS for a modern Dark/Sports theme.
 */
export default function Matches({
  availableTournaments = [],
  onSelect = () => {},
  readOnly = false,
}) {
  const [tournamentsList, setTournamentsList] = useState(
    normalizeTournamentArray(availableTournaments)
  );
  const [matchesByTournament, setMatchesByTournament] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("live");
  const [deletingIds, setDeletingIds] = useState({});

  const unsubRefs = useRef({});

  // Helper: normalize input
  function normalizeTournamentArray(arr) {
    if (!arr) return [];
    return (arr || [])
      .map((t) => {
        if (!t) return null;
        if (typeof t === "string") return { id: t, name: t };
        if (typeof t === "object") {
          return { id: String(t.id || t), name: t.name || t.id || String(t) };
        }
        return { id: String(t), name: String(t) };
      })
      .filter(Boolean);
  }

  async function handleDelete(tournamentId, matchId, e) {
    if (e && e.stopPropagation) e.stopPropagation();

    const key = `${tournamentId}__${matchId}`;
    if (!window.confirm("Delete this match? This action cannot be undone."))
      return;

    setDeletingIds((prev) => ({ ...prev, [key]: true }));
    try {
      await deleteMatch(tournamentId, matchId);
    } catch (err) {
      console.error("Failed to delete match:", err);
      alert("Failed to delete match.");
    } finally {
      setDeletingIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadTournaments() {
      setLoading(true);
      try {
        const provided =
          availableTournaments && availableTournaments.length > 0;
        const rawTournaments = provided
          ? availableTournaments
          : await listTournaments();

        if (!mounted) return;

        const finalTournaments = normalizeTournamentArray(rawTournaments || []);
        setTournamentsList(finalTournaments);

        // Cleanup old listeners
        Object.values(unsubRefs.current).forEach((u) => u && u());
        unsubRefs.current = {};

        // Subscribe to matches
        finalTournaments.forEach((tObj) => {
          if (!tObj || !tObj.id) return;
          const unsub = subscribeMatches(tObj.id, (matches) => {
            setMatchesByTournament((prev) => ({ ...prev, [tObj.id]: matches }));
          });
          unsubRefs.current[tObj.id] = unsub;
        });
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTournaments();

    return () => {
      mounted = false;
      Object.values(unsubRefs.current).forEach((u) => u && u());
      unsubRefs.current = {};
    };
  }, [availableTournaments]);

  // --- Helpers for Filtering & Display ---

  const normalizeStatus = (status) => {
    if (!status) return "live";
    const s = status.toLowerCase();
    if (s === "in-progress" || s === "inprogress" || s === "live")
      return "live";
    if (s === "finished" || s === "completed") return "finished";
    if (s === "upcoming" || s === "scheduled") return "upcoming";
    return "live"; // default
  };

  const filterByStatus = (matches, tab) =>
    (matches || []).filter((m) => normalizeStatus(m.status) === tab);

  const getStatusBadge = (status) => {
    const s = normalizeStatus(status);
    if (s === "live") {
      return (
        <span className="flex items-center gap-1.5 px-2 py-1 bg-red-900/30 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase rounded-full animate-pulse">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Live
        </span>
      );
    }
    if (s === "finished") {
      return (
        <span className="px-2 py-1 bg-green-900/30 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase rounded-full">
          Finished
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-blue-900/30 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase rounded-full">
        Upcoming
      </span>
    );
  };

  // --- Loading / Empty States ---

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-cyan-500 animate-pulse">
        <div className="text-lg font-bold">Loading Arena...</div>
      </div>
    );
  }

  if (!tournamentsList || tournamentsList.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-900 border border-gray-800 rounded-xl">
        <h3 className="text-xl text-gray-400 font-bold">
          No Tournaments Found
        </h3>
        <p className="text-gray-600 mt-2">
          Create a tournament to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-2 sm:p-4">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Match
            </span>{" "}
            Center
          </h2>
          <p className="text-gray-500 text-sm">
            Select a match to manage or view
          </p>
        </div>

        {/* Custom Tab Switcher */}
        <div className="bg-gray-800 p-1 rounded-lg flex items-center border border-gray-700">
          {["live", "upcoming", "finished"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-bold capitalize transition-all duration-200 ${
                activeTab === tab
                  ? "bg-gray-700 text-white shadow-sm border border-gray-600"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              }`}>
              {tab === "live" ? "Live 🔴" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="space-y-8">
        {tournamentsList.map((tObj) => {
          const tId = tObj.id;
          const tName = tObj.name || tId;
          const matches = matchesByTournament[tId] || [];
          const filtered = filterByStatus(matches, activeTab);

          // Skip rendering tournament block if no matches in this tab
          if (filtered.length === 0) return null;

          return (
            <div
              key={`t-${tId}`}
              className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Tournament Title */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px bg-gray-800 flex-1"></div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
                  {tName}
                </h3>
                <div className="h-px bg-gray-800 flex-1"></div>
              </div>

              {/* Grid of Matches */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((m) => (
                  <div
                    key={`m-${tId}-${m.id}`}
                    onClick={() => onSelect(tId, m.id)}
                    className="group relative bg-gray-800 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer overflow-hidden">
                    {/* Decorative Top Bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-gray-700 to-gray-800 group-hover:from-cyan-500 group-hover:to-blue-600 transition-all duration-300"></div>

                    <div className="p-5">
                      {/* Top Row: Date & Delete */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Match Date
                          </span>
                          <span className="text-sm text-gray-300 font-mono">
                            {m.date || "Date TBA"}
                          </span>
                        </div>

                        {!readOnly && (
                          <button
                            onClick={(e) => handleDelete(tId, m.id, e)}
                            disabled={!!deletingIds[`${tId}__${m.id}`]}
                            className="text-gray-600 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-900/20"
                            title="Delete Match">
                            {deletingIds[`${tId}__${m.id}`] ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              // Simple Trash SVG Icon
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Teams */}
                      <div className="flex justify-between items-center gap-2 mb-4">
                        <div className="flex-1 text-center">
                          <div className="text-lg font-bold text-white leading-tight truncate">
                            {m.meta?.teamA || "Team A"}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gray-600 bg-gray-900 px-2 py-1 rounded-full">
                          VS
                        </div>
                        <div className="flex-1 text-center">
                          <div className="text-lg font-bold text-white leading-tight truncate">
                            {m.meta?.teamB || "Team B"}
                          </div>
                        </div>
                      </div>

                      {/* Footer: Status & Info */}
                      <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
                        {getStatusBadge(m.status)}

                        <div className="text-sm text-gray-500 flex items-center gap-1 group-hover:text-cyan-400 transition-colors">
                          Open Match <span>→</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty State for specific tab */}
        {Object.keys(matchesByTournament).length > 0 &&
          Object.values(matchesByTournament)
            .flat()
            .filter((m) => normalizeStatus(m.status) === activeTab).length ===
            0 && (
            <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
              <p className="text-gray-500">
                No {activeTab} matches found in your tournaments.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
