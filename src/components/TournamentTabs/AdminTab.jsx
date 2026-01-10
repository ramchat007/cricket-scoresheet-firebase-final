import React from "react";
import TeamManager from "../TeamManager";
import TournamentAccessManager from "../TournamentAccessManager";
import { useNavigate } from "react-router-dom";

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

  if (!canEdit) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
      
      {/* --- TEAM MANAGEMENT CARD --- */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        
        {/* Background Icon Decoration */}
        <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl group-hover:scale-110 transition-transform select-none pointer-events-none grayscale">
          🛡️
        </div>

        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
            <span className="text-xl">🛡️</span>
            <h3 className="text-slate-100 font-bold text-lg">Team Management</h3>
        </div>

        {tournamentData.isAuction ? (
          <div className="bg-[#0F1115] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4 grayscale opacity-80">🔒</div>
            <h4 className="text-slate-200 font-bold mb-2">Rosters Locked</h4>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              This is an <strong className="text-slate-400">Auction Tournament</strong>. <br/>
              Teams and players are managed through the Auction Console.
            </p>
            <button
              onClick={() => navigate(`/tournaments/${id}/auction`)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl transition-all shadow-lg shadow-purple-900/20 active:scale-[0.98]">
              Go to Auction Console
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full bg-[#0F1115] hover:bg-white/5 text-teal-400 border border-teal-500/20 hover:border-teal-500/40 px-4 py-4 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest shadow-sm">
              <span className="text-lg leading-none">+</span> Import Global Teams
            </button>
            
            {/* Team Manager Component (Already Themed) */}
            <div className="bg-[#0F1115] rounded-xl border border-white/5 p-1">
                <TeamManager tournamentId={id} />
            </div>
          </>
        )}
      </div>

      {/* --- OWNER ACTIONS --- */}
      {isOwner && (
        <div className="space-y-6">
          
          {/* Access Control */}
          <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
             {/* Decor */}
             <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl select-none pointer-events-none grayscale">
                🔑
            </div>
            
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                <span className="text-xl">🔑</span>
                <h3 className="text-slate-100 font-bold text-lg">Access Control</h3>
            </div>
            
            <TournamentAccessManager
              tournament={tournamentData}
              currentUserId={user.uid}
            />
          </div>

          {/* Danger Zone */}
          <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <h4 className="text-red-400 font-black uppercase tracking-widest text-xs mb-2 flex items-center gap-2">
                <span>⚠️</span> Danger Zone
            </h4>
            <p className="text-red-400/60 text-xs mb-6 font-medium">
              This action cannot be undone. All data will be lost.
            </p>
            <button
              onClick={handleDeleteTournament}
              className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/50 px-4 py-4 rounded-xl font-black uppercase tracking-widest text-xs w-full transition-all shadow-lg shadow-red-900/10 active:scale-[0.98]">
              Delete Tournament
            </button>
          </div>
        </div>
      )}
    </div>
  );
}