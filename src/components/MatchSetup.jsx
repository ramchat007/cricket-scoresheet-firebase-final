// src/components/MatchSetup.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import {
  subscribeTournaments,
  listTournamentTeams,
  listGlobalPlayers,
  addTournament,
  createMatch,
} from "../utils/firestore.js";

// --- 1. PLAYER PICKER MODAL (Full Original Logic, Updated UI) ---
const PlayerPickerModal = ({ isOpen, onClose, onSelect, title }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (isOpen) {
      listGlobalPlayers().then(setPlayers);
      setSelected([]);
      setSearch("");
    }
  }, [isOpen]);

  const toggle = (p) => {
    if (selected.find((s) => s.id === p.id)) {
      setSelected((prev) => prev.filter((s) => s.id !== p.id));
    } else {
      setSelected((prev) => [...prev, p]);
    }
  };

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/90 p-0 sm:p-4 backdrop-blur-md">
      <div className="bg-gray-900 border-t sm:border border-white/10 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div>
             <h3 className="font-black text-white uppercase tracking-tighter text-lg italic">{title}</h3>
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Select members from database</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white">✕</button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5 bg-black/20">
          <input
            className="w-full bg-black border border-white/10 text-white p-4 rounded-2xl outline-none focus:border-cyan-500 transition-all font-bold"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.map((p) => {
            const isSel = selected.find((s) => s.id === p.id);
            return (
              <div
                key={p.id}
                onClick={() => toggle(p)}
                className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all active:scale-95 ${
                  isSel
                    ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                    : "bg-white/5 border border-white/5 text-gray-400"
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${isSel ? 'bg-black text-white' : 'bg-white/10 text-gray-500'}`}>
                        {p.name.charAt(0)}
                    </div>
                    <div className="text-sm font-black uppercase tracking-tight">{p.name}</div>
                </div>
                {isSel && <div className="font-black">✓</div>}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-black/40 flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 text-gray-400 font-black uppercase tracking-widest text-xs border border-white/10 rounded-2xl">Cancel</button>
          <button
            onClick={() => { onSelect(selected); onClose(); }}
            disabled={selected.length === 0}
            className="flex-[2] py-4 bg-cyan-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-cyan-900/20 disabled:opacity-20 transition-all">
            Confirm {selected.length} Selected
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 2. MAIN COMPONENT ---
export default function MatchSetup({ allTeams = [], initialTournament }) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("single");
  const [teams, setTeams] = useState(allTeams);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [tournament, setTournament] = useState(initialTournament || "");
  const [tournamentDate, setTournamentDate] = useState(new Date().toISOString().slice(0, 10));
  const [tournamentFormat, setTournamentFormat] = useState("T20");
  const [overs, setOvers] = useState(4);

  // Single Match States
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [teamARoster, setTeamARoster] = useState([]);
  const [teamBRoster, setTeamBRoster] = useState([]);
  const [batsmenText, setBatsmenText] = useState("");
  const [bowlersText, setBowlersText] = useState("");

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState("A");

  // Auto Schedule States
  const [selectedTeams, setSelectedTeams] = useState(new Set());

  useEffect(() => {
    const unsub = subscribeTournaments(setAvailableTournaments);
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (!tournament) { setTeams(allTeams); return; }
    listTournamentTeams(tournament).then((t) => {
      setTeams(t.length ? t : allTeams);
    });
  }, [tournament, allTeams]);

  const handleTeamChange = (e, setTeamName, setText, setRoster) => {
    const val = e.target.value;
    setTeamName(val);
    const t = teams.find((t) => t.name === val || t.id === val);
    if (t) {
      const roster = t.roster?.length ? t.roster.map((p) => ({ ...p })) : [];
      setRoster(roster);
      setText(roster.map((p) => p.name).join(", "));
    } else {
      setRoster([]);
      setText("");
    }
  };

  const openPicker = (target) => {
    setModalTarget(target);
    setModalOpen(true);
  };

  const handlePlayersPicked = (pickedPlayers) => {
    const newRoster = pickedPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role || "Unknown",
      isOwner: false,
      isIcon: false,
      soldPrice: 0,
      originalId: p.id,
    }));

    if (modalTarget === "A") {
      setTeamARoster((prev) => [...prev, ...newRoster]);
      setBatsmenText((prev) => prev ? prev + ", " + newRoster.map((p) => p.name).join(",") : newRoster.map((p) => p.name).join(","));
    } else {
      setTeamBRoster((prev) => [...prev, ...newRoster]);
      setBowlersText((prev) => prev ? prev + ", " + newRoster.map((p) => p.name).join(",") : newRoster.map((p) => p.name).join(","));
    }
  };

  const getSmartSquad = (textInput, roster) => {
    const names = textInput.split(",").map((s) => s.trim()).filter(Boolean);
    return names.map((name) => {
      const existing = roster.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      return { id: crypto.randomUUID(), name, role: "Unknown", isOwner: false, isIcon: false, soldPrice: 0, originalId: "" };
    });
  };

  const handleSubmitSingle = async () => {
    if (!user || !tournament || !teamA || !teamB) return alert("Missing fields");
    if (!availableTournaments.find((t) => t.id === tournament)) {
      await addTournament(tournament, { name: tournament, createdAt: new Date().toISOString(), status: "upcoming" });
    }
    const squadA = getSmartSquad(batsmenText, teamARoster);
    const squadB = getSmartSquad(bowlersText, teamBRoster);
    const matchId = `match_${Date.now()}`;
    await createMatch(tournament, matchId, {
      meta: { teamAName: teamA, teamBName: teamB, overs: Number(overs), date: tournamentDate, format: tournamentFormat },
      squads: { teamA: squadA, teamB: squadB },
    });
    alert("Match created successfully!");
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeams((prev) => {
      const copy = new Set(prev);
      if (copy.has(teamId)) copy.delete(teamId);
      else copy.add(teamId);
      return copy;
    });
  };

  const handleAutoScheduleSubmit = async () => {
    if (selectedTeams.size < 2 || !tournament) return alert("Select at least 2 teams");
    if (!availableTournaments.find((t) => t.id === tournament)) {
      await addTournament(tournament, { name: tournament, createdAt: new Date().toISOString(), status: "upcoming" });
    }
    const selectedTeamObjs = teams.filter((t) => selectedTeams.has(t.id));
    for (let i = 0; i < selectedTeamObjs.length; i++) {
      for (let j = i + 1; j < selectedTeamObjs.length; j++) {
        const t1 = selectedTeamObjs[i];
        const t2 = selectedTeamObjs[j];
        const matchId = `match_${Date.now()}_${Math.random()}`;
        await createMatch(tournament, matchId, {
          meta: { teamAName: t1.name, teamBName: t2.name, overs: Number(overs), date: tournamentDate, format: tournamentFormat },
          squads: { teamA: t1.roster || [], teamB: t2.roster || [] },
        });
      }
    }
    alert(`${(selectedTeams.size * (selectedTeams.size - 1)) / 2} matches generated!`);
    setSelectedTeams(new Set());
  };

  // --- Styles ---
  const inputClass = "w-full bg-black text-white border border-white/10 rounded-2xl px-4 py-4 focus:outline-none focus:border-cyan-500 transition-all font-bold placeholder:text-gray-700";
  const labelClass = "block text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1";

  return (
    <div className="w-full pb-20">
      <PlayerPickerModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSelect={handlePlayersPicked} title={`SQUAD BUILDER`} />

      <div className="bg-gray-900 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* TAB NAVIGATION */}
        <div className="bg-black/40 p-2 flex gap-2 border-b border-white/5">
          {["single", "auto"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? "bg-cyan-500 text-black shadow-lg" : "text-gray-500 hover:text-white"
              }`}>
              {tab === "single" ? "Single Encounter" : "Auto Round Robin"}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-10">
          {/* COMMON SETTINGS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="md:col-span-1">
              <label className={labelClass}>Tournament</label>
              <input value={tournament} onChange={(e) => setTournament(e.target.value)} className={inputClass} placeholder="League Name" list="tList" />
              <datalist id="tList">
                {availableTournaments.map((t) => <option key={t.id} value={t.id} />)}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Match Date</label>
              <input type="date" value={tournamentDate} onChange={(e) => setTournamentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Max Overs</label>
              <input type="number" value={overs} onChange={(e) => setOvers(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* SINGLE MATCH VIEW */}
          {activeTab === "single" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Team A */}
                <div className="space-y-4">
                  <label className={`${labelClass} text-cyan-500`}>Primary Team (Home)</label>
                  <input value={teamA} onChange={(e) => handleTeamChange(e, setTeamA, setBatsmenText, setTeamARoster)} className={inputClass} placeholder="Team A" list="teamList" />
                  
                  <div className="flex justify-between items-center px-1">
                    <label className={labelClass}>Current Roster</label>
                    <button onClick={() => openPicker("A")} className="text-[9px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/20">Build Squad</button>
                  </div>
                  <textarea value={batsmenText} onChange={(e) => setBatsmenText(e.target.value)} className={`${inputClass} h-32 text-xs leading-relaxed no-scrollbar`} placeholder="Comma-separated player names..." />
                </div>

                {/* Team B */}
                <div className="space-y-4">
                  <label className={`${labelClass} text-green-500`}>Opposing Team (Away)</label>
                  <input value={teamB} onChange={(e) => handleTeamChange(e, setTeamB, setBowlersText, setTeamBRoster)} className={inputClass} placeholder="Team B" list="teamList" />
                  
                  <div className="flex justify-between items-center px-1">
                    <label className={labelClass}>Current Roster</label>
                    <button onClick={() => openPicker("B")} className="text-[9px] font-black text-green-400 uppercase tracking-widest bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">Build Squad</button>
                  </div>
                  <textarea value={bowlersText} onChange={(e) => setBowlersText(e.target.value)} className={`${inputClass} h-32 text-xs leading-relaxed no-scrollbar`} placeholder="Comma-separated player names..." />
                </div>
              </div>
              
              <button onClick={handleSubmitSingle} disabled={!teamA || !teamB} 
                      className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-cyan-900/40 active:scale-[0.98] transition-all disabled:opacity-20">
                Finalize Encounter
              </button>
            </div>
          )}

          {/* AUTO SCHEDULE VIEW */}
          {activeTab === "auto" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
              <div className="p-6 bg-black/40 rounded-3xl border border-white/5">
                  <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4 italic">Available Pool</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto no-scrollbar pr-2">
                    {teams.map((team) => (
                      <div key={team.id} onClick={() => toggleTeamSelection(team.id)} 
                           className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${selectedTeams.has(team.id) ? 'bg-cyan-500 border-cyan-400 text-black shadow-lg shadow-cyan-500/20' : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'}`}>
                        <div className={`w-3 h-3 rounded-full border-2 ${selectedTeams.has(team.id) ? 'bg-black border-black' : 'border-gray-700'}`}></div>
                        <span className="text-xs font-black uppercase tracking-tight">{team.name}</span>
                      </div>
                    ))}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className={labelClass}>Format Preset</label>
                    <select value={tournamentFormat} onChange={(e) => setTournamentFormat(e.target.value)} className={inputClass}>
                      <option value="T20">T20 International</option>
                      <option value="T10">T10 Sprint</option>
                      <option value="ODI">One Day Intl</option>
                    </select>
                 </div>
                 <div className="flex flex-col justify-end">
                    <button onClick={handleAutoScheduleSubmit} disabled={selectedTeams.size < 2} 
                            className="w-full py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-purple-900/20 active:scale-[0.98] transition-all disabled:opacity-20">
                        Generate { (selectedTeams.size * (selectedTeams.size - 1)) / 2 } Fixtures
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden Datalist for shared team lookup */}
      <datalist id="teamList">
        {teams.map((t) => <option key={t.id} value={t.name} />)}
      </datalist>
    </div>
  );
}