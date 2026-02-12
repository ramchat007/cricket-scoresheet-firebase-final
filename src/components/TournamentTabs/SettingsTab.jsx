import React, { useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  Scale,
  Gavel,
  AlertTriangle,
  Trash2,
  Save,
  Lock,
  ScrollText,
  Loader2,
} from "lucide-react";

export default function SettingsTab({ tournament, canEdit }) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();
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
      <div
        className={`p-8 text-center italic flex flex-col items-center gap-2 ${theme.sub}`}>
        <Lock size={24} />
        🔒 Only tournament admins can access settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* SECTION 1: RULES CONFIGURATION */}
      <div
        className={`border rounded-2xl p-6 shadow-xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <h3
          className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme.text}`}>
          <ScrollText size={20} className="text-teal-500" /> Tournament Rules
        </h3>

        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
            <label
              className={`block text-xs font-black uppercase tracking-widest mb-3 ${theme.sub}`}>
              Tie Breaker Rule
            </label>
            <div className="grid gap-3">
              {[
                {
                  id: "COMPULSORY_CHASE",
                  label: "Compulsory Chase (Defending Team Wins)",
                  desc: "If scores are tied, the team that batted first wins automatically.",
                  icon: Scale,
                },
                {
                  id: "SHARED_POINTS",
                  label: "Shared Points (Draw)",
                  desc: "Both teams get 1 point each. NRR remains neutral.",
                  icon: ScrollText,
                },
                {
                  id: "SUPER_OVER",
                  label: "Super Over (Manual Winner)",
                  desc: "Match shows as TIE until you manually set a winner in the match editor.",
                  icon: Gavel,
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = tieRule === opt.id;

                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? lightMode
                          ? "bg-teal-50 border-teal-200"
                          : "bg-teal-500/10 border-teal-500/50"
                        : lightMode
                          ? "bg-white border-gray-200 hover:bg-gray-50"
                          : "bg-transparent border-white/5 hover:bg-white/5"
                    }`}>
                    <input
                      type="radio"
                      name="tieRule"
                      value={opt.id}
                      checked={isSelected}
                      onChange={(e) => setTieRule(e.target.value)}
                      className="mt-1 accent-teal-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          size={14}
                          className={
                            isSelected ? "text-teal-500" : "text-slate-400"
                          }
                        />
                        <div
                          className={`text-sm font-bold ${
                            isSelected
                              ? lightMode
                                ? "text-teal-700"
                                : "text-teal-400"
                              : theme.text
                          }`}>
                          {opt.label}
                        </div>
                      </div>
                      <div
                        className={`text-[10px] leading-snug mt-1 ml-6 ${theme.sub}`}>
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20">
            {isSaving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* SECTION 2: DANGER ZONE */}
      <div
        className={`border rounded-2xl p-6 shadow-xl transition-all ${
          lightMode
            ? "bg-red-50 border-red-200"
            : "bg-[#1C2128] border-red-500/20 opacity-90 hover:opacity-100"
        }`}>
        <h3
          className={`text-lg font-bold mb-2 flex items-center gap-2 ${lightMode ? "text-red-700" : "text-red-500"}`}>
          <AlertTriangle size={20} /> Danger Zone
        </h3>
        <p
          className={`text-xs mb-4 ${lightMode ? "text-red-600/70" : "text-slate-500"}`}>
          Actions here cannot be undone. Proceed with caution.
        </p>
        <button
          onClick={handleDeleteTournament}
          className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            lightMode
              ? "bg-white border border-red-200 text-red-600 hover:bg-red-100 shadow-sm"
              : "bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-500/30"
          }`}>
          <Trash2 size={18} /> Delete Tournament
        </button>
      </div>
    </div>
  );
}
