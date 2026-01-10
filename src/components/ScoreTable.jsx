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
      <div className="text-slate-500 text-center py-10 animate-pulse text-sm font-bold bg-[#0F1115] h-full flex items-center justify-center">
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

  // --- HELPER: FORMAT DISMISSAL TEXT ---
  const getDismissalText = (stats, isStriker, isNonStriker) => {
    if (isStriker || isNonStriker)
      return <span className="text-teal-400 font-bold">not out</span>;
    
    if (!stats || !stats.out) return "Did not bat";
    if (typeof stats.out === "string" && stats.out.length > 5) return stats.out;

    const b = stats.bowler || "";
    const f = stats.fielder || "";
    const type = stats.wicketType || "out";

    switch (type) {
      case "bowled": return `b ${b}`;
      case "caught": return `c ${f} b ${b}`;
      case "lbw": return `lbw b ${b}`;
      case "runout": return `run out (${f})`;
      case "stumped": return `st ${f} b ${b}`;
      case "hitwicket": return `hit wicket b ${b}`;
      case "retiredhurt": return <span className="text-slate-500 italic">retired hurt</span>;
      case "retiredout": return <span className="text-red-400">retired out</span>;
      default: return type;
    }
  };

  const renderInnings = (inn, idx) => {
    // --- 1. SQUAD RESOLUTION ---
    const norm = (str) => (str ? String(str).trim().toLowerCase() : "");
    const batTeam = norm(inn?.battingTeam);
    const teamA = norm(match.meta?.teamA);
    
    // Determine squads based on who is batting
    let fieldingSquadList = [];
    let battingSquadList = inn?.batsmenList || [];

    if (batTeam === teamA) {
      fieldingSquadList = match.teamBSquad || [];
      if (battingSquadList.length === 0) battingSquadList = match.teamASquad || [];
    } else {
      fieldingSquadList = match.teamASquad || [];
      if (battingSquadList.length === 0) battingSquadList = match.teamBSquad || [];
    }

    if (!inn) return null;

    const isOpen = openInningIndex === idx;
    const isCurrentInnings = match.currentInnings === idx;

    // --- 2. PROCESS BATTERS ---
    // Merge squad list + recorded stats to ensure subs/new players appear
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
      const isCurrent = name === cleanName(inn.striker) || name === cleanName(inn.nonStriker);
      
      // Player is "Played" if they have stats, are batting now, or are in the batting order
      const hasBatted = (inn.battingOrder && inn.battingOrder.includes(name)) ||
                        (stats && (stats.balls > 0 || stats.out)) ||
                        isCurrent;

      if (hasBatted) playedBatsmen.push(name);
      else dnbBatsmen.push(name);
    });

    // Sort played batsmen by batting order
    playedBatsmen.sort((a, b) => {
      const order = (inn.battingOrder || []).map(cleanName);
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return 0;
    });

    // --- 3. PROCESS BOWLERS ---
    const activeBowlers = [];
    const dnbBowlers = [];

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

      if (isCurrent || (s && (s.balls > 0 || s.runs > 0 || s.wickets > 0))) {
        activeBowlers.push(name);
      } else {
        dnbBowlers.push(name);
      }
    });

    // --- 4. CALCULATIONS ---
    const extras = inn.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
    const totalExtras = (extras.wides || 0) + (extras.noBalls || 0) + (extras.byes || 0) + (extras.legByes || 0);
    const totalBallsBowled = inn.over * 6 + inn.overBallCount;
    const crr = totalBallsBowled > 0 ? ((inn.score / totalBallsBowled) * 6).toFixed(2) : "0.00";

    return (
      <div key={`inn-${idx}`} className="bg-[#161920] border border-white/5 rounded-2xl overflow-hidden mb-3 shadow-lg">
        
        {/* INNINGS HEADER */}
        <div
          onClick={() => setOpenInningIndex(isOpen ? null : idx)}
          className={`px-5 py-4 flex justify-between items-center cursor-pointer transition-colors ${
            isOpen ? "bg-[#1C2128]" : "hover:bg-white/5"
          }`}>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <span className="text-slate-200 font-bold text-lg uppercase tracking-wide">
                {inn.battingTeam || `Innings ${idx + 1}`}
                </span>
                {isCurrentInnings && !isFinished && (
                <span className="text-[9px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse border border-red-500/20">
                    Live
                </span>
                )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-2xl font-bold text-slate-100">
                {inn.score}/{inn.wickets}
              </span>
              <span className="text-slate-500 text-xs ml-2 font-mono">
                ({inn.over}.{inn.overBallCount} Ov)
              </span>
            </div>
            <span className={`text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
              ▼
            </span>
          </div>
        </div>

        {/* DETAILS CONTENT */}
        {isOpen && (
          <div className="bg-[#0F1115] border-t border-white/5 animate-in slide-in-from-top-2">
            
            {/* --- BATTING TABLE --- */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1C2128] text-slate-500 text-[10px] uppercase font-bold border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 w-1/2">Batter</th>
                    <th className="px-2 py-3 text-right">R</th>
                    <th className="px-2 py-3 text-right">B</th>
                    <th className="px-2 py-3 text-right hidden sm:table-cell">4s</th>
                    <th className="px-2 py-3 text-right hidden sm:table-cell">6s</th>
                    <th className="px-2 py-3 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {playedBatsmen.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-600 italic">Innings starting...</td></tr>
                  ) : (
                    playedBatsmen.map((name) => {
                      const stats = inn.batsmenStats?.[name] || { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
                      const isStriker = name === cleanName(inn.striker);
                      const isNon = name === cleanName(inn.nonStriker);
                      const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(0) : "0";
                      const isNotOut = isStriker || isNon;

                      return (
                        <tr key={name} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className={`font-semibold ${isNotOut ? "text-teal-400" : "text-slate-300"}`}>
                              {name} {isNotOut && "*"}
                            </div>
                            <div className="text-xs text-slate-500 font-medium mt-0.5 lowercase first-letter:uppercase">
                              {getDismissalText(stats, isStriker, isNon)}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right font-bold text-slate-200">{stats.runs}</td>
                          <td className="px-2 py-3 text-right text-slate-500">{stats.balls}</td>
                          <td className="px-2 py-3 text-right text-slate-600 hidden sm:table-cell">{stats.fours}</td>
                          <td className="px-2 py-3 text-right text-slate-600 hidden sm:table-cell">{stats.sixes}</td>
                          <td className="px-2 py-3 text-right text-slate-600 text-xs">{sr}</td>
                        </tr>
                      );
                    })
                  )}
                  {/* EXTRAS ROW */}
                  <tr className="bg-[#161920]/50 border-t border-white/5">
                    <td className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">Extras</td>
                    <td colSpan={5} className="px-4 py-2 text-right text-slate-300 font-mono text-xs">
                      {totalExtras} (wd {extras.wides}, nb {extras.noBalls}, b {extras.byes}, lb {extras.legByes})
                    </td>
                  </tr>
                  {/* TOTAL ROW */}
                  <tr className="bg-[#1C2128] border-t border-white/10 font-bold">
                    <td className="px-4 py-3 text-slate-200 uppercase text-sm">Total Score</td>
                    <td colSpan={5} className="px-4 py-3 text-right">
                      <span className="text-slate-100 text-base mr-2">{inn.score}/{inn.wickets}</span>
                      <span className="text-slate-500 text-xs font-mono">({inn.over}.{inn.overBallCount} Ov)</span>
                      <span className="text-slate-600 text-xs font-mono ml-3">CRR: {crr}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DNB BATTERS */}
            {dnbBatsmen.length > 0 && (
              <div className="px-4 py-3 border-t border-white/5 bg-[#0F1115]">
                <span className="text-[10px] font-bold text-slate-600 uppercase mr-2 tracking-wider">Yet to bat:</span>
                <span className="text-xs text-slate-500 italic">{dnbBatsmen.join(", ")}</span>
              </div>
            )}

            {/* --- BOWLING TABLE --- */}
            <div className="mt-2 border-t border-white/5">
              <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-[#161920]">
                Bowling
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-[#1C2128] text-slate-500 text-[10px] uppercase font-bold border-b border-white/5">
                  <tr>
                    <th className="px-4 py-2 w-1/2">Bowler</th>
                    <th className="px-2 py-2 text-right">O</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right text-slate-300">W</th>
                    <th className="px-2 py-2 text-right">Eco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeBowlers.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-600 italic">No bowlers yet</td></tr>
                  ) : (
                    activeBowlers.map((name) => {
                      const s = inn.bowlerStats?.[name] || { balls: 0, runs: 0, wickets: 0 };
                      const overs = Math.floor(s.balls / 6);
                      const balls = s.balls % 6;
                      const econ = s.balls > 0 ? (s.runs / (s.balls / 6)).toFixed(1) : "0.0";
                      const isCurrent = name === cleanName(inn.currentBowler);
                      return (
                        <tr key={name} className={isCurrent ? "bg-teal-900/10" : ""}>
                          <td className={`px-4 py-2 ${isCurrent ? "text-teal-400 font-bold" : "text-slate-300"}`}>
                            {name} {isCurrent && "🥎"}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-400">{overs}.{balls}</td>
                          <td className="px-2 py-2 text-right text-slate-400">{s.runs}</td>
                          <td className="px-2 py-2 text-right text-slate-200 font-bold">{s.wickets}</td>
                          <td className="px-2 py-2 text-right text-slate-600 text-xs">{econ}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* DNB BOWLERS */}
            {dnbBowlers.length > 0 && (
              <div className="px-4 py-3 border-t border-white/5 bg-[#0F1115]">
                <span className="text-[10px] font-bold text-slate-600 uppercase mr-2 tracking-wider">Bench:</span>
                <span className="text-xs text-slate-500 italic">{dnbBowlers.join(", ")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-3 max-w-2xl mx-auto pb-10">
      
      {/* MAN OF THE MATCH CARD (Finished Match) */}
      {isFinished && mom && (
        <div className="mb-2 bg-gradient-to-r from-amber-900/20 to-[#161920] border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏅</div>
            <div>
              <div className="text-[9px] text-amber-500 uppercase font-black tracking-[0.2em] mb-1">Player of the Match</div>
              <div className="text-xl font-bold text-slate-100">{cleanName(mom.name)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-slate-200">{mom.mvpScore}</div>
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">MVP Pts</div>
          </div>
        </div>
      )}

      {/* INNINGS LIST */}
      <div className="flex flex-col">
        {renderInnings(inns[0], 0)}
        {(inns[1] || isFinished || match.currentInnings === 1) && renderInnings(inns[1], 1)}
      </div>
    </div>
  );
};

export default React.memo(ScoreTable);