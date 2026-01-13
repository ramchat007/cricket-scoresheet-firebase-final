import React, { useState, useMemo, useEffect } from "react";
import leagueData from "../dombivali_league.json";
import { listGlobalPlayers } from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

const PastLeague = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("matches");
  const [statsCategory, setStatsCategory] = useState("mvp");
  const [globalPlayers, setGlobalPlayers] = useState([]);
  const [localMappers, setLocalMappers] = useState({});
  const [showLinkModal, setShowLinkModal] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  // 1. Load saved links from Firestore and Global Players List
  useEffect(() => {
    const loadData = async () => {
      // Load Global Players from Firestore
      const players = await listGlobalPlayers();
      setGlobalPlayers(players);

      // Load specific DFL mappings from Firestore
      const docRef = doc(db, "settings", "playerLinks");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLocalMappers(docSnap.data());
      }
    };
    loadData();
  }, []);

  // Compute filtered players for the search modal
  const filteredGlobalPlayers = useMemo(() => {
    return globalPlayers.filter((gp) =>
      gp.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
    );
  }, [globalPlayers, playerSearchQuery]);

  const leaderboard = useMemo(() => {
    switch (statsCategory) {
      case "bat":
        return leagueData.batting_leaderboard || [];
      case "bowl":
        return leagueData.bowling_leaderboard || [];
      case "field":
        return leagueData.fielding_leaderboard || [];
      case "mvp":
        return leagueData.mvp_standings || [];
      default:
        return [];
    }
  }, [statsCategory]);

  const getPlayerDisplayData = (localName) => {
    // Priority 1: Check manual mappings from Firestore
    if (localMappers[localName]) return localMappers[localName];

    // Priority 2: Check for exact string match in global list
    const match = globalPlayers.find((gp) =>
      gp.name.toLowerCase().includes(localName.toLowerCase())
    );

    if (match)
      return { photoURL: match.photoURL, name: match.name, isLinked: true };

    // Fallback: Default icon
    return {
      photoURL: "https://cdn-icons-png.flaticon.com/512/847/847969.png",
      name: localName,
      isLinked: false,
    };
  };

  const handleManualLink = async (gp) => {
    if (!user) return;

    const updatedMappers = {
      ...localMappers,
      [showLinkModal]: { photoURL: gp.photoURL, name: gp.name, isLinked: true },
    };

    setLocalMappers(updatedMappers);
    setShowLinkModal(null);
    setPlayerSearchQuery("");

    try {
      await setDoc(doc(db, "settings", "playerLinks"), updatedMappers);
    } catch (error) {
      console.error("Error saving player link:", error);
    }
  };

  const handleUnlink = async (localName) => {
    if (!user || !window.confirm(`Unlink ${localName}?`)) return;

    const updatedMappers = { ...localMappers };
    delete updatedMappers[localName];

    setLocalMappers(updatedMappers);

    try {
      await setDoc(doc(db, "settings", "playerLinks"), updatedMappers);
    } catch (error) {
      console.error("Error unlinking:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 pt-24 pb-12 px-4 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700 drop-shadow-2xl">
            {leagueData.tournament_name}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="h-px w-8 bg-amber-500/30"></span>
            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
              Season {leagueData.season} Archive
            </span>
            <span className="h-px w-8 bg-amber-500/30"></span>
          </div>
        </header>

        <div className="flex bg-[#1C2128] p-1.5 rounded-2xl mb-10 w-fit mx-auto border border-white/5 shadow-2xl overflow-x-auto no-scrollbar">
          {["matches", "teams", "stats"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === t
                  ? "bg-[#0F1115] text-amber-500 border border-amber-500/20 shadow-lg"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              {t === "stats" ? "Hall of Fame" : t}
            </button>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* --- MATCHES TAB --- */}
          {activeTab === "matches" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagueData.matches.map((m) => (
                <div
                  key={m.id}
                  className={`bg-[#1C2128] border rounded-[2.5rem] overflow-hidden shadow-xl group hover:border-amber-500/30 transition-all ${
                    m.type === "Final"
                      ? "border-amber-500/40"
                      : "border-white/5"
                  }`}>
                  <div className="bg-[#0F1115] px-6 py-4 flex justify-between border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {m.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 font-bold italic">
                      {m.date}
                    </span>
                  </div>
                  <div className="p-8 space-y-4">
                    <div className="flex justify-between font-bold">
                      <span>{m.t1}</span>
                      <span className="font-mono text-slate-500">
                        {m.t1_score}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 py-1">
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[9px] font-black text-slate-700 italic">
                        VS
                      </span>
                      <div className="h-px bg-white/5 flex-1" />
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>{m.t2}</span>
                      <span className="font-mono text-slate-500">
                        {m.t2_score}
                      </span>
                    </div>
                  </div>
                  <div className="px-6 pb-6 space-y-3">
                    <div className="bg-amber-500/5 py-3 rounded-xl text-center text-[10px] font-black uppercase text-amber-500">
                      🏆 {m.res}
                    </div>
                    <button
                      onClick={() => setSelectedMatch(m)}
                      className="w-full py-3 rounded-xl bg-amber-600 text-[#0F1115] text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/20">
                      View Detailed Scorecard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* --- STATS TAB --- */}
          {activeTab === "stats" && (
            <div className="space-y-8">
              <div className="flex justify-center gap-3 overflow-x-auto">
                {[
                  { id: "mvp", label: "MVP Race", icon: "👑" },
                  { id: "bat", label: "Orange Cap", icon: "🏏" },
                  { id: "bowl", label: "Purple Cap", icon: "🥎" },
                  { id: "field", label: "Fielding", icon: "🧤" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setStatsCategory(c.id)}
                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                      statsCategory === c.id
                        ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                        : "border border-white/10 text-slate-500 hover:border-white/30"
                    }`}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leaderboard.map((p, idx) => {
                  const display = getPlayerDisplayData(p.name);
                  const rankColor =
                    idx === 0
                      ? "text-amber-400 border-amber-500/20"
                      : idx === 1
                      ? "text-slate-300 border-slate-400/20"
                      : idx === 2
                      ? "text-orange-400 border-orange-500/20"
                      : "text-teal-500 border-white/5";
                  return (
                    <div
                      key={idx}
                      className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative group transition-all hover:border-amber-500/30">
                      <div
                        className={`absolute top-4 right-4 w-10 h-10 bg-[#0F1115] rounded-full flex items-center justify-center border font-black italic text-sm ${rankColor}`}>
                        #{idx + 1}
                      </div>
                      <div className="flex items-center gap-5">
                        <img
                          src={display.photoURL}
                          className={`w-16 h-16 rounded-2xl object-cover border-2 ${
                            display.isLinked
                              ? "border-amber-500 shadow-lg"
                              : "border-slate-800 opacity-60"
                          }`}
                          alt=""
                        />
                        <div className="overflow-hidden">
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            {p.team}
                          </div>
                          <h3 className="text-lg font-black text-slate-100 truncate tracking-tight flex items-center gap-2">
                            {display.name}
                            {display.isLinked && (
                              <span className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></span>
                            )}
                          </h3>
                          {user && (
                            <div className="mt-1 flex gap-3">
                              {!display.isLinked ? (
                                <button
                                  onClick={() => setShowLinkModal(p.name)}
                                  className="text-[8px] font-black uppercase text-amber-500 hover:underline">
                                  Associate Profile 🔗
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUnlink(p.name)}
                                  className="text-[8px] font-black uppercase text-rose-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                                  Unlink Profile ✂️
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                        {statsCategory === "bat" && (
                          <>
                            <div className="text-2xl font-black text-teal-400 font-mono">
                              {p.runs}{" "}
                              <span className="text-[8px] block text-slate-600">
                                Total Runs
                              </span>
                            </div>
                            <div className="text-right text-lg font-bold text-slate-400 font-mono">
                              {p.sr}{" "}
                              <span className="text-[8px] block text-slate-600">
                                SR (HS: {p.hs})
                              </span>
                            </div>
                          </>
                        )}
                        {statsCategory === "bowl" && (
                          <>
                            <div className="text-2xl font-black text-indigo-400 font-mono">
                              {p.wickets}{" "}
                              <span className="text-[8px] block text-slate-600">
                                Wickets
                              </span>
                            </div>
                            <div className="text-right text-lg font-bold text-slate-400 font-mono">
                              {p.eco}{" "}
                              <span className="text-[8px] block text-slate-600">
                                Economy
                              </span>
                            </div>
                          </>
                        )}
                        {statsCategory === "mvp" && (
                          <>
                            <div className="text-2xl font-black text-amber-500 font-mono">
                              {p.points?.total || 0}{" "}
                              <span className="text-[8px] block text-slate-600">
                                Impact Score
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-[8px] font-mono text-slate-500 uppercase font-bold">
                              <span>Bat: {p.points?.batting || 0}</span>
                              <span>Bowl: {p.points?.bowling || 0}</span>
                              <span>Fld: {p.points?.fielding || 0}</span>
                            </div>
                          </>
                        )}
                        {statsCategory === "field" && (
                          <>
                            <div className="text-2xl font-black text-purple-400 font-mono">
                              {p.dismissals}{" "}
                              <span className="text-[8px] block text-slate-600">
                                Total Dismissals
                              </span>
                            </div>
                            <div className="text-right font-mono text-xs text-slate-400">
                              <div>Ct: {p.catches}</div>
                              <div>RO: {p.run_outs}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- TEAMS TAB --- */}
          {activeTab === "teams" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagueData.teams.map((team, idx) => (
                <div
                  key={idx}
                  className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
                  <h3 className="text-xl font-black italic uppercase mb-6 border-b border-white/5 pb-4 tracking-tight">
                    <span>{team.name}</span>
                  </h3>
                  <div className="space-y-3">
                    {team.players.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 bg-[#0F1115] rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
                        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 group-hover:bg-amber-500 group-hover:text-black">
                          {i + 1}
                        </div>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ✅ MATCH SCORECARD MODAL */}
      {selectedMatch && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in"
          onClick={() => setSelectedMatch(null)}>
          <div
            className="bg-[#1C2128] border border-white/10 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/5 bg-[#0F1115] flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black italic text-slate-100 uppercase tracking-tighter">
                  Match Result
                </h3>
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">
                  {selectedMatch.t1} vs {selectedMatch.t2}
                </p>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-12 custom-scrollbar">
              {selectedMatch.innings?.map((inn, i) => (
                <div key={i} className="space-y-6">
                  <div className="flex justify-between items-end border-b border-white/10 pb-2">
                    <span className="text-xs font-black uppercase text-amber-500 tracking-widest">
                      {inn.team}
                    </span>
                    <span className="font-mono font-black text-slate-100 text-xl">
                      {inn.score}
                    </span>
                  </div>
                  <div className="bg-[#0F1115] rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-slate-600 text-[8px] font-black uppercase tracking-widest">
                        <tr>
                          <th className="px-4 py-3">Batter</th>
                          <th className="text-center px-2">R</th>
                          <th className="text-center px-2">B</th>
                          <th className="text-center px-2">4s</th>
                          <th className="text-center px-2">6s</th>
                          <th className="text-right px-4">SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {inn.batting.map((b, idx) => (
                          <tr key={idx} className="text-slate-300">
                            <td className="px-4 py-3">
                              <b>{b.name}</b>
                              <div className="text-[9px] text-slate-500">
                                {b.res}
                              </div>
                            </td>
                            <td className="text-center text-teal-400 font-mono font-bold">
                              {b.r}
                            </td>
                            <td className="text-center text-slate-500 font-mono">
                              {b.b}
                            </td>
                            <td className="text-center text-slate-500 font-mono">
                              {b.f}
                            </td>
                            <td className="text-center text-slate-500 font-mono">
                              {b.s}
                            </td>
                            <td className="text-right px-4 text-slate-400 font-mono">
                              {b.sr}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {inn.bowling?.length > 0 && (
                    <div className="bg-[#0F1115] rounded-2xl border border-white/5 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-slate-600 text-[8px] font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-4 py-3">Bowler</th>
                            <th className="text-center px-2">O</th>
                            <th className="text-center px-2">R</th>
                            <th className="text-center px-2">W</th>
                            <th className="text-right px-4">Eco</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {inn.bowling.map((bw, idx) => (
                            <tr key={idx} className="text-slate-300">
                              <td className="px-4 py-3 font-bold">{bw.name}</td>
                              <td className="text-center text-slate-500 font-mono">
                                {bw.o}
                              </td>
                              <td className="text-center text-slate-300 font-mono">
                                {bw.r}
                              </td>
                              <td className="text-center text-indigo-400 font-mono font-black">
                                {bw.w}
                              </td>
                              <td className="text-right px-4 text-slate-500 font-mono">
                                {bw.eco}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ PROFILE LINK MODAL */}
      {showLinkModal && user && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in"
          onClick={() => {
            setShowLinkModal(null);
            setPlayerSearchQuery("");
          }}>
          <div
            className="bg-[#1C2128] border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-100 uppercase italic">
                  Identify Profile
                </h3>
                <p className="text-slate-500 text-[10px] uppercase font-bold">
                  Map <span className="text-amber-500">{showLinkModal}</span>
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(null)}
                className="text-slate-500 hover:text-white">
                ✕
              </button>
            </div>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search global players..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 text-slate-200"
                autoFocus
              />
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {filteredGlobalPlayers.map((gp) => (
                <div
                  key={gp.id}
                  onClick={() => handleManualLink(gp)}
                  className="flex items-center gap-4 p-3 bg-[#0F1115] border border-white/5 rounded-2xl cursor-pointer hover:border-amber-500 group transition-all">
                  <img
                    src={gp.photoURL}
                    className="w-10 h-10 rounded-xl object-cover"
                    alt=""
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-bold text-slate-200 truncate group-hover:text-amber-500">
                      {gp.name}
                    </div>
                    <div className="text-[9px] text-slate-600 uppercase font-black">
                      {gp.role || "Player"}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 text-amber-500 text-[8px] font-black uppercase">
                    Link
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PastLeague;
