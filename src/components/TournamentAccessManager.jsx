import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useTheme } from "../context/ThemeContext"; // 🟢 Added ThemeContext
import {
  findUserByEmail,
  addScorerToTournament,
  addViewerToTournament,
  removeScorerFromTournament,
  removeViewerFromTournament,
} from "../utils/firestore";

export default function TournamentAccessManager({
  tournamentId,
  tournamentData,
}) {
  const { theme } = useTheme(); // 🟢 Initialized Theme

  const [data, setData] = useState(tournamentData || null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("scorer");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // 1. Sync Data
  useEffect(() => {
    if (tournamentData) {
      setData(tournamentData);
      return;
    }
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
      <div
        className={`p-6 rounded-2xl flex flex-col items-center justify-center animate-pulse border transition-colors ${theme.card}`}>
        <span
          className={`text-xs font-bold uppercase tracking-widest ${theme.sub}`}>
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
      const targetUid = await findUserByEmail(email);

      if (!targetUid) {
        setMsg("❌ User email not found in system.");
        setLoading(false);
        return;
      }

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

  // 🟢 Helper for dynamic message styling based on theme
  const getMessageStyle = () => {
    if (msg.includes("❌"))
      return lightMode
        ? "bg-red-50 text-red-600 border-red-200"
        : "bg-red-900/20 text-red-400 border-red-500/30";
    if (msg.includes("⚠️"))
      return lightMode
        ? "bg-amber-50 text-amber-600 border-amber-200"
        : "bg-amber-900/20 text-amber-400 border-amber-500/30";
    return lightMode
      ? "bg-teal-50 text-teal-600 border-teal-200"
      : "bg-teal-900/20 text-teal-400 border-teal-500/30";
  };

  return (
    <div
      className={`rounded-2xl p-6 shadow-xl relative overflow-hidden border transition-colors ${theme.card}`}>
      {/* Header */}
      <div
        className={`flex justify-between items-center mb-6 border-b pb-4 ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <h3
          className={`text-lg font-bold flex items-center gap-2 ${theme.text}`}>
          <span className="text-cyan-500">🔑</span> Access Control
        </h3>
        <span
          className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${lightMode ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-[#0F1115] text-slate-500 border-white/5"}`}>
          Owner Only
        </span>
      </div>

      {/* Add User Form */}
      <form
        onSubmit={handleAddUser}
        className={`flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-xl border transition-colors ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter user email..."
          className={`flex-1 rounded-xl px-4 py-3 outline-none text-sm font-bold transition-all border ${lightMode ? "bg-white text-gray-900 border-gray-200 focus:border-teal-500 placeholder:text-gray-400" : "bg-[#161920] text-slate-200 border-white/10 focus:border-teal-500/50 placeholder:text-slate-600"}`}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={`rounded-xl px-4 py-3 cursor-pointer outline-none text-sm font-bold border transition-colors ${lightMode ? "bg-white text-gray-900 border-gray-200 focus:border-teal-500" : "bg-[#161920] text-slate-200 border-white/10 focus:border-teal-500/50"}`}>
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
          className={`text-xs font-bold p-3 rounded-lg border mb-6 flex items-center gap-2 transition-colors ${getMessageStyle()}`}>
          {msg}
        </div>
      )}

      {/* User Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SCORERS */}
        <div
          className={`p-4 rounded-xl border transition-colors ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
          <h4
            className={`text-[10px] font-black uppercase tracking-widest mb-3 border-b pb-2 flex justify-between ${theme.sub} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <span>Scorers (Edit Access)</span>
            <span
              className={`px-1.5 rounded ${lightMode ? "bg-gray-200 text-gray-700" : "bg-white/10 text-white"}`}>
              {scorersList.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {scorersList.map((uid) => (
              <div
                key={uid}
                className={`flex justify-between items-center p-2.5 rounded-lg border transition-colors group ${lightMode ? "bg-white border-gray-200 hover:border-teal-300 shadow-sm" : "bg-[#161920] border-white/5 hover:border-white/10"}`}>
                <span
                  className={`font-mono text-xs ${lightMode ? "text-gray-600" : "text-slate-300"}`}>
                  {uid === ownerId ? (
                    <span className="text-teal-500">👑 Owner</span>
                  ) : (
                    uid.slice(0, 18) + "..."
                  )}
                </span>
                {uid !== ownerId && (
                  <button
                    onClick={() => handleRemove(uid, "scorer")}
                    className={`text-[10px] uppercase font-black px-2 py-1 rounded transition-all opacity-0 group-hover:opacity-100 ${lightMode ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20"}`}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            {scorersList.length === 0 && (
              <span
                className={`text-xs italic block text-center py-2 ${lightMode ? "text-gray-400" : "text-slate-600"}`}>
                No scorers added
              </span>
            )}
          </div>
        </div>

        {/* VIEWERS */}
        <div
          className={`p-4 rounded-xl border transition-colors ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
          <h4
            className={`text-[10px] font-black uppercase tracking-widest mb-3 border-b pb-2 flex justify-between ${theme.sub} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <span>Viewers (Read Only)</span>
            <span
              className={`px-1.5 rounded ${lightMode ? "bg-gray-200 text-gray-700" : "bg-white/10 text-white"}`}>
              {viewersList.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {viewersList.map((uid) => (
              <div
                key={uid}
                className={`flex justify-between items-center p-2.5 rounded-lg border transition-colors group ${lightMode ? "bg-white border-gray-200 hover:border-teal-300 shadow-sm" : "bg-[#161920] border-white/5 hover:border-white/10"}`}>
                <span
                  className={`font-mono text-xs ${lightMode ? "text-gray-600" : "text-slate-300"}`}>
                  {uid.slice(0, 18) + "..."}
                </span>
                <button
                  onClick={() => handleRemove(uid, "viewer")}
                  className={`text-[10px] uppercase font-black px-2 py-1 rounded transition-all opacity-0 group-hover:opacity-100 ${lightMode ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20"}`}>
                  Remove
                </button>
              </div>
            ))}
            {viewersList.length === 0 && (
              <span
                className={`text-xs italic block text-center py-2 ${lightMode ? "text-gray-400" : "text-slate-600"}`}>
                No viewers added
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
