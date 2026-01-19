import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import {
  subscribeTournaments,
  listTournamentTeams,
  listGlobalPlayers,
  addTournament,
  createMatch,
} from "../utils/firestore.js";
import { writeBatch, doc, collection } from "firebase/firestore"; 
import { db } from "../utils/firebase";

// --- 1. PLAYER PICKER MODAL (Unchanged) ---
const PlayerPickerModal = ({ isOpen, onClose, onSelect, title }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (isOpen) {
      listGlobalPlayers().then(setPlayers).catch(console.error);
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#0F1115]/90 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#1C2128] border-t sm:border border-white/10 w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div>
             <h3 className="font-black text-slate-100 uppercase tracking-tight text-lg italic">{title}</h3>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select members from database</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">✕</button>
        </div>
        <div className="p-4 border-b border-white/5 bg-[#161920]">
          <input
            className="w-full bg-[#0F1115] border border-white/10 text-slate-200 p-4 rounded-xl outline-none focus:border-teal-500/50 transition-all font-bold placeholder:text-slate-600"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filtered.map((p) => {
            const isSel = selected.find((s) => s.id === p.id);
            return (
              <div key={p.id} onClick={() => toggle(p)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all active:scale-95 border ${isSel ? "bg-teal-500/10 border-teal-500/50 text-teal-400" : "bg-[#0F1115] border-white/5 text-slate-400 hover:border-white/10"}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isSel ? 'bg-teal-500 text-black' : 'bg-white/5 text-slate-500'}`}>{p.name.charAt(0)}</div>
                    <div className="text-sm font-bold uppercase tracking-tight">{p.name}</div>
                </div>
                {isSel && <div className="font-black text-lg">✓</div>}
              </div>
            );
          })}
        </div>
        <div className="p-6 border-t border-white/5 bg-[#161920] flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest text-xs border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={() => { onSelect(selected); onClose(); }} disabled={selected.length === 0} className="flex-[2] py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-teal-900/20 disabled:opacity-20 transition-all active:scale-[0.98]">Confirm {selected.length} Selected</button>
        </div>
      </div>
    </div>
  );
};

// --- 2. MAIN COMPONENT (Unified Logic) ---
export default function MatchSetup({ allTeams = [], initialTournament }) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("single");
  const [teams, setTeams] = useState(allTeams);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [tournament, setTournament] = useState(initialTournament || "");
  const [tournamentDate, setTournamentDate] = useState(new Date().toISOString().slice(0, 10));
  const [tournamentFormat, setTournamentFormat] = useState("T20");
  const [overs, setOvers] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single Match States
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [teamARoster, setTeamARoster] = useState([]);
  const [teamBRoster, setTeamBRoster] = useState([]);
  const [batsmenText, setBatsmenText] = useState("");
  const [bowlersText, setBowlersText] = useState("");
  
  // Advanced Auto Schedule States (Copied from MatchScheduler)
  const [startTime, setStartTime] = useState("09:00");
  const [matchDuration, setMatchDuration] = useState(120); // mins
  const [matchGap, setMatchGap] = useState(30); // mins
  const [matchesPerDay, setMatchesPerDay] = useState(2);
  const [defaultVenue, setDefaultVenue] = useState("");

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState("A");

  // Auto Schedule Selection
  const [selectedTeams, setSelectedTeams] = useState(new Set());

  // ✅ HELPER: Sanitize Squad (Crucial to prevent crashes & sync with Scheduler)
  const sanitizeSquad = (roster) => {
    if (!roster) return [];
    return roster.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role || "All-Rounder",
      photoURL: player.photoURL && player.photoURL.startsWith("data:image") ? "" : player.photoURL || "",
      isIcon: !!player.isIcon,
    }));
  };

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
    setIsSubmitting(true);
    
    try {
        if (!availableTournaments.find((t) => t.id === tournament)) {
          await addTournament(tournament, { name: tournament, createdAt: new Date().toISOString(), status: "upcoming" });
        }
        
        // Find Real Team IDs if they exist in the dropdown list
        const teamAObj = teams.find(t => t.name === teamA);
        const teamBObj = teams.find(t => t.name === teamB);

        // ✅ Uses Sanitize Logic here too
        const squadA = sanitizeSquad(getSmartSquad(batsmenText, teamARoster));
        const squadB = sanitizeSquad(getSmartSquad(bowlersText, teamBRoster));
        const matchId = `match_${Date.now()}`;
        
        const startDateTime = new Date(`${tournamentDate}T${startTime}`);

        // ✅ EXACT SAME PAYLOAD STRUCTURE AS MatchScheduler
        await createMatch(tournament, matchId, {
          meta: { 
            teamAName: teamA, 
            teamBName: teamB, 
            teamAId: teamAObj?.id || "",
            teamBId: teamBObj?.id || "",
            teamALogo: teamAObj?.logoUrl || "",
            teamBLogo: teamBObj?.logoUrl || "",
            overs: Number(overs), 
            date: tournamentDate, 
            time: startTime,
            startAt: startDateTime.toISOString(), 
            format: tournamentFormat, 
            venue: defaultVenue || "TBA",
            matchTitle: "Friendly Match"
          },
          squads: { teamA: squadA, teamB: squadB },
        });
        alert("Match created successfully!");
        setTeamA(""); setTeamB(""); setBatsmenText(""); setBowlersText("");
    } catch (e) {
        console.error("Match Creation Error:", e);
        alert(`Error: ${e.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeams((prev) => {
      const copy = new Set(prev);
      if (copy.has(teamId)) copy.delete(teamId);
      else copy.add(teamId);
      return copy;
    });
  };

  // --- ⚡ UPGRADED AUTO SCHEDULER (Synced Logic) ---
  const handleAutoScheduleSubmit = async () => {
    if (selectedTeams.size < 2 || !tournament) return alert("Select at least 2 teams");
    setIsSubmitting(true);

    try {
        if (!availableTournaments.find((t) => t.id === tournament)) {
          await addTournament(tournament, { name: tournament, createdAt: new Date().toISOString(), status: "upcoming" });
        }
        
        const selectedTeamObjs = teams.filter((t) => selectedTeams.has(t.id));
        
        // 1. Generate Round Robin Pairs
        let matchesToCreate = [];
        for (let i = 0; i < selectedTeamObjs.length; i++) {
          for (let j = i + 1; j < selectedTeamObjs.length; j++) {
            matchesToCreate.push({ teamA: selectedTeamObjs[i], teamB: selectedTeamObjs[j] });
          }
        }

        // 2. Assign Dates & Times
        let currentDateTime = new Date(`${tournamentDate}T${startTime}`);
        let matchesToday = 0;
        const matchesPayload = [];

        matchesToCreate.forEach((pair, index) => {
            if (matchesToday >= matchesPerDay) {
                currentDateTime.setDate(currentDateTime.getDate() + 1); // Next Day
                const [h, m] = startTime.split(':');
                currentDateTime.setHours(h, m, 0, 0); // Reset Time
                matchesToday = 0;
            }

            const startIso = currentDateTime.toISOString();
            const dateStr = startIso.slice(0, 10);
            const timeStr = currentDateTime.toTimeString().slice(0, 5);
            
            // Calculate End Time
            const endDateTime = new Date(currentDateTime);
            endDateTime.setMinutes(endDateTime.getMinutes() + Number(matchDuration));

            matchesPayload.push({
                meta: { 
                    tournament: tournament,
                    teamAName: pair.teamA.name, 
                    teamBName: pair.teamB.name, 
                    teamAId: pair.teamA.id,
                    teamBId: pair.teamB.id,
                    teamALogo: pair.teamA.logoUrl || "",
                    teamBLogo: pair.teamB.logoUrl || "",
                    overs: Number(overs), 
                    date: dateStr, 
                    time: timeStr,
                    startAt: startIso,
                    endAt: endDateTime.toISOString(),
                    format: tournamentFormat,
                    venue: defaultVenue || "TBA",
                    matchTitle: `League Match ${index + 1}`
                },
                squads: { 
                    teamA: sanitizeSquad(pair.teamA.roster || []), 
                    teamB: sanitizeSquad(pair.teamB.roster || []) 
                }
            });

            // Increment time for next match
            matchesToday++;
            currentDateTime.setMinutes(currentDateTime.getMinutes() + Number(matchDuration) + Number(matchGap));
        });

        // 3. Batch Create using Firestore Batches
        const batchSize = 50; 
        const matchesCol = collection(db, "tournaments", tournament, "matches");

        for (let i = 0; i < matchesPayload.length; i += batchSize) {
            const chunk = matchesPayload.slice(i, i + batchSize);
            const batch = writeBatch(db);
            
            chunk.forEach(payload => {
                const newRef = doc(matchesCol); // Auto ID
                // Manually constructing doc to match createMatch schema
                const docData = {
                    meta: { ...payload.meta, status: "upcoming", createdAt: new Date().toISOString() },
                    squads: payload.squads,
                    // Unified Initial Innings Structure
                    innings: [
                        { battingTeam: "", score: 0, wickets: 0, over: 0, overBallCount: 0, ballsLog: [], timeline: [], striker: "", nonStriker: "", currentBowler: "", batsmenStats: {}, bowlerStats: {}, extras: {wides:0, noBalls:0, byes:0, legByes:0} },
                        { battingTeam: "", score: 0, wickets: 0, over: 0, overBallCount: 0, ballsLog: [], timeline: [], striker: "", nonStriker: "", currentBowler: "", batsmenStats: {}, bowlerStats: {}, extras: {wides:0, noBalls:0, byes:0, legByes:0} }
                    ],
                    status: "upcoming",
                    currentInnings: 0,
                    undoStack: []
                };
                batch.set(newRef, docData);
            });
            await batch.commit();
        }

        alert(`${matchesPayload.length} matches generated successfully!`);
        setSelectedTeams(new Set());
    } catch (e) {
        console.error("Auto Schedule Error:", e);
        alert(`Error: ${e.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Styles ---
  const inputClass = "w-full bg-[#0F1115] text-slate-200 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-teal-500/50 transition-all font-bold placeholder:text-slate-600";
  const labelClass = "block text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1";

  return (
    <div className="w-full pb-20">
      <PlayerPickerModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSelect={handlePlayersPicked} title={`SQUAD BUILDER`} />

      <div className="bg-[#1C2128] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* TAB NAVIGATION */}
        <div className="bg-[#161920]/50 p-2 flex gap-2 border-b border-white/5">
          {["single", "auto"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg" 
                : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
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
              <label className={labelClass}>Venue</label>
              <input value={defaultVenue} onChange={(e) => setDefaultVenue(e.target.value)} className={inputClass} placeholder="Stadium Name" />
            </div>
          </div>

          {/* SINGLE MATCH VIEW */}
          {activeTab === "single" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Team A */}
                <div className="space-y-4">
                  <label className={`${labelClass} text-teal-500`}>Primary Team (Home)</label>
                  <input value={teamA} onChange={(e) => handleTeamChange(e, setTeamA, setBatsmenText, setTeamARoster)} className={inputClass} placeholder="Team A Name" list="teamList" />
                  <div className="flex justify-between items-center px-1 pt-2">
                    <label className={labelClass}>Current Roster</label>
                    <button onClick={() => openPicker("A")} className="text-[9px] font-black text-teal-400 uppercase tracking-widest bg-teal-400/10 px-3 py-1 rounded-full border border-teal-400/20 hover:bg-teal-400/20 transition-colors">Build Squad</button>
                  </div>
                  <textarea value={batsmenText} onChange={(e) => setBatsmenText(e.target.value)} className={`${inputClass} h-32 text-xs leading-relaxed custom-scrollbar`} placeholder="Comma-separated player names..." />
                </div>

                {/* Team B */}
                <div className="space-y-4">
                  <label className={`${labelClass} text-indigo-400`}>Opposing Team (Away)</label>
                  <input value={teamB} onChange={(e) => handleTeamChange(e, setTeamB, setBowlersText, setTeamBRoster)} className={inputClass} placeholder="Team B Name" list="teamList" />
                  <div className="flex justify-between items-center px-1 pt-2">
                    <label className={labelClass}>Current Roster</label>
                    <button onClick={() => openPicker("B")} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-400/20 hover:bg-indigo-400/20 transition-colors">Build Squad</button>
                  </div>
                  <textarea value={bowlersText} onChange={(e) => setBowlersText(e.target.value)} className={`${inputClass} h-32 text-xs leading-relaxed custom-scrollbar`} placeholder="Comma-separated player names..." />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelClass}>Start Time</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
                 </div>
                 <div>
                    <label className={labelClass}>Overs</label>
                    <input type="number" value={overs} onChange={(e) => setOvers(e.target.value)} className={inputClass} />
                 </div>
              </div>

              <button onClick={handleSubmitSingle} disabled={!teamA || !teamB || isSubmitting} 
                      className="w-full py-5 bg-gradient-to-r from-teal-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-teal-900/40 active:scale-[0.98] transition-all disabled:opacity-50 hover:shadow-teal-900/60">
                {isSubmitting ? "Creating..." : "Finalize Encounter"}
              </button>
            </div>
          )}

          {/* AUTO SCHEDULE VIEW */}
          {activeTab === "auto" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
              <div className="p-6 bg-[#0F1115] rounded-3xl border border-white/5">
                  <h4 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-4 italic">Available Pool</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {teams.map((team) => (
                      <div key={team.id} onClick={() => toggleTeamSelection(team.id)} 
                           className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border ${selectedTeams.has(team.id) ? 'bg-teal-500/10 border-teal-500/50 text-teal-400 shadow-lg' : 'bg-[#161920] border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-400'}`}>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${selectedTeams.has(team.id) ? 'bg-teal-500 border-teal-500' : 'border-slate-700'}`}>
                            {selectedTeams.has(team.id) && <span className="text-black text-[10px] font-black">✓</span>}
                        </div>
                        <span className="text-xs font-black uppercase tracking-tight">{team.name}</span>
                      </div>
                    ))}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                    <label className={labelClass}>Start Time</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
                 </div>
                 <div>
                    <label className={labelClass}>Overs</label>
                    <input type="number" value={overs} onChange={(e) => setOvers(e.target.value)} className={inputClass} />
                 </div>
                 <div>
                    <label className={labelClass}>Matches/Day</label>
                    <input type="number" value={matchesPerDay} onChange={(e) => setMatchesPerDay(e.target.value)} className={inputClass} />
                 </div>
                 <div>
                    <label className={labelClass}>Duration (Min)</label>
                    <input type="number" value={matchDuration} onChange={(e) => setMatchDuration(e.target.value)} className={inputClass} />
                 </div>
                 <div>
                    <label className={labelClass}>Gap (Min)</label>
                    <input type="number" value={matchGap} onChange={(e) => setMatchGap(e.target.value)} className={inputClass} />
                 </div>
                 <div className="flex flex-col justify-end">
                    <button onClick={handleAutoScheduleSubmit} disabled={selectedTeams.size < 2 || isSubmitting} 
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-purple-900/20 active:scale-[0.98] transition-all disabled:opacity-50 hover:shadow-purple-900/40">
                        {isSubmitting ? "Generating..." : `Generate ${(selectedTeams.size * (selectedTeams.size - 1)) / 2} Fixtures`}
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