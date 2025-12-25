// src/components/TeamManager.jsx
import React, { useState, useEffect } from "react";
import {
  addTeam,
  updateTeam,
  deleteTeam,
  subscribeAllTeams,
  subscribeTeams,
} from "../utils/firestore.js";
import { useAuth } from "../hooks/useAuth.jsx";

export default function TeamManager({ tournamentId }) {
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [playersText, setPlayersText] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    let unsubscribe = () => {};
    if (tournamentId) {
      unsubscribe = subscribeTeams(tournamentId, setTeams);
    } else {
      unsubscribe = subscribeAllTeams(setTeams);
    }
    return () => unsubscribe && unsubscribe();
  }, [tournamentId]);

  const handleSaveTeam = async () => {
    if (!teamName.trim()) {
      alert("Team name is required.");
      return;
    }

    const players = playersText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const exists = teams.some((t) => t.id === teamName);
      if (exists) {
        await updateTeam(teamName, players);
        alert(`Team "${teamName}" updated successfully.`);
      } else {
        await addTeam(teamName, players);
        alert(`Team "${teamName}" added successfully.`);
      }

      setTeamName("");
      setPlayersText("");
    } catch (err) {
      console.error("Save team error:", err);
      alert("Failed to save team.");
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamName) {
      alert("Select a team to delete.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${teamName}"?`))
      return;
    try {
      await deleteTeam(teamName);
      alert(`Team "${teamName}" deleted.`);
      setTeamName("");
      setPlayersText("");
    } catch (err) {
      console.error("Delete team error:", err);
      alert("Failed to delete team.");
    }
  };

  const handleSelectTeam = (e) => {
    const selected = e.target.value;
    if (!selected) {
      setTeamName("");
      setPlayersText("");
      return;
    }
    const team = teams.find((t) => t.id === selected);
    if (team) {
      setTeamName(team.id);
      setPlayersText((team.players || []).join(", "));
    }
  };

  // --- STYLES ---
  const labelClass =
    "block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2";
  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-600";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-cyan-500">🛡️</span> Team Manager
        </h2>
        <span className="text-sm text-gray-500 font-mono">
          {teams.length} Teams Registered
        </span>
      </div>

      <div className="space-y-5">
        {/* Select Team Dropdown */}
        <div>
          <label className={labelClass}>Select Team to Edit</label>
          <div className="relative">
            <select
              className={`${inputClass} appearance-none cursor-pointer`}
              onChange={handleSelectTeam}
              value={teamName}>
              <option value="" className="text-gray-400">
                -- Create New Team --
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id} className="bg-gray-900">
                  {team.name || team.id}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
              ▼
            </div>
          </div>
        </div>

        {/* Team Name Input */}
        <div>
          <label className={labelClass}>Team Name</label>
          <input
            type="text"
            className={inputClass}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Mumbai Indians"
            disabled={!!teams.find((t) => t.id === teamName)} // Disable editing ID of existing team
          />
          {teams.find((t) => t.id === teamName) && (
            <p className="text-[10px] text-yellow-500 mt-1">
              * To rename a team, delete and recreate it.
            </p>
          )}
        </div>

        {/* Players Input */}
        <div>
          <label className={labelClass}>
            Squad List{" "}
            <span className="text-gray-600 normal-case">(Comma separated)</span>
          </label>
          <textarea
            className={`${inputClass} min-h-[100px]`}
            rows="4"
            value={playersText}
            onChange={(e) => setPlayersText(e.target.value)}
            placeholder="Rohit Sharma, Jasprit Bumrah, Suryakumar Yadav..."
            disabled={!user}
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-800 flex gap-3">
          {user ? (
            <>
              <button
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
                onClick={handleSaveTeam}>
                {teams.some((t) => t.id === teamName)
                  ? "Update Squad"
                  : "Create Team"}
              </button>

              {teamName && teams.some((t) => t.id === teamName) && (
                <button
                  className="px-4 py-3 border border-red-500/30 text-red-400 hover:bg-red-900/20 hover:text-red-300 font-bold rounded-lg transition-colors"
                  onClick={handleDeleteTeam}
                  title="Delete Team">
                  Delete
                </button>
              )}
            </>
          ) : (
            <div className="w-full text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700 text-gray-400 text-sm">
              Please login to manage teams.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
