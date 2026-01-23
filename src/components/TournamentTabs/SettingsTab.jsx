import React, { useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useNavigate } from "react-router-dom";

export default function SettingsTab({ tournament, canEdit }) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // 1. Initialize State from Tournament Data
  const [tieRule, setTieRule] = useState(
    tournament?.rules?.tieRule || "COMPULSORY_CHASE",
  );

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const ref = doc(db, "tournaments", tournament.id);
      await updateDoc(ref, {
        "rules.tieRule": tieRule,
        updatedAt: new Date().toISOString(),
      });
      alert(
        "✅ Settings Updated! Please 'Sync Stats' in Points Table to apply changes.",
      );
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTournament = async () => {
    const confirmMsg = `⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to delete "${tournament.name}"?\nThis action cannot be undone and will delete all matches and teams.`;
    if (!window.confirm(confirmMsg)) return;

    // Double confirmation
    const input = window.prompt(`Type "DELETE" to confirm.`);
    if (input !== "DELETE") return;

    try {
      await deleteDoc(doc(db, "tournaments", tournament.id));
      navigate("/tournaments"); // Redirect to home
    } catch (e) {
      alert("Error deleting: " + e.message);
    }
  };

  if (!canEdit) {
    return (
      <div className="p-8 text-center text-slate-500 italic">
        🔒 Only tournament admins can access settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* SECTION 1: RULES CONFIGURATION */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
          📜 Tournament Rules
        </h3>

        <div className="space-y-4">
          <div className="bg-black/20 p-4 rounded-xl border border-white/5">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
              Tie Breaker Rule
            </label>
            <div className="grid gap-3">
              {[
                {
                  id: "COMPULSORY_CHASE",
                  label: "Compulsory Chase (Defending Team Wins)",
                  desc: "If scores are tied, the team that batted first wins automatically.",
                },
                {
                  id: "SHARED_POINTS",
                  label: "Shared Points (Draw)",
                  desc: "Both teams get 1 point each. NRR remains neutral.",
                },
                {
                  id: "SUPER_OVER",
                  label: "Super Over (Manual Winner)",
                  desc: "Match shows as TIE until you manually set a winner in the match editor.",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    tieRule === opt.id
                      ? "bg-teal-500/10 border-teal-500/50"
                      : "bg-transparent border-white/5 hover:bg-white/5"
                  }`}>
                  <input
                    type="radio"
                    name="tieRule"
                    value={opt.id}
                    checked={tieRule === opt.id}
                    onChange={(e) => setTieRule(e.target.value)}
                    className="mt-1 accent-teal-500"
                  />
                  <div>
                    <div
                      className={`text-sm font-bold ${
                        tieRule === opt.id ? "text-teal-400" : "text-slate-300"
                      }`}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-snug mt-1">
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50">
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* SECTION 2: DANGER ZONE */}
      <div className="bg-[#1C2128] border border-red-500/20 rounded-2xl p-6 shadow-xl opacity-90 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
          ☠️ Danger Zone
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Actions here cannot be undone. Proceed with caution.
        </p>
        <button
          onClick={handleDeleteTournament}
          className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-500/30 font-bold rounded-xl transition-all">
          Delete Tournament
        </button>
      </div>
    </div>
  );
}
