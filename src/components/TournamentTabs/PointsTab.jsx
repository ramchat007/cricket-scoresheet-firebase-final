import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recalculateTournamentStats } from "../../utils/matchService";
import { useTheme } from "../../context/ThemeContext";
import { RefreshCw, History, Trophy } from "lucide-react"; // 🟢 Added Trophy

// --- NRR Helper ---
const calculateNRR = (runsScored, oversFaced, runsConceded, oversBowled) => {
  if (oversFaced === 0) return 0;
  const runRateFor = runsScored / oversFaced;
  const runRateAgainst = oversBowled === 0 ? 0 : runsConceded / oversBowled;
  return (runRateFor - runRateAgainst).toFixed(3);
};

// --- Fallback Processor (Client Side Calculation) ---
const processStandings = (teams, matches) => {
  const standings = {};
  teams.forEach((t) => {
    const name = (t.name || "").trim();
    standings[name] = {
      id: t.id,
      name,
      logo: t.logoUrl,
      group: t.group || null, // 🟢 Capture Group from DB if it exists
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      nrr: "0.000",
      history: [],
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
    };
  });

  matches.forEach((m) => {
    if (m.status !== "finished" && m.meta?.matchStatus !== "finished") return;

    const inn1 = m.innings?.[0];
    const inn2 = m.innings?.[1];
    if (!inn1 || !inn2) return;

    const t1 = inn1.battingTeam.trim();
    const t2 = inn2.battingTeam.trim();

    if (!standings[t1])
      standings[t1] = { name: t1, played: 0, points: 0, history: [] };
    if (!standings[t2])
      standings[t2] = { name: t2, played: 0, points: 0, history: [] };

    const s1 = standings[t1];
    const s2 = standings[t2];
    s1.played++;
    s2.played++;

    let winner = null;
    if (inn1.score > inn2.score) {
      winner = t1;
    } else if (inn2.score > inn1.score) {
      winner = t2;
    } else {
      const dbWinner = (m.winner || m.meta?.result?.winner || "").trim();
      if (dbWinner) winner = dbWinner;
      else winner = t1;
    }

    const tId = m.tournamentId;
    const date = m.date || m.meta?.date;

    const pushHist = (teamStats, result, oppName) => {
      teamStats.history.push({
        result,
        matchId: m.id,
        tournamentId: tId,
        opponent: oppName,
        date: date,
      });
    };

    if (winner === t1) {
      s1.won++;
      s1.points += 2;
      pushHist(s1, "W", t2);
      s2.lost++;
      pushHist(s2, "L", t1);
    } else if (winner === t2) {
      s2.won++;
      s2.points += 2;
      pushHist(s2, "W", t1);
      s1.lost++;
      pushHist(s1, "L", t2);
    } else {
      s1.points++;
      s2.points++;
      s1.tied = (s1.tied || 0) + 1;
      s2.tied = (s2.tied || 0) + 1;
      pushHist(s1, "T", t2);
      pushHist(s2, "T", t1);
    }

    const getOvers = (o, b) => parseFloat(o) + parseFloat(b) / 6;
    s1.runsScored += inn1.score;
    s1.oversFaced += getOvers(inn1.over, inn1.overBallCount);
    s2.runsConceded += inn1.score;
    s2.oversBowled += getOvers(inn1.over, inn1.overBallCount);

    s2.runsScored += inn2.score;
    s2.oversFaced += getOvers(inn2.over, inn2.overBallCount);
    s1.runsConceded += inn2.score;
    s1.oversBowled += getOvers(inn2.over, inn2.overBallCount);
  });

  return Object.values(standings).map((t) => ({
    ...t,
    nrr: calculateNRR(
      t.runsScored,
      t.oversFaced,
      t.runsConceded,
      t.oversBowled,
    ),
  }));
};

