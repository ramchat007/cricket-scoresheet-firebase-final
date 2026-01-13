import React, { useState } from "react";
import { formatCurrency } from "./helpers";
import PlayerProfileModal from "./PlayerProfileModal";

// --- TEAM STATS MODAL (Kept exactly as is) ---
const TeamStatsModal = ({ team, isOpen, onClose }) => {
  if (!isOpen || !team) return null;

  const roster = team.roster || [];
  const totalPlayers = roster.length;
  const remaining = (team.purse || 0) - (team.spent || 0);

  const roleCounts = roster.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {});

  const roles = ["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"];

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-[#1C2128] border border-white/10 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-[#161920] p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {team.logo ? (
              <img
                src={team.logo}
                className="w-16 h-16 rounded-2xl object-cover bg-black border border-white/10"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl">
                🛡️
              </div>
            )}
            <div>
              <h2 className="text-2xl font-black text-white uppercase italic">
                {team.name}
              </h2>
              <p className="text-xs text-amber-500 font-bold">
                👑 {team.ownerName || "No Owner"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 font-bold transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0F1115] p-5 rounded-3xl border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">
                Total Purse
              </p>
              <p className="text-2xl font-mono font-bold text-white">
                {formatCurrency(team.purse)}
              </p>
            </div>
            <div className="bg-[#0F1115] p-5 rounded-3xl border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">
                Total Spent
              </p>
              <p className="text-2xl font-mono font-bold text-red-400">
                {formatCurrency(team.spent)}
              </p>
            </div>
            <div className="bg-[#0F1115] p-5 rounded-3xl border border-white/5 border-l-4 border-l-green-500">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">
                Remaining
              </p>
              <p className="text-2xl font-mono font-bold text-green-400">
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
              Squad Composition
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {roles.map((role) => (
                <div
                  key={role}
                  className="bg-white/5 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-300 uppercase">
                    {role}
                  </span>
                  <span className="text-xl font-black text-teal-500">
                    {roleCounts[role] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
              Full Roster ({totalPlayers})
            </h3>
            <div className="bg-[#0F1115] rounded-3xl border border-white/5 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Player</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-right">Sold Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {roster.map((p, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <img
                          src={p.photoURL}
                          className="w-8 h-8 rounded-lg object-cover bg-[#161920]"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-white flex items-center gap-2">
                            {p.name}
                            {p.isOwner && (
                              <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase tracking-wide">
                                OWNER
                              </span>
                            )}
                            {p.isIcon && (
                              <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-wide">
                                ICON
                              </span>
                            )}
                            {p.isDirectBuy && (
                              <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-wide">
                                DIRECT
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-bold uppercase">
                        {p.role}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-teal-400">
                        {formatCurrency(p.soldPrice)}
                      </td>
                    </tr>
                  ))}
                  {roster.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="p-8 text-center text-slate-600 italic">
                        No players purchased yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function TeamsTab({ tournamentTeams, isAuctionEnabled }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [viewingTeamStats, setViewingTeamStats] = useState(null);

  if (tournamentTeams.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500 italic text-sm bg-[#161920] border border-dashed border-white/5 rounded-2xl">
        No teams added to this tournament yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {tournamentTeams.map((team) => {
        const remaining = (team.purse || 0) - (team.spent || 0);
        const spentPercentage = Math.min(
          ((team.spent || 0) / (team.purse || 1)) * 100,
          100
        );

        return (
          <div
            key={team.id}
            className="bg-[#1C2128] border border-white/5 rounded-[2rem] overflow-hidden shadow-xl hover:border-teal-500/30 transition-all duration-300 flex flex-col h-full group">
            {/* Header */}
            <div className="p-6 pb-4 flex items-center gap-4">
              <div className="relative">
                {team.logo ? (
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white/5 shadow-2xl bg-black"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl border border-white/10 text-slate-500">
                    🛡️
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-teal-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-lg border border-teal-400/50">
                  {team.roster?.length || 0}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black text-slate-100 leading-none truncate uppercase italic tracking-tighter">
                  {team.name}
                </h3>
                <p className="text-xs font-bold text-amber-500/80 mt-1 truncate">
                  👑 {team.ownerName || "No Owner"}
                </p>
              </div>
            </div>

            {/* Auction Stats */}
            {isAuctionEnabled && (
              <div className="px-6 py-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                  <span className="text-slate-500">Budget Spent</span>
                  <span
                    className={
                      remaining < 0 ? "text-red-400" : "text-teal-400"
                    }>
                    {remaining < 0
                      ? "Over Limit"
                      : `${Math.round(spentPercentage)}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-1000"
                    style={{ width: `${spentPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between mt-3">
                  <div className="text-center px-3 py-1 bg-white/5 rounded-lg border border-white/5 flex-1 mr-2">
                    <p className="text-[8px] text-slate-500 uppercase font-bold">
                      Remaining
                    </p>
                    <p className="text-xs font-mono font-bold text-slate-200">
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                  <div className="text-center px-3 py-1 bg-white/5 rounded-lg border border-white/5 flex-1">
                    <p className="text-[8px] text-slate-500 uppercase font-bold">
                      Total Purse
                    </p>
                    <p className="text-xs font-mono font-bold text-slate-400">
                      {formatCurrency(team.purse)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Squad Avatar Preview */}
            <div className="p-6 flex-1">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Active Roster
                </h4>
                <span className="text-[10px] font-black text-slate-600 bg-white/5 px-2 py-1 rounded">
                  Top 6
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {team.roster?.slice(0, 6).map((player, i) => (
                  <div
                    key={player.id || i}
                    className="group/avatar relative cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setSelectedPlayer(player)}>
                    <img
                      src={
                        player.photoURL ||
                        `https://ui-avatars.com/api/?name=${player.name}&background=random`
                      }
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 grayscale group-hover/avatar:grayscale-0 transition-all"
                      title={player.name}
                    />
                    <div className="absolute -top-1.5 -right-1.5 flex gap-0.5">
                      {player.isIcon && (
                        <div
                          className="bg-amber-500 text-black text-[7px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-black border border-black shadow-sm"
                          title="Icon Player">
                          ★
                        </div>
                      )}
                      {player.isDirectBuy && (
                        <div
                          className="bg-purple-500 text-white text-[7px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-black border border-black shadow-sm"
                          title="Direct Buy">
                          ⚡
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {team.roster?.length > 6 && (
                  <div
                    onClick={() => setViewingTeamStats(team)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 cursor-pointer hover:bg-white/10 transition-colors">
                    +{team.roster.length - 6}
                  </div>
                )}
                {(!team.roster || team.roster.length === 0) && (
                  <p className="text-[10px] text-slate-600 italic">
                    No players auctioned yet...
                  </p>
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 bg-[#161920] mt-auto flex justify-center border-t border-white/5">
              <button
                onClick={() => setViewingTeamStats(team)}
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2">
                View Full Analysis <span className="text-teal-500">→</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* MODALS */}
      <PlayerProfileModal
        player={selectedPlayer}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
      <TeamStatsModal
        team={viewingTeamStats}
        isOpen={!!viewingTeamStats}
        onClose={() => setViewingTeamStats(null)}
      />
    </div>
  );
}
