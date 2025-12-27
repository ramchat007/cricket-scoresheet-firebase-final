// src/components/ScoreTable.jsx
import React, { useMemo } from "react";
import { getManOfTheMatch } from "../utils/statsHelper";

const ScoreTable = ({ match, selectedTeamId = null, selectedInnings = null }) => {
  if (!match) return <div className="text-gray-500 text-center py-10">Loading Scorecard...</div>;

  const inns = Array.isArray(match.innings) ? match.innings : [];
  const mom = useMemo(() => getManOfTheMatch(match), [match]);
  const isFinished = match.status === "finished" || match.meta?.matchStatus === "finished";

  // --- HELPER: STRICT NAME EXTRACTOR ---
  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const formatDismissal = (stats, isStriker, isNonStriker) => {
    if (isStriker || isNonStriker) return <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Not Out</span>;
    if (!stats || !stats.out) return <span className="text-gray-600 text-[10px] uppercase">DNB</span>;

    const style = "text-gray-400 text-xs";
    const b = stats.bowler || "";
    const f = stats.fielder || "";
    
    switch (stats.wicketType) {
      case "bowled": return <span className={style}>b {b}</span>;
      case "caught": return <span className={style}>c {f} b {b}</span>;
      case "lbw": return <span className={style}>lbw b {b}</span>;
      case "runout": return <span className={style}>run out ({f})</span>;
      case "stumped": return <span className={style}>st {f} b {b}</span>;
      case "hitwicket": return <span className={style}>hit wicket b {b}</span>;
      default: return <span className={style}>{stats.wicketType || stats.out}</span>;
    }
  };

  const renderInnings = (inn, idx) => {
    if (!inn) return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 flex flex-col justify-center items-center opacity-60">
        <div className="text-sm text-gray-500 font-mono">Innings {idx + 1} Not Started</div>
      </div>
    );

    // --- 1. BATTING LOGIC ---
    const rawPool = [
      ...(inn.battingOrder || inn.batsmenList || []),
      ...(inn.batsmenStats ? Object.keys(inn.batsmenStats) : []),
      inn.striker,
      inn.nonStriker
    ];

    const uniqueBatters = Array.from(new Set(
      rawPool.map(cleanName).filter(n => n && n !== "Unknown" && n !== "[object Object]")
    ));

    const playedBatsmen = [];
    const dnbBatsmen = [];

    uniqueBatters.forEach((name) => {
      const stats = inn.batsmenStats?.[name];
      const isCurrent = name === cleanName(inn.striker) || name === cleanName(inn.nonStriker);

      if ((stats && (stats.balls > 0 || stats.out)) || isCurrent) {
        playedBatsmen.push(name);
      } else {
        dnbBatsmen.push(name);
      }
    });

    playedBatsmen.sort((a, b) => {
        const order = (inn.battingOrder || inn.batsmenList || []).map(cleanName);
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if(idxA !== -1 && idxB !== -1) return idxA - idxB;
        return 0; 
    });

    // --- 2. BOWLING LOGIC (UPDATED TO MATCH BATTING STYLE) ---
    const rawBowlers = [
        ...(inn.bowlersList || []),
        ...(inn.bowlerStats ? Object.keys(inn.bowlerStats) : [])
    ];
    
    const uniqueBowlers = Array.from(new Set(
        rawBowlers.map(cleanName).filter(n => n && n !== "Unknown" && n !== "[object Object]")
    ));

    const activeBowlers = [];
    const dnbBowlers = [];

    uniqueBowlers.forEach((name) => {
      const s = inn.bowlerStats?.[name];
      const isCurrent = name === cleanName(inn.currentBowler);
      
      // Condition: Is Currently Bowling OR Has bowled at least 1 ball
      if (isCurrent || (s && s.balls > 0)) {
        activeBowlers.push(name);
      } else {
        dnbBowlers.push(name);
      }
    });

    // Sort Active Bowlers by Appearance (or Squad Order)
    activeBowlers.sort((a, b) => {
        const order = (inn.bowlersList || []).map(cleanName); // Use squad list as implicit order
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if(idxA !== -1 && idxB !== -1) return idxA - idxB;
        return 0;
    });

    const highlight = (selectedTeamId && inn.battingTeam === selectedTeamId) || selectedInnings === idx;

    return (
      <div className={`bg-gray-900 border rounded-xl overflow-hidden flex flex-col shadow-xl mb-8 ${highlight ? "border-cyan-500/50 ring-1 ring-cyan-500/20" : "border-gray-800"}`} key={`inn-${idx}`}>
        
        {/* Innings Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-1 h-8 rounded-full ${idx === 0 ? "bg-cyan-500" : "bg-purple-500"}`}></div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-0.5">Innings {idx + 1}</span>
              <span className="text-lg md:text-xl font-bold text-white tracking-wide">{inn.battingTeam}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-white leading-none tracking-tight">{inn.score}/{inn.wickets}</span>
            <span className="text-sm text-gray-400 font-mono ml-2 block sm:inline opacity-80">({inn.over}.{inn.overBallCount} ov)</span>
          </div>
        </div>

        {/* Batting Table */}
        <div className="flex-1 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-950/50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 w-[35%] min-w-[140px]">Batter</th>
                  <th className="px-2 py-3 text-left w-[25%] min-w-[120px]">Dismissal</th>
                  <th className="px-2 py-3 text-center min-w-[40px]">R</th>
                  <th className="px-2 py-3 text-center min-w-[40px]">B</th>
                  <th className="px-2 py-3 text-center hidden sm:table-cell min-w-[40px]">4s</th>
                  <th className="px-2 py-3 text-center hidden sm:table-cell min-w-[40px]">6s</th>
                  <th className="px-2 py-3 text-center hidden sm:table-cell min-w-[50px]">SR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {playedBatsmen.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 italic">Innings starting...</td></tr>
                ) : (
                  playedBatsmen.map((name) => {
                    const stats = inn.batsmenStats?.[name] || { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
                    const isStriker = name === cleanName(inn.striker);
                    const isNon = name === cleanName(inn.nonStriker);
                    const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : "0.0";
                    
                    let rowClass = "group hover:bg-white/5 transition-colors";
                    let nameClass = "text-gray-300 font-medium text-sm";
                    if (stats.out) nameClass = "text-gray-500";
                    if (isStriker) {
                      rowClass += " bg-gradient-to-r from-cyan-900/10 to-transparent border-l-2 border-cyan-500";
                      nameClass = "text-white font-bold";
                    } else if (isNon) {
                      rowClass += " bg-gray-800/30 border-l-2 border-gray-600";
                      nameClass = "text-gray-200 font-bold";
                    }

                    return (
                      <tr key={`bat-${name}`} className={rowClass}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={nameClass}>{name}</span>
                          {isStriker && <span className="text-cyan-400 ml-2 text-[10px] align-top animate-pulse">★</span>}
                        </td>
                        <td className="px-2 py-3 text-left">{formatDismissal(stats, isStriker, isNon)}</td>
                        <td className="px-2 py-3 text-center font-bold text-white text-base">{stats.runs}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400 text-xs">{stats.balls}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-500 hidden sm:table-cell text-xs">{stats.fours}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-500 hidden sm:table-cell text-xs">{stats.sixes}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-500 hidden sm:table-cell text-xs">{sr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* DNB Batsmen */}
          {dnbBatsmen.length > 0 && (
            <div className="bg-gray-950/30 px-4 py-3 border-t border-gray-800 text-[11px] flex gap-2 overflow-x-auto">
              <span className="font-bold text-gray-600 uppercase whitespace-nowrap shrink-0">Yet to Bat:</span>
              <span className="text-gray-500">{dnbBatsmen.join(", ")}</span>
            </div>
          )}

          {/* Bowling Table */}
          <div className="bg-gray-950/20 border-t border-gray-800 mt-auto">
            <div className="px-4 py-2 text-[10px] font-bold text-cyan-600 uppercase tracking-widest border-b border-gray-800 bg-gray-900/40">Bowling</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-gray-500 text-[10px] uppercase font-bold border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-2 w-[40%]">Bowler</th>
                    <th className="px-2 py-2 text-center">O</th>
                    <th className="px-2 py-2 text-center">M</th>
                    <th className="px-2 py-2 text-center">R</th>
                    <th className="px-2 py-2 text-center">W</th>
                    <th className="px-2 py-2 text-center hidden sm:table-cell">Eco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {activeBowlers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-600 italic">No bowling stats</td></tr>
                  ) : (
                    activeBowlers.map((b) => {
                      const s = inn.bowlerStats?.[b] || { balls: 0, runs: 0, wickets: 0 };
                      const overStr = `${Math.floor(s.balls / 6)}.${s.balls % 6}`;
                      const econ = s.balls > 0 ? (s.runs / (s.balls / 6)).toFixed(1) : "0.0";
                      const isCurrent = b === cleanName(inn.currentBowler);
                      return (
                        <tr key={`bowl-${b}`} className={isCurrent ? "bg-green-900/10 border-l-2 border-green-500" : "hover:bg-white/5 transition-colors"}>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={isCurrent ? "text-white font-bold" : "text-gray-300 text-sm"}>
                              {b} {isCurrent && <span className="text-[10px] text-green-400 ml-1">●</span>}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center font-mono text-white font-medium">{overStr}</td>
                          <td className="px-2 py-2.5 text-center font-mono text-gray-500 text-xs">0</td>
                          <td className="px-2 py-2.5 text-center font-mono text-gray-400">{s.runs}</td>
                          <td className="px-2 py-2.5 text-center font-mono font-bold text-white">{s.wickets}</td>
                          <td className="px-2 py-2.5 text-center font-mono text-gray-500 hidden sm:table-cell text-xs">{econ}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DNB Bowlers (Optional - shows rest of squad who haven't bowled) */}
          {dnbBowlers.length > 0 && (
            <div className="bg-gray-950/30 px-4 py-3 border-t border-gray-800 text-[11px] flex gap-2 overflow-x-auto">
              <span className="font-bold text-gray-600 uppercase whitespace-nowrap shrink-0">Yet to Bowl:</span>
              <span className="text-gray-500">{dnbBowlers.join(", ")}</span>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col">
      {isFinished && mom && (
        <div className="mb-8 bg-gradient-to-r from-yellow-900/40 via-gray-900 to-gray-900 border border-yellow-500/30 rounded-xl p-5 flex items-center justify-between shadow-lg shadow-yellow-900/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 blur-3xl rounded-full"></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center text-3xl border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]">🏅</div>
            <div>
              <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">Man of the Match</div>
              <div className="text-2xl font-bold text-white">{cleanName(mom.name)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{mom.team}</div>
            </div>
          </div>
          <div className="text-right relative z-10">
            <div className="text-4xl font-black text-white font-mono tracking-tighter drop-shadow-md">{mom.mvpScore}</div>
            <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">MVP Points</div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6 w-full">
        {renderInnings(inns[0] || null, 0)}
        {(inns[1] || isFinished) && renderInnings(inns[1] || null, 1)}
      </div>
    </div>
  );
};

export default React.memo(ScoreTable);