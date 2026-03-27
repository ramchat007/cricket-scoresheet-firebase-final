// src/components/Matches.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  listTournaments,
  subscribeMatches,
  deleteMatch,
} from "../utils/firestore.js";
import { db } from "../utils/firebase.js"; // 👈 We need this to fetch the logos
import { collection, onSnapshot } from "firebase/firestore";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Matches({
  availableTournaments = [],
  teams = [], // We keep this as a fallback
  onSelect = () => {},
  readOnly = false,
}) {
  const { theme, lightMode } = useTheme();

  const [tournamentsList, setTournamentsList] = useState(
    normalizeTournamentArray(availableTournaments),
  );
  const [matchesByTournament, setMatchesByTournament] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("live");
  const [deletingIds, setDeletingIds] = useState({});

  // 🚀 NEW: A dedicated state just for mapping team names to their logos
  const [logoMap, setLogoMap] = useState({});

  const unsubRefs = useRef({});

  // ... (Keep normalizeTournamentArray and handleDelete exactly as they are)
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

  // 🚀 NEW: Listen to the Teams collection directly to build a reliable logo dictionary
  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
      const newMap = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Use the team name as the dictionary key (convert to lowercase to be safe)
        if (data.name) {
          const keyName = data.name.trim().toLowerCase();
          // Look for 'logo' or 'logoUrl' or 'photoUrl' in the team document
          newMap[keyName] = data.logo || data.logoUrl || data.photoUrl || null;
        }
      });
      setLogoMap(newMap);
    });

    return () => unsubTeams();
  }, []);

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
    if (s === "in-progress" || s === "inprogress" || s === "live")
      return "live";
    if (s === "finished" || s === "completed") return "finished";
    if (s === "upcoming" || s === "scheduled") return "upcoming";
    return "live";
  };

  const filterByStatus = (matches, tab) =>
    (matches || []).filter((m) => normalizeStatus(m.status) === tab);

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
        <span
          className={`px-3 py-1 text-[9px] font-black uppercase rounded-full border ${
            lightMode
              ? "bg-green-50 text-green-600 border-green-200"
              : "bg-green-500/10 text-green-400 border-green-500/20"
          }`}
        >
          Completed
        </span>
      );
    }
    return (
      <span
        className={`px-3 py-1 text-[9px] font-black uppercase rounded-full border ${
          lightMode
            ? "bg-gray-100 text-gray-500 border-gray-200"
            : "bg-white/5 text-gray-400 border-white/10"
        }`}
      >
        Upcoming
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Loading Arena...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      {/* --- HEADER & TABS --- */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6 px-2">
        <div>
          <h2
            className={`text-4xl font-black uppercase tracking-tighter italic leading-none ${theme.text}`}
          >
            Match <span className="text-cyan-500">Center</span>
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-2">
            Live Fixtures & Historical Data
          </p>
        </div>

        <div
          className={`p-1 rounded-2xl flex items-center border backdrop-blur-md ${
            lightMode
              ? "bg-gray-100/50 border-gray-200"
              : "bg-gray-900/50 border-white/5"
          }`}
        >
          {["live", "upcoming", "finished"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                  : lightMode
                    ? "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab === "live" ? "Live 🔴" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* --- MATCHES GRID --- */}
      <div className="space-y-12">
        {tournamentsList.map((tObj) => {
          const tId = tObj.id;
          const matches = matchesByTournament[tId] || [];
          const filtered = filterByStatus(matches, activeTab);

          if (filtered.length === 0) return null;

          return (
            <div
              key={`t-${tId}`}
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <div className="flex items-center gap-4 mb-6 px-2">
                <h3
                  className={`flex-shrink-0 text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] border px-4 py-1.5 rounded-full ${
                    lightMode
                      ? "bg-cyan-50 border-cyan-200"
                      : "bg-cyan-500/5 border-cyan-500/20"
                  }`}
                >
                  {tObj.name}
                </h3>
                <div
                  className={`h-px flex-1 ${lightMode ? "bg-gray-200" : "bg-white/5"}`}
                ></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-2">
                {filtered.map((m) => {
                  const teamA = m.meta?.teamA || m.teamA || "Team A";
                  const teamB = m.meta?.teamB || m.teamB || "Team B";

                  // 🚀 THE FIX: Look up the logo from our new dedicated logoMap using the lowercase name
                  const safeNameA = teamA.trim().toLowerCase();
                  const safeNameB = teamB.trim().toLowerCase();

                  const logoA =
                    logoMap[safeNameA] ||
                    m.meta?.teamALogo ||
                    m.teamALogo ||
                    null;
                  const logoB =
                    logoMap[safeNameB] ||
                    m.meta?.teamBLogo ||
                    m.teamBLogo ||
                    null;

                  const matchTime = m.time || m.meta?.time;
                  const matchOvers = m.overs || m.meta?.overs;
                  const matchVenue = m.venue || m.meta?.venue;

                  return (
                    <div
                      key={`m-${tId}-${m.id}`}
                      onClick={() => onSelect(tId, m.id)}
                      className={`group border rounded-[2.5rem] p-6 active:scale-95 transition-all shadow-xl relative overflow-hidden cursor-pointer ${
                        lightMode
                          ? "bg-white border-gray-100 hover:border-cyan-200 hover:shadow-cyan-500/10"
                          : "bg-gray-900/40 border-white/5 hover:border-cyan-500/30"
                      }`}
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-3xl -z-10 group-hover:bg-cyan-500/10 transition-colors"></div>

                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-tighter ${lightMode ? "text-cyan-600" : "text-cyan-400"}`}
                          >
                            📅 {m.date || "Date TBA"}{" "}
                            {matchTime && `• ⏰ ${matchTime}`}
                          </span>
                          {(matchOvers || matchVenue) && (
                            <span
                              className={`text-[9px] font-bold uppercase tracking-widest ${lightMode ? "text-gray-500" : "text-gray-500"}`}
                            >
                              {matchOvers && `🏏 ${matchOvers} Overs`}{" "}
                              {matchOvers && matchVenue && " | "}{" "}
                              {matchVenue && `📍 ${matchVenue}`}
                            </span>
                          )}
                        </div>

                        {!readOnly && (
                          <button
                            onClick={(e) => handleDelete(tId, m.id, e)}
                            disabled={!!deletingIds[`${tId}__${m.id}`]}
                            className="text-gray-400 hover:text-red-500 transition-colors p-2"
                          >
                            {deletingIds[`${tId}__${m.id}`] ? (
                              <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              "🗑"
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-8">
                        <div className="flex-1 text-center space-y-3">
                          <div
                            className={`w-14 h-14 rounded-2xl border mx-auto flex items-center justify-center text-2xl font-black shadow-inner overflow-hidden relative ${
                              lightMode
                                ? "bg-gray-50 border-gray-200 text-gray-300"
                                : "bg-white/5 border-white/5 text-white/20"
                            }`}
                          >
                            {logoA ? (
                              <img
                                src={logoA}
                                alt={teamA}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              teamA.charAt(0)
                            )}
                          </div>
                          <div
                            className={`font-black text-xs uppercase tracking-tight truncate max-w-[90px] mx-auto ${theme.text}`}
                          >
                            {teamA}
                          </div>
                        </div>

                        <div className="flex flex-col items-center">
                          <div
                            className={`text-[9px] font-black italic ${lightMode ? "text-gray-300" : "text-gray-700"}`}
                          >
                            VS
                          </div>
                          <div
                            className={`h-8 w-px my-1 ${lightMode ? "bg-gray-200" : "bg-white/5"}`}
                          ></div>
                        </div>

                        <div className="flex-1 text-center space-y-3">
                          <div
                            className={`w-14 h-14 rounded-2xl border mx-auto flex items-center justify-center text-2xl font-black shadow-inner overflow-hidden relative ${
                              lightMode
                                ? "bg-gray-50 border-gray-200 text-gray-300"
                                : "bg-white/5 border-white/5 text-white/20"
                            }`}
                          >
                            {logoB ? (
                              <img
                                src={logoB}
                                alt={teamB}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              teamB.charAt(0)
                            )}
                          </div>
                          <div
                            className={`font-black text-xs uppercase tracking-tight truncate max-w-[90px] mx-auto ${theme.text}`}
                          >
                            {teamB}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`flex justify-between items-center pt-4 border-t ${lightMode ? "border-gray-100" : "border-white/5"}`}
                      >
                        {getStatusBadge(m.status)}
                        <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          {readOnly ? "Scorecard →" : "Score Match →"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {tournamentsList.length > 0 &&
          Object.values(matchesByTournament)
            .flat()
            .filter((m) => normalizeStatus(m.status) === activeTab).length ===
            0 && (
            <div
              className={`text-center py-20 rounded-[3rem] border border-dashed mx-2 ${
                lightMode
                  ? "bg-gray-50 border-gray-200"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-[0.3em] ${lightMode ? "text-gray-400" : "text-gray-600"}`}
              >
                No {activeTab} matches found
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
