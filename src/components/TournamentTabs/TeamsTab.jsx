import React from "react";
import { formatCurrency } from "./helpers"; // Adjust path if needed

export default function TeamsTab({ tournamentTeams, isAuctionEnabled }) {
  return tournamentTeams.length === 0 ? (
    <div className="text-center py-16 text-slate-500 italic text-sm bg-[#161920] border border-dashed border-white/5 rounded-2xl">
      No teams added to this tournament yet.
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {tournamentTeams.map((team) => (
        <div
          key={team.id}
          className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-white/10 group">
          
          {/* Header */}
          <div className="bg-[#0F1115] p-5 border-b border-white/5">
            <div className="flex items-center gap-4 mb-4">
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-14 h-14 rounded-xl object-cover border border-white/10 shadow-lg bg-black"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl shadow-inner text-slate-400 border border-white/5">
                  🛡️
                </div>
              )}
              <div>
                <h3 className="text-lg font-black text-slate-100 leading-tight group-hover:text-teal-400 transition-colors">
                  {team.name}
                </h3>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  {team.players?.length || 0} Players
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-500/10 to-transparent border-l-2 border-amber-500 pl-3 py-1.5 rounded-r-lg">
              <div className="text-[9px] uppercase font-black text-amber-600 tracking-widest mb-0.5">
                Team Owner
              </div>
              <div className="text-amber-400 font-bold text-sm flex items-center gap-1.5">
                <span>👑</span> {team.ownerName || "No Owner Assigned"}
              </div>
            </div>
          </div>

          {isAuctionEnabled && (
            <div className="bg-[#161920] px-5 py-3 flex justify-between items-center text-xs border-b border-white/5">
              <div className="text-slate-500 font-medium">
                Purse:{" "}
                <span className="text-slate-200 font-mono font-bold ml-1">
                  {formatCurrency(team.purse)}
                </span>
              </div>
              <div className="text-slate-500 font-medium">
                Spent:{" "}
                <span className="text-red-400 font-mono font-bold ml-1">
                  {formatCurrency(team.spent)}
                </span>
              </div>
            </div>
          )}

          {/* Squad List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-[#161920]/50">
            {team.roster?.length > 0 ? (
              <div className="divide-y divide-white/5">
                {team.roster.map((player, idx) => (
                  <div
                    key={player.id || idx}
                    className="px-5 py-3 flex justify-between items-center hover:bg-[#0F1115] transition-colors group/player">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-600 font-mono text-[10px] w-4 text-center font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-slate-300 group-hover/player:text-white transition-colors flex items-center gap-2">
                          {player.name}
                          {player.isOwner && (
                            <span className="text-[8px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-black uppercase tracking-widest">
                              OWNER
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">
                          {player.role || "Player"}
                        </div>
                      </div>
                    </div>
                    {player.soldPrice > 0 && (
                      <div className="text-xs font-mono font-bold text-teal-500 bg-teal-900/10 px-2 py-1 rounded">
                        {formatCurrency(player.soldPrice)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-600 text-xs italic bg-[#161920]">
                No players in squad yet.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}