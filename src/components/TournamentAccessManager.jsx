import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  findUserByEmail,
  addScorerToTournament,
  addViewerToTournament,
  removeScorerFromTournament,
  removeViewerFromTournament,
} from "../utils/firestore";

// ✅ Updated props to match TournamentTabs (tournamentData)
export default function TournamentAccessManager({
  tournamentId,
  tournamentData,
}) {
  const [data, setData] = useState(tournamentData || null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("scorer");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // 1. Sync Data (Props or Listener)
  useEffect(() => {
    // If parent passes data, keep it in sync
    if (tournamentData) {
      setData(tournamentData);
      return;
    }

    // Fallback: If no data passed, fetch it ourselves
    if (tournamentId) {
      const unsub = onSnapshot(
        doc(db, "tournaments", tournamentId),
        (docSnap) => {
          if (docSnap.exists()) {
            setData({ id: docSnap.id, ...docSnap.data() });
          }
        },
      );
      return () => unsub();
    }
  }, [tournamentId, tournamentData]);

  if (!data) {
    return (
      <div className="p-6 bg-[#1C2128] border border-white/5 rounded-2xl flex flex-col items-center justify-center animate-pulse">
        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
          Loading Access Control...
        </span>
      </div>
    );
  }

  // 2. Add User Logic
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setMsg("");

    try {
      // Step A: Find the user's UID by their email
      const targetUid = await findUserByEmail(email);

      if (!targetUid) {
        setMsg("❌ User email not found in system.");
        setLoading(false);
        return;
      }

      // Step B: Check for duplicates
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

      // Step C: Update Firestore
      if (role === "scorer") {
        await addScorerToTournament(tournamentId, targetUid);
        setMsg("✅ Scorer added successfully!");
      } else {
        await addViewerToTournament(tournamentId, targetUid);
        setMsg("✅ Viewer added successfully!");
      }
      setEmail("");
    } catch (err) {
      console.error(err);
      setMsg("❌ Error processing request.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Remove User Logic
  const handleRemove = async (uid, currentRole) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      if (currentRole === "scorer") {
        await removeScorerFromTournament(tournamentId, uid);
      } else {
        await removeViewerFromTournament(tournamentId, uid);
      }
    } catch (err) {
      console.error(err);
      alert("Error removing user");
    }
  };

  const scorersList = data.scorers || [];
  const viewersList = data.viewers || [];
  const ownerId = data.ownerId;

  return (
    <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="text-cyan-500">🔑</span> Access Control
        </h3>
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-[#0F1115] px-2 py-1 rounded border border-white/5">
          Owner Only
        </span>
      </div>

      {/* Add User Form */}
      <form
        onSubmit={handleAddUser}
        className="flex flex-col sm:flex-row gap-3 mb-6 bg-[#0F1115] p-4 rounded-xl border border-white/5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter user email..."
          className="flex-1 bg-[#161920] text-slate-200 border border-white/10 rounded-xl px-4 py-3 focus:border-teal-500/50 outline-none text-sm font-bold placeholder:text-slate-600 transition-all"
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-[#161920] text-slate-200 border border-white/10 rounded-xl px-4 py-3 cursor-pointer outline-none focus:border-teal-500/50 text-sm font-bold">
          <option value="scorer">Scorer (Edit)</option>
          <option value="viewer">Viewer (Read)</option>
        </select>
        <button
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-wider text-xs px-6 py-3 rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center min-w-[100px]">
          {loading ? <span className="animate-spin">↻</span> : "Add User"}
        </button>
      </form>

      {/* Status Message */}
      {msg && (
        <div
          className={`text-xs font-bold p-3 rounded-lg border mb-6 flex items-center gap-2 ${
            msg.includes("❌")
              ? "bg-red-900/20 text-red-400 border-red-500/30"
              : msg.includes("⚠️")
                ? "bg-amber-900/20 text-amber-400 border-amber-500/30"
                : "bg-teal-900/20 text-teal-400 border-teal-500/30"
          }`}>
          {msg}
        </div>
      )}

      {/* User Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SCORERS */}
        <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex justify-between">
            <span>Scorers (Edit Access)</span>
            <span className="bg-white/10 text-white px-1.5 rounded">
              {scorersList.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {scorersList.map((uid) => (
              <div
                key={uid}
                className="flex justify-between items-center bg-[#161920] p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                <span className="font-mono text-xs text-slate-300">
                  {uid === ownerId ? (
                    <span className="text-teal-400">👑 Owner</span>
                  ) : (
                    uid.slice(0, 18) + "..."
                  )}
                </span>
                {uid !== ownerId && (
                  <button
                    onClick={() => handleRemove(uid, "scorer")}
                    className="text-slate-600 hover:text-red-400 text-[10px] uppercase font-black px-2 py-1 rounded hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100">
                    Remove
                  </button>
                )}
              </div>
            ))}
            {scorersList.length === 0 && (
              <span className="text-xs text-slate-600 italic block text-center py-2">
                No scorers added
              </span>
            )}
          </div>
        </div>

        {/* VIEWERS */}
        <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex justify-between">
            <span>Viewers (Read Only)</span>
            <span className="bg-white/10 text-white px-1.5 rounded">
              {viewersList.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {viewersList.map((uid) => (
              <div
                key={uid}
                className="flex justify-between items-center bg-[#161920] p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                <span className="font-mono text-xs text-slate-300">
                  {uid.slice(0, 18) + "..."}
                </span>
                <button
                  onClick={() => handleRemove(uid, "viewer")}
                  className="text-slate-600 hover:text-red-400 text-[10px] uppercase font-black px-2 py-1 rounded hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100">
                  Remove
                </button>
              </div>
            ))}
            {viewersList.length === 0 && (
              <span className="text-xs text-slate-600 italic block text-center py-2">
                No viewers added
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
