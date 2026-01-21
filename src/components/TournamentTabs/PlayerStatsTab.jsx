import React, { useMemo } from "react";
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

  // --- 1. CONFIGURATION: Columns for each Tab ---
  const tableColumns = useMemo(() => {
    switch (statsTab) {
      case "bat":
        return [
          { key: "rank", label: "#", align: "center", width: "w-8" },
          { key: "player", label: "Player", align: "left", width: "w-48" },
          { key: "matches", label: "Mat", align: "center", width: "w-12" },
          { key: "innings", label: "Inn", align: "center", width: "w-12" },
          {
            key: "runs",
            label: "Runs",
            align: "center",
            width: "w-16",
            highlight: true,
          },
          { key: "hs", label: "HS", align: "center", width: "w-16" },
          { key: "avg", label: "Avg", align: "center", width: "w-16" },
          { key: "sr", label: "SR", align: "center", width: "w-16" },
          { key: "fours", label: "4s", align: "center", width: "w-12" },
          { key: "sixes", label: "6s", align: "center", width: "w-12" },
        ];
      case "bowl":
        return [
          { key: "rank", label: "#", align: "center", width: "w-8" },
          { key: "player", label: "Player", align: "left", width: "w-48" },
          { key: "matches", label: "Mat", align: "center", width: "w-12" },
          { key: "innings", label: "Inn", align: "center", width: "w-12" },
          {
            key: "wickets",
            label: "Wkts",
            align: "center",
            width: "w-16",
            highlight: true,
          },
          { key: "eco", label: "Eco", align: "center", width: "w-16" },
          { key: "b_avg", label: "Avg", align: "center", width: "w-16" },
          { key: "best", label: "BBI", align: "center", width: "w-20" },
          { key: "b_sr", label: "SR", align: "center", width: "w-16" },
        ];
      case "mvp":
        return [
          { key: "rank", label: "#", align: "center", width: "w-8" },
          { key: "player", label: "Player", align: "left", width: "w-48" },
          { key: "matches", label: "Mat", align: "center", width: "w-12" },
          { key: "runs", label: "Runs", align: "center", width: "w-16" },
          { key: "wickets", label: "Wkts", align: "center", width: "w-16" },
          {
            key: "points",
            label: "Pts",
            align: "center",
            width: "w-20",
            highlight: true,
          },
        ];
      case "boundaries":
        return [
          { key: "rank", label: "#", align: "center", width: "w-8" },
          { key: "player", label: "Player", align: "left", width: "w-48" },
          {
            key: "fours",
            label: "4s",
            align: "center",
            width: "w-16",
            color: "text-yellow-400",
          },
          {
            key: "sixes",
            label: "6s",
            align: "center",
            width: "w-16",
            color: "text-orange-500",
          },
          {
            key: "boundaryRuns",
            label: "B.Runs",
            align: "center",
            width: "w-20",
            highlight: true,
          },
        ];
      default:
        return [];
    }
  }, [statsTab]);

  // --- 2. HELPER: Calculate Stats dynamically if missing ---
  const processRowData = (p, index) => {
    // Basic Calculations from History if stats are incomplete
    const history = p.history || [];
    const matches = new Set(history.map((h) => h.matchId)).size;

    // Batting specific
    const batInnings = history.filter((h) => h.type === "bat").length;
    const notOuts = p.notOuts || 0; // Ensure you have this or default to 0
    const avg = (p.runs / (batInnings - notOuts || 1)).toFixed(1);

    // Bowling specific
    const bowlInnings = history.filter((h) => h.type === "bowl").length;
    const ballsBowled = p.ballsBowled || 0;
    const runsConceded = p.runsConceded || 0;
    const economy =
      ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(1) : "-";
    const bowlAvg = p.wickets > 0 ? (runsConceded / p.wickets).toFixed(1) : "-";
    const bowlSR = p.wickets > 0 ? (ballsBowled / p.wickets).toFixed(1) : "-";

    return {
      rank: index + 1,
      id: p.id || p.name,
      name: p.name,
      team: p.team,
      matches: matches || p.matches || 0,
      innings: statsTab === "bat" ? batInnings : bowlInnings,
      runs: p.runs || 0,
      hs: p.highestScore || 0,
      avg: avg > 999 ? "∞" : avg,
      sr: p.batSR || 0, // Using batSR from your logic
      fours: p.fours || 0,
      sixes: p.sixes || 0,
      wickets: p.wickets || 0,
      eco: economy,
      b_avg: bowlAvg,
      b_sr: bowlSR,
      best: p.bestBowling || "-",
      points: p.mvp || 0,
      boundaryRuns: (p.fours || 0) * 4 + (p.sixes || 0) * 6,
      history: p.history,
    };
  };

  // --- 3. SORTING LOGIC ---
  const sortedData = useMemo(() => {
    let data = [...filteredStats];

    if (statsTab === "boundaries") {
      data.sort((a, b) => {
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
        if (sortStyle === "most_fours") return b.fours - a.fours;
        return b.fours * 4 + b.sixes * 6 - (a.fours * 4 + a.sixes * 6);
      });
    }
    // Other sorts are handled by parent `filteredStats`, or you can add specific sorts here
    return data.map(processRowData);
  }, [filteredStats, statsTab, sortStyle]);

  // --- 4. RENDER CELL ---
  const renderCell = (row, col) => {
    switch (col.key) {
      case "rank":
        return (
          <span className="text-slate-500 font-mono text-xs">{row.rank}</span>
        );
      case "player":
        return (
          <div className="flex flex-col justify-center">
            <span className="font-bold text-slate-200 text-sm truncate">
              {row.name}
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider truncate">
              {row.team}
            </span>
          </div>
        );
      case "runs":
      case "wickets":
      case "points":
      case "boundaryRuns":
        return (
          <span
            className={`font-black text-base ${col.highlight ? "text-teal-400" : "text-slate-300"}`}>
            {row[col.key]}
          </span>
        );
      case "fours":
      case "sixes":
        return (
          <span
            className={`font-bold text-sm ${col.color || "text-slate-300"}`}>
            {row[col.key]}
          </span>
        );
      default:
        return (
          <span className="text-slate-400 text-sm font-medium">
            {row[col.key] || "-"}
          </span>
        );
    }
  };

  const getUnifiedHistory = (history = [], filterTab = "mvp") => {
    // 1. Safety check: Ensure history is an array
    if (!Array.isArray(history)) return [];

    const matches = {};

    history.forEach((h) => {
      // Create unique key per match
      const key = h.matchId || `temp-${h.date || "no-date"}`;

      if (!matches[key]) {
        matches[key] = {
          matchId: h.matchId,
          // ✅ DATE FIX: Ensure we handle string, timestamp, or missing dates
          date: h.date || new Date(0).toISOString(),
          opponent: h.opponent || "Opponent",
          runs: 0,
          wickets: 0,
          fours: 0,
          sixes: 0,
          isBat: false,
          isBowl: false,
        };
      }

      const m = matches[key];
      if (h.type === "bat") {
        m.isBat = true;
        m.runs += parseInt(h.runs || 0);
        m.fours += parseInt(h.fours || 0);
        m.sixes += parseInt(h.sixes || 0);
      }
      if (h.type === "bowl") {
        m.isBowl = true;
        m.wickets += parseInt(h.wickets || 0);
      }
    });

    // Convert object to Array
    const combinedArray = Object.values(matches);

    // 2. ✅ FIXED FILTER LOGIC: Strict check to avoid "undefined is not a function"
    let filteredResult = combinedArray;

    if (filterTab === "bat") {
      filteredResult = combinedArray.filter((m) => m.isBat === true);
    } else if (filterTab === "bowl") {
      filteredResult = combinedArray.filter((m) => m.isBowl === true);
    } else if (filterTab === "boundaries") {
      filteredResult = combinedArray.filter(
        (m) => Number(m.fours) > 0 || Number(m.sixes) > 0,
      );
    }
    // "mvp" tab returns the full combined performance array

    // 3. ✅ SAFE SORT: Compare numeric timestamps
    return filteredResult.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA; // Newest matches first
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      {/* --- CAPS SECTION (Keeping the Cards for Visual Appeal) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {orangeCap && (
          <div className="bg-gradient-to-r from-[#1C2128] to-orange-950/20 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between shadow-lg group">
            <div className="flex items-center gap-4">
              <div className="bg-orange-500/10 p-3 rounded-lg text-2xl border border-orange-500/20 group-hover:scale-110 transition-transform">
                🏏
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-0.5">
                  Orange Cap
                </div>
                <div className="text-lg font-black text-slate-100">
                  {orangeCap.name}
                </div>
              </div>
            </div>
            <div className="text-2xl font-black text-orange-400">
              {orangeCap.runs}{" "}
              <span className="text-xs text-orange-500/60 font-medium">
                Runs
              </span>
            </div>
          </div>
        )}
        {purpleCap && (
          <div className="bg-gradient-to-r from-[#1C2128] to-purple-950/20 border border-purple-500/20 p-4 rounded-xl flex items-center justify-between shadow-lg group">
            <div className="flex items-center gap-4">
              <div className="bg-purple-500/10 p-3 rounded-lg text-2xl border border-purple-500/20 group-hover:scale-110 transition-transform">
                🥎
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-0.5">
                  Purple Cap
                </div>
                <div className="text-lg font-black text-slate-100">
                  {purpleCap.name}
                </div>
              </div>
            </div>
            <div className="text-2xl font-black text-purple-400">
              {purpleCap.wickets}{" "}
              <span className="text-xs text-purple-500/60 font-medium">
                Wkts
              </span>
            </div>
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="bg-[#1C2128] border border-white/5 p-2 rounded-xl flex flex-col md:flex-row gap-2 shadow-md">
        {/* Tabs */}
        <div className="flex bg-[#0F1115] p-1 rounded-lg flex-1 overflow-x-auto no-scrollbar">
          {[
            { id: "bat", label: "Batting" },
            { id: "bowl", label: "Bowling" },
            { id: "mvp", label: "MVP" },
            { id: "boundaries", label: "Boundaries" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatsTab(tab.id);
                // Smart Default Sorting
                if (tab.id === "bat") setSortStyle("most_runs");
                else if (tab.id === "bowl") setSortStyle("most_wickets");
                else if (tab.id === "mvp") setSortStyle("mvp");
                else if (tab.id === "boundaries") setSortStyle("most_sixes");
              }}
              className={`flex-1 px-4 py-2 rounded-md text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                statsTab === tab.id
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            className="bg-[#0F1115] border border-white/10 text-slate-300 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-teal-500/50"
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
            className="bg-[#0F1115] border border-white/10 text-slate-300 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-teal-500/50"
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
            {statsTab === "boundaries" && (
              <>
                <option value="most_sixes">Most Sixes</option>
                <option value="most_fours">Most Fours</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* --- STANDARD STATS TABLE (With Sticky First Column) --- */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#13161c] text-slate-500 text-[10px] uppercase font-black tracking-wider border-b border-white/5">
              <tr>
                {tableColumns.map((col, idx) => {
                  // Logic to stick the first two columns (Rank & Player)
                  const isSticky = idx < 2;
                  const stickyClass = isSticky
                    ? "sticky z-20 bg-[#13161c]"
                    : "";
                  const leftPos =
                    idx === 0 ? "left-0" : idx === 1 ? "left-8" : ""; // Approx width for rank

                  return (
                    <th
                      key={col.key}
                      className={`p-4 whitespace-nowrap ${col.align === "center" ? "text-center" : "text-left"} ${stickyClass} ${leftPos}`}
                      style={isSticky ? { minWidth: col.width } : {}}>
                      {col.label}
                      {/* Add a border to the right of the sticky column for separation */}
                      {idx === 1 && (
                        <div className="absolute top-0 right-0 h-full w-px bg-white/10 shadow-xl"></div>
                      )}
                    </th>
                  );
                })}
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + 1}
                    className="p-8 text-center text-slate-600 text-sm italic">
                    No stats available.
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() =>
                        setExpandedPlayer(
                          expandedPlayer === row.name ? null : row.name,
                        )
                      }
                      className={`transition-colors cursor-pointer group ${expandedPlayer === row.name ? "bg-white/5" : "hover:bg-white/5"}`}>
                      {tableColumns.map((col, idx) => {
                        const isSticky = idx < 2;
                        // Important: Sticky cells need a solid background color to cover scrolling content
                        const bgClass =
                          expandedPlayer === row.name
                            ? "bg-[#252932]"
                            : "bg-[#1C2128]";
                        const stickyClass = isSticky
                          ? `sticky z-10 ${bgClass}`
                          : "";
                        const leftPos =
                          idx === 0 ? "left-0" : idx === 1 ? "left-8" : "";

                        return (
                          <td
                            key={col.key}
                            className={`p-3 whitespace-nowrap ${col.align === "center" ? "text-center" : "text-left"} ${stickyClass} ${leftPos}`}>
                            {renderCell(row, col)}
                            {/* Visual separator for the sticky column */}
                            {idx === 1 && (
                              <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-white/5 to-transparent"></div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center text-slate-600 text-[10px]">
                        {expandedPlayer === row.name ? "▲" : "▼"}
                      </td>
                    </tr>

                    {/* EXPANDED HISTORY (Accordion) - Stays same, spans full width */}
                    {expandedPlayer === row.name && (
                      <tr className="bg-[#0F1115] animate-in slide-in-from-top-2 duration-300">
                        <td colSpan={12} className="p-0">
                          <div className="p-4 sticky left-0 w-full">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                              {statsTab === "mvp"
                                ? "Match Performance"
                                : `Recent ${statsTab} form`}
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {getUnifiedHistory(row.history, statsTab).length >
                              0 ? (
                                getUnifiedHistory(row.history, statsTab).map(
                                  (log, idx) => (
                                    <div
                                      key={idx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(
                                          `/tournaments/${id}/scorecard/${log.matchId}`,
                                        );
                                      }}
                                      className="bg-[#1C2128] border border-white/5 p-3 rounded-lg flex justify-between items-center hover:border-teal-500/30 transition-all cursor-pointer shadow-sm group/card">
                                      <div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">
                                          {(() => {
                                            const d = new Date(log.date);
                                            return isNaN(d.getTime())
                                              ? "No Date"
                                              : d.toLocaleDateString("en-GB", {
                                                  day: "2-digit",
                                                  month: "short",
                                                });
                                          })()}
                                        </div>
                                        <div className="text-xs font-bold text-slate-300 group-hover/card:text-teal-400">
                                          vs {log.opponent}
                                        </div>
                                      </div>

                                      {/* ✅ COMBINED DISPLAY LOGIC */}
                                      <div className="flex gap-3 items-center">
                                        {(statsTab === "bat" ||
                                          statsTab === "mvp" ||
                                          statsTab === "boundaries") &&
                                          log.isBat && (
                                            <div className="text-right">
                                              <div className="text-sm font-black text-yellow-400 leading-none">
                                                {log.runs}
                                              </div>
                                              <div className="text-[8px] text-slate-500 font-bold uppercase">
                                                Runs
                                              </div>
                                            </div>
                                          )}

                                        {(statsTab === "bowl" ||
                                          statsTab === "mvp") &&
                                          log.isBowl && (
                                            <div className="text-right border-l border-white/10 pl-3">
                                              <div className="text-sm font-black text-green-400 leading-none">
                                                {log.wickets}w
                                              </div>
                                              <div className="text-[8px] text-slate-500 font-bold uppercase">
                                                Wkts
                                              </div>
                                            </div>
                                          )}

                                        {statsTab === "boundaries" && (
                                          <div className="flex gap-2 border-l border-white/10 pl-3">
                                            <span className="text-[10px] font-bold text-orange-500">
                                              {log.sixes}x6s
                                            </span>
                                            <span className="text-[10px] font-bold text-yellow-500">
                                              {log.fours}x4s
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ),
                                )
                              ) : (
                                <div className="text-xs text-slate-600 italic p-2">
                                  No relevant stats recorded for this category.
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