export default function PointsTab({
  pointsTable,
  matches = [],
  teams = [],
  tournamentId,
  canEdit,
}) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // 🟢 1. GET RAW DATA
  const rawTableData = useMemo(() => {
    if (matches && matches.length > 0) return processStandings(teams, matches);
    if (
      pointsTable &&
      pointsTable.length > 0 &&
      pointsTable.some((t) => t.played > 0)
    )
      return pointsTable;
    return [];
  }, [pointsTable, matches, teams]);

  // 🟢 2. GROUP THE DATA (Cricbuzz Style)
  const groupedTables = useMemo(() => {
    const groups = {};

    rawTableData.forEach((team) => {
      // If the team has a 'group' field, use it. Otherwise, use "Overall Standings".
      // E.g. team.group = "A" -> "Group A"
      const groupName = team.group
        ? `Group ${team.group.replace("Group", "").trim()}`
        : "Overall Standings";

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    // Sort each group internally by Points -> Wins -> NRR
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.won !== a.won) return b.won - a.won;
        return parseFloat(b.nrr || 0) - parseFloat(a.nrr || 0);
      });
    });

    return groups;
  }, [rawTableData]);

  const handleSync = async () => {
    if (!tournamentId) return alert("Missing Tournament ID");
    // if (!window.confirm("Recalculate Table using latest rules?")) return;
    setIsSyncing(true);
    try {
      await recalculateTournamentStats(tournamentId);
      // alert("✅ Sync Complete. Page will reload.");
      // window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedTeamId((prev) => (prev === id ? null : id));
  };

  // Themed class for table headers
  const thClass = `px-3 py-4 text-center font-black uppercase tracking-widest text-[10px]`;

  return (
    <div className="space-y-6">
      {/* Sync Button */}
      {canEdit && (
        <div className="flex justify-end px-1 mb-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
              lightMode
                ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200"
                : "bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border-indigo-500/30"
            }`}>
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : "Sync Stats"}
          </button>
        </div>
      )}

      {/* 🟢 3. RENDER EACH GROUP AS A SEPARATE CARD */}
      {Object.entries(groupedTables)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sorts Group A, Group B, etc.
        .map(([groupName, teamsInGroup]) => (
          <div
            key={groupName}
            className={`border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 ${
              lightMode
                ? "bg-white border-gray-200"
                : "bg-[#1C2128] border-white/5"
            }`}>
            {/* Group Header */}
            <div
              className={`px-6 py-4 border-b flex items-center gap-3 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
              <Trophy size={18} className="text-teal-500" />
              <h3
                className={`font-black uppercase tracking-widest text-sm ${theme.text}`}>
                {groupName}
              </h3>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto no-scrollbar pb-2">
              <table className="w-full text-sm text-left border-collapse whitespace-nowrap min-w-[600px]">
                <thead
                  className={`border-b ${
                    lightMode
                      ? "bg-gray-50 text-gray-500 border-gray-200"
                      : "bg-[#0F1115] text-slate-500 border-white/5"
                  }`}>
                  <tr>
                    <th className={`${thClass} w-10`}>#</th>
                    <th
                      className={`${thClass} text-left sticky left-0 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.1)] ${
                        lightMode ? "bg-gray-50" : "bg-[#0F1115]"
                      }`}>
                      Team
                    </th>
                    <th className={thClass}>P</th>
                    <th className={`${thClass} text-teal-500`}>W</th>
                    <th className={`${thClass} text-red-500`}>L</th>
                    <th className={`${thClass} ${theme.text}`}>Pts</th>
                    <th
                      className={`${thClass} text-right pr-6 text-indigo-400`}>
                      NRR
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${lightMode ? "divide-gray-100" : "divide-white/5"}`}>
                  {teamsInGroup.length > 0 ? (
                    teamsInGroup.map((t, i) => {
                      const isQualifier = i < 4; // Top 4 in group highlight
                      const isExpanded = expandedTeamId === t.id;

                      return (
                        <React.Fragment key={t.id || i}>
                          <tr
                            onClick={() => toggleRow(t.id)}
                            className={`cursor-pointer transition-colors group border-l-2 ${
                              isExpanded
                                ? lightMode
                                  ? "bg-gray-50"
                                  : "bg-white/[0.03]"
                                : lightMode
                                  ? "hover:bg-gray-50"
                                  : "hover:bg-white/5"
                            } ${isQualifier ? "border-teal-500" : "border-transparent"}`}>
                            <td
                              className={`px-4 py-3 font-mono text-center text-xs ${theme.sub}`}>
                              {i + 1}
                            </td>
                            <td
                              className={`px-4 py-3 sticky left-0 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.1)] transition-colors ${
                                isExpanded
                                  ? lightMode
                                    ? "bg-gray-50"
                                    : "bg-[#252b33]"
                                  : lightMode
                                    ? "bg-white group-hover:bg-gray-50"
                                    : "bg-[#1C2128] group-hover:bg-[#252b33]"
                              }`}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-6 h-6 rounded flex-none flex items-center justify-center text-[10px] shadow-inner ${
                                    isQualifier
                                      ? lightMode
                                        ? "bg-teal-100 text-teal-700"
                                        : "bg-teal-900/20 text-teal-400"
                                      : lightMode
                                        ? "bg-gray-100 text-gray-500"
                                        : "bg-slate-800 text-slate-500"
                                  }`}>
                                  {t.logo ? (
                                    <img
                                      src={t.logo}
                                      alt={t.name}
                                      className="w-full h-full object-contain p-0.5"
                                    />
                                  ) : (
                                    t.name?.charAt(0)
                                  )}
                                </div>
                                <span
                                  className={`text-xs font-bold truncate max-w-[120px] ${
                                    isQualifier
                                      ? lightMode
                                        ? "text-teal-900"
                                        : "text-slate-100"
                                      : lightMode
                                        ? "text-gray-600"
                                        : "text-slate-400"
                                  }`}>
                                  {t.name}
                                </span>
                              </div>
                            </td>
                            <td
                              className={`px-3 text-center font-medium ${theme.sub}`}>
                              {t.played}
                            </td>
                            <td className="px-3 text-center font-bold text-teal-500">
                              {t.won}
                            </td>
                            <td className="px-3 text-center text-red-500 font-medium">
                              {t.lost}
                            </td>
                            <td className="px-4 text-center">
                              <span
                                className={`inline-block font-black px-2 py-1 rounded border min-w-[28px] text-xs ${
                                  lightMode
                                    ? "bg-gray-800 text-white border-gray-600"
                                    : "bg-black/40 text-white border-white/10"
                                }`}>
                                {t.points}
                              </span>
                            </td>
                            <td className="px-6 text-right font-mono font-medium text-xs">
                              <span
                                className={`${parseFloat(t.nrr) >= 0 ? "text-indigo-400" : "text-red-400"}`}>
                                {parseFloat(t.nrr) > 0 ? "+" : ""}
                                {t.nrr}
                              </span>
                            </td>
                          </tr>

                          {/* Expandable History Row */}
                          {isExpanded && (
                            <tr>
                              <td
                                colSpan={7}
                                className={`p-0 border-b ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115]/50 border-white/5"}`}>
                                <div className="p-4 animate-in slide-in-from-top-2 duration-300">
                                  <h4
                                    className={`text-[10px] font-bold uppercase tracking-widest mb-3 pl-1 flex items-center gap-2 ${theme.sub}`}>
                                    <History size={12} /> Recent Match History
                                  </h4>
                                  <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
                                    {(t.history || []).length > 0 ? (
                                      [...(t.history || [])]
                                        .reverse()
                                        .map((match, idx) => {
                                          const result =
                                            typeof match === "object"
                                              ? match.result
                                              : match;
                                          const oppName =
                                            typeof match === "object"
                                              ? match.opponent
                                              : "Unknown";
                                          const mId =
                                            typeof match === "object"
                                              ? match.matchId
                                              : null;
                                          const dateStr =
                                            typeof match === "object"
                                              ? match.date
                                              : null;

                                          return (
                                            <div
                                              key={idx}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (mId)
                                                  navigate(
                                                    `/tournaments/${tournamentId}/scorecard/${mId}`,
                                                  );
                                              }}
                                              className={`snap-start flex-shrink-0 w-32 border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all group ${
                                                lightMode
                                                  ? "bg-white border-gray-200 hover:border-teal-300 hover:shadow-md"
                                                  : "bg-[#1C2128] border-white/10 hover:border-teal-500/50 hover:bg-[#252b33]"
                                              }`}>
                                              <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-lg ${
                                                  result === "W"
                                                    ? "bg-teal-500 text-black shadow-teal-500/20"
                                                    : result === "L"
                                                      ? "bg-red-500 text-white shadow-red-500/20"
                                                      : "bg-slate-600 text-white"
                                                }`}>
                                                {result}
                                              </div>
                                              <div className="text-center">
                                                <div
                                                  className={`text-[9px] uppercase font-bold tracking-tight ${theme.sub}`}>
                                                  vs
                                                </div>
                                                <div
                                                  className={`text-[10px] font-bold truncate max-w-[100px] ${theme.text}`}
                                                  title={oppName}>
                                                  {oppName || "Opponent"}
                                                </div>
                                              </div>
                                              {dateStr && (
                                                <div
                                                  className={`text-[9px] font-mono mt-1 ${theme.sub}`}>
                                                  {new Date(
                                                    dateStr,
                                                  ).toLocaleDateString(
                                                    undefined,
                                                    {
                                                      month: "short",
                                                      day: "numeric",
                                                    },
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                    ) : (
                                      <div
                                        className={`text-xs italic px-2 ${theme.sub}`}>
                                        No matches played yet.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className={`px-6 py-12 text-center italic text-xs ${theme.sub}`}>
                        No standings available in this group.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
