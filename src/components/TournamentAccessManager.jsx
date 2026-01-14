import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase"; // Ensure db is imported
import {
  findUserByEmail,
  addScorerToTournament,
  addViewerToTournament,
  removeScorerFromTournament,
  removeViewerFromTournament,
} from "../utils/firestore";

// Updated to accept tournamentId OR tournament object
export default function TournamentAccessManager({ tournamentId, tournament: initialData }) {
  const [data, setData] = useState(initialData || null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("scorer");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ REAL-TIME LISTENER
  // This ensures that if the parent passes null, we fetch the data ourselves
  useEffect(() => {
    // If we already have data via props, use it
    if (initialData) {
      setData(initialData);
      return;
    }

    // Otherwise, fetch it using the ID
    if (tournamentId) {
      const unsub = onSnapshot(doc(db, "tournaments", tournamentId), (docSnap) => {
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() });
        }
      });
      return () => unsub();
    }
  }, [tournamentId, initialData]);

  // If we still have no data after trying to fetch
  if (!data) {
    return (
      <div className="p-6 bg-[#1C2128] border border-white/5 rounded-2xl flex flex-col items-center justify-center animate-pulse">
        <div className="text-slate-500 italic text-xs mb-2">
            Loading access controls...
        </div>
        <div className="text-[10px] text-slate-600">
            (Waiting for Tournament ID: {tournamentId || "None provided"})
        </div>
      </div>
    );
  }

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

      // ✅ SAFE CHECK: Use (array || []) to prevent crashing
      const currentScorers = data.scorers || [];
      const currentViewers = data.viewers || [];

      if (
        currentScorers.includes(targetUid) ||
        currentViewers.includes(targetUid)
      ) {
        setMsg("⚠️ User already has access.");
        setLoading(false);
        return;
      }

      // Use data.id (from local state)
      if (role === "scorer") {
        await addScorerToTournament(data.id, targetUid);
        setMsg("✅ Scorer added!");
      } else {
        await addViewerToTournament(data.id, targetUid);
        setMsg("✅ Viewer added!");
      }
      setEmail("");
    } catch (err) {
      console.error(err);
      setMsg("❌ Error adding user.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (uid, currentRole) => {
    if (!window.confirm("Remove user?")) return;
    try {
      if (currentRole === "scorer")
        await removeScorerFromTournament(data.id, uid);
      else await removeViewerFromTournament(data.id, uid);
    } catch (err) {
      console.error(err);
      alert("Error removing user");
    }
  };

  // ✅ Prepare lists safely from local state
  const scorersList = data.scorers || [];
  const viewersList = data.viewers || [];
  const ownerId = data.ownerId; // Get owner ID from data

  return (
    <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="text-xl">🔑</span> Access Control
        </h3>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-[#0F1115] px-2 py-1 rounded border border-white/5">
          Owner Only
        </span>
      </div>

      <form
        onSubmit={handleAddUser}
        className="flex flex-col sm:flex-row gap-3 mb-6 bg-[#0F1115] p-4 rounded-xl border border-white/5">
        <input
          type="email"
          className="flex-1 bg-[#161920] text-slate-200 border border-white/10 rounded-xl px-4 py-3 focus:border-teal-500/50 focus:outline-none transition-all placeholder:text-slate-600 text-sm font-bold"
          placeholder="Enter user email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-[#161920] text-slate-200 border border-white/10 rounded-xl px-4 py-3 cursor-pointer outline-none focus:border-teal-500/50 text-sm font-bold">
          <option value="scorer">Scorer (Can Edit)</option>
          <option value="viewer">Viewer (Read Only)</option>
        </select>
        <button
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-wider text-xs px-6 py-3 rounded-xl shadow-lg disabled:opacity-50 transition-all">
          {loading ? "Adding..." : "Add"}
        </button>
      </form>

      {msg && (
        <div
          className={`text-sm mb-4 font-bold p-3 rounded-lg border ${
            msg.includes("❌")
              ? "bg-red-900/20 text-red-400 border-red-500/30"
              : msg.includes("⚠️")
              ? "bg-amber-900/20 text-amber-400 border-amber-500/30"
              : "bg-teal-900/20 text-teal-400 border-teal-500/30"
          }`}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SCORERS LIST */}
        <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
            Scorers (Edit Access)
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {scorersList.length === 0 && (
              <span className="text-xs text-slate-600 italic p-2 block text-center">
                No scorers added
              </span>
            )}
            {scorersList.map((uid) => (
              <div
                key={uid}
                className="flex justify-between items-center bg-[#161920] p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                <span className="font-mono text-xs text-slate-300">
                  {uid === ownerId
                    ? "Owner (Creator)"
                    : uid.slice(0, 12) + "..."}
                </span>
                {uid !== ownerId && (
                  <button
                    onClick={() => handleRemove(uid, "scorer")}
                    className="text-slate-600 hover:text-red-400 text-[10px] uppercase font-black px-2 py-1 rounded hover:bg-red-900/20 transition-all">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* VIEWERS LIST */}
        <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
            Viewers (Read Only)
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {viewersList.length === 0 && (
              <span className="text-xs text-slate-600 italic p-2 block text-center">
                No viewers added
              </span>
            )}
            {viewersList.map((uid) => (
              <div
                key={uid}
                className="flex justify-between items-center bg-[#161920] p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                <span className="font-mono text-xs text-slate-300">
                  {uid.slice(0, 12) + "..."}
                </span>
                <button
                  onClick={() => handleRemove(uid, "viewer")}
                  className="text-slate-600 hover:text-red-400 text-[10px] uppercase font-black px-2 py-1 rounded hover:bg-red-900/20 transition-all">
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