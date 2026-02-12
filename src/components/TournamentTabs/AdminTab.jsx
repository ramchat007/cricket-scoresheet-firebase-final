import React from "react";
import TeamManager from "../TeamManager";
import TournamentAccessManager from "../TournamentAccessManager";
import { useNavigate } from "react-router-dom";
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
  const { theme, lightMode } = useTheme();

  if (!canEdit) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
      {/* --- TEAM MANAGEMENT CARD --- */}
      <div
        className={`border rounded-2xl p-6 shadow-xl relative overflow-hidden group ${
          lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/5"
        }`}>
        {/* Background Icon Decoration */}
        <div
          className={`absolute top-0 right-0 p-6 text-6xl group-hover:scale-110 transition-transform select-none pointer-events-none ${
            lightMode ? "text-gray-100 opacity-20" : "opacity-5 grayscale"
          }`}>
          <Shield />
        </div>

        <div
          className={`flex items-center gap-3 mb-6 border-b pb-4 ${
            lightMode ? "border-gray-100" : "border-white/5"
          }`}>
          <div
            className={`p-2 rounded-lg ${lightMode ? "bg-teal-50 text-teal-600" : "bg-white/5 text-slate-200"}`}>
            <Shield size={24} />
          </div>
          <h3 className={`font-bold text-lg ${theme.text}`}>Team Management</h3>
        </div>

        {tournamentData?.isAuction ? (
          <div
            className={`border rounded-xl p-8 text-center ${
              lightMode
                ? "bg-gray-50 border-gray-200"
                : "bg-[#0F1115] border-white/5"
            }`}>
            <div className="flex justify-center mb-4 opacity-80">
              <Lock
                size={40}
                className={lightMode ? "text-gray-400" : "text-slate-600"}
              />
            </div>
            <h4 className={`font-bold mb-2 ${theme.text}`}>Rosters Locked</h4>
            <p className={`text-xs mb-6 leading-relaxed ${theme.sub}`}>
              This is an{" "}
              <strong
                className={lightMode ? "text-gray-700" : "text-slate-400"}>
                Auction Tournament
              </strong>
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
              className={`w-full px-4 py-4 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest shadow-sm border ${
                lightMode
                  ? "bg-white hover:bg-gray-50 text-teal-600 border-teal-200 hover:border-teal-300"
                  : "bg-[#0F1115] hover:bg-white/5 text-teal-400 border-teal-500/20 hover:border-teal-500/40"
              }`}>
              <Plus size={16} /> Import Global Teams
            </button>

            {/* Team Manager Component Container */}
            <div
              className={`rounded-xl border p-1 ${
                lightMode
                  ? "bg-gray-50 border-gray-200"
                  : "bg-[#0F1115] border-white/5"
              }`}>
              <TeamManager tournamentId={id} />
            </div>
          </>
        )}
      </div>

      {/* --- OWNER ACTIONS --- */}
      {isOwner && (
        <div className="space-y-6">
          {/* Access Control */}
          <div
            className={`border rounded-2xl p-6 shadow-xl relative overflow-hidden ${
              lightMode
                ? "bg-white border-gray-200"
                : "bg-[#1C2128] border-white/5"
            }`}>
            {/* Decor */}
            <div
              className={`absolute top-0 right-0 p-6 text-6xl select-none pointer-events-none ${
                lightMode ? "text-gray-100 opacity-20" : "opacity-5 grayscale"
              }`}>
              <Key />
            </div>

            <div
              className={`flex items-center gap-3 mb-6 border-b pb-4 ${
                lightMode ? "border-gray-100" : "border-white/5"
              }`}>
              <div
                className={`p-2 rounded-lg ${lightMode ? "bg-indigo-50 text-indigo-600" : "bg-white/5 text-slate-200"}`}>
                <Key size={24} />
              </div>
              <h3 className={`font-bold text-lg ${theme.text}`}>
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
            className={`border rounded-2xl p-6 relative overflow-hidden ${
              lightMode
                ? "bg-red-50 border-red-200"
                : "bg-red-900/10 border-red-500/20"
            }`}>
            <div
              className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl pointer-events-none ${
                lightMode ? "bg-red-200" : "bg-red-500/10"
              }`}></div>

            <h4
              className={`font-black uppercase tracking-widest text-xs mb-2 flex items-center gap-2 ${
                lightMode ? "text-red-700" : "text-red-400"
              }`}>
              <AlertTriangle size={16} /> Danger Zone
            </h4>
            <p
              className={`text-xs mb-6 font-medium ${
                lightMode ? "text-red-600/80" : "text-red-400/60"
              }`}>
              This action cannot be undone. All data will be lost.
            </p>
            <button
              onClick={handleDeleteTournament}
              className={`w-full px-4 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-[0.98] border flex items-center justify-center gap-2 ${
                lightMode
                  ? "bg-white hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300 shadow-red-100"
                  : "bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border-red-500/50 shadow-red-900/10"
              }`}>
              <Trash2 size={16} /> Delete Tournament
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
