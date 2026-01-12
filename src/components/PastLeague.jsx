import React, { useState, useMemo, useEffect } from "react";
import leagueData from "../dombivali_league.json";
import { listGlobalPlayers } from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";

const PastLeague = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("matches");
  const [statsCategory, setStatsCategory] = useState("bat");
  const [globalPlayers, setGlobalPlayers] = useState([]);
  const [localMappers, setLocalMappers] = useState({});
  const [showLinkModal, setShowLinkModal] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    listGlobalPlayers().then(setGlobalPlayers);
  }, []);

  const leaderboard = useMemo(() => {
    const data = (leagueData.top_performers || []).map((p) => ({
      ...p,
      mvpPoints: (p.runs || 0) + (p.wickets || 0) * 20 + (p.not_out || 0) * 10,
    }));
    if (statsCategory === "bat") return [...data].sort((a, b) => b.runs - a.runs);
    if (statsCategory === "bowl") return [...data].sort((a, b) => b.wickets - a.wickets);
    if (statsCategory === "mvp") return [...data].sort((a, b) => b.mvpPoints - a.mvpPoints);
    return data;
  }, [statsCategory]);

  const getPlayerDisplayData = (localName) => {
    if (localMappers[localName]) return localMappers[localName];
    const match = globalPlayers.find((gp) => gp.name.toLowerCase().includes(localName.toLowerCase()));
    if (match) return { photoURL: match.photoURL, name: match.name, isLinked: true };
    return { photoURL: "https://cdn-icons-png.flaticon.com/512/847/847969.png", name: localName, isLinked: false };
  };

  const handleManualLink = (gp) => {
    if (!user) return;
    setLocalMappers((prev) => ({ ...prev, [showLinkModal]: { photoURL: gp.photoURL, name: gp.name, isLinked: true } }));
    setShowLinkModal(null);
  };

  // ✅ Tool to help you build the JSON archive manually
  const copyMatchJsonTemplate = (m) => {
    const template = {
      ...m,
      innings: [
        { team: m.t1, score: m.t1_score, batting: [{ name: "Player", res: "out", r: 0, b: 0, f: 0, s: 0, sr: "0.0" }], bowling: [{ name: "Bowler", o: "1.0", r: 0, w: 0, eco: "0.0" }], fow: "" },
        { team: m.t2, score: m.t2_score, batting: [], bowling: [], fow: "" }
      ]
    };
    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
    alert("JSON Structure Copied! Paste into your .json file and fill details.");
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 pt-24 pb-12 px-4 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">{leagueData.tournament_name}</h1>
          <span className="inline-block mt-4 bg-teal-500/10 text-teal-500 border border-teal-500/20 px-4 py-1 rounded-full text-[10px] font-black uppercase">Season {leagueData.season} Archive</span>
        </header>

        <div className="flex bg-[#1C2128] p-1.5 rounded-2xl mb-10 w-fit mx-auto border border-white/5 shadow-2xl overflow-x-auto no-scrollbar">
          {["matches", "teams", "stats"].map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t ? "bg-[#0F1115] text-teal-400 border border-white/10 shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>
              {t === "stats" ? "Hero Gallery" : t}
            </button>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "matches" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagueData.matches.map((m) => (
                <div key={m.id} className={`bg-[#1C2128] border rounded-[2.5rem] overflow-hidden shadow-xl group hover:border-teal-500/30 transition-all ${m.type === "Final" ? "border-amber-500/40" : "border-white/5"}`}>
                  <div className="bg-[#0F1115] px-6 py-4 flex justify-between border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{m.type}</span>
                    <span className="text-[10px] font-mono text-slate-600 font-bold italic">{m.date}</span>
                  </div>
                  <div className="p-8 space-y-4">
                    <div className="flex justify-between font-bold"><span>{m.t1}</span><span className="font-mono text-slate-500">{m.t1_score}</span></div>
                    <div className="flex items-center gap-4 py-1"><div className="h-px bg-white/5 flex-1" /><span className="text-[9px] font-black text-slate-700 italic">VS</span><div className="h-px bg-white/5 flex-1" /></div>
                    <div className="flex justify-between font-bold"><span>{m.t2}</span><span className="font-mono text-slate-500">{m.t2_score}</span></div>
                  </div>
                  <div className="px-6 pb-6 space-y-3">
                    <div className="bg-teal-500/5 py-3 rounded-xl text-center text-[10px] font-black uppercase text-teal-400">🏆 {m.res}</div>
                    <div className="flex flex-col gap-2">
                        {m.innings ? (
                            <button onClick={() => setSelectedMatch(m)} className="w-full py-3 rounded-xl bg-teal-500 text-[#0F1115] text-[9px] font-black uppercase tracking-widest shadow-lg shadow-teal-500/20">View Detailed Scorecard</button>
                        ) : (
                            <>
                                <a href={m.scorecard_url} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-center text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white">External CricHeroes ↗</a>
                                {user && <button onClick={() => copyMatchJsonTemplate(m)} className="w-full py-2 border border-dashed border-teal-500/30 rounded-xl text-[8px] font-black uppercase text-teal-500 hover:bg-teal-500/5">Admin: Copy JSON Block</button>}
                            </>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="space-y-8">
              <div className="flex justify-center gap-3">
                {[{id:"bat",label:"Batters",icon:"🏏"},{id:"bowl",label:"Bowlers",icon:"🥎"},{id:"mvp",label:"MVP",icon:"👑"}].map(c => (
                  <button key={c.id} onClick={() => setStatsCategory(c.id)} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${statsCategory === c.id ? "bg-teal-500 text-black shadow-lg shadow-teal-500/20" : "border border-white/10 text-slate-500 hover:border-white/30"}`}>{c.icon} {c.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leaderboard.map((p, idx) => {
                  const display = getPlayerDisplayData(p.name);
                  return (
                    <div key={idx} className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative group transition-all hover:border-teal-500/30">
                      <div className="absolute top-4 right-4 w-10 h-10 bg-[#0F1115] rounded-full flex items-center justify-center border border-white/5 font-black text-teal-500 italic text-sm">#{idx + 1}</div>
                      <div className="flex items-center gap-5">
                        <img src={display.photoURL} className={`w-16 h-16 rounded-2xl object-cover border-2 ${display.isLinked ? "border-teal-500 shadow-lg" : "border-slate-800 opacity-60"}`} alt="" />
                        <div className="overflow-hidden">
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.team}</div>
                          <h3 className="text-lg font-black text-slate-100 truncate tracking-tight">{display.name}</h3>
                          {!display.isLinked && user && <button onClick={() => setShowLinkModal(p.name)} className="mt-1 text-[8px] font-black uppercase text-amber-500 hover:underline">Associate Profile 🔗</button>}
                        </div>
                      </div>
                      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                        {statsCategory === "bat" && <><div className="text-2xl font-black text-teal-400 font-mono">{p.runs} <span className="text-[8px] block text-slate-600">Runs (SR: {p.sr})</span></div><div className="text-right text-lg font-bold text-slate-400 font-mono">{p.hs} <span className="text-[8px] block text-slate-600">High Score</span></div></>}
                        {statsCategory === "bowl" && <><div className="text-2xl font-black text-indigo-400 font-mono">{p.wickets} <span className="text-[8px] block text-slate-600">Wickets</span></div><div className="text-right text-lg font-bold text-slate-400 font-mono">{p.matches} <span className="text-[8px] block text-slate-600">Inns</span></div></>}
                        {statsCategory === "mvp" && <><div className="text-2xl font-black text-amber-500 font-mono">{p.mvpPoints} <span className="text-[8px] block text-slate-600">Impact Score</span></div><div className="flex gap-3 text-right font-mono text-[10px] text-slate-500"><div>R:{p.runs}</div><div>W:{p.wickets}</div></div></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leagueData.teams.map((team, idx) => (
                <div key={idx} className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
                  <h3 className="text-xl font-black italic uppercase mb-6 border-b border-white/5 pb-4 tracking-tight">{team.name}</h3>
                  <div className="space-y-3">
                    {team.players.map((p, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-[#0F1115] rounded-2xl border border-white/5 group hover:border-teal-500/30 transition-all">
                        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 group-hover:bg-teal-500 group-hover:text-black">{i + 1}</div>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ✅ IN-APP SCORECARD MODAL */}
      {selectedMatch && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in" onClick={() => setSelectedMatch(null)}>
          <div className="bg-[#1C2128] border border-white/10 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/5 bg-[#0F1115] flex justify-between items-center">
              <div><h3 className="text-xl font-black italic text-slate-100 uppercase">Match Scorecard</h3><p className="text-[10px] text-teal-500 font-bold uppercase">{selectedMatch.t1} vs {selectedMatch.t2}</p></div>
              <button onClick={() => setSelectedMatch(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-10">
              {selectedMatch.innings.map((inn, i) => (
                <div key={i} className="space-y-4">
                  <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-xs font-black uppercase text-teal-400 tracking-[0.2em]">{inn.team}</span><span className="font-mono font-black text-slate-100">{inn.score}</span></div>
                  <div className="bg-[#0F1115] rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead><tr className="bg-white/5 text-slate-600 uppercase text-[8px] font-black tracking-widest"><th className="px-4 py-3">Batter</th><th className="text-center">R</th><th className="text-center">B</th><th className="text-right px-4">SR</th></tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {inn.batting.map((b, idx) => (
                          <tr key={idx} className="text-slate-300">
                            <td className="px-4 py-3"><div className="font-bold">{b.name}</div><div className="text-[9px] text-slate-500 italic">{b.res}</div></td>
                            <td className="text-center font-black text-teal-400 font-mono">{b.r}</td><td className="text-center text-slate-500 font-mono">{b.b}</td><td className="text-right px-4 text-slate-400 font-mono">{b.sr}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Association Modal */}
      {showLinkModal && user && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in" onClick={() => setShowLinkModal(null)}>
          <div className="bg-[#1C2128] border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-100 uppercase mb-1 italic">Identify Profile</h3>
            <p className="text-slate-500 text-[10px] mb-6 font-bold uppercase tracking-wider">Map <span className="text-amber-500">{showLinkModal}</span> to Global List</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
              {globalPlayers.map(gp => (
                <div key={gp.id} onClick={() => handleManualLink(gp)} className="flex items-center gap-4 p-3 bg-[#0F1115] border border-white/5 rounded-2xl cursor-pointer hover:border-teal-500 transition-all group">
                  <img src={gp.photoURL} className="w-10 h-10 rounded-xl object-cover" alt="" />
                  <div className="flex-1 overflow-hidden"><div className="text-sm font-bold text-slate-200 group-hover:text-teal-400 truncate">{gp.name}</div><div className="text-[9px] text-slate-600 uppercase font-black">{gp.role}</div></div>
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