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

  // --- 🛠️ 1. DISMISSAL TEXT (Standardized Color & Shorthand) ---
  const getDismissalText = (stats, isStriker, isNonStriker) => {
    if (isStriker || isNonStriker)
      return (
        <span className="text-teal-400 font-bold uppercase text-[9px]">
          not out
        </span>
      );
    if (!stats || !stats.out) return null;

    const b = stats.bowler || "";
    const f = stats.fielderName || stats.fielder || "";
    const type = stats.wicketType || "out";
    const style = "text-slate-400 font-medium lowercase";

    switch (type) {
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
      case "retiredhurt":
        return (
          <span className="text-slate-500 italic text-[9px]">retired hurt</span>
        );
      case "retiredout":
        return <span className={style}>retired out</span>;
      default:
        return <span className="text-slate-500 capitalize">{type}</span>;
    }
  };

  const renderInnings = (inn, idx) => {
    if (!inn) return null;

    const isOpen = openInningIndex === idx;
    const isCurrentInnings = match.currentInnings === idx;
    const timeline = inn.timeline || [];

    const norm = (t) => (t || "").trim().toLowerCase();
    const isTeamA = norm(inn.battingTeam) === norm(match.meta?.teamA);
    const battingSquad = isTeamA ? match.teamASquad : match.teamBSquad;
    const fieldingSquad = isTeamA ? match.teamBSquad : match.teamASquad;

    // --- 2. BATSMEN APPEARANCE ORDER LOGIC ---
    const playedBatsmen = [];
    const addToPlayed = (name) => {
      const cName = cleanName(name);
      if (cName && !playedBatsmen.includes(cName)) playedBatsmen.push(cName);
    };

    if (inn.batsmenList?.[0]) addToPlayed(inn.batsmenList[0]);
    if (inn.batsmenList?.[1]) addToPlayed(inn.batsmenList[1]);
    timeline.forEach((ball) => {
      if (ball.batter) addToPlayed(ball.batter);
      if (ball.nextStriker) addToPlayed(ball.nextStriker);
    });

    const striker = cleanName(inn.striker);
    const nonStriker = cleanName(inn.nonStriker);
    addToPlayed(striker);
    addToPlayed(nonStriker);

    const dnbBatsmen = (battingSquad || [])
      .map(cleanName)
      .filter((n) => n && !playedBatsmen.includes(n));

    // --- 3. BOWLER APPEARANCE ORDER LOGIC ---
    const playedBowlers = [];
    const addToBowl = (name) => {
      const cName = cleanName(name);
      if (cName && !playedBowlers.includes(cName)) playedBowlers.push(cName);
    };
    timeline.forEach((ball) => {
      if (ball.bowler) addToBowl(ball.bowler);
    });
    addToBowl(inn.currentBowler);

    const dnbBowlers = (fieldingSquad || [])
      .map(cleanName)
      .filter((n) => n && !playedBowlers.includes(n));

    // --- 4. STATS CALCULATIONS (Restored CRR & Extras) ---
    const extras = inn.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
    const totalExtras =
      (extras.wides || 0) +
      (extras.noBalls || 0) +
      (extras.byes || 0) +
      (extras.legByes || 0);
    const totalBalls = (inn.over || 0) * 6 + (inn.overBallCount || 0);
    const crr =
      totalBalls > 0 ? ((inn.score / totalBalls) * 6).toFixed(2) : "0.00";

    return (
      <div
        key={`inn-${idx}`}
        className="bg-[#161920] border border-white/5 rounded-2xl overflow-hidden mb-4 shadow-2xl">
        {/* HEADER */}
        <div
          onClick={() => setOpenInningIndex(isOpen ? null : idx)}
          className={`px-6 py-4 flex justify-between items-center cursor-pointer transition-all ${isOpen ? "bg-[#1C2128]" : "hover:bg-white/5"}`}>
          <div className="flex items-center gap-3">
            <span className="text-slate-200 font-black text-lg tracking-tight uppercase">
              {inn.battingTeam}
            </span>
            {isCurrentInnings && !isFinished && (
              <span className="bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase animate-pulse border border-red-500/20">
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-2xl font-black text-white italic tracking-tighter">
                {inn.score}/{inn.wickets}
              </span>
              <span className="text-slate-500 text-xs ml-2 font-mono">
                ({inn.over}.{inn.overBallCount} Ov)
              </span>
            </div>
            <span
              className={`text-slate-600 transition-transform duration-500 ${isOpen ? "rotate-180" : ""}`}>
              ▼
            </span>
          </div>
        </div>

        {isOpen && (
          <div className="bg-[#0F1115] border-t border-white/5 animate-in fade-in slide-in-from-top-2">
            {/* BATTING TABLE (Restored 4s, 6s) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1C2128]/50 text-slate-500 text-[10px] uppercase font-black border-b border-white/5">
                  <tr>
                    <th className="px-6 py-3 w-1/2">Batter</th>
                    <th className="px-2 py-3 text-right">R</th>
                    <th className="px-2 py-3 text-right">B</th>
                    <th className="px-2 py-3 text-right hidden sm:table-cell">
                      4s
                    </th>
                    <th className="px-2 py-3 text-right hidden sm:table-cell">
                      6s
                    </th>
                    <th className="px-2 py-3 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {playedBatsmen.map((name) => {
                    const stats = inn.batsmenStats?.[name] || {
                      runs: 0,
                      balls: 0,
                      fours: 0,
                      sixes: 0,
                      out: null,
                    };
                    const isS = name === striker;
                    const isNS = name === nonStriker;
                    const isAtCrease = isS || isNS;
                    const sr =
                      stats.balls > 0
                        ? ((stats.runs / stats.balls) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr
                        key={name}
                        className={
                          isAtCrease
                            ? "bg-teal-500/[0.04]"
                            : "hover:bg-white/[0.02]"
                        }>
                        <td className="px-6 py-4">
                          <div
                            className={`font-bold ${isAtCrease ? "text-teal-400" : "text-slate-300"}`}>
                            {name} {isS && "*"}
                          </div>
                          <div className="mt-1">
                            {getDismissalText(stats, isS, isNS)}
                          </div>
                        </td>
                        <td className="px-2 py-4 text-right font-black text-slate-100">
                          {stats.runs}
                        </td>
                        <td className="px-2 py-4 text-right text-slate-500">
                          {stats.balls}
                        </td>
                        <td className="px-2 py-4 text-right text-slate-600 hidden sm:table-cell">
                          {stats.fours}
                        </td>
                        <td className="px-2 py-4 text-right text-slate-600 hidden sm:table-cell">
                          {stats.sixes}
                        </td>
                        <td className="px-2 py-4 text-right text-slate-500 text-xs font-mono">
                          {sr}
                        </td>
                      </tr>
                    );
                  })}
                  {/* EXTRAS ROW (Restored) */}
                  <tr className="bg-[#161920]/50 border-t border-white/5">
                    <td className="px-6 py-2 text-[10px] font-bold text-slate-500 uppercase">
                      Extras
                    </td>
                    <td
                      colSpan={5}
                      className="px-6 py-2 text-right text-slate-300 font-mono text-xs">
                      {totalExtras} (wd {extras.wides}, nb {extras.noBalls}, b{" "}
                      {extras.byes}, lb {extras.legByes})
                    </td>
                  </tr>
                  {/* TOTAL ROW (Restored) */}
                  <tr className="bg-[#1C2128] border-t border-white/10 font-bold">
                    <td className="px-6 py-3 text-slate-200 uppercase text-xs">
                      Total Score
                    </td>
                    <td colSpan={5} className="px-6 py-3 text-right">
                      <span className="text-slate-100 text-base mr-2">
                        {inn.score}/{inn.wickets}
                      </span>
                      <span className="text-slate-500 text-xs font-mono">
                        ({inn.over}.{inn.overBallCount} Ov)
                      </span>
                      <span className="text-teal-500/80 text-xs font-mono ml-3">
                        CRR: {crr}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* YET TO BAT SECTION */}
            {dnbBatsmen.length > 0 && (
              <div className="px-6 py-3 border-t border-white/5 bg-black/20">
                <span className="text-[9px] font-black text-slate-600 uppercase mr-3 tracking-[0.2em]">
                  Yet to Bat:
                </span>
                <span className="text-xs text-slate-500 font-medium italic">
                  {dnbBatsmen.join(", ")}
                </span>
              </div>
            )}

            {/* BOWLING SECTION (Restored Appearance Order & Current Highlight) */}
            <div className="mt-2 border-t border-white/5">
              <div className="px-6 py-2 text-[10px] font-black text-slate-600 uppercase bg-[#161920]">
                Bowling
              </div>
              <table className="w-full text-left">
                <thead className="bg-[#1C2128]/30 text-slate-500 text-[10px] uppercase font-black border-b border-white/5">
                  <tr>
                    <th className="px-6 py-2 w-1/2">Bowler</th>
                    <th className="px-2 py-2 text-right">O</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right text-slate-300">W</th>
                    <th className="px-2 py-2 text-right">Eco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {playedBowlers.map((name) => {
                    const s = inn.bowlerStats?.[name] || {
                      balls: 0,
                      runs: 0,
                      wickets: 0,
                    };
                    const isCurrent = name === cleanName(inn.currentBowler);
                    const eco =
                      s.balls > 0 ? (s.runs / (s.balls / 6)).toFixed(1) : "0.0";
                    return (
                      <tr
                        key={name}
                        className={
                          isCurrent
                            ? "bg-teal-500/[0.04]"
                            : "hover:bg-white/[0.02]"
                        }>
                        <td
                          className={`px-6 py-3 font-bold ${isCurrent ? "text-teal-400" : "text-slate-400"}`}>
                          {name} {isCurrent && "🥎"}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-500 font-mono">
                          {Math.floor(s.balls / 6)}.{s.balls % 6}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-500 font-mono">
                          {s.runs}
                        </td>
                        <td
                          className={`px-2 py-3 text-right font-black ${isCurrent ? "text-teal-400" : "text-slate-100"}`}>
                          {s.wickets}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-600 text-xs font-mono">
                          {eco}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* YET TO BOWL SECTION */}
            {dnbBowlers.length > 0 && (
              <div className="px-6 py-3 border-t border-white/5 bg-black/20">
                <span className="text-[9px] font-black text-slate-600 uppercase mr-3 tracking-[0.2em]">
                  Yet to Bowl:
                </span>
                <span className="text-xs text-slate-500 font-medium italic">
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
    <div className="w-full flex flex-col gap-4 max-w-3xl mx-auto pb-20">
      {/* MAN OF THE MATCH CARD */}
      {isFinished && mom && (
        <div className="bg-gradient-to-br from-[#1C2128] to-[#0F1115] border border-amber-500/20 rounded-3xl p-6 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl border border-amber-500/20">
              🏅
            </div>
            <div>
              <div className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-1">
                Player of the Match
              </div>
              <div className="text-2xl font-black text-white italic uppercase">
                {cleanName(mom.name)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black text-white tracking-tighter">
              {mom.mvpScore}
            </div>
            <div className="text-[10px] text-slate-600 font-black uppercase mt-1">
              MVP Points
            </div>
          </div>
        </div>
      )}

      {/* INNINGS LIST */}
      <div className="flex flex-col">
        {inns.map((inn, idx) => renderInnings(inn, idx))}
      </div>
    </div>
  );
};

export default React.memo(ScoreTable);
