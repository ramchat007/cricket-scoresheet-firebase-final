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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-950 text-cyan-500 animate-pulse">
        <div className="text-xl font-bold tracking-widest uppercase">
          Loading Scorecard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-950 text-red-500">
        <div className="text-center p-8 border border-red-800 bg-red-900/10 rounded-xl">
          <h3 className="text-lg font-bold mb-2">Error Loading Match</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!match) return null;

  // --- HELPERS ---

  // Helper: Format Dismissal Text
  const formatDismissal = (stats) => {
    if (!stats || !stats.out)
      return (
        <span className="text-green-500/60 text-[10px] lowercase">not out</span>
      );

    const b = stats.bowler || "";
    const f = stats.fielder || "";
    const style = "text-gray-500 text-[11px] font-medium";

    switch (stats.wicketType) {
      case "bowled":
        return <span className={style}>b {b}</span>;
      case "caught":
        return (
          <span className={style}>
            c {f} b {b}
          </span>
        );
      case "lbw":
        return <span className={style}>lbw b {b}</span>;
      case "runout":
        return <span className={style}>run out ({f})</span>;
      case "stumped":
        return (
          <span className={style}>
            st {f} b {b}
          </span>
        );
      case "hitwicket":
        return <span className={style}>hit wicket b {b}</span>;
      default:
        return <span className={style}>{stats.wicketType || "out"}</span>;
    }
  };

  const getBowlersStats = (inning) => {
    if (!inning || !inning.bowlerStats) return [];
    return Object.entries(inning.bowlerStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .filter((b) => b.balls > 0);
  };

  // --- INNINGS CARD COMPONENT ---
  const InningCard = ({ inningIndex, teamName }) => {
    const inning = match.innings?.[inningIndex];
    if (!inning) return null;

    // 1. Separate Played vs DNB
    const fullSquad = inning.batsmenList || [];
    const playedBatsmen = [];
    const dnbList = [];

    // Fallback if squad list is empty (legacy data support)
    const playerList =
      fullSquad.length > 0
        ? fullSquad
        : [
            ...(inning.batsmenStats ? Object.keys(inning.batsmenStats) : []),
            inning.striker,
            inning.nonStriker,
          ].filter(Boolean);

    // De-duplicate
    const uniquePlayers = Array.from(new Set(playerList));

    uniquePlayers.forEach((name) => {
      const stats = inning.batsmenStats?.[name];
      const isStriker = name === inning.striker;
      const isNonStriker = name === inning.nonStriker;

      // A player is "Played" if:
      // 1. They have stats (runs/balls)
      // 2. OR they are OUT
      // 3. OR they are currently batting (Striker/NonStriker)
      if (
        (stats && (stats.balls > 0 || stats.out)) ||
        isStriker ||
        isNonStriker
      ) {
        playedBatsmen.push({ name, ...(stats || {}), isStriker, isNonStriker });
      } else {
        dnbList.push(name);
      }
    });

    const bowlers = getBowlersStats(inning);
    const extras = inning.extras || {};
    const totalExtras =
      (extras.wides || 0) +
      (extras.noBalls || 0) +
      (extras.byes || 0) +
      (extras.legByes || 0);

    return (
      <div className="mb-8 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="bg-gray-800/80 p-4 border-b border-gray-700 flex justify-between items-center backdrop-blur-sm">
          <h5 className="text-lg font-bold text-white uppercase tracking-wider border-l-4 border-cyan-500 pl-3">
            {teamName}{" "}
            <span className="text-gray-500 text-sm font-normal normal-case ml-1">
              Innings
            </span>
          </h5>
          <div className="text-right">
            <span className="text-3xl font-black text-white font-mono tracking-tight">
              {inning.score}/{inning.wickets}
            </span>
            <span className="ml-2 text-sm text-gray-400 font-mono">
              ({inning.over}.{inning.overBallCount} Ov)
            </span>
          </div>
        </div>

        {/* Batting Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-950 text-gray-500 text-[10px] uppercase font-bold tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 w-1/3">Batter</th>
                <th className="px-2 py-3 text-left">Dismissal</th>
                <th className="px-2 py-3 text-center">R</th>
                <th className="px-2 py-3 text-center text-gray-600">B</th>
                <th className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">
                  4s
                </th>
                <th className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">
                  6s
                </th>
                <th className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">
                  SR
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-gray-300">
              {playedBatsmen.map((p, i) => {
                const sr =
                  p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";

                // Highlight active batters
                const isActive = p.isStriker || p.isNonStriker;
                let rowClass = "hover:bg-gray-800/30 transition-colors";
                let nameClass = "text-gray-300 font-medium";

                if (isActive) {
                  rowClass += " bg-cyan-900/10";
                  nameClass = "text-cyan-400 font-bold";
                } else if (p.out) {
                  nameClass = "text-gray-400";
                }

                return (
                  <tr key={i} className={rowClass}>
                    <td
                      className={`px-4 py-3 whitespace-nowrap border-l-2 ${
                        isActive ? "border-cyan-500" : "border-transparent"
                      }`}>
                      <span className={nameClass}>{p.name}</span>
                      {p.isStriker && (
                        <span className="text-cyan-400 ml-1">*</span>
                      )}
                    </td>
                    <td className="px-2 py-3">{formatDismissal(p)}</td>
                    <td className="px-2 py-3 text-center font-bold text-white font-mono">
                      {p.runs || 0}
                    </td>
                    <td className="px-2 py-3 text-center text-gray-500 font-mono">
                      {p.balls || 0}
                    </td>
                    <td className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">
                      {p.fours || 0}
                    </td>
                    <td className="px-2 py-3 text-center text-gray-600 hidden sm:table-cell">
                      {p.sixes || 0}
                    </td>
                    <td className="px-2 py-3 text-center text-gray-600 font-mono text-sm hidden sm:table-cell">
                      {sr}
                    </td>
                  </tr>
                );
              })}

              {/* Extras Row */}
              <tr className="bg-gray-800/30 border-t border-gray-700 font-bold text-gray-400">
                <td
                  colSpan="2"
                  className="px-4 py-3 text-sm uppercase tracking-widest">
                  Extras
                </td>
                <td colSpan="5" className="px-4 py-3 text-sm">
                  <span className="text-white mr-2">{totalExtras}</span>
                  <span className="text-[10px] font-normal text-gray-500 lowercase">
                    (b {extras.byes || 0}, lb {extras.legByes || 0}, w{" "}
                    {extras.wides || 0}, nb {extras.noBalls || 0})
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* --- DNB SECTION (Did Not Bat) --- */}
        {dnbList.length > 0 && (
          <div className="bg-gray-950 px-4 py-3 border-t border-gray-800">
            <div className="flex flex-wrap gap-2 text-sm leading-relaxed">
              <span className="font-bold text-gray-500 uppercase tracking-wide">
                Did not bat:
              </span>
              {dnbList.map((player, idx) => (
                <span key={idx} className="text-gray-400">
                  {player}
                  {idx < dnbList.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bowling Table */}
        {bowlers.length > 0 && (
          <div className="border-t-2 border-gray-800">
            <div className="bg-gray-950/50 px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
              Bowling
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-900 text-gray-500 text-[10px] uppercase font-bold tracking-wider border-b border-gray-800">
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
                  {bowlers.map((b, i) => {
                    const overs = Math.floor(b.balls / 6) + (b.balls % 6) / 10;
                    const economy =
                      b.balls > 0
                        ? ((b.runs / b.balls) * 6).toFixed(2)
                        : "0.00";
                    return (
                      <tr
                        key={i}
                        className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">
                          {b.name}
                        </td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400">
                          {overs}
                        </td>
                        <td className="px-2 py-3 text-center font-mono text-gray-500">
                          0
                        </td>
                        <td className="px-2 py-3 text-center font-mono text-gray-400">
                          {b.runs}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-white bg-red-900/10">
                          {b.wickets}
                        </td>
                        <td className="px-2 py-3 text-center font-mono text-gray-600 text-sm">
                          {economy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
  const tossInfo = match.meta?.toss
    ? `${match.meta.toss.winner} chose to ${match.meta.toss.decision}`
    : "";

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 min-h-screen">
      <Link
        to={`/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-cyan-400 mb-6 transition-colors text-sm font-bold uppercase tracking-wider">
        <span>←</span> Back to Tournament
      </Link>

      {/* Hero Header */}
      <div className="mb-8 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="relative z-10 text-center">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
            {match.date || "Date TBA"} • {match.meta?.tournament || "Match"}
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white uppercase mb-4 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">
              {teamA}
            </span>
            <span className="text-gray-600 mx-3 text-2xl align-middle">vs</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">
              {teamB}
            </span>
          </h1>

          <div className="inline-block">
            {matchStatus === "finished" ? (
              <div className="px-6 py-2 bg-green-900/30 border border-green-500/30 text-green-400 rounded-full font-bold uppercase text-sm tracking-wide shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                🏆 {matchResult}
              </div>
            ) : (
              <div className="px-6 py-2 bg-red-900/30 border border-red-500/30 text-red-400 rounded-full font-bold uppercase text-sm tracking-wide animate-pulse">
                🔴 {matchStatus}
              </div>
            )}
          </div>

          {tossInfo && (
            <div className="mt-4 text-sm text-gray-400 border-t border-gray-800 pt-4 inline-block px-8">
              <span className="font-bold text-gray-500 uppercase text-sm mr-2">
                Toss:
              </span>{" "}
              {tossInfo}
            </div>
          )}

          {matchStatus === "finished" && mom && (
            <div className="mt-2 text-yellow-400 font-bold text-sm">
              🏅 Man of the Match: {mom.name} ({mom.mvpScore} pts)
            </div>
          )}
        </div>
      </div>

      {/* Innings Grid */}
      <div className="grid grid-cols-1 gap-6">
        <InningCard inningIndex={0} teamName={teamA} />
        {match.innings?.[1] && <InningCard inningIndex={1} teamName={teamB} />}
      </div>
    </div>
  );
}
