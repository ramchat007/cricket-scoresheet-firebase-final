// src/components/Matches.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  listTournaments,
  subscribeMatches,
  deleteMatch,
} from "../utils/firestore.js";

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
    if (!window.confirm("Delete this match? This action cannot be undone.")) return;

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
        const provided = availableTournaments && availableTournaments.length > 0;
        const rawTournaments = provided ? availableTournaments : await listTournaments();
        if (!mounted) return;

        const finalTournaments = normalizeTournamentArray(rawTournaments || []);
        setTournamentsList(finalTournaments);

        Object.values(unsubRefs.current).forEach((u) => u && u());
        unsubRefs.current = {};

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

  const normalizeStatus = (status) => {
    if (!status) return "live";
    const s = status.toLowerCase();
    if (s === "in-progress" || s === "inprogress" || s === "live") return "live";
    if (s === "finished" || s === "completed") return "finished";
    if (s === "upcoming" || s === "scheduled") return "upcoming";
    return "live";
  };

  const filterByStatus = (matches, tab) => (matches || []).filter((m) => normalizeStatus(m.status) === tab);

  const getStatusBadge = (status) => {
    const s = normalizeStatus(status);
    if (s === "live") {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase rounded-full shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse">
          <span className="w-1.5 h-1.5 bg-white rounded-full"></span> Live
        </span>
      );
    }
    if (s === "finished") {
      return (
        <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase rounded-full">
          Completed
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-white/5 border border-white/10 text-gray-400 text-[9px] font-black uppercase rounded-full">
        Upcoming
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Loading Arena...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      {/* --- MOBILE HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6 px-2">
        <div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none">
            Match <span className="text-cyan-500">Center</span>
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-2">
            Live Fixtures & Historical Data
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-gray-900/50 p-1 rounded-2xl flex items-center border border-white/5 backdrop-blur-md">
          {["live", "upcoming", "finished"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                  : "text-gray-500 hover:text-white"
              }`}>
              {tab === "live" ? "Live 🔴" : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-12">
        {tournamentsList.map((tObj) => {
          const tId = tObj.id;
          const matches = matchesByTournament[tId] || [];
          const filtered = filterByStatus(matches, activeTab);

          if (filtered.length === 0) return null;

          return (
            <div key={`t-${tId}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Tournament Title Badge */}
              <div className="flex items-center gap-4 mb-6 px-2">
                <h3 className="flex-shrink-0 text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] bg-cyan-500/5 border border-cyan-500/20 px-4 py-1.5 rounded-full">
                  {tObj.name}
                </h3>
                <div className="h-px bg-white/5 flex-1"></div>
              </div>

              {/* Grid of Matches */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-2">
                {filtered.map((m) => (
                  <div
                    key={`m-${tId}-${m.id}`}
                    onClick={() => onSelect(tId, m.id)}
                    className="group bg-gray-900/40 border border-white/5 rounded-[2.5rem] p-6 active:scale-95 transition-all shadow-xl relative overflow-hidden">
                    
                    {/* Glow decoration */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-3xl -z-10 group-hover:bg-cyan-500/10 transition-colors"></div>

                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">
                        {m.date || "Schedule TBA"}
                      </span>
                      {!readOnly && (
                        <button
                          onClick={(e) => handleDelete(tId, m.id, e)}
                          disabled={!!deletingIds[`${tId}__${m.id}`]}
                          className="text-gray-700 hover:text-red-500 transition-colors p-2">
                          {deletingIds[`${tId}__${m.id}`] ? (
                            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : "🗑"}
                        </button>
                      )}
                    </div>

                    {/* VS View */}
                    <div className="flex items-center justify-between gap-2 mb-8">
                       <div className="flex-1 text-center space-y-2">
                          <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/5 mx-auto flex items-center justify-center text-lg shadow-inner">
                            {m.meta?.teamA?.charAt(0) || "A"}
                          </div>
                          <div className="text-white font-black text-xs uppercase tracking-tight truncate max-w-[80px] mx-auto">
                            {m.meta?.teamA || "Team A"}
                          </div>
                       </div>

                       <div className="flex flex-col items-center">
                          <div className="text-[9px] font-black text-gray-700 italic">VS</div>
                          <div className="h-8 w-px bg-white/5 my-1"></div>
                       </div>

                       <div className="flex-1 text-center space-y-2">
                          <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/5 mx-auto flex items-center justify-center text-lg shadow-inner">
                            {m.meta?.teamB?.charAt(0) || "B"}
                          </div>
                          <div className="text-white font-black text-xs uppercase tracking-tight truncate max-w-[80px] mx-auto">
                            {m.meta?.teamB || "Team B"}
                          </div>
                       </div>
                    </div>

                    {/* Bottom Status */}
                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                      {getStatusBadge(m.status)}
                      <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        Details →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {tournamentsList.length > 0 &&
          Object.values(matchesByTournament).flat().filter((m) => normalizeStatus(m.status) === activeTab).length === 0 && (
          <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10 mx-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
              No {activeTab} matches found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}