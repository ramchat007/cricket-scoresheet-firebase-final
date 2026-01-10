import React, { useState, useEffect } from "react";
import {
  addTeam,
  updateTeam,
  deleteTeam,
  subscribeTeams,
  subscribeAllTeams,
  listGlobalPlayers,
  createGlobalPlayer,
} from "../utils/firestore.js";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../utils/firebase"; 
import { useAuth } from "../hooks/useAuth.jsx";

// --- SUB-COMPONENT: GLOBAL PLAYER SELECTOR MODAL ---
const PlayerSelectorModal = ({ isOpen, onClose, onSelect, existingNames }) => {
  const [globalPlayers, setGlobalPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetch = async () => {
        setLoading(true);
        try {
          const data = await listGlobalPlayers();
          const available = data.filter((p) => !existingNames.includes(p.name));
          setGlobalPlayers(available);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetch();
    } else {
      setSelectedPlayers([]);
      setSearchTerm("");
    }
  }, [isOpen, existingNames]);

  const toggleSelect = (player) => {
    if (selectedPlayers.find((p) => p.id === player.id)) {
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id));
    } else {
      setSelectedPlayers((prev) => [...prev, player]);
    }
  };

  const handleAdd = () => {
    onSelect(selectedPlayers);
    onClose();
  };

  const filtered = globalPlayers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1115]/90 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#1C2128] border border-white/10 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight italic">
            Select Global Players
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            ✕
          </button>
        </div>
        
        <div className="p-4 bg-[#161920] border-b border-white/5">
          <input
            className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-teal-500/50 transition-colors placeholder:text-slate-600 font-bold"
            placeholder="Search database..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8 text-teal-500 animate-pulse font-bold text-sm uppercase tracking-widest">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-600 italic text-sm">
              No matching players found.
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = selectedPlayers.some((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-teal-500/10 border-teal-500/50"
                      : "bg-[#0F1115] border-white/5 hover:border-white/10"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isSelected ? 'bg-teal-500 text-black' : 'bg-white/5 text-slate-500'}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isSelected ? 'text-teal-400' : 'text-slate-300'}`}>
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        {p.role}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="text-teal-400 font-black text-lg">✓</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-[#161920] flex justify-end gap-3 rounded-b-3xl">
          <button
            onClick={onClose}
            className="text-slate-500 text-xs font-black uppercase tracking-widest px-6 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedPlayers.length === 0}
            className="bg-gradient-to-r from-teal-600 to-teal-700 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
            Add {selectedPlayers.length} Players
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function TeamManager({ tournamentId }) {
  const { user } = useAuth();

  // Data State
  const [teams, setTeams] = useState([]);

  // Form State
  const [teamId, setTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [ownerName, setOwnerName] = useState(""); 
  const [squad, setSquad] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Owner Player Logic
  const [isOwnerPlaying, setIsOwnerPlaying] = useState(false); 
  const [ownerRole, setOwnerRole] = useState("All-Rounder"); 

  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guestName, setGuestName] = useState("");

  // 1. Fetch Teams
  useEffect(() => {
    let unsubscribe = () => {};
    if (tournamentId) {
      unsubscribe = subscribeTeams(tournamentId, setTeams);
    } else {
      unsubscribe = subscribeAllTeams(setTeams);
    }
    return () => unsubscribe && unsubscribe();
  }, [tournamentId]);

  // 2. Select Team Logic
  const handleSelectTeam = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      resetForm();
      return;
    }

    const team = teams.find((t) => t.id === selectedId);
    if (team) {
      setTeamId(team.id);
      setTeamName(team.name || team.id);
      setOwnerName(team.ownerName || ""); 

      if (team.roster && Array.isArray(team.roster) && team.roster.length > 0) {
        setSquad(team.roster);
      } else if (team.players && Array.isArray(team.players)) {
        setSquad(
          team.players.map((name) => ({
            id: `guest_${Date.now()}_${Math.random()}`,
            name: name,
            isGuest: true,
          }))
        );
      } else {
        setSquad([]);
      }
    }
  };

  const resetForm = () => {
    setTeamId("");
    setTeamName("");
    setOwnerName("");
    setSquad([]);
    setGuestName("");
    setIsOwnerPlaying(false);
    setOwnerRole("All-Rounder");
  };

  // 3. Squad Management
  const addGuestPlayer = (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const newPlayer = {
      id: `guest_${Date.now()}`,
      name: guestName.trim(),
      role: "All-Rounder",
      isGuest: true,
    };
    setSquad((prev) => [...prev, newPlayer]);
    setGuestName("");
  };

  const addGlobalPlayers = (selected) => {
    const formatted = selected.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role || "Player",
      isGuest: false,
    }));
    setSquad((prev) => [...prev, ...formatted]);
  };

  const removePlayer = (playerId) => {
    setSquad((prev) => prev.filter((p) => p.id !== playerId));
  };

  // 4. Save Logic
  const handleSaveTeam = async () => {
    if (!teamName.trim()) return alert("Team name required.");
    if (!tournamentId) return alert("Tournament ID missing.");

    if (isOwnerPlaying && !ownerName.trim()) {
      return alert("Owner Name is required if they are playing.");
    }

    if (squad.length === 0 && !isOwnerPlaying) {
      return alert("Add at least one player.");
    }

    setIsSaving(true);

    try {
      // --- STEP 1: ADD OWNER TO SQUAD ---
      let finalSquad = [...squad];
      if (isOwnerPlaying) {
        const exists = finalSquad.find(
          (p) => p.name.toLowerCase() === ownerName.trim().toLowerCase()
        );
        if (!exists) {
          finalSquad.push({
            id: `owner_${Date.now()}`, 
            name: ownerName.trim(),
            role: ownerRole,
            isGuest: true, 
            isOwner: true, 
          });
        }
      }

      // --- STEP 2: PROCESS GUESTS ---
      const processedSquad = await Promise.all(
        finalSquad.map(async (p) => {
          if (p.isGuest) {
            try {
              const newGlobalId = await createGlobalPlayer({
                name: p.name,
                role: p.role || "All-Rounder",
                battingStyle: "Right Hand Bat",
                bowlingStyle: "Right Arm Medium",
              });
              return {
                id: newGlobalId,
                name: p.name,
                role: p.role,
                isGuest: false,
                isOwner: !!p.isOwner,
              };
            } catch (err) {
              console.error(`Failed to promote guest ${p.name}`, err);
              return p;
            }
          }
          return p;
        })
      );

      // --- STEP 3: PREPARE DATA ---
      const playersArray = processedSquad.map((p) => p.name);
      const rosterArray = processedSquad.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role || "Player",
        isGuest: !!p.isGuest,
        isOwner: !!p.isOwner, 
      }));

      // --- STEP 4: SAVE TEAM DOC ---
      let savedTeamId = teamId;
      const teamPayload = {
        name: teamName,
        ownerName: ownerName, 
        roster: rosterArray,
      };

      if (teamId) {
        await updateTeam(tournamentId, teamId, playersArray, teamPayload);
      } else {
        const newDocRef = await addTeam(
          tournamentId,
          teamName,
          playersArray,
          teamPayload
        );
        savedTeamId = newDocRef.id;
      }

      // --- STEP 5: REGISTER OWNER IN AUCTION STATS ---
      if (isOwnerPlaying) {
        const ownerPlayer = processedSquad.find((p) => p.isOwner);
        if (ownerPlayer) {
          await addDoc(
            collection(db, "tournaments", tournamentId, "auctionPlayers"),
            {
              name: ownerPlayer.name,
              role: ownerPlayer.role,
              status: "SOLD",
              teamId: savedTeamId, 
              soldPrice: 0,
              isOwner: true,
              playerId: ownerPlayer.id, 
              createdAt: new Date().toISOString(),
            }
          );
        }
      }

      alert(teamId ? "Team updated!" : "Team created!");
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Error saving team: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this team?")) return;
    try {
      await deleteTeam(tournamentId, teamId);
      alert("Deleted.");
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Delete failed");
    }
  };

  const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1";
  const inputClass = "w-full bg-[#0F1115] text-slate-200 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-all placeholder:text-slate-600 font-bold";

  return (
    <div className="bg-[#1C2128] border border-white/5 rounded-[2rem] p-6 md:p-8 shadow-2xl mb-6 backdrop-blur-md">
      <PlayerSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={addGlobalPlayers}
        existingNames={squad.map((p) => p.name)}
      />

      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
        <h2 className="text-xl font-black text-slate-100 italic uppercase tracking-tighter flex items-center gap-3">
          <span className="text-2xl not-italic">🛡️</span> Team Manager
        </h2>
        <span className="text-[10px] font-black text-slate-500 bg-[#0F1115] border border-white/5 px-3 py-1.5 rounded-lg uppercase tracking-widest">
          {teams.length} Teams Active
        </span>
      </div>

      <div className="space-y-8">
        {/* SELECT TEAM */}
        <div>
          <label className={labelClass}>Select Team to Edit</label>
          <div className="relative group">
            <select
              className={`${inputClass} appearance-none cursor-pointer hover:border-white/20`}
              value={teamId}
              onChange={handleSelectTeam}>
              <option value="" className="text-slate-500">-- Create New Team --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="text-slate-200 bg-[#1C2128]">
                  {t.name || t.id}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 group-hover:text-slate-300 transition-colors">
              ▼
            </div>
          </div>
        </div>

        {/* TEAM NAME & OWNER NAME */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Team Name</label>
            <input
              type="text"
              className={inputClass}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Royal Challengers"
            />
          </div>
          <div>
            <label className={labelClass}>Owner Name</label>
            <input
              type="text"
              className={inputClass}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Virat Kohli"
            />
          </div>
        </div>

        {/* OWNER PLAYING CONFIG */}
        <div className="bg-[#161920] p-5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center">
                <input
                type="checkbox"
                id="ownerPlay"
                checked={isOwnerPlaying}
                onChange={(e) => setIsOwnerPlaying(e.target.checked)}
                className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border border-white/10 bg-[#0F1115] checked:border-teal-500 checked:bg-teal-500 transition-all"
                />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 peer-checked:opacity-100 font-bold pointer-events-none">✓</span>
            </div>
            
            <div>
              <label
                htmlFor="ownerPlay"
                className="text-slate-200 text-sm font-bold cursor-pointer select-none">
                Is Owner playing in the team?
              </label>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                They will be added to squad & stats automatically.
              </p>
            </div>
          </div>

          {isOwnerPlaying && (
            <div className="mt-4 animate-in slide-in-from-top-2 pl-10">
              <label className={labelClass}>Owner's Playing Role</label>
              <select
                value={ownerRole}
                onChange={(e) => setOwnerRole(e.target.value)}
                className={`${inputClass} w-full md:w-1/2`}>
                <option>Batsman</option>
                <option>Bowler</option>
                <option>All-Rounder</option>
                <option>Wicket Keeper</option>
              </select>
            </div>
          )}
        </div>

        {/* ROSTER BUILDER */}
        <div>
          <div className="flex justify-between items-end mb-2 px-1">
             <label className={labelClass}>Squad Roster ({squad.length})</label>
             <span className="text-[9px] text-slate-600 font-bold uppercase">Drag & Drop coming soon</span>
          </div>

          <div className="bg-[#0F1115] border border-white/5 rounded-2xl p-4 min-h-[150px] shadow-inner">
            {squad.length === 0 ? (
              <div className="text-center text-slate-600 text-sm py-10 italic flex flex-col items-center gap-2">
                <span className="text-2xl opacity-20">👥</span>
                <span>No players added yet.<br />Use the buttons below to build your squad.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {squad.map((player) => (
                  <div
                    key={player.id}
                    className="bg-[#161920] flex justify-between items-center p-3 rounded-xl border border-white/5 group hover:border-white/10 transition-all shadow-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${
                          player.isOwner
                            ? "bg-purple-500 text-purple-500 animate-pulse"
                            : player.isGuest
                            ? "bg-amber-500 text-amber-500"
                            : "bg-teal-500 text-teal-500"
                        }`}></div>
                      <div>
                        <div className="text-sm font-bold text-slate-200 leading-tight flex items-center gap-2">
                          {player.name}
                          {player.isOwner && (
                            <span className="text-[8px] bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-black uppercase tracking-widest">
                              OWNER
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">
                          {player.isGuest
                            ? "Guest (Auto-Save)"
                            : "Global Player"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-all font-bold text-xs">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ADD CONTROLS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-teal-900/10 hover:bg-teal-900/20 text-teal-400 border border-teal-500/20 hover:border-teal-500/40 font-black text-xs uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
              <span className="text-lg">🌍</span> Search Global DB
            </button>

            <div className="flex gap-2">
              <input
                className="bg-[#0F1115] border border-white/10 text-slate-200 rounded-xl px-4 py-3 flex-1 text-sm font-bold focus:outline-none focus:border-white/20 placeholder:text-slate-600"
                placeholder="Type Manual Guest Name..."
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGuestPlayer(e)}
              />
              <button
                onClick={addGuestPlayer}
                disabled={!guestName.trim()}
                className="bg-[#161920] hover:bg-white/10 text-white px-5 rounded-xl font-bold disabled:opacity-30 border border-white/5 transition-all text-xl">
                +
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="pt-8 border-t border-white/5 flex gap-4">
          <button
            onClick={handleSaveTeam}
            disabled={!user || isSaving}
            className="flex-1 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl shadow-teal-900/20 disabled:opacity-50 transition-all flex justify-center items-center gap-3 active:scale-[0.98]">
            {isSaving && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            )}
            {isSaving
              ? "Saving Team..."
              : teamId
              ? "Update Team Roster"
              : "Create New Team"}
          </button>

          {teamId && (
            <button
              onClick={handleDelete}
              className="px-6 py-4 bg-red-900/10 text-red-400 hover:bg-red-900/30 font-black text-sm uppercase tracking-widest rounded-xl border border-red-500/20 transition-all hover:border-red-500/40">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}