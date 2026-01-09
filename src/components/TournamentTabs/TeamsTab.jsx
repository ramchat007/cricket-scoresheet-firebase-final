import React from "react";
import { formatCurrency } from "./helpers";

export default function TeamsTab({ tournamentTeams, isAuctionEnabled }) {
  return tournamentTeams.length === 0 ? (
    <div className="text-center py-12 text-gray-500 italic">
      No teams added to this tournament yet.
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tournamentTeams.map((team) => (
        <div
          key={team.id}
          className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-gray-700">
          {/* Header */}
          <div className="bg-gray-950 p-5 border-b border-gray-800">
            <div className="flex items-center gap-4 mb-3">
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-12 h-12 rounded-full object-cover border border-gray-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-xl shadow-inner">
                  🛡️
                </div>
              )}
              <div>
                <h3 className="text-xl font-black text-white leading-tight">
                  {team.name}
                </h3>
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  {team.players?.length || 0} Players
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-900/20 to-transparent border-l-2 border-yellow-500 pl-3 py-1">
              <div className="text-[10px] uppercase font-bold text-yellow-600 tracking-wider">
                Team Owner
              </div>
              <div className="text-yellow-400 font-bold text-sm flex items-center gap-1.5">
                <span>👑</span> {team.ownerName || "No Owner Assigned"}
              </div>
            </div>
          </div>

          {isAuctionEnabled && (
            <div className="bg-gray-900 px-5 py-3 flex justify-between items-center text-xs border-b border-gray-800">
              <div className="text-gray-400">
                Purse:{" "}
                <span className="text-white font-mono">
                  {formatCurrency(team.purse)}
                </span>
              </div>
              <div className="text-gray-400">
                Spent:{" "}
                <span className="text-red-400 font-mono">
                  {formatCurrency(team.spent)}
                </span>
              </div>
            </div>
          )}

          {/* Squad List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-gray-900/50">
            {team.roster?.length > 0 ? (
              <div className="divide-y divide-gray-800/50">
                {team.roster.map((player, idx) => (
                  <div
                    key={player.id || idx}
                    className="px-5 py-3 flex justify-between items-center hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 font-mono text-xs w-4">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-gray-200">
                          {player.name}
                          {player.isOwner && (
                            <span className="ml-2 text-[9px] bg-purple-900 text-purple-300 px-1 rounded border border-purple-500/30">
                              OWNER
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">
                          {player.role || "Player"}
                        </div>
                      </div>
                    </div>
                    {player.soldPrice > 0 && (
                      <div className="text-xs font-mono text-green-400">
                        {formatCurrency(player.soldPrice)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-600 text-xs italic">
                No players in squad yet.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
