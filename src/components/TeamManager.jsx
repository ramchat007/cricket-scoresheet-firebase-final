import React, { useState, useEffect, useMemo } from "react";
import {
  addTeam,
  updateTeam,
  deleteTeam,
  subscribeTeams,
  subscribeAllGlobalTeams,
  listGlobalPlayers,
  createGlobalPlayer,
  getTournamentDetails,
} from "../utils/firestore.js";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth.jsx";
import { useTheme } from "../context/ThemeContext";
import {
  X,
  Search,
  Shield,
  Check,
  Loader2,
  Plus,
  Globe,
  UserPlus,
  Trash2,
  Crown,
  Save,
  Copy,
  GripVertical,
} from "lucide-react";

// --- SUB-COMPONENT: GLOBAL PLAYER SELECTOR MODAL ---
const PlayerSelectorModal = ({ isOpen, onClose, onSelect, existingNames }) => {
  const { theme } = useTheme();
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
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[80vh] transition-colors ${theme.card} ${lightMode ? "border border-gray-200" : "border border-white/10"}`}>
        <div
          className={`p-6 border-b flex justify-between items-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#1C2128] border-white/5"}`}>
          <h3
            className={`text-lg font-black uppercase tracking-tight italic flex items-center gap-2 ${theme.text}`}>
            <Globe size={20} className="text-teal-500" /> Select Global Players
          </h3>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${lightMode ? "bg-gray-200 text-gray-500 hover:bg-gray-300" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"}`}>
            <X size={16} />
          </button>
        </div>
        <div
          className={`p-4 border-b ${lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <div className="relative">
            <Search
              className={`absolute left-4 top-3.5 ${theme.sub}`}
              size={16}
            />
            <input
              className={`w-full rounded-xl px-4 py-3 pl-11 outline-none transition-colors font-bold text-sm border focus:border-teal-500 ${lightMode ? "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white" : "bg-[#0F1115] border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50"}`}
              placeholder="Search database..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-teal-500 animate-pulse">
              <Loader2 size={24} className="animate-spin" />
              <span className="font-bold text-sm uppercase tracking-widest">
                Loading...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className={`text-center py-8 italic text-sm ${theme.sub}`}>
              No matching players found.
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = selectedPlayers.some((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? (lightMode ? "bg-teal-50 border-teal-500 shadow-md" : "bg-teal-500/10 border-teal-500/50") : lightMode ? "bg-white border-gray-200 hover:border-teal-300" : "bg-[#0F1115] border-white/5 hover:border-white/10"}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isSelected ? (lightMode ? "bg-teal-100 text-teal-700" : "bg-teal-500 text-black") : lightMode ? "bg-gray-100 text-gray-500" : "bg-white/5 text-slate-500"}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div
                        className={`text-sm font-bold ${isSelected ? (lightMode ? "text-teal-700" : "text-teal-400") : theme.text}`}>
                        {p.name}
                      </div>
                      <div
                        className={`text-[10px] uppercase font-bold tracking-wider ${theme.sub}`}>
                        {p.role}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className={`p-1 rounded-full ${lightMode ? "bg-teal-100 text-teal-600" : "text-teal-400"}`}>
                      <Check size={16} strokeWidth={4} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div
          className={`p-6 border-t flex justify-end gap-3 rounded-b-3xl ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <button
            onClick={onClose}
            className={`text-xs font-black uppercase tracking-widest px-6 py-3 border rounded-xl transition-colors ${lightMode ? "text-gray-500 border-gray-300 hover:bg-gray-200" : "text-slate-500 border-white/10 hover:bg-white/5"}`}>
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedPlayers.length === 0}
            className="bg-gradient-to-r from-teal-600 to-teal-700 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center gap-2">
            <Plus size={14} /> Add {selectedPlayers.length} Players
          </button>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: IMPORT TEAM MODAL ---
const ImportTeamModal = ({ isOpen, onClose, onImport }) => {
  const { theme } = useTheme();
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const unsub = subscribeAllGlobalTeams((teams) => {
        setAllTeams(teams);
        setLoading(false);
      });
      return () => unsub();
    }
  }, [isOpen]);

  const filtered = allTeams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[80vh] ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"}`}>
        <div
          className={`p-6 border-b flex justify-between items-center ${lightMode ? "bg-gray-50" : "bg-black/20"}`}>
          <h3
            className={`text-lg font-black uppercase flex gap-2 ${theme.text}`}>
            <Copy size={20} className="text-blue-500" /> Import Team
          </h3>
          <button onClick={onClose}>
            <X size={20} className={theme.sub} />
          </button>
        </div>
        <div className="p-4 border-b">
          <input
            autoFocus
            placeholder="Search existing teams..."
            className={`w-full p-3 rounded-xl font-bold border outline-none ${lightMode ? "bg-white border-gray-200 text-black" : "bg-black/20 border-white/10 text-white"}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center p-8">
              <Loader2 className="animate-spin mx-auto" />
            </div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  onImport(t);
                  onClose();
                }}
                className={`p-4 rounded-xl border cursor-pointer hover:border-blue-500 transition-all flex justify-between items-center ${lightMode ? "bg-white border-gray-200" : "bg-white/5 border-white/5"}`}>
                <div>
                  <div className={`font-bold ${theme.text}`}>{t.name}</div>
                  <div className={`text-xs ${theme.sub}`}>
                    {t.roster?.length || 0} Players
                  </div>
                </div>
                <Plus size={16} className="text-blue-500" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function TeamManager({ tournamentId }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Data State
  const [teams, setTeams] = useState([]);
  const [isAuctionMode, setIsAuctionMode] = useState(false);

  // Form State
  const [teamId, setTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamGroup, setTeamGroup] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [squad, setSquad] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Owner Player Logic
  const [isOwnerPlaying, setIsOwnerPlaying] = useState(false);
  const [ownerRole, setOwnerRole] = useState("All-Rounder");

  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [guestName, setGuestName] = useState("");

  // Drag State
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  // 1. Fetch Teams & Config
  useEffect(() => {
    if (!tournamentId) return;

    const fetchConfig = async () => {
      const data = await getTournamentDetails(tournamentId);
      setIsAuctionMode(!!data?.isAuctionMode);
    };
    fetchConfig();

    const unsubscribe = subscribeTeams(tournamentId, (data) => {
      setTeams(data);
    });
    return () => unsubscribe();
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
      setTeamGroup(team.group || "");
      setOwnerName(team.ownerName || "");

      if (team.roster && Array.isArray(team.roster) && team.roster.length > 0) {
        setSquad(team.roster);
      } else if (team.players && Array.isArray(team.players)) {
        setSquad(
          team.players.map((name) => ({
            id: `guest_${Date.now()}_${Math.random()}`,
            name: name,
            isGuest: true,
          })),
        );
      } else {
        setSquad([]);
      }
    }
  };

  const resetForm = () => {
    setTeamId("");
    setTeamName("");
    setTeamGroup("");
    setOwnerName("");
    setSquad([]);
    setGuestName("");
    setIsOwnerPlaying(false);
    setOwnerRole("All-Rounder");
  };

  const handleImportTeam = (importedTeam) => {
    setTeamId("");
    setTeamName(importedTeam.name + " (Copy)");
    setTeamGroup(importedTeam.group || "");
    setOwnerName(importedTeam.ownerName || "");
    if (importedTeam.roster) {
      setSquad(importedTeam.roster.map((p) => ({ ...p })));
    }
  };

  // 🟢 3. NEW: GROUP-AWARE VALIDATION LOGIC
  const checkGroupViolation = (playerName, targetGroup) => {
    const normalizedName = playerName.toLowerCase().trim();
    const normalizedGroup = (targetGroup || "").trim().toUpperCase();

    // Check all other teams in memory
    for (const t of teams) {
      if (t.id === teamId) continue; // Skip the team we are currently editing

      const tGroup = (t.group || "").trim().toUpperCase();

      // If the team belongs to the SAME group/lot, check their roster!
      if (tGroup === normalizedGroup) {
        const isPlaying = t.roster?.some(
          (p) => p.name.toLowerCase().trim() === normalizedName,
        );
        if (isPlaying) {
          return t.name; // Return the conflicting team's name
        }
      }
    }
    return null; // Safe!
  };

  const addGuestPlayer = (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    // Run Group Validation
    const conflictTeam = checkGroupViolation(guestName, teamGroup);
    if (conflictTeam) {
      alert(
        `⚠️ Rule Violation: "${guestName.trim()}" is already registered for "${conflictTeam}" in Group "${teamGroup || "Default"}". They cannot play for two teams in the same lot.`,
      );
      return;
    }

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
    // Filter out players who violate the group rule
    const validPlayers = selected.filter((p) => {
      const conflictTeam = checkGroupViolation(p.name, teamGroup);
      if (conflictTeam) {
        alert(
          `⚠️ Dropped "${p.name}": Already registered for "${conflictTeam}" in this group/lot.`,
        );
        return false;
      }
      return true;
    });

    const formatted = validPlayers.map((p) => ({
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

  // 4. Drag & Drop Handlers
  const onDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newSquad = [...squad];
    const draggedItem = newSquad[draggedItemIndex];
    newSquad.splice(draggedItemIndex, 1);
    newSquad.splice(index, 0, draggedItem);

    setSquad(newSquad);
    setDraggedItemIndex(index);
  };

  const onDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // 5. Save Logic
  const handleSaveTeam = async () => {
    if (!teamName.trim()) return alert("Team name required.");
    if (!tournamentId) return alert("Tournament ID missing.");

    if (isAuctionMode && isOwnerPlaying && !ownerName.trim()) {
      return alert("Owner Name is required if they are playing.");
    }

    if (squad.length === 0 && !isOwnerPlaying) {
      return alert("Add at least one player.");
    }

    // 🟢 FINAL SAFETY LOCK: Check entire squad before saving
    // (Prevents bugs if the user changes the 'Group' name AFTER adding players)
    for (const p of squad) {
      const conflict = checkGroupViolation(p.name, teamGroup);
      if (conflict) {
        return alert(
          `⚠️ Cannot save! Player "${p.name}" is already in "${conflict}" in Group "${teamGroup || "Default"}". Please remove them or change the Group name.`,
        );
      }
    }

    if (isAuctionMode && isOwnerPlaying) {
      const conflict = checkGroupViolation(ownerName, teamGroup);
      if (conflict) {
        return alert(
          `⚠️ Cannot save! Owner "${ownerName}" is already playing for "${conflict}" in this Group.`,
        );
      }
    }

    setIsSaving(true);

    try {
      let finalSquad = [...squad];
      if (isAuctionMode && isOwnerPlaying) {
        const exists = finalSquad.find(
          (p) => p.name.toLowerCase() === ownerName.trim().toLowerCase(),
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

      const processedSquad = await Promise.all(
        finalSquad.map(async (p) => {
          if (p.isGuest && !p.id.includes("global_")) {
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
        }),
      );

      const playersArray = processedSquad.map((p) => p.name);
      const rosterArray = processedSquad.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role || "Player",
        isGuest: !!p.isGuest,
        isOwner: !!p.isOwner,
      }));

      let savedTeamId = teamId;
      const teamPayload = {
        name: teamName,
        group: teamGroup.trim().toUpperCase(),
        ownerName: isAuctionMode ? ownerName : "",
        roster: rosterArray,
      };

      if (teamId) {
        await updateTeam(tournamentId, teamId, playersArray, teamPayload);
      } else {
        const newDocRef = await addTeam(
          tournamentId,
          teamName,
          playersArray,
          teamPayload,
        );
        savedTeamId = newDocRef.id;
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

  const labelClass = `block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1 ${theme.sub}`;
  const inputClass = `w-full rounded-xl px-4 py-3 focus:outline-none transition-all font-bold text-sm border focus:border-teal-500 ${
    lightMode
      ? "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white placeholder:text-gray-400"
      : "bg-[#0F1115] border-white/10 text-slate-200 focus:ring-1 focus:ring-teal-500/20 placeholder:text-slate-600"
  }`;

  return (
    <div
      className={`rounded-[2rem] p-6 md:p-8 shadow-2xl mb-6 backdrop-blur-md transition-colors ${lightMode ? "bg-white border border-gray-200" : "bg-[#1C2128] border border-white/5"}`}>
      <PlayerSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={addGlobalPlayers}
        existingNames={squad.map((p) => p.name)}
      />
      <ImportTeamModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportTeam}
      />

      <div
        className={`flex justify-between items-center mb-8 border-b pb-4 ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <h2
          className={`text-xl font-black italic uppercase tracking-tighter flex items-center gap-3 ${theme.text}`}>
          <Shield
            size={24}
            className={lightMode ? "text-teal-600" : "text-white"}
          />{" "}
          Team Manager
        </h2>
        <span
          className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border ${lightMode ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-[#0F1115] text-slate-500 border-white/5"}`}>
          {teams.length} Teams Active
        </span>
      </div>

      <div className="space-y-8">
        <div>
          <label className={labelClass}>Select Team to Edit</label>
          <div className="flex gap-2">
            <div className="relative group flex-1">
              <select
                className={`${inputClass} appearance-none cursor-pointer`}
                value={teamId}
                onChange={handleSelectTeam}>
                <option value="" className="text-gray-500">
                  -- Create New Team --
                </option>
                {teams.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    className={
                      lightMode
                        ? "bg-white text-gray-900"
                        : "bg-[#1C2128] text-slate-200"
                    }>
                    {t.name || t.id}
                  </option>
                ))}
              </select>
              <div
                className={`absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none transition-colors ${theme.sub}`}>
                ▼
              </div>
            </div>
            <button
              onClick={() => setIsImportOpen(true)}
              className={`px-4 rounded-xl font-bold uppercase text-xs flex items-center gap-2 transition-all ${lightMode ? "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100" : "bg-blue-900/20 text-blue-400 border border-blue-500/20 hover:border-blue-500/50"}`}>
              <Copy size={16} /> Import
            </button>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${isAuctionMode ? "lg:grid-cols-3" : ""} gap-6`}>
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

          {/* 🟢 LOT / GROUP FIELD */}
          <div>
            <label className={labelClass}>Group / Lot Name</label>
            <input
              type="text"
              className={inputClass}
              value={teamGroup}
              onChange={(e) => setTeamGroup(e.target.value)}
              placeholder="e.g. Open Lot, Building A..."
            />
          </div>

          {isAuctionMode && (
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
          )}
        </div>

        {isAuctionMode && (
          <div
            className={`p-5 rounded-2xl border transition-colors ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
            <div className="flex items-center gap-4">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  id="ownerPlay"
                  checked={isOwnerPlaying}
                  onChange={(e) => setIsOwnerPlaying(e.target.checked)}
                  className={`peer h-6 w-6 cursor-pointer appearance-none rounded-lg border transition-all ${lightMode ? "bg-white border-gray-300 checked:bg-teal-600 checked:border-teal-600" : "bg-[#0F1115] border-white/10 checked:bg-teal-500 checked:border-teal-500"}`}
                />
                <Check
                  size={14}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                />
              </div>
              <div>
                <label
                  htmlFor="ownerPlay"
                  className={`text-sm font-bold cursor-pointer select-none ${theme.text}`}>
                  Is Owner playing in the team?
                </label>
                <p className={`text-[10px] font-medium mt-0.5 ${theme.sub}`}>
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
        )}

        <div>
          <div className="flex justify-between items-end mb-2 px-1">
            <label className={labelClass}>Squad Roster ({squad.length})</label>
            <span className={`text-[9px] font-bold uppercase ${theme.sub}`}>
              Drag to reorder
            </span>
          </div>

          <div
            className={`border rounded-2xl p-4 min-h-[150px] shadow-inner transition-colors ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
            {squad.length === 0 ? (
              <div
                className={`text-center text-sm py-10 italic flex flex-col items-center gap-2 ${theme.sub}`}>
                <UserPlus size={32} className="opacity-20" />
                <span>
                  No players added yet.
                  <br />
                  Use the buttons below to build your squad.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {squad.map((player, index) => (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={(e) => onDragOver(e, index)}
                    onDragEnd={onDragEnd}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all shadow-sm group cursor-move ${lightMode ? "bg-white border-gray-200 hover:border-teal-300" : "bg-[#161920] border-white/5 hover:border-white/10"} ${draggedItemIndex === index ? "opacity-50 ring-2 ring-teal-500" : ""}`}>
                    <div className="flex items-center gap-3">
                      <GripVertical
                        size={16}
                        className={`opacity-30 group-hover:opacity-100 ${theme.sub}`}
                      />
                      <div
                        className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${player.isOwner ? "bg-purple-500 text-purple-500 animate-pulse" : player.isGuest ? "bg-amber-500 text-amber-500" : "bg-teal-500 text-teal-500"}`}></div>
                      <div>
                        <div
                          className={`text-sm font-bold leading-tight flex items-center gap-2 ${theme.text}`}>
                          {player.name}
                          {player.isOwner && (
                            <span
                              className={`text-[8px] px-1.5 py-0.5 rounded border font-black uppercase tracking-widest flex items-center gap-1 ${lightMode ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-purple-900/30 text-purple-300 border-purple-500/30"}`}>
                              <Crown size={8} /> OWNER
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 ${theme.sub}`}>
                          {player.isGuest
                            ? "Guest (Auto-Save)"
                            : "Global Player"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all font-bold text-xs ${lightMode ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20"}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className={`font-black text-xs uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm border ${lightMode ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" : "bg-teal-900/10 hover:bg-teal-900/20 text-teal-400 border-teal-500/20 hover:border-teal-500/40"}`}>
              <Globe size={18} /> Search Global DB
            </button>

            <div className="flex gap-2">
              <input
                className={`border rounded-xl px-4 py-3 flex-1 text-sm font-bold focus:outline-none transition-colors ${lightMode ? "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300" : "bg-[#0F1115] border-white/10 text-slate-200 focus:border-white/20 placeholder:text-slate-600"}`}
                placeholder="Type Manual Guest Name..."
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGuestPlayer(e)}
              />
              <button
                onClick={addGuestPlayer}
                disabled={!guestName.trim()}
                className={`px-5 rounded-xl font-bold disabled:opacity-30 border transition-all text-xl flex items-center justify-center ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200" : "bg-[#161920] hover:bg-white/10 text-white border-white/5"}`}>
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`pt-8 border-t flex gap-4 ${lightMode ? "border-gray-200" : "border-white/5"}`}>
          <button
            onClick={handleSaveTeam}
            disabled={!user || isSaving}
            className="flex-1 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl shadow-teal-900/20 disabled:opacity-50 transition-all flex justify-center items-center gap-3 active:scale-[0.98]">
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
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
              className={`px-6 py-4 font-black text-sm uppercase tracking-widest rounded-xl border transition-all flex items-center gap-2 ${lightMode ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-red-900/10 text-red-400 hover:bg-red-900/30 border-red-500/20 hover:border-red-500/40"}`}>
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
