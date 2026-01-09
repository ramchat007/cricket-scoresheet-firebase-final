import React from "react";
import { useNavigate } from "react-router-dom";

export default function PlayerStatsTab({
  statsTab,
  setStatsTab,
  sortStyle,
  setSortStyle,
  teamFilter,
  setTeamFilter,
  filteredStats,
  expandedPlayer,
  setExpandedPlayer,
  orangeCap,
  purpleCap,
  distinctTeams,
  id,
}) {
  const navigate = useNavigate();
  const getUnifiedHistory = (history) => {
    // Example helper for MVP tab
    return history;
  };

  return (
    <div>
      {/* Caps Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {orangeCap && (
          <div className="bg-gradient-to-br from-orange-900/20 to-gray-900 border border-orange-500/20 p-5 rounded-2xl flex items-center gap-5 relative overflow-hidden shadow-lg shadow-orange-500/5">
            <div className="bg-orange-500/10 p-3 rounded-full text-3xl">🏏</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">
                Orange Cap
              </div>
              <div className="text-2xl font-bold text-white leading-none">
                {orangeCap.name}
              </div>
              <div className="text-sm text-gray-400 mt-1 font-mono">
                {orangeCap.runs} Runs
              </div>
            </div>
          </div>
        )}
        {purpleCap && (
          <div className="bg-gradient-to-br from-purple-900/20 to-gray-900 border border-purple-500/20 p-5 rounded-2xl flex items-center gap-5 relative overflow-hidden shadow-lg shadow-purple-500/5">
            <div className="bg-purple-500/10 p-3 rounded-full text-3xl">🥎</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1">
                Purple Cap
              </div>
              <div className="text-2xl font-bold text-white leading-none">
                {purpleCap.name}
              </div>
              <div className="text-sm text-gray-400 mt-1 font-mono">
                {purpleCap.wickets} Wickets
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex bg-gray-800 p-1 rounded-lg">
            {["bat", "bowl", "mvp"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setStatsTab(type);
                  setSortStyle(
                    type === "bat"
                      ? "most_runs"
                      : type === "bowl"
                      ? "most_wickets"
                      : "mvp"
                  );
                }}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  statsTab === type
                    ? "bg-cyan-600 text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                }`}>
                {type === "bat"
                  ? "🏏 Batting"
                  : type === "bowl"
                  ? "🥎 Bowling"
                  : "👑 MVP"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select
              className="bg-black border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {distinctTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="bg-black border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
              value={sortStyle}
              onChange={(e) => setSortStyle(e.target.value)}>
              {statsTab === "bat" && (
                <>
                  <option value="most_runs">Most Runs</option>
                  <option value="high_score">Highest Score</option>
                  <option value="strike_rate">Strike Rate</option>
                  <option value="most_sixes">Most 6s</option>
                </>
              )}
              {statsTab === "bowl" && (
                <>
                  <option value="most_wickets">Most Wickets</option>
                  <option value="best_economy">Best Economy</option>
                </>
              )}
              {statsTab === "mvp" && <option value="mvp">MVP Points</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Detailed List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        {filteredStats.map((p, index) => (
          <div key={index} className="border-b border-gray-800 last:border-0">
            <div
              className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                expandedPlayer === p.name
                  ? "bg-gray-800"
                  : "hover:bg-gray-800/30"
              }`}
              onClick={() =>
                setExpandedPlayer(expandedPlayer === p.name ? null : p.name)
              }>
              <div className="flex items-center gap-4">
                <span className="text-gray-600 font-mono text-sm w-4">
                  {index + 1}
                </span>
                <div>
                  <div className="font-bold text-white text-base leading-tight">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold">
                    {p.team}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {/* Dynamic Stat Display based on Tab */}
                {statsTab === "bat" && (
                  <div>
                    <div className="font-bold text-cyan-400 text-lg">
                      {p.runs}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase">
                      Runs
                    </div>
                  </div>
                )}
                {statsTab === "bowl" && (
                  <div>
                    <div className="font-bold text-green-400 text-lg">
                      {p.wickets}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase">
                      Wickets
                    </div>
                  </div>
                )}
                {statsTab === "mvp" && (
                  <div className="flex flex-col items-end">
                    <div className="font-black text-yellow-500 text-lg">
                      {p.mvp}
                    </div>
                    <div className="flex gap-2 text-[10px] text-gray-500">
                      {p.runs > 0 && <span>🏏{p.runs}</span>}
                      {p.wickets > 0 && <span>🥎{p.wickets}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded View */}
            {expandedPlayer === p.name && (
              <div className="bg-black/30 p-5 border-t border-gray-800 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-gray-800/50">
                  {/* Batting Row */}
                  {(statsTab === "bat" ||
                    (statsTab === "mvp" && p.runs > 0)) && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Runs
                        </div>
                        <div className="font-bold text-white">{p.runs}</div>
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Avg
                        </div>
                        <div className="font-bold text-white">{p.batAvg}</div>
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          SR
                        </div>
                        <div className="font-bold text-white">{p.batSR}</div>
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          HS
                        </div>
                        <div className="font-bold text-white">{p.hs}</div>
                      </div>
                    </div>
                  )}
                  {/* Bowling Row */}
                  {(statsTab === "bowl" ||
                    (statsTab === "mvp" && p.ballsBowled > 0)) && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Wkts
                        </div>
                        <div className="font-bold text-green-400">
                          {p.wickets}
                        </div>
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Eco
                        </div>
                        <div className="font-bold text-white">{p.bowlEco}</div>
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Avg
                        </div>
                        <div className="font-bold text-white">{p.bowlAvg}</div>
                      </div>
                      <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Overs
                        </div>
                        <div className="font-bold text-white">
                          {(p.ballsBowled / 6).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
                  Match History
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(statsTab === "mvp"
                    ? getUnifiedHistory(p.history)
                    : p.history.filter((h) => h.type === statsTab)
                  ).map((log, lIdx) => (
                    <div
                      key={lIdx}
                      onClick={() =>
                        navigate(`/tournaments/${id}/scorecard/${log.matchId}`)
                      }
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-2.5 rounded-lg cursor-pointer transition-all flex justify-between items-center group">
                      <div>
                        <div className="text-xs font-bold text-gray-300 group-hover:text-cyan-400 transition-colors">
                          vs {log.opponent}
                        </div>
                        <div className="text-[9px] text-gray-500">
                          {log.date}
                        </div>
                      </div>
                      <div className="text-right text-xs font-mono">
                        {statsTab === "bat" && (
                          <span
                            className={
                              log.runs >= 30
                                ? "text-yellow-400 font-bold"
                                : "text-white"
                            }>
                            {log.runs} runs
                          </span>
                        )}
                        {statsTab === "bowl" && (
                          <span
                            className={
                              log.wickets >= 2
                                ? "text-green-400 font-bold"
                                : "text-white"
                            }>
                            {log.wickets} wkts
                          </span>
                        )}
                        {statsTab === "mvp" && (
                          <span className="text-yellow-500 font-bold">
                            {log.totalPoints} pts
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
