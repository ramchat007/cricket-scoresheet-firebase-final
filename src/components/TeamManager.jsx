// src/components/TeamManager.jsx
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
import { db } from "../utils/firebase"; // Import db
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">
            Select Global Players
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-3 bg-gray-900 border-b border-gray-800">
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-cyan-500 transition-colors"
            placeholder="Search database..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="text-center py-8 text-cyan-500 animate-pulse">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No matching players found.
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = selectedPlayers.some((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? "bg-cyan-900/30 border border-cyan-500/50"
                      : "hover:bg-gray-800 border border-transparent"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                      👤
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-200">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-gray-500 uppercase">
                        {p.role}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="text-cyan-400 font-bold">✓</div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-gray-400 text-sm font-bold px-4 py-2 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedPlayers.length === 0}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
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
  const [ownerName, setOwnerName] = useState(""); // NEW: Owner Name
  const [squad, setSquad] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Owner Player Logic
  const [isOwnerPlaying, setIsOwnerPlaying] = useState(false); // NEW
  const [ownerRole, setOwnerRole] = useState("All-Rounder"); // NEW

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
      setOwnerName(team.ownerName || ""); // Load Owner

      // Parse Squad Data
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

  // 4. Save Logic (Handles Guests + Owner)
  const handleSaveTeam = async () => {
    if (!teamName.trim()) return alert("Team name required.");
    if (!tournamentId) return alert("Tournament ID missing.");

    // --- OWNER VALIDATION ---
    if (isOwnerPlaying && !ownerName.trim()) {
      return alert("Owner Name is required if they are playing.");
    }

    // --- CHECK FOR SQUAD ---
    // If owner is playing, squad can be empty initially (owner will be added)
    if (squad.length === 0 && !isOwnerPlaying) {
      return alert("Add at least one player.");
    }

    setIsSaving(true);

    try {
      // --- STEP 1: ADD OWNER TO SQUAD (IF PLAYING) ---
      let finalSquad = [...squad];
      if (isOwnerPlaying) {
        // Check if owner is already in squad to avoid duplicates
        const exists = finalSquad.find(
          (p) => p.name.toLowerCase() === ownerName.trim().toLowerCase()
        );
        if (!exists) {
          finalSquad.push({
            id: `owner_${Date.now()}`, // Temporary ID, will be globalized below
            name: ownerName.trim(),
            role: ownerRole,
            isGuest: true, // Will convert to Global Player logic
            isOwner: true, // Mark as Owner
          });
        }
      }

      // --- STEP 2: PROCESS GUESTS (CREATE GLOBAL PLAYERS) ---
      const processedSquad = await Promise.all(
        finalSquad.map(async (p) => {
          if (p.isGuest) {
            try {
              // Create in Global DB
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
        isOwner: !!p.isOwner, // Persist owner flag
      }));

      // --- STEP 4: SAVE TEAM DOC ---
      let savedTeamId = teamId;
      const teamPayload = {
        name: teamName,
        ownerName: ownerName, // Save Owner Name
        roster: rosterArray,
      };

      if (teamId) {
        // UPDATE
        await updateTeam(tournamentId, teamId, playersArray, teamPayload);
      } else {
        // CREATE NEW
        const newDocRef = await addTeam(
          tournamentId,
          teamName,
          playersArray,
          teamPayload
        );
        savedTeamId = newDocRef.id;
      }

      // --- STEP 5: REGISTER OWNER IN AUCTION STATS (IF PLAYING) ---
      if (isOwnerPlaying) {
        const ownerPlayer = processedSquad.find((p) => p.isOwner);
        if (ownerPlayer) {
          // Add to Global Auction Players as SOLD so stats work
          await addDoc(
            collection(db, "tournaments", tournamentId, "auctionPlayers"),
            {
              name: ownerPlayer.name,
              role: ownerPlayer.role,
              status: "SOLD",
              teamId: savedTeamId, // Link to this team
              soldPrice: 0,
              isOwner: true,
              playerId: ownerPlayer.id, // Link to Global ID
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

  const labelClass =
    "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2";
  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg mb-6">
      <PlayerSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={addGlobalPlayers}
        existingNames={squad.map((p) => p.name)}
      />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-cyan-500">🛡️</span> Team Manager
        </h2>
        <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded">
          {teams.length} Teams
        </span>
      </div>

      <div className="space-y-6">
        {/* SELECT TEAM */}
        <div>
          <label className={labelClass}>Select Team to Edit</label>
          <div className="relative">
            <select
              className={`${inputClass} appearance-none cursor-pointer`}
              value={teamId}
              onChange={handleSelectTeam}>
              <option value="">-- Create New Team --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
              ▼
            </div>
          </div>
        </div>

        {/* TEAM NAME & OWNER NAME */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ownerPlay"
              checked={isOwnerPlaying}
              onChange={(e) => setIsOwnerPlaying(e.target.checked)}
              className="w-5 h-5 accent-cyan-500 cursor-pointer"
            />
            <div>
              <label
                htmlFor="ownerPlay"
                className="text-white text-sm font-bold cursor-pointer">
                Is Owner playing in the team?
              </label>
              <p className="text-[10px] text-gray-500">
                They will be added to squad & stats automatically.
              </p>
            </div>
          </div>

          {isOwnerPlaying && (
            <div className="mt-4 animate-in slide-in-from-top-2">
              <label className={labelClass}>Owner's Playing Role</label>
              <select
                value={ownerRole}
                onChange={(e) => setOwnerRole(e.target.value)}
                className={inputClass}>
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
          <label className={labelClass}>Squad Roster ({squad.length})</label>

          <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-4 min-h-[150px]">
            {squad.length === 0 ? (
              <div className="text-center text-gray-600 text-sm py-8 italic">
                No players added yet. <br /> Use the buttons below to build your
                squad.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {squad.map((player) => (
                  <div
                    key={player.id}
                    className="bg-gray-800 flex justify-between items-center p-2 rounded border border-gray-700 group">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          player.isOwner
                            ? "bg-purple-500 animate-pulse"
                            : player.isGuest
                            ? "bg-yellow-500"
                            : "bg-cyan-500"
                        }`}></div>
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">
                          {player.name}
                          {player.isOwner && (
                            <span className="ml-2 text-[9px] bg-purple-900 text-purple-200 px-1 rounded border border-purple-500/50">
                              OWNER
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">
                          {player.isGuest
                            ? "Guest (Will be Saved Global)"
                            : "Global Player"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id)}
                      className="text-gray-500 hover:text-red-400 px-2 font-bold text-sm">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ADD CONTROLS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
              <span>🌍</span> Search Global DB
            </button>

            <div className="flex gap-2">
              <input
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:border-gray-500"
                placeholder="Manual Guest Name..."
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGuestPlayer(e)}
              />
              <button
                onClick={addGuestPlayer}
                disabled={!guestName.trim()}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-lg font-bold disabled:opacity-50">
                +
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="pt-6 border-t border-gray-800 flex gap-4">
          <button
            onClick={handleSaveTeam}
            disabled={!user || isSaving}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-lg disabled:opacity-50 transition-all flex justify-center items-center gap-2">
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
              className="px-4 py-3 bg-red-900/20 text-red-400 hover:bg-red-900/40 font-bold rounded-lg border border-red-900/50 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
