import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { Trophy, Crown } from "lucide-react";

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
  const { theme, lightMode } = useTheme();

  // --- 1. CONFIGURATION: Columns for each Tab (Tiny UI Widths added) ---
  const tableColumns = useMemo(() => {
    // We strictly define the rank width so the sticky Player column knows exactly where to sit.
    const rankWidth =
      "w-8 md:w-10 min-w-[32px] md:min-w-[40px] max-w-[32px] md:max-w-[40px]";
    const playerWidth = "min-w-[100px] md:min-w-[180px]";

    switch (statsTab) {
      case "bat":
        return [
          { key: "rank", label: "#", align: "center", widthClass: rankWidth },
          {
            key: "player",
            label: "Player",
            align: "left",
            widthClass: playerWidth,
          },
          {
            key: "matches",
            label: "Mat",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
          {
            key: "innings",
            label: "Inn",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
          {
            key: "runs",
            label: "Runs",
            align: "center",
            highlight: true,
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "hs",
            label: "HS",
            align: "center",
            widthClass: "min-w-[36px] md:min-w-[64px]",
          },
          {
            key: "avg",
            label: "Avg",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "sr",
            label: "SR",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "fours",
            label: "4s",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
          {
            key: "sixes",
            label: "6s",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
        ];
      case "bowl":
        return [
          { key: "rank", label: "#", align: "center", widthClass: rankWidth },
          {
            key: "player",
            label: "Player",
            align: "left",
            widthClass: playerWidth,
          },
          {
            key: "matches",
            label: "Mat",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
          {
            key: "innings",
            label: "Inn",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
          {
            key: "wickets",
            label: "Wkts",
            align: "center",
            highlight: true,
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "eco",
            label: "Eco",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "b_avg",
            label: "Avg",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "best",
            label: "BBI",
            align: "center",
            widthClass: "min-w-[48px] md:min-w-[80px]",
          },
          {
            key: "b_sr",
            label: "SR",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
        ];
      case "mvp":
        return [
          { key: "rank", label: "#", align: "center", widthClass: rankWidth },
          {
            key: "player",
            label: "Player",
            align: "left",
            widthClass: playerWidth,
          },
          {
            key: "matches",
            label: "Mat",
            align: "center",
            widthClass: "min-w-[32px] md:min-w-[48px]",
          },
          {
            key: "runs",
            label: "Runs",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "wickets",
            label: "Wkts",
            align: "center",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "points",
            label: "Pts",
            align: "center",
            highlight: true,
            widthClass: "min-w-[48px] md:min-w-[80px]",
          },
        ];
      case "boundaries":
        return [
          { key: "rank", label: "#", align: "center", widthClass: rankWidth },
          {
            key: "player",
            label: "Player",
            align: "left",
            widthClass: playerWidth,
          },
          {
            key: "fours",
            label: "4s",
            align: "center",
            color: "text-yellow-500",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "sixes",
            label: "6s",
            align: "center",
            color: "text-orange-500",
            widthClass: "min-w-[40px] md:min-w-[64px]",
          },
          {
            key: "boundaryRuns",
            label: "B.Runs",
            align: "center",
            highlight: true,
            widthClass: "min-w-[48px] md:min-w-[80px]",
          },
        ];
      default:
        return [];
    }
  }, [statsTab]);

  // --- 2. HELPER: Calculate Stats ---
  const calculateStats = (p) => {
    const history = p.history || [];
    const matches = new Set(history.map((h) => h.matchId)).size;

    const batInnings = history.filter((h) => h.type === "bat").length;
    const notOuts = p.notOuts || 0;
    const avg = (p.runs / (batInnings - notOuts || 1)).toFixed(1);

    const bowlInnings = history.filter((h) => h.type === "bowl").length;
    const ballsBowled = p.ballsBowled || 0;
    const runsConceded = p.runsConceded || 0;

    const economy =
      ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(2) : "-";
    const bowlAvg = p.wickets > 0 ? (runsConceded / p.wickets).toFixed(2) : "-";
    const bowlSR = p.wickets > 0 ? (ballsBowled / p.wickets).toFixed(2) : "-";

    return {
      id: p.id || p.name,
      name: p.name,
      team: p.team,
      matches: matches || p.matches || 0,
      innings: statsTab === "bat" ? batInnings : bowlInnings,
      runs: p.runs || 0,
      hs: p.highestScore || 0,
      avg: avg > 999 ? "∞" : avg,
      sr: p.batSR || 0,
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
      rawEco: ballsBowled > 0 ? runsConceded / (ballsBowled / 6) : 9999,
    };
  };

  // --- 3. SORTING LOGIC ---
  const sortedData = useMemo(() => {
    let data = filteredStats.map(calculateStats);

    data.sort((a, b) => {
      if (statsTab === "bat") {
        if (sortStyle === "most_runs") return b.runs - a.runs;
        if (sortStyle === "high_score") return b.hs - a.hs;
        if (sortStyle === "strike_rate") return b.sr - a.sr;
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
        return b.runs - a.runs;
      } else if (statsTab === "bowl") {
        if (sortStyle === "most_wickets") {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return a.rawEco - b.rawEco;
        }
        if (sortStyle === "best_economy") {
          if (a.rawEco === 9999 && b.rawEco === 9999) return 0;
          if (a.rawEco === 9999) return 1;
          if (b.rawEco === 9999) return -1;
          if (a.rawEco !== b.rawEco) return a.rawEco - b.rawEco;
          return b.wickets - a.wickets;
        }
        return b.wickets - a.wickets;
      } else if (statsTab === "mvp") return b.points - a.points;
      else if (statsTab === "boundaries") {
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
        if (sortStyle === "most_fours") return b.fours - a.fours;
        return b.boundaryRuns - a.boundaryRuns;
      }
      return 0;
    });

    return data.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [filteredStats, statsTab, sortStyle]);

  // --- 4. RENDER CELL (Tiny UI Fonts) ---
  const renderCell = (row, col) => {
    switch (col.key) {
      case "rank":
        return (
          <span className={`font-mono text-[9px] md:text-xs ${theme.sub}`}>
            {row.rank}
          </span>
        );
      case "player":
        return (
          <div className="flex flex-col justify-center">
            <span
              className={`font-bold text-[10px] md:text-sm truncate max-w-[80px] sm:max-w-[120px] md:max-w-[160px] ${theme.text}`}>
              {row.name}
            </span>
            <span
              className={`text-[8px] md:text-[10px] uppercase font-black tracking-wider truncate max-w-[80px] sm:max-w-[120px] md:max-w-[160px] ${theme.sub}`}>
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
            className={`font-black text-[11px] md:text-base ${col.highlight ? (lightMode ? "text-teal-600" : "text-teal-400") : theme.text}`}>
            {row[col.key]}
          </span>
        );
      case "fours":
      case "sixes":
        return (
          <span
            className={`font-bold text-[10px] md:text-sm ${col.color || theme.text}`}>
            {row[col.key]}
          </span>
        );
      default:
        return (
          <span className={`text-[10px] md:text-sm font-medium ${theme.sub}`}>
            {row[col.key] || "-"}
          </span>
        );
    }
  };

  const getUnifiedHistory = (history = [], filterTab = "mvp") => {
    if (!Array.isArray(history)) return [];
    const matches = {};
    history.forEach((h) => {
      const key = h.matchId || `temp-${h.date || "no-date"}`;
      if (!matches[key]) {
        matches[key] = {
          matchId: h.matchId,
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

    const combinedArray = Object.values(matches);
    let filteredResult = combinedArray;

    if (filterTab === "bat")
      filteredResult = combinedArray.filter((m) => m.isBat === true);
    else if (filterTab === "bowl")
      filteredResult = combinedArray.filter((m) => m.isBowl === true);
    else if (filterTab === "boundaries")
      filteredResult = combinedArray.filter(
        (m) => Number(m.fours) > 0 || Number(m.sixes) > 0,
      );

    return filteredResult.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      {/* --- CAPS SECTION --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {orangeCap && (
          <div
            className={`border p-3 md:p-4 rounded-xl flex items-center justify-between shadow-md md:shadow-lg group ${lightMode ? "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200" : "bg-gradient-to-r from-[#1C2128] to-orange-950/20 border-orange-500/20"}`}>
            <div className="flex items-center gap-3 md:gap-4">
              <div
                className={`p-2 md:p-3 rounded-lg text-lg md:text-2xl border group-hover:scale-110 transition-transform ${lightMode ? "bg-orange-100 border-orange-200 text-orange-600" : "bg-orange-500/10 border-orange-500/20"}`}>
                <Trophy size={20} className="md:w-6 md:h-6" />
              </div>
              <div>
                <div
                  className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 ${lightMode ? "text-orange-600" : "text-orange-500"}`}>
                  Orange Cap
                </div>
                <div className={`text-sm md:text-lg font-black ${theme.text}`}>
                  {orangeCap.name}
                </div>
              </div>
            </div>
            <div
              className={`text-xl md:text-2xl font-black ${lightMode ? "text-orange-600" : "text-orange-400"}`}>
              {orangeCap.runs}{" "}
              <span
                className={`text-[10px] md:text-xs font-medium ${lightMode ? "text-orange-600/60" : "text-orange-500/60"}`}>
                Runs
              </span>
            </div>
          </div>
        )}

        {purpleCap && (
          <div
            className={`border p-3 md:p-4 rounded-xl flex items-center justify-between shadow-md md:shadow-lg group ${lightMode ? "bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200" : "bg-gradient-to-r from-[#1C2128] to-purple-950/20 border-purple-500/20"}`}>
            <div className="flex items-center gap-3 md:gap-4">
              <div
                className={`p-2 md:p-3 rounded-lg text-lg md:text-2xl border group-hover:scale-110 transition-transform ${lightMode ? "bg-purple-100 border-purple-200 text-purple-600" : "bg-purple-500/10 border-purple-500/20"}`}>
                <Crown size={20} className="md:w-6 md:h-6" />
              </div>
              <div>
                <div
                  className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 ${lightMode ? "text-purple-600" : "text-purple-500"}`}>
                  Purple Cap
                </div>
                <div className={`text-sm md:text-lg font-black ${theme.text}`}>
                  {purpleCap.name}
                </div>
              </div>
            </div>
            <div
              className={`text-xl md:text-2xl font-black ${lightMode ? "text-purple-600" : "text-purple-400"}`}>
              {purpleCap.wickets}{" "}
              <span
                className={`text-[10px] md:text-xs font-medium ${lightMode ? "text-purple-600/60" : "text-purple-500/60"}`}>
                Wkts
              </span>
            </div>
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div
        className={`border p-1.5 md:p-2 rounded-xl flex flex-col sm:flex-row gap-1.5 md:gap-2 shadow-sm md:shadow-md ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <div
          className={`flex p-1 rounded-lg flex-1 overflow-x-auto no-scrollbar ${lightMode ? "bg-gray-100" : "bg-[#0F1115]"}`}>
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
                if (tab.id === "bat") setSortStyle("most_runs");
                else if (tab.id === "bowl") setSortStyle("most_wickets");
                else if (tab.id === "mvp") setSortStyle("mvp");
                else if (tab.id === "boundaries") setSortStyle("most_sixes");
              }}
              className={`flex-1 px-2.5 md:px-4 py-1.5 md:py-2 rounded-md text-[9px] md:text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${statsTab === tab.id ? (lightMode ? "bg-white text-teal-700 shadow-sm" : "bg-slate-700 text-white shadow-sm") : lightMode ? "text-gray-500 hover:text-gray-700" : "text-slate-500 hover:text-slate-300"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 md:gap-2">
          <select
            className={`text-[10px] md:text-xs font-bold rounded-lg px-2 md:px-3 py-1.5 md:py-2 outline-none border focus:border-teal-500/50 ${lightMode ? "bg-white border-gray-200 text-gray-700" : "bg-[#0F1115] border-white/10 text-slate-300"}`}
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
            className={`text-[10px] md:text-xs font-bold rounded-lg px-2 md:px-3 py-1.5 md:py-2 outline-none border focus:border-teal-500/50 ${lightMode ? "bg-white border-gray-200 text-gray-700" : "bg-[#0F1115] border-white/10 text-slate-300"}`}
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

      {/* --- STANDARD STATS TABLE --- */}
      <div
        className={`border rounded-xl md:rounded-2xl overflow-hidden shadow-lg md:shadow-2xl relative ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <div className="overflow-x-auto no-scrollbar md:custom-scrollbar pb-1">
          <table className="w-full text-left border-collapse">
            <thead
              className={`text-[8px] md:text-[10px] uppercase font-black tracking-wider border-b ${lightMode ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-[#13161c] text-slate-500 border-white/5"}`}>
              <tr>
                {tableColumns.map((col, idx) => {
                  const isSticky = idx < 2;
                  const bgClass = lightMode ? "bg-gray-50" : "bg-[#13161c]";
                  const stickyClass = isSticky
                    ? `sticky z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] md:shadow-[4px_0_10px_rgba(0,0,0,0.1)] ${bgClass}`
                    : "";
                  const leftPos =
                    idx === 0 ? "left-0" : idx === 1 ? "left-8 md:left-10" : "";

                  return (
                    <th
                      key={col.key}
                      className={`px-2 py-2.5 md:p-4 whitespace-nowrap ${col.align === "center" ? "text-center" : "text-left"} ${stickyClass} ${leftPos} ${col.widthClass}`}>
                      {col.label}
                      {idx === 1 && (
                        <div
                          className={`absolute top-0 right-0 h-full w-px shadow-xl ${lightMode ? "bg-gray-200" : "bg-white/10"}`}></div>
                      )}
                    </th>
                  );
                })}
                <th className="px-2 py-2.5 md:p-4 w-6 md:w-10"></th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${lightMode ? "divide-gray-100" : "divide-white/5"}`}>
              {sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + 1}
                    className={`p-6 md:p-8 text-center text-xs md:text-sm italic ${theme.sub}`}>
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
                      className={`transition-colors cursor-pointer group ${expandedPlayer === row.name ? (lightMode ? "bg-gray-50" : "bg-white/5") : lightMode ? "hover:bg-gray-50" : "hover:bg-white/5"}`}>
                      {tableColumns.map((col, idx) => {
                        const isSticky = idx < 2;
                        const bgClass =
                          expandedPlayer === row.name
                            ? lightMode
                              ? "bg-gray-100"
                              : "bg-[#252932]"
                            : lightMode
                              ? "bg-white group-hover:bg-gray-50"
                              : "bg-[#1C2128] group-hover:bg-white/5";
                        const stickyClass = isSticky
                          ? `sticky z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] md:shadow-[4px_0_10px_rgba(0,0,0,0.1)] ${bgClass}`
                          : "";
                        const leftPos =
                          idx === 0
                            ? "left-0"
                            : idx === 1
                              ? "left-8 md:left-10"
                              : "";

                        return (
                          <td
                            key={col.key}
                            className={`px-2 py-2 md:p-3 whitespace-nowrap ${col.align === "center" ? "text-center" : "text-left"} ${stickyClass} ${leftPos}`}>
                            {renderCell(row, col)}
                            {idx === 1 && (
                              <div
                                className={`absolute top-0 right-0 h-full w-px ${lightMode ? "bg-gray-100" : "bg-gradient-to-b from-white/5 to-transparent"}`}></div>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={`px-2 md:px-3 text-center text-[8px] md:text-[10px] ${theme.sub}`}>
                        {expandedPlayer === row.name ? "▲" : "▼"}
                      </td>
                    </tr>

                    {/* EXPANDABLE HISTORY ROW */}
                    {expandedPlayer === row.name && (
                      <tr
                        className={`animate-in slide-in-from-top-2 duration-300 ${lightMode ? "bg-gray-50" : "bg-[#0F1115]"}`}>
                        <td colSpan={12} className="p-0">
                          <div className="p-2.5 md:p-4 sticky left-0 w-full">
                            <h4
                              className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-2 md:mb-3 ${theme.sub}`}>
                              {statsTab === "mvp"
                                ? "Match Performance"
                                : `Recent ${statsTab} form`}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2">
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
                                      className={`border p-2 md:p-3 rounded-lg flex justify-between items-center transition-all cursor-pointer shadow-sm group/card ${lightMode ? "bg-white border-gray-200 hover:border-teal-300" : "bg-[#1C2128] border-white/5 hover:border-teal-500/30"}`}>
                                      <div>
                                        <div
                                          className={`text-[8px] md:text-[10px] font-bold uppercase ${theme.sub}`}>
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
                                        <div
                                          className={`text-[10px] md:text-xs font-bold transition-colors ${lightMode ? "text-gray-700 group-hover/card:text-teal-600" : "text-slate-300 group-hover/card:text-teal-400"}`}>
                                          vs {log.opponent}
                                        </div>
                                      </div>

                                      <div className="flex gap-2 md:gap-3 items-center">
                                        {(statsTab === "bat" ||
                                          statsTab === "mvp" ||
                                          statsTab === "boundaries") &&
                                          log.isBat && (
                                            <div className="text-right">
                                              <div className="text-[11px] md:text-sm font-black text-yellow-500 leading-none">
                                                {log.runs}
                                              </div>
                                              <div
                                                className={`text-[7px] md:text-[8px] font-bold uppercase ${theme.sub}`}>
                                                Runs
                                              </div>
                                            </div>
                                          )}
                                        {(statsTab === "bowl" ||
                                          statsTab === "mvp") &&
                                          log.isBowl && (
                                            <div
                                              className={`text-right border-l pl-2 md:pl-3 ${lightMode ? "border-gray-200" : "border-white/10"}`}>
                                              <div className="text-[11px] md:text-sm font-black text-green-500 leading-none">
                                                {log.wickets}w
                                              </div>
                                              <div
                                                className={`text-[7px] md:text-[8px] font-bold uppercase ${theme.sub}`}>
                                                Wkts
                                              </div>
                                            </div>
                                          )}
                                        {statsTab === "boundaries" && (
                                          <div
                                            className={`flex gap-1.5 md:gap-2 border-l pl-2 md:pl-3 ${lightMode ? "border-gray-200" : "border-white/10"}`}>
                                            <span className="text-[9px] md:text-[10px] font-bold text-orange-500">
                                              {log.sixes}x6s
                                            </span>
                                            <span className="text-[9px] md:text-[10px] font-bold text-yellow-500">
                                              {log.fours}x4s
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ),
                                )
                              ) : (
                                <div
                                  className={`text-[10px] md:text-xs italic p-1.5 md:p-2 ${theme.sub}`}>
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
