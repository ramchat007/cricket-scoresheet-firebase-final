import React from "react";
import TeamManager from "../TeamManager";
import TournamentAccessManager from "../TournamentAccessManager";
import { useNavigate } from "react-router-dom";
// 🟢 1. Import useTheme
import { useTheme } from "../../context/ThemeContext";
import {
  Shield,
  Lock,
  Plus,
  Key,
  AlertTriangle,
  Trash2,
  Settings,
  Gavel,
} from "lucide-react";

export default function AdminTab({
  canEdit,
  isOwner,
  tournamentData,
  setShowImportModal,
  handleDeleteTournament,
  id,
  user,
}) {
  const navigate = useNavigate();

  // 🟢 2. Extract theme natively (removed lightMode)
  const { theme } = useTheme();

  // Safely fallback to default classes
  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";

  if (!canEdit) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
      {/* --- TEAM MANAGEMENT CARD --- */}
      <div
        // 🟢 Replaced hardcoded bg with dynamic theme card
        className={`rounded-3xl p-6 relative overflow-hidden group ${cardBg}`}>
        {/* Background Icon Decoration */}
        <div
          className={`absolute top-0 right-0 p-6 text-6xl group-hover:scale-110 transition-transform select-none pointer-events-none text-current opacity-5`}>
          <Shield />
        </div>

        <div
          className={`flex items-center gap-3 mb-6 border-b pb-4 border-current/10`}>
          <div className={`p-2 rounded-xl bg-teal-500/10 text-teal-500`}>
            <Shield size={24} />
          </div>
          <h3 className={`font-bold text-lg ${textMain}`}>Team Management</h3>
        </div>

        {tournamentData?.isAuction ? (
          <div
            // 🟢 Uses bg-current/5 to adapt to light/dark automatically
            className={`rounded-2xl p-8 text-center bg-current/5 border border-current/10`}>
            <div className="flex justify-center mb-4 opacity-50">
              <Lock size={40} className="text-current" />
            </div>
            <h4 className={`font-bold mb-2 ${textMain}`}>Rosters Locked</h4>
            <p className={`text-xs mb-6 leading-relaxed ${textSub}`}>
              This is an{" "}
              <strong className={textMain}>Auction Tournament</strong>
              . <br />
              Teams and players are managed through the Auction Console.
            </p>
            <button
              onClick={() => navigate(`/tournaments/${id}/auction`)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl transition-all shadow-lg shadow-purple-900/20 active:scale-[0.98] flex items-center justify-center gap-2">
              <Gavel size={16} /> Go to Auction Console
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowImportModal(true)}
              // 🟢 Uses semi-transparent teal for cross-theme compatibility
              className={`w-full px-4 py-4 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest shadow-sm border bg-teal-500/10 text-teal-500 border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/40`}>
              <Plus size={16} /> Import Global Teams
            </button>

            {/* Team Manager Component Container */}
            <div
              className={`rounded-2xl border p-1 bg-current/5 border-current/10`}>
              <TeamManager tournamentId={id} />
            </div>
          </>
        )}
      </div>

      {/* --- OWNER ACTIONS --- */}
      {isOwner && (
        <div className="space-y-6">
          {/* Access Control */}
          <div className={`rounded-3xl p-6 relative overflow-hidden ${cardBg}`}>
            {/* Decor */}
            <div
              className={`absolute top-0 right-0 p-6 text-6xl select-none pointer-events-none text-current opacity-5`}>
              <Key />
            </div>

            <div
              className={`flex items-center gap-3 mb-6 border-b pb-4 border-current/10`}>
              <div
                className={`p-2 rounded-xl bg-indigo-500/10 text-indigo-500`}>
                <Key size={24} />
              </div>
              <h3 className={`font-bold text-lg ${textMain}`}>
                Access Control
              </h3>
            </div>

            <TournamentAccessManager
              tournament={tournamentData}
              currentUserId={user?.uid}
            />
          </div>

          {/* Danger Zone */}
          <div
            // 🟢 Uses universal transparent red so it works on light and dark
            className={`border rounded-3xl p-6 relative overflow-hidden bg-red-500/5 border-red-500/20 backdrop-blur-md`}>
            <div
              className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl pointer-events-none bg-red-500/10`}></div>

            <h4
              className={`font-black uppercase tracking-widest text-xs mb-2 flex items-center gap-2 text-red-500`}>
              <AlertTriangle size={16} /> Danger Zone
            </h4>
            <p className={`text-xs mb-6 font-medium text-red-500/70`}>
              This action cannot be undone. All data will be lost.
            </p>
            <button
              onClick={handleDeleteTournament}
              className={`w-full px-4 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-[0.98] border flex items-center justify-center gap-2 bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white shadow-red-500/10`}>
              <Trash2 size={16} /> Delete Tournament
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
