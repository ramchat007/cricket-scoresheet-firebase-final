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
  id, // tournamentId
}) {
  const navigate = useNavigate();

  // ✅ HELPER: Merge Batting & Bowling history for MVP View
  const getUnifiedHistory = (history = []) => {
    const matches = {};

    history.forEach((h) => {
      if (!matches[h.matchId]) {
        matches[h.matchId] = {
          matchId: h.matchId,
          date: h.date,
          opponent: h.opponent,
          runs: 0,
          wickets: 0,
          points: 0,
          fours: 0,
          sixes: 0,
          isBat: false,
          isBowl: false,
        };
      }

      const m = matches[h.matchId];

      if (h.type === "bat") {
        m.isBat = true;
        m.runs += parseInt(h.runs || 0);
        // Track boundaries in history for the new tab
        // Note: You need to ensure your 'h' object from TournamentTabs actually includes fours/sixes per match
        // If not, this is a placeholder for visual consistency
        m.points += parseInt(h.runs || 0);
      }

      if (h.type === "bowl") {
        m.isBowl = true;
        m.wickets += parseInt(h.wickets || 0);
        m.points += parseInt(h.wickets || 0) * 20;
      }
    });

    return Object.values(matches).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* --- CAPS SECTION --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Orange Cap */}
        {orangeCap && (
          <div className="bg-gradient-to-br from-orange-900/30 to-[#161920] border border-orange-500/20 p-5 rounded-2xl flex items-center gap-5 relative overflow-hidden shadow-xl shadow-orange-900/10 group">
            <div className="bg-orange-500/10 p-3 rounded-full text-3xl border border-orange-500/20 group-hover:scale-110 transition-transform">
              🏏
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">
                Orange Cap
              </div>
              <div className="text-2xl font-black text-slate-100 leading-none">
                {orangeCap.name}
              </div>
              <div className="text-sm text-slate-400 mt-1 font-mono">
                {orangeCap.runs} Runs
              </div>
            </div>
          </div>
        )}

        {/* Purple Cap */}
        {purpleCap && (
          <div className="bg-gradient-to-br from-purple-900/30 to-[#161920] border border-purple-500/20 p-5 rounded-2xl flex items-center gap-5 relative overflow-hidden shadow-xl shadow-purple-900/10 group">
            <div className="bg-purple-500/10 p-3 rounded-full text-3xl border border-purple-500/20 group-hover:scale-110 transition-transform">
              🥎
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">
                Purple Cap
              </div>
              <div className="text-2xl font-black text-slate-100 leading-none">
                {purpleCap.name}
              </div>
              <div className="text-sm text-slate-400 mt-1 font-mono">
                {purpleCap.wickets} Wickets
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="bg-[#1C2128] border border-white/5 p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Tab Switcher */}
          <div className="flex bg-[#0F1115] p-1 rounded-xl w-full md:w-auto border border-white/5 overflow-x-auto no-scrollbar">
            {[
              { id: "bat", label: "🏏 Batting" },
              { id: "bowl", label: "🥎 Bowling" },
              { id: "mvp", label: "👑 MVP" },
              { id: "boundaries", label: "💥 Boundaries" }, // ✅ NEW TAB
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatsTab(tab.id);
                  // Auto-switch sort based on tab
                  if (tab.id === "bat") setSortStyle("most_runs");
                  else if (tab.id === "bowl") setSortStyle("most_wickets");
                  else if (tab.id === "mvp") setSortStyle("mvp");
                  else if (tab.id === "boundaries") setSortStyle("most_sixes"); // Default sort for boundaries
                }}
                className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  statsTab === tab.id
                    ? "bg-slate-700 text-slate-100 shadow-md"
                    : "text-slate-500 hover:text-slate-300"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none group">
              <select
                className="w-full appearance-none bg-[#0F1115] border border-white/10 text-slate-300 text-xs font-bold rounded-xl px-4 py-3 outline-none focus:border-teal-500/50 cursor-pointer hover:border-white/20 transition-all"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="all">All Teams</option>
                {distinctTeams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500 group-hover:text-slate-300">
                ▼
              </div>
            </div>

            <div className="relative flex-1 md:flex-none group">
              <select
                className="w-full appearance-none bg-[#0F1115] border border-white/10 text-slate-300 text-xs font-bold rounded-xl px-4 py-3 outline-none focus:border-teal-500/50 cursor-pointer hover:border-white/20 transition-all"
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
                {/* ✅ Sort Options for Boundaries Tab */}
                {statsTab === "boundaries" && (
                  <>
                    <option value="most_sixes">Most Sixes</option>
                    <option value="most_fours">Most Fours</option>
                  </>
                )}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500 group-hover:text-slate-300">
                ▼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- PLAYER LIST --- */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        {/* ✅ CUSTOM FILTER LOGIC FOR BOUNDARIES TAB */}
        {filteredStats
          .sort((a, b) => {
            // Apply sorting specifically for the new tab if active
            if (statsTab === "boundaries") {
              if (sortStyle === "most_sixes")
                return b.sixes - a.sixes || b.fours - a.fours;
              if (sortStyle === "most_fours")
                return b.fours - a.fours || b.sixes - a.sixes;
              // Default: Total Boundaries
              return b.fours + b.sixes - (a.fours + a.sixes);
            }
            return 0; // Use default sort from parent for other tabs
          })
          .map((p, index) => (
            <div
              key={index}
              className="border-b border-white/5 last:border-0 group">
              <div
                className={`p-5 flex items-center justify-between cursor-pointer transition-colors ${
                  expandedPlayer === p.name
                    ? "bg-[#0F1115]"
                    : "hover:bg-white/5"
                }`}
                onClick={() =>
                  setExpandedPlayer(expandedPlayer === p.name ? null : p.name)
                }>
                <div className="flex items-center gap-5">
                  <span className="text-slate-600 font-mono text-sm w-4 text-center font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-bold text-slate-100 text-base leading-tight group-hover:text-teal-400 transition-colors">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider mt-0.5">
                      {p.team}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {statsTab === "bat" && (
                    <div>
                      <div className="font-black text-slate-200 text-lg">
                        {p.runs}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                        Runs
                      </div>
                    </div>
                  )}
                  {statsTab === "bowl" && (
                    <div>
                      <div className="font-black text-slate-200 text-lg">
                        {p.wickets}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                        Wickets
                      </div>
                    </div>
                  )}
                  {statsTab === "mvp" && (
                    <div className="flex flex-col items-end">
                      <div className="font-black text-yellow-500 text-lg">
                        {p.mvp}
                      </div>
                      <div className="flex gap-2 text-[10px] text-slate-500 font-medium">
                        {p.runs > 0 && <span>🏏{p.runs}</span>}
                        {p.wickets > 0 && <span>🥎{p.wickets}</span>}
                      </div>
                    </div>
                  )}
                  {/* ✅ NEW: Boundaries Tab View */}
                  {statsTab === "boundaries" && (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <span className="font-black text-orange-500 text-lg block leading-none">
                            {p.sixes}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase">
                            6s
                          </span>
                        </div>
                        <div className="w-[1px] h-6 bg-white/10"></div>
                        <div className="text-center">
                          <span className="font-black text-yellow-400 text-lg block leading-none">
                            {p.fours}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase">
                            4s
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {expandedPlayer === p.name && (
                <div className="bg-[#0F1115] p-5 border-t border-white/5 animate-in slide-in-from-top-1">
                  <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-white/5">
                    {/* Reuse stats grid but highlight boundaries if in boundaries tab */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <StatBox label="Runs" value={p.runs} />
                      <StatBox label="SR" value={p.batSR} />
                      <StatBox
                        label="4s"
                        value={p.fours}
                        color="text-yellow-400"
                      />
                      <StatBox
                        label="6s"
                        value={p.sixes}
                        color="text-orange-500"
                      />
                    </div>
                  </div>

                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 pl-1">
                    Match History
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(statsTab === "mvp" || statsTab === "boundaries"
                      ? getUnifiedHistory(p.history)
                      : p.history.filter((h) => h.type === statsTab)
                    ).map((log, lIdx) => (
                      <div
                        key={lIdx}
                        onClick={() =>
                          navigate(
                            `/tournaments/${id}/scorecard/${log.matchId}`,
                          )
                        }
                        className="bg-[#161920] hover:bg-[#1C2128] border border-white/5 p-3 rounded-lg cursor-pointer transition-all flex justify-between items-center group/card shadow-sm">
                        <div>
                          <div className="text-xs font-bold text-slate-300 group-hover/card:text-teal-400 transition-colors">
                            vs {log.opponent || "Opponent"}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            {log.date
                              ? new Date(log.date).toLocaleDateString()
                              : "-"}
                          </div>
                        </div>

                        <div className="text-right text-xs font-mono font-medium text-slate-400">
                          {statsTab === "bat" && (
                            <span
                              className={
                                log.runs >= 30
                                  ? "text-yellow-400 font-bold"
                                  : ""
                              }>
                              {log.runs} runs
                            </span>
                          )}
                          {statsTab === "bowl" && (
                            <span
                              className={
                                log.wickets >= 2
                                  ? "text-green-400 font-bold"
                                  : ""
                              }>
                              {log.wickets} wkts
                            </span>
                          )}
                          {(statsTab === "mvp" ||
                            statsTab === "boundaries") && (
                            <div className="flex flex-col items-end">
                              {statsTab === "mvp" ? (
                                <span className="text-yellow-500 font-bold">
                                  {log.points} pts
                                </span>
                              ) : (
                                // For boundaries tab, show runs (closest approximation if 4s/6s not in history)
                                <span className="text-slate-300 font-bold">
                                  {log.runs} runs
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {p.history.length === 0 && (
                      <div className="text-slate-500 text-xs italic">
                        No matches played.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

const StatBox = ({ label, value, color = "text-slate-200" }) => (
  <div className="bg-[#161920] p-2 rounded-lg border border-white/5">
    <div className="text-[9px] text-slate-500 uppercase font-black">
      {label}
    </div>
    <div className={`font-bold ${color}`}>{value}</div>
  </div>
);
