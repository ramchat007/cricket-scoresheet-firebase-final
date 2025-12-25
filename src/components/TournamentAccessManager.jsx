import React, { useState } from "react";
import {
  findUserByEmail,
  addScorerToTournament,
  addViewerToTournament,
  removeScorerFromTournament,
  removeViewerFromTournament,
} from "../utils/firestore";

export default function TournamentAccessManager({ tournament, currentUserId }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("scorer");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const isOwner = tournament.ownerId === currentUserId;
  if (!isOwner) return null;

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setMsg("");
    try {
      const targetUid = await findUserByEmail(email);
      if (!targetUid) {
        setMsg("❌ User not found.");
        setLoading(false);
        return;
      }
      if (
        tournament.scorers?.includes(targetUid) ||
        tournament.viewers?.includes(targetUid)
      ) {
        setMsg("⚠️ User already has access.");
        setLoading(false);
        return;
      }
      if (role === "scorer") {
        await addScorerToTournament(tournament.id, targetUid);
        setMsg("✅ Scorer added!");
      } else {
        await addViewerToTournament(tournament.id, targetUid);
        setMsg("✅ Viewer added!");
      }
      setEmail("");
    } catch (err) {
      setMsg("❌ Error adding user.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (uid, currentRole) => {
    if (!window.confirm("Remove user?")) return;
    try {
      if (currentRole === "scorer")
        await removeScorerFromTournament(tournament.id, uid);
      else await removeViewerFromTournament(tournament.id, uid);
    } catch (err) {
      alert("Error");
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 border-l-4 border-l-cyan-500 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">🔑</span> Access Control
        </h3>
        <span className="text-sm font-mono text-gray-500 uppercase tracking-widest">
          Owner Only
        </span>
      </div>
      <form
        onSubmit={handleAddUser}
        className="flex flex-col sm:flex-row gap-3 mb-6 bg-gray-950 p-4 rounded-lg border border-gray-800">
        <input
          type="email"
          className="flex-1 bg-gray-800 text-white border border-gray-700 rounded px-4 py-2 focus:border-cyan-500 focus:outline-none"
          placeholder="Enter user email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-gray-800 text-white border border-gray-700 rounded px-4 py-2 cursor-pointer">
          <option value="scorer">Scorer (Can Edit)</option>
          <option value="viewer">Viewer (Read Only)</option>
        </select>
        <button
          disabled={loading}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2 rounded shadow-lg disabled:opacity-50">
          {loading ? "Adding..." : "Add"}
        </button>
      </form>
      {msg && (
        <div
          className={`text-sm mb-4 font-bold ${
            msg.includes("❌") ? "text-red-400" : "text-green-400"
          }`}>
          {msg}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">
            Scorers
          </h4>
          <div className="space-y-2">
            {tournament.scorers?.map((uid) => (
              <div
                key={uid}
                className="flex justify-between items-center bg-gray-800/30 p-2 rounded text-sm text-gray-300">
                <span className="font-mono text-sm">
                  {uid === tournament.ownerId ? "Me (Owner)" : uid}
                </span>
                {uid !== tournament.ownerId && (
                  <button
                    onClick={() => handleRemove(uid, "scorer")}
                    className="text-red-500 hover:text-red-400 text-sm uppercase font-bold">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">
            Viewers
          </h4>
          <div className="space-y-2">
            {tournament.viewers?.map((uid) => (
              <div
                key={uid}
                className="flex justify-between items-center bg-gray-800/30 p-2 rounded text-sm text-gray-300">
                <span className="font-mono text-sm">{uid}</span>
                <button
                  onClick={() => handleRemove(uid, "viewer")}
                  className="text-red-500 hover:text-red-400 text-sm uppercase font-bold">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
