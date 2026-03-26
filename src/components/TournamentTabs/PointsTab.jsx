import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recalculateTournamentStats } from "../../utils/matchService";
import { useTheme } from "../../context/ThemeContext";
import { RefreshCw, History, Trophy } from "lucide-react";

// --- NRR Helper ---
const calculateNRR = (runsScored, oversFaced, runsConceded, oversBowled) => {
  if (oversFaced === 0) return 0;
  const runRateFor = runsScored / oversFaced;
  const runRateAgainst = oversBowled === 0 ? 0 : runsConceded / oversBowled;
  return (runRateFor - runRateAgainst).toFixed(3);
};

// --- Client Side Calculation (Smart Resolution Support) ---
const processStandings = (teams, matches) => {
  const standings = {};
  teams.forEach((t) => {
    const name = (t.name || "").trim();
    standings[name] = {
      id: t.id,
      name,
      logo: t.logoUrl,
      group: t.group || null,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      nr: 0,
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

    const t1 = (m.innings?.[0]?.battingTeam || m.meta?.teamA || "").trim();
    const t2 = (
      m.innings?.[1]?.battingTeam ||
      m.innings?.[0]?.bowlingTeam ||
      m.meta?.teamB ||
      ""
    ).trim();

    if (!t1 || !t2) return;

    if (!standings[t1])
      standings[t1] = {
        name: t1,
        played: 0,
        points: 0,
        history: [],
        runsScored: 0,
        oversFaced: 0,
        runsConceded: 0,
        oversBowled: 0,
        won: 0,
        lost: 0,
        tied: 0,
        nr: 0,
      };
    if (!standings[t2])
      standings[t2] = {
        name: t2,
        played: 0,
        points: 0,
        history: [],
        runsScored: 0,
        oversFaced: 0,
        runsConceded: 0,
        oversBowled: 0,
        won: 0,
        lost: 0,
        tied: 0,
        nr: 0,
      };

    const s1 = standings[t1];
    const s2 = standings[t2];

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

    // SCENARIO A: MATCH ABANDONED (Rain / No Show)
    if (m.resultType === "abandoned") {
      s1.played++;
      s2.played++;
      s1.points++;
      s2.points++;
      s1.nr++;
      s2.nr++;
      pushHist(s1, "NR", t2);
      pushHist(s2, "NR", t1);
      return;
    }

    // SCENARIO B: WALKOVER
    if (m.resultType === "walkover") {
      s1.played++;
      s2.played++;
      const wName = (m.winner || "").trim();

      if (wName === t1 || m.winnerId === m.meta?.teamAId) {
        s1.won++;
        s1.points += 2;
        pushHist(s1, "W", t2);
        s2.lost++;
        pushHist(s2, "L", t1);
      } else {
        s2.won++;
        s2.points += 2;
        pushHist(s2, "W", t1);
        s1.lost++;
        pushHist(s1, "L", t2);
      }
      return;
    }

    // SCENARIO C: STANDARD MATCH
    const inn1 = m.innings?.[0];
    const inn2 = m.innings?.[1];
    if (!inn1 || !inn2) return;

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
      s1.tied++;
      s2.tied++;
      pushHist(s1, "T", t2);
      pushHist(s2, "T", t1);
    }

    // Standard NRR Calculation
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

  // 🟢 1. Natively extract theme
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";

  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

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

  const groupedTables = useMemo(() => {
    const groups = {};

    rawTableData.forEach((team) => {
      const groupName = team.group
        ? `Group ${team.group.replace("Group", "").trim()}`
        : "Overall Standings";

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

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
    setIsSyncing(true);
    try {
      await recalculateTournamentStats(tournamentId);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedTeamId((prev) => (prev === id ? null : id));
  };

  // 🟢 Highly Responsive Header Class
  const thClass = `px-1.5 md:px-3 py-2.5 md:py-4 text-center font-black uppercase tracking-wider md:tracking-widest text-[9px] md:text-[10px]`;

  return (
    <div className="space-y-4 md:space-y-6">
      {canEdit && (
        <div className="flex justify-end px-1 mb-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            // 🟢 Adapts perfectly to text color
            className={`flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-md md:rounded-lg border transition-all disabled:opacity-50 bg-current/5 border-current/10 hover:bg-current/10 text-inherit`}>
            <RefreshCw
              size={12}
              className={`md:w-3.5 md:h-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing ? "Syncing..." : "Sync Stats"}
          </button>
        </div>
      )}

      {Object.entries(groupedTables)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([groupName, teamsInGroup]) => (
          <div
            key={groupName}
            // 🟢 Replaced hardcoded backgrounds with dynamic theme card
            className={`rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 ${cardBg}`}>
            {/* Group Header */}
            <div
              className={`px-4 py-3 md:px-6 md:py-4 border-b border-current/10 flex items-center gap-2 md:gap-3 bg-black/10`}>
              <Trophy
                size={16}
                className="md:w-[18px] md:h-[18px] text-teal-500"
              />
              <h3
                className={`font-black uppercase tracking-widest text-xs md:text-sm ${textMain}`}>
                {groupName}
              </h3>
            </div>

            {/* Table Container - 🟢 Removed fixed 600px width on mobile */}
            <div className="overflow-x-auto no-scrollbar pb-1 md:pb-2">
              <table className="w-full text-sm text-left border-collapse whitespace-nowrap min-w-max md:min-w-[600px]">
                <thead
                  className={`border-b border-white/5 bg-black/20 ${textSub}`}>
                  <tr>
                    <th className={`${thClass} w-8 md:w-10`}>#</th>
                    <th
                      className={`${thClass} text-left sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] md:shadow-[4px_0_10px_rgba(0,0,0,0.1)] bg-black/40 backdrop-blur-sm`}>
                      Team
                    </th>
                    <th className={thClass}>P</th>
                    <th className={`${thClass} text-teal-500`}>W</th>
                    <th className={`${thClass} text-red-500`}>L</th>
                    <th className={`${thClass} ${textMain}`}>Pts</th>
                    <th
                      className={`${thClass} text-right pr-3 md:pr-6 text-indigo-400`}>
                      NRR
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-white/5`}>
                  {teamsInGroup.length > 0 ? (
                    teamsInGroup.map((t, i) => {
                      const isQualifier = i < 4;
                      const isExpanded = expandedTeamId === t.id;

                      return (
                        <React.Fragment key={t.id || i}>
                          <tr
                            onClick={() => toggleRow(t.id)}
                            // 🟢 Replaced hardcoded hover colors with clean bg-current/10
                            className={`cursor-pointer transition-colors group border-l-2 ${
                              isExpanded
                                ? "bg-current/10"
                                : "hover:bg-current/5"
                            } ${isQualifier ? "border-teal-500" : "border-transparent"}`}>
                            {/* RANK */}
                            <td
                              className={`px-2 md:px-4 py-2 md:py-3 font-mono text-center text-[10px] md:text-xs ${textSub}`}>
                              {i + 1}
                            </td>

                            {/* TEAM NAME (Sticky) */}
                            <td
                              className={`px-2 md:px-4 py-2 md:py-3 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] md:shadow-[4px_0_10px_rgba(0,0,0,0.1)] transition-colors ${
                                isExpanded
                                  ? "bg-black/40 backdrop-blur-md"
                                  : "bg-black/20 group-hover:bg-black/30 backdrop-blur-sm"
                              }`}>
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <div
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded flex-none flex items-center justify-center text-[8px] md:text-[10px] shadow-inner ${
                                    isQualifier
                                      ? "bg-teal-500/20 text-teal-500"
                                      : "bg-current/10 text-inherit opacity-70"
                                  }`}>
                                  {t.logo ? (
                                    <img
                                      src={t.logo}
                                      alt={t.name}
                                      className="w-full h-full object-contain p-0.5 drop-shadow-md"
                                    />
                                  ) : (
                                    t.name?.charAt(0)
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] md:text-xs font-bold truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px] ${
                                    isQualifier ? textMain : textSub
                                  }`}>
                                  {t.name}
                                </span>
                              </div>
                            </td>

                            {/* P, W, L */}
                            <td
                              className={`px-1.5 md:px-3 text-center font-medium text-[10px] md:text-xs ${textSub}`}>
                              {t.played}
                            </td>
                            <td className="px-1.5 md:px-3 text-center font-bold text-teal-500 text-[10px] md:text-xs">
                              {t.won}
                            </td>
                            <td className="px-1.5 md:px-3 text-center text-red-500 font-medium text-[10px] md:text-xs">
                              {t.lost}
                            </td>

                            {/* POINTS */}
                            <td className="px-1.5 md:px-4 text-center">
                              <span
                                className={`inline-block font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded border min-w-[20px] md:min-w-[28px] text-[10px] md:text-xs bg-black/40 text-white border-white/10`}>
                                {t.points}
                              </span>
                            </td>

                            {/* NRR */}
                            <td className="px-2 md:px-6 text-right font-mono font-medium text-[9px] md:text-xs">
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
                                className={`p-0 border-b border-current/10 bg-black/40`}>
                                <div className="p-2.5 md:p-4 animate-in slide-in-from-top-2 duration-300">
                                  <h4
                                    className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-2 md:mb-3 pl-1 flex items-center gap-1.5 md:gap-2 ${textSub}`}>
                                    <History
                                      size={10}
                                      className="md:w-3 md:h-3"
                                    />{" "}
                                    Recent Match History
                                  </h4>
                                  <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
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
                                              // 🟢 Replaced hardcoded colors with transparent cards
                                              className={`snap-start flex-shrink-0 w-24 md:w-32 border border-current/10 rounded-xl md:rounded-2xl p-2 md:p-3 flex flex-col items-center gap-1.5 md:gap-2 cursor-pointer transition-all group bg-current/5 hover:bg-current/10 hover:border-teal-500/50`}>
                                              <div
                                                className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black shadow-md md:shadow-lg ${
                                                  result === "W"
                                                    ? "bg-teal-500 text-white shadow-teal-500/20"
                                                    : result === "L"
                                                      ? "bg-red-500 text-white shadow-red-500/20"
                                                      : "bg-current/20 text-inherit opacity-70"
                                                }`}>
                                                {result}
                                              </div>
                                              <div className="text-center">
                                                <div
                                                  className={`text-[8px] md:text-[9px] uppercase font-bold tracking-tight ${textSub}`}>
                                                  vs
                                                </div>
                                                <div
                                                  className={`text-[9px] md:text-[10px] font-bold truncate max-w-[80px] md:max-w-[100px] transition-colors ${textMain} group-hover/card:text-teal-500`}
                                                  title={oppName}>
                                                  {oppName || "Opponent"}
                                                </div>
                                              </div>
                                              {dateStr && (
                                                <div
                                                  className={`text-[8px] md:text-[9px] font-mono mt-0.5 md:mt-1 ${textSub}`}>
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
                                        className={`text-[10px] md:text-xs italic px-2 ${textSub}`}>
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
                        className={`px-6 py-8 md:py-12 text-center italic text-xs ${textSub}`}>
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
