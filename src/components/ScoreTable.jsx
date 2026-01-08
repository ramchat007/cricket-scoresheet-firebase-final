// src/components/ScoreTable.jsx
import React, { useState, useEffect, useMemo } from "react";
import { getManOfTheMatch } from "../utils/statsHelper";

const ScoreTable = ({ match }) => {
  const [openInningIndex, setOpenInningIndex] = useState(0);

  useEffect(() => {
    if (match?.currentInnings !== undefined) {
      setOpenInningIndex(match.currentInnings);
    }
  }, [match?.currentInnings]);

  if (!match)
    return (
      <div className="text-gray-400 text-center py-10 animate-pulse text-sm font-bold">
        Loading Scorecard...
      </div>
    );

  const inns = Array.isArray(match.innings)
    ? match.innings
    : [match.innings?.[0], match.innings?.[1]].filter(Boolean);

  const mom = useMemo(() => getManOfTheMatch(match), [match]);
  const isFinished =
    match.status === "finished" || match.meta?.matchStatus === "finished";

  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const getDismissalText = (stats, isStriker, isNonStriker) => {
    if (isStriker || isNonStriker)
      return <span className="text-green-400 font-bold">not out</span>;
    if (!stats || !stats.out) return "Did not bat";
    if (typeof stats.out === "string" && stats.out.length > 5) return stats.out;

    const b = stats.bowler || "";
    const f = stats.fielder || "";
    const type = stats.wicketType || "out";

    switch (type) {
      case "bowled":
        return `b ${b}`;
      case "caught":
        return `c ${f} b ${b}`;
      case "lbw":
        return `lbw b ${b}`;
      case "runout":
        return `run out (${f})`;
      case "stumped":
        return `st ${f} b ${b}`;
      case "hitwicket":
        return `hit wicket b ${b}`;
      default:
        return type;
    }
  };

  const renderInnings = (inn, idx) => {
    // --- 1. DETERMINE OPPOSING SQUAD (For Bowling) ---
    // We need the *fielding* team's squad to list "Yet to Bowl"
    let fieldingSquadList = [];

    // Logic: If current batting team is Team A, then fielding squad is Team B (and vice versa)
    const norm = (str) => (str ? String(str).trim().toLowerCase() : "");
    const batTeam = norm(inn?.battingTeam);
    const teamA = norm(match.meta?.teamA);
    const teamB = norm(match.meta?.teamB);

    if (batTeam === teamA) {
      // Team A batting -> Team B Bowling
      fieldingSquadList = match.teamBSquad || [];
    } else if (batTeam === teamB) {
      // Team B batting -> Team A Bowling
      fieldingSquadList = match.teamASquad || [];
    } else {
      // Fallback based on index (swap logic)
      if (idx === 0) fieldingSquadList = match.teamBSquad || [];
      else fieldingSquadList = match.teamASquad || [];
    }

    // --- 2. DETERMINE BATTING SQUAD ---
    let battingSquadList = inn?.batsmenList || [];
    if (battingSquadList.length === 0) {
      if (batTeam === teamA) battingSquadList = match.teamASquad || [];
      else if (batTeam === teamB) battingSquadList = match.teamBSquad || [];
      else {
        if (idx === 0) battingSquadList = match.teamASquad || [];
        else battingSquadList = match.teamBSquad || [];
      }
    }

    if (!inn) return null; // Or placeholder

    const isOpen = openInningIndex === idx;
    const isCurrentInnings = match.currentInnings === idx;

    // --- 3. PROCESS BATTERS ---
    const allBatters = Array.from(
      new Set([
        ...battingSquadList.map(cleanName),
        ...(inn.battingOrder || []).map(cleanName),
        ...Object.keys(inn.batsmenStats || {}),
        cleanName(inn.striker),
        cleanName(inn.nonStriker),
      ])
    ).filter((n) => n && n !== "Unknown");

    const playedBatsmen = [];
    const dnbBatsmen = [];

    allBatters.forEach((name) => {
      const stats = inn.batsmenStats?.[name];
      const isCurrent =
        name === cleanName(inn.striker) || name === cleanName(inn.nonStriker);
      const hasBatted =
        (inn.battingOrder && inn.battingOrder.includes(name)) ||
        (stats && (stats.balls > 0 || stats.out)) ||
        isCurrent;

      if (hasBatted) playedBatsmen.push(name);
      else dnbBatsmen.push(name);
    });

    playedBatsmen.sort((a, b) => {
      const order = (inn.battingOrder || []).map(cleanName);
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return 0;
    });

    // --- 4. PROCESS BOWLERS ---
    const activeBowlers = [];
    const dnbBowlers = [];

    // Combine stats keys with squad list to get everyone
    const allFielders = Array.from(
      new Set([
        ...fieldingSquadList.map(cleanName),
        ...(inn.bowlersList || []).map(cleanName),
        ...Object.keys(inn.bowlerStats || {}),
      ])
    ).filter((n) => n && n !== "Unknown" && n !== "[object Object]");

    allFielders.forEach((name) => {
      const s = inn.bowlerStats?.[name];
      const isCurrent = name === cleanName(inn.currentBowler);

      // Active if current OR has stats (balls > 0)
      if (isCurrent || (s && s.balls > 0)) {
        activeBowlers.push(name);
      } else {
        dnbBowlers.push(name);
      }
    });

    // Sort Active Bowlers (Insertion Order usually preserved, or alphabetical)
    activeBowlers.sort((a, b) => 0);

    const extras = inn.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
    const totalExtras =
      (extras.wides || 0) +
      (extras.noBalls || 0) +
      (extras.byes || 0) +
      (extras.legByes || 0);
    const totalBallsBowled = inn.over * 6 + inn.overBallCount;
    const crr =
      totalBallsBowled > 0
        ? ((inn.score / totalBallsBowled) * 6).toFixed(2)
        : "0.00";

    return (
      <div
        key={`inn-${idx}`}
        className="bg-gray-900 border border-gray-800 rounded-none first:rounded-t-xl last:rounded-b-xl overflow-hidden mb-1">
        {/* HEADER */}
        <div
          onClick={() => setOpenInningIndex(isOpen ? null : idx)}
          className={`px-4 py-4 flex justify-between items-center cursor-pointer transition-colors ${
            isOpen ? "bg-gray-800" : "bg-gray-900 hover:bg-gray-800/50"
          }`}>
          <div className="flex flex-col">
            <span className="text-white font-bold text-base md:text-lg">
              {inn.battingTeam || `Innings ${idx + 1}`}
            </span>
            {isCurrentInnings && !isFinished && (
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
                Batting Now
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xl md:text-2xl font-bold text-white">
                {inn.score}/{inn.wickets}
              </span>
              <span className="text-gray-400 text-xs ml-2 font-mono">
                ({inn.over}.{inn.overBallCount} Ov)
              </span>
            </div>
            <span
              className={`text-gray-500 transition-transform duration-300 ${
                isOpen ? "rotate-180" : ""
              }`}>
              ▼
            </span>
          </div>
        </div>

        {/* CONTENT */}
        {isOpen && (
          <div className="bg-gray-950/30 border-t border-gray-800 animate-in slide-in-from-top-2">
            {/* BATTERS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-900/50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-2 w-1/2">Batter</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right">B</th>
                    <th className="px-2 py-2 text-right hidden sm:table-cell">
                      4s
                    </th>
                    <th className="px-2 py-2 text-right hidden sm:table-cell">
                      6s
                    </th>
                    <th className="px-2 py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-sm">
                  {playedBatsmen.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-gray-500 italic">
                        Innings starting...
                      </td>
                    </tr>
                  ) : (
                    playedBatsmen.map((name) => {
                      const stats = inn.batsmenStats?.[name] || {
                        runs: 0,
                        balls: 0,
                        fours: 0,
                        sixes: 0,
                        out: null,
                      };
                      const isStriker = name === cleanName(inn.striker);
                      const isNon = name === cleanName(inn.nonStriker);
                      const sr =
                        stats.balls > 0
                          ? ((stats.runs / stats.balls) * 100).toFixed(0)
                          : "0";
                      const isNotOut = isStriker || isNon;

                      return (
                        <tr key={name} className="hover:bg-gray-800/30">
                          <td className="px-4 py-3">
                            <div
                              className={`font-semibold ${
                                isNotOut ? "text-cyan-400" : "text-gray-300"
                              }`}>
                              {name} {isNotOut && "*"}
                            </div>
                            <div className="text-xs text-gray-500 font-medium mt-0.5 lowercase first-letter:uppercase">
                              {getDismissalText(stats, isStriker, isNon)}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right font-bold text-white">
                            {stats.runs}
                          </td>
                          <td className="px-2 py-3 text-right text-gray-400">
                            {stats.balls}
                          </td>
                          <td className="px-2 py-3 text-right text-gray-600 hidden sm:table-cell">
                            {stats.fours}
                          </td>
                          <td className="px-2 py-3 text-right text-gray-600 hidden sm:table-cell">
                            {stats.sixes}
                          </td>
                          <td className="px-2 py-3 text-right text-gray-600 text-xs">
                            {sr}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr className="border-t border-gray-800">
                    <td className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">
                      Extras
                    </td>
                    <td
                      colSpan={5}
                      className="px-4 py-2 text-right text-white font-mono text-xs">
                      {totalExtras} (wd {extras.wides}, nb {extras.noBalls}, b{" "}
                      {extras.byes}, lb {extras.legByes})
                    </td>
                  </tr>
                  <tr className="bg-gray-800/20 border-t border-gray-700 font-bold">
                    <td className="px-4 py-3 text-white uppercase text-sm">
                      Total
                    </td>
                    <td colSpan={5} className="px-4 py-3 text-right">
                      <span className="text-white text-base mr-2">
                        {inn.score}/{inn.wickets}
                      </span>
                      <span className="text-gray-400 text-xs font-normal">
                        ({inn.over}.{inn.overBallCount} Ov)
                      </span>
                      <span className="text-gray-500 text-xs font-mono ml-3">
                        CRR: {crr}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DNB BATTERS */}
            {dnbBatsmen.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-800">
                <span className="text-xs font-bold text-gray-500 uppercase mr-2">
                  To bat:
                </span>
                <span className="text-xs text-gray-400 italic">
                  {dnbBatsmen.join(", ")}
                </span>
              </div>
            )}

            {/* BOWLERS */}
            <div className="mt-2 bg-gray-900 border-t border-gray-800">
              <div className="px-4 py-2 text-[10px] font-bold text-cyan-600 uppercase tracking-widest bg-gray-900/50">
                Bowling
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-900/50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-2 w-1/2">Bowler</th>
                    <th className="px-2 py-2 text-right">O</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right text-white">W</th>
                    <th className="px-2 py-2 text-right">Eco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {activeBowlers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-gray-500 italic">
                        No bowlers yet
                      </td>
                    </tr>
                  ) : (
                    activeBowlers.map((name) => {
                      const s = inn.bowlerStats?.[name] || {
                        balls: 0,
                        runs: 0,
                        wickets: 0,
                      };
                      const overs = Math.floor(s.balls / 6);
                      const balls = s.balls % 6;
                      const econ =
                        s.balls > 0
                          ? (s.runs / (s.balls / 6)).toFixed(1)
                          : "0.0";
                      const isCurrent = name === cleanName(inn.currentBowler);
                      return (
                        <tr
                          key={name}
                          className={isCurrent ? "bg-cyan-900/10" : ""}>
                          <td
                            className={`px-4 py-2 ${
                              isCurrent
                                ? "text-cyan-400 font-bold"
                                : "text-gray-300"
                            }`}>
                            {name}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-400">
                            {overs}.{balls}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-400">
                            {s.runs}
                          </td>
                          <td className="px-2 py-2 text-right text-white font-bold">
                            {s.wickets}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-500 text-xs">
                            {econ}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* DNB BOWLERS (Fixed Logic) */}
            {dnbBowlers.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-800">
                <span className="text-xs font-bold text-gray-500 uppercase mr-2">
                  Yet to bowl:
                </span>
                <span className="text-xs text-gray-400 italic">
                  {dnbBowlers.join(", ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4 max-w-2xl mx-auto">
      {/* MOM CARD */}
      {isFinished && mom && (
        <div className="mb-4 bg-gradient-to-r from-yellow-900/40 via-gray-900 to-gray-900 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🏅</div>
            <div>
              <div className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">
                Player of the Match
              </div>
              <div className="text-xl font-black text-white">
                {cleanName(mom.name)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-white">{mom.mvpScore}</div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">
              Pts
            </div>
          </div>
        </div>
      )}

      {/* INNINGS LIST */}
      <div className="flex flex-col shadow-2xl rounded-xl overflow-hidden border border-gray-800">
        {renderInnings(inns[0], 0)}
        {(inns[1] || isFinished || match.currentInnings === 1) &&
          renderInnings(inns[1], 1)}
      </div>
    </div>
  );
};

export default React.memo(ScoreTable);
