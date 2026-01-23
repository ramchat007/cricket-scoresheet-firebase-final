import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recalculateTournamentStats } from "../../utils/matchService";

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
      played: 0,
      won: 0,
      lost: 0,
      tied: 0, // Track ties specifically if needed
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
    // Only process finished matches
    if (m.status !== "finished" && m.meta?.matchStatus !== "finished") return;

    const inn1 = m.innings?.[0];
    const inn2 = m.innings?.[1];
    if (!inn1 || !inn2) return;

    const t1 = inn1.battingTeam.trim(); // Defending Team
    const t2 = inn2.battingTeam.trim(); // Chasing Team

    // Safety check
    if (!standings[t1])
      standings[t1] = { name: t1, played: 0, points: 0, history: [] };
    if (!standings[t2])
      standings[t2] = { name: t2, played: 0, points: 0, history: [] };

    const s1 = standings[t1];
    const s2 = standings[t2];
    s1.played++;
    s2.played++;

    // --- 🏆 WINNER LOGIC (With Compulsory Chase Rule) ---
    let winner = null;

    // 1. Check Runs
    if (inn1.score > inn2.score) {
      winner = t1;
    } else if (inn2.score > inn1.score) {
      winner = t2;
    } else {
      // 2. Scores Level (TIE)
      const dbWinner = (m.winner || m.meta?.result?.winner || "").trim();

      if (dbWinner) {
        // Respect manual overwrite from DB
        winner = dbWinner;
      } else {
        // ⚡ COMPULSORY CHASE RULE:
        // If scores are tied, Defending Team (t1) wins.
        winner = t1;
      }
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
      // Use this ONLY if you explicitly want a Draw (1pt each)
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

  return Object.values(standings)
    .map((t) => ({
      ...t,
      nrr: calculateNRR(
        t.runsScored,
        t.oversFaced,
        t.runsConceded,
        t.oversBowled,
      ),
    }))
    .sort((a, b) => {
      // 1. Points (Higher is better)
      if (b.points !== a.points) return b.points - a.points;

      // 2. Wins (Higher is better)
      if (b.won !== a.won) return b.won - a.won;

      // 3. NRR (Higher is better)
      const nrrA = parseFloat(a.nrr);
      const nrrB = parseFloat(b.nrr);
      if (nrrB !== nrrA) return nrrB - nrrA;

      // 4. Matches Played (Lower is better for 0-point ties)
      // This pushes teams with 0 games above teams that lost games but kept 0.000 NRR
      return a.played - b.played;
    });
};

export default function PointsTab({
  pointsTable,
  matches = [],
  teams = [],
  tournamentId,
  canEdit,
}) {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  const tableData = useMemo(() => {
    // ⚠️ NOTE: If 'pointsTable' from DB has data, it might override this calculation.
    // If you want to force the new logic, temporarily rely on 'processStandings' by commenting out the check below,
    // OR click the "Sync Stats" button to update the backend.

    // Fallback Calculation (Client Side) - This now contains the fix
    if (matches && matches.length > 0) return processStandings(teams, matches);

    // Default to DB data if matches not loaded yet
    if (
      pointsTable &&
      pointsTable.length > 0 &&
      pointsTable.some((t) => t.played > 0)
    ) {
      return pointsTable;
    }
    return [];
  }, [pointsTable, matches, teams]);

  const handleSync = async () => {
    if (!tournamentId) return alert("Missing Tournament ID");
    if (!window.confirm("Recalculate Table using latest rules?")) return;
    setIsSyncing(true);
    try {
      await recalculateTournamentStats(tournamentId);
      alert("✅ Sync Complete. Page will reload.");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedTeamId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end px-1">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/30 transition-all disabled:opacity-50">
            <span className={isSyncing ? "animate-spin" : ""}>↻</span>{" "}
            {isSyncing ? "Syncing..." : "Sync Stats"}
          </button>
        </div>
      )}

      <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="overflow-x-auto no-scrollbar pb-2">
          <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
            <thead className="bg-[#0F1115] text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] border-b border-white/5">
              <tr>
                <th className="px-4 py-4 text-center w-10">#</th>
                <th className="px-4 py-4 sticky left-0 bg-[#0F1115] z-10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                  Team
                </th>
                <th className="px-3 text-center">P</th>
                <th className="px-3 text-center text-teal-500">W</th>
                <th className="px-3 text-center text-red-500">L</th>
                <th className="px-4 text-center text-slate-200">Pts</th>
                <th className="px-6 text-right text-indigo-400">NRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tableData.length > 0 ? (
                tableData.map((t, i) => {
                  const isQualifier = i < 4;
                  const isExpanded = expandedTeamId === t.id;

                  return (
                    <React.Fragment key={t.id || i}>
                      <tr
                        onClick={() => toggleRow(t.id)}
                        className={`cursor-pointer transition-colors group ${
                          isExpanded ? "bg-white/[0.03]" : "hover:bg-white/5"
                        } ${isQualifier ? "border-l-2 border-teal-500" : "border-l-2 border-transparent"}`}>
                        <td className="px-4 py-3 font-mono text-center text-slate-500 text-xs">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 sticky left-0 bg-[#1C2128] z-10 shadow-[4px_0_10px_rgba(0,0,0,0.5)] group-hover:bg-[#252b33] transition-colors">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded flex-none flex items-center justify-center text-[10px] shadow-inner ${isQualifier ? "bg-teal-900/20 text-teal-400" : "bg-slate-800 text-slate-500"}`}>
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
                              className={`text-xs font-bold truncate max-w-[120px] ${isQualifier ? "text-slate-100" : "text-slate-400"}`}>
                              {t.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 text-center text-slate-500 font-medium">
                          {t.played}
                        </td>
                        <td className="px-3 text-center font-bold text-teal-400">
                          {t.won}
                        </td>
                        <td className="px-3 text-center text-red-400 font-medium">
                          {t.lost}
                        </td>
                        <td className="px-4 text-center">
                          <span className="inline-block bg-black/40 text-white font-black px-2 py-1 rounded border border-white/10 min-w-[28px] text-xs">
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

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={7}
                            className="bg-[#0F1115]/50 border-b border-white/5 p-0">
                            <div className="p-4 animate-in slide-in-from-top-2 duration-300">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">
                                Recent Match History
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
                                      const tId = tournamentId;

                                      return (
                                        <div
                                          key={idx}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (mId)
                                              navigate(
                                                `/tournaments/${tId}/scorecard/${mId}`,
                                              );
                                          }}
                                          className="snap-start flex-shrink-0 w-32 bg-[#1C2128] border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:border-teal-500/50 hover:bg-[#252b33] transition-all group">
                                          <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-lg ${result === "W" ? "bg-teal-500 text-black shadow-teal-500/20" : result === "L" ? "bg-red-500 text-white shadow-red-500/20" : "bg-slate-600 text-white"}`}>
                                            {result}
                                          </div>
                                          <div className="text-center">
                                            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-tight">
                                              vs
                                            </div>
                                            <div
                                              className="text-[10px] font-bold text-slate-300 truncate max-w-[100px]"
                                              title={oppName}>
                                              {oppName || "Opponent"}
                                            </div>
                                          </div>
                                          {dateStr && (
                                            <div className="text-[9px] text-slate-600 font-mono mt-1">
                                              {new Date(
                                                dateStr,
                                              ).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                ) : (
                                  <div className="text-slate-500 text-xs italic px-2">
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
                    className="px-6 py-12 text-center text-slate-600 italic text-xs">
                    No standings available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
