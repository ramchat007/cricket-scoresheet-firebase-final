// src/pages/MatchScorecard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { getMatch } from "../utils/firestore";
import { getManOfTheMatch } from "../utils/statsHelper";

export default function MatchScorecard() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mom = useMemo(() => getManOfTheMatch(match), [match]);

  useEffect(() => {
    async function fetch() {
      try {
        if (!tournamentId || !matchId) throw new Error("Missing IDs");
        const data = await getMatch(tournamentId, matchId);
        setMatch(data);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [tournamentId, matchId]);

  if (loading) return <div className="flex justify-center items-center min-h-screen bg-gray-950 text-cyan-500 animate-pulse font-bold tracking-widest uppercase">Loading Scorecard...</div>;
  if (error) return <div className="flex justify-center items-center min-h-screen bg-gray-950 text-red-500 font-bold">{error}</div>;
  if (!match) return null;

  // --- HELPER: STRICT NAME EXTRACTOR (SILVER BULLET) ---
  const cleanName = (p) => {
    if (!p) return "";
    // If it's an object, grab the name property
    if (typeof p === "object") {
        return p.name || p.playerName || ""; 
    }
    // If it's a string, return it
    return String(p).trim();
  };

  // --- HELPER: Dismissal Text ---
  const formatDismissal = (stats) => {
    if (!stats || !stats.out) return <span className="text-green-500/60 text-[10px] lowercase">not out</span>;
    const b = stats.bowler || "";
    const f = stats.fielder || "";
    const style = "text-gray-500 text-[11px] font-medium";
    switch (stats.wicketType) {
      case "bowled": return <span className={style}>b {b}</span>;
      case "caught": return <span className={style}>c {f} b {b}</span>;
      case "lbw": return <span className={style}>lbw b {b}</span>;
      case "runout": return <span className={style}>run out ({f})</span>;
      case "stumped": return <span className={style}>st {f} b {b}</span>;
      case "hitwicket": return <span className={style}>hit wicket b {b}</span>;
      default: return <span className={style}>{stats.wicketType || "out"}</span>;
    }
  };

  // --- INNING CARD COMPONENT ---
  const InningCard = ({ inningIndex, teamName }) => {
    const inning = match.innings?.[inningIndex];
    if (!inning) return null;

    // --- 1. DETERMINE SQUADS (Robust Fallback) ---
    let rawBattingSquad = inning.batsmenList;
    let rawBowlingSquad = inning.bowlersList;

    // Fallback to Meta Squads if inning list is empty
    if (!rawBattingSquad || rawBattingSquad.length === 0) {
        if (teamName === match.meta.teamA) rawBattingSquad = match.teamASquad;
        else rawBattingSquad = match.teamBSquad;
    }
    if (!rawBowlingSquad || rawBowlingSquad.length === 0) {
        if (teamName === match.meta.teamA) rawBowlingSquad = match.teamBSquad;
        else rawBowlingSquad = match.teamASquad;
    }

    // --- 2. PROCESS BATTING ---
    const playedBatsmen = [];
    const dnbBatsmen = [];

    // Combine all sources and IMMEDIATELY convert to Strings
    const allBattersRaw = [
        ...(rawBattingSquad || []),
        ...(inning.batsmenStats ? Object.keys(inning.batsmenStats) : []),
        inning.striker, 
        inning.nonStriker
    ];

    // Filter, Clean, and Deduplicate names
    const uniqueBatterNames = Array.from(new Set(
        allBattersRaw
            .map(cleanName) // Convert all to string names
            .filter(n => n && n !== "[object Object]" && n !== "Unknown") // Remove garbage
    ));

    uniqueBatterNames.forEach((name) => {
      const stats = inning.batsmenStats?.[name];
      const isStriker = name === cleanName(inning.striker);
      const isNonStriker = name === cleanName(inning.nonStriker);

      if ((stats && (stats.balls > 0 || stats.out)) || isStriker || isNonStriker) {
        playedBatsmen.push({ name, ...(stats || {}), isStriker, isNonStriker });
      } else {
        dnbBatsmen.push(name);
      }
    });

    // --- 3. PROCESS BOWLING ---
    const activeBowlers = [];
    const dnbBowlers = [];
    
    const allBowlersRaw = [
        ...(rawBowlingSquad || []),
        ...(inning.bowlerStats ? Object.keys(inning.bowlerStats) : [])
    ];

    const uniqueBowlerNames = Array.from(new Set(
        allBowlersRaw
            .map(cleanName)
            .filter(n => n && n !== "[object Object]" && n !== "Unknown")
    ));

    uniqueBowlerNames.forEach(name => {
        const stats = inning.bowlerStats?.[name];
        if (stats && stats.balls > 0) {
            activeBowlers.push({ name, ...stats });
        } else {
            dnbBowlers.push(name);
        }
    });

    // --- 4. SORT BOWLERS (Stable Sort) ---
    const bowlingOrder = inning.bowlingOrder || []; 
    
    activeBowlers.sort((a, b) => {
        // Priority 1: DB Appearance Order
        const idxA_Order = bowlingOrder.indexOf(a.name);
        const idxB_Order = bowlingOrder.indexOf(b.name);
        if (idxA_Order !== -1 && idxB_Order !== -1) return idxA_Order - idxB_Order;
        if (idxA_Order !== -1) return -1;
        if (idxB_Order !== -1) return 1;

        // Priority 2: Squad List Order
        const idxA_Squad = uniqueBowlerNames.indexOf(a.name);
        const idxB_Squad = uniqueBowlerNames.indexOf(b.name);
        if (idxA_Squad !== -1 && idxB_Squad !== -1) return idxA_Squad - idxB_Squad;

        // Priority 3: Alphabetical
        return a.name.localeCompare(b.name);
    });

    const extras = inning.extras || {};
    const totalExtras = (extras.wides || 0) + (extras.noBalls || 0) + (extras.byes || 0) + (extras.legByes || 0);

    // --- RENDER ---
    return (
      <div className="mb-8 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="bg-gray-800/80 p-4 border-b border-gray-700 flex justify-between items-center backdrop-blur-sm">
          <h5 className="text-lg font-bold text-white uppercase tracking-wider border-l-4 border-cyan-500 pl-3">
            {teamName} <span className="text-gray-500 text-sm font-normal normal-case ml-1">Innings</span>
          </h5>
          <div className="text-right">
            <span className="text-3xl font-black text-white font-mono tracking-tight">{inning.score}/{inning.wickets}</span>
            <span className="ml-2 text-sm text-gray-400 font-mono">({inning.over}.{inning.overBallCount} Ov)</span>
          </div>
        </div>

        {/* BATTING TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase font-bold tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 w-1/3">Batter</th>
                <th className="px-2 py-3 text-left">Dismissal</th>
                <th className="px-2 py-3 text-center">R</th>
                <th className="px-2 py-3 text-center text-gray-600">B</th>
                <th className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">4s</th>
                <th className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">6s</th>
                <th className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">SR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-gray-300">
              {playedBatsmen.length === 0 ? (
                 <tr><td colSpan="7" className="px-4 py-4 text-center text-gray-500 italic">Innings not started</td></tr>
              ) : (
                playedBatsmen.map((p, i) => {
                    const sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";
                    const isActive = p.isStriker || p.isNonStriker;
                    return (
                    <tr key={i} className={`transition-colors ${isActive ? "bg-cyan-900/10" : "hover:bg-gray-800/30"}`}>
                        <td className={`px-4 py-3 whitespace-nowrap border-l-2 ${isActive ? "border-cyan-500" : "border-transparent"}`}>
                        <span className={isActive ? "text-cyan-400 font-bold" : p.out ? "text-gray-400" : "text-gray-300 font-medium"}>
                            {p.name}
                        </span>
                        {p.isStriker && <span className="text-cyan-400 ml-1">*</span>}
                        </td>
                        <td className="px-2 py-3">{formatDismissal(p)}</td>
                        <td className="px-2 py-3 text-center font-bold text-white font-mono">{p.runs || 0}</td>
                        <td className="px-2 py-3 text-center text-gray-500 font-mono">{p.balls || 0}</td>
                        <td className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">{p.fours || 0}</td>
                        <td className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">{p.sixes || 0}</td>
                        <td className="px-2 py-3 text-center text-gray-600 font-mono text-sm hidden sm:table-cell">{sr}</td>
                    </tr>
                    );
                })
              )}
              {/* EXTRAS */}
              <tr className="bg-gray-800/30 border-t border-gray-700 font-bold text-gray-400">
                <td colSpan="2" className="px-4 py-3 text-sm uppercase tracking-widest">Extras</td>
                <td colSpan="5" className="px-4 py-3 text-sm">
                  <span className="text-white mr-2">{totalExtras}</span>
                  <span className="text-[10px] font-normal text-gray-500 lowercase">(b {extras.byes||0}, lb {extras.legByes||0}, w {extras.wides||0}, nb {extras.noBalls||0})</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* DID NOT BAT */}
        {dnbBatsmen.length > 0 && (
          <div className="bg-gray-950 px-4 py-3 border-t border-gray-800">
            <div className="flex flex-wrap gap-2 text-sm leading-relaxed">
              <span className="font-bold text-gray-500 uppercase tracking-wide text-[10px]">Did not bat:</span>
              {dnbBatsmen.map((player, idx) => (
                <span key={idx} className="text-gray-400 text-xs">
                    {player}
                    {idx < dnbBatsmen.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* BOWLING TABLE */}
        <div className="border-t-4 border-gray-900 mt-2">
          <div className="bg-gray-800/50 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800">Bowling</div>
          {activeBowlers.length === 0 ? (
             <div className="p-4 text-center text-gray-600 text-xs italic">No overs bowled yet.</div>
          ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase font-bold tracking-wider border-b border-gray-800">
                    <tr>
                    <th className="px-4 py-3 w-1/3">Bowler</th>
                    <th className="px-2 py-3 text-center">O</th>
                    <th className="px-2 py-3 text-center">M</th>
                    <th className="px-2 py-3 text-center">R</th>
                    <th className="px-2 py-3 text-center text-white">W</th>
                    <th className="px-2 py-3 text-center text-gray-600">Eco</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 text-gray-300">
                    {activeBowlers.map((b, i) => {
                    const overs = Math.floor(b.balls / 6) + "." + (b.balls % 6);
                    const economy = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : "0.00";
                    return (
                        <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400">{overs}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-500">{b.maidens || 0}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400">{b.runs}</td>
                        <td className="px-2 py-3 text-center font-bold text-white bg-red-900/10">{b.wickets}</td>
                        <td className="px-2 py-3 text-center font-mono text-gray-600 text-sm">{economy}</td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
          )}
        </div>

        {/* DID NOT BOWL */}
        {dnbBowlers.length > 0 && (
          <div className="bg-gray-950 px-4 py-3 border-t border-gray-800">
            <div className="flex flex-wrap gap-2 text-sm leading-relaxed">
              <span className="font-bold text-gray-500 uppercase tracking-wide text-[10px]">Did not bowl:</span>
              {dnbBowlers.map((player, idx) => (
                <span key={idx} className="text-gray-400 text-xs">
                    {player}
                    {idx < dnbBowlers.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    );
  };

  // --- MAIN RENDER ---
  const matchResult = match.result || match.meta?.result;
  const matchStatus = match.status || match.meta?.matchStatus || "live";
  const teamA = match.teamA || match.meta?.teamA;
  const teamB = match.teamB || match.meta?.teamB;
  const tossInfo = match.meta?.toss ? `${match.meta.toss.winner} chose to ${match.meta.toss.decision}` : "";

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 min-h-screen">
      <Link to={`/tournaments/${tournamentId}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-cyan-400 mb-6 transition-colors text-sm font-bold uppercase tracking-wider">
        <span>←</span> Back to Tournament
      </Link>

      <div className="mb-8 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 text-center">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">{match.date || "Date TBA"} • {match.meta?.tournament || "Match"}</div>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase mb-4 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">{teamA}</span>
            <span className="text-gray-600 mx-3 text-2xl align-middle">vs</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">{teamB}</span>
          </h1>
          <div className="inline-block">
            {matchStatus === "finished" ? (
              <div className="px-6 py-2 bg-green-900/30 border border-green-500/30 text-green-400 rounded-full font-bold uppercase text-sm tracking-wide shadow-[0_0_15px_rgba(34,197,94,0.1)]">🏆 {matchResult}</div>
            ) : (
              <div className="px-6 py-2 bg-red-900/30 border border-red-500/30 text-red-400 rounded-full font-bold uppercase text-sm tracking-wide animate-pulse">🔴 {matchStatus}</div>
            )}
          </div>
          {tossInfo && (
            <div className="mt-4 text-sm text-gray-400 border-t border-gray-800 pt-4 inline-block px-8">
              <span className="font-bold text-gray-500 uppercase text-sm mr-2">Toss:</span> {tossInfo}
            </div>
          )}
          {matchStatus === "finished" && mom && (
            <div className="mt-2 text-yellow-400 font-bold text-sm">🏅 Man of the Match: {mom.name} ({mom.mvpScore} pts)</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <InningCard inningIndex={0} teamName={teamA} />
        {match.innings?.[1] && <InningCard inningIndex={1} teamName={teamB} />}
      </div>
    </div>
  );
}