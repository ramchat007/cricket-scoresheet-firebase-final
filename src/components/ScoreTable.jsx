import React, { useState, useEffect, useMemo } from "react";
import { getManOfTheMatch } from "../utils/statsHelper";
import { useTheme } from "../context/ThemeContext";
import { ChevronDown, Trophy } from "lucide-react";

const ScoreTable = ({ match }) => {
  const { theme, lightMode } = useTheme();
  const [openInningIndex, setOpenInningIndex] = useState(0);

  useEffect(() => {
    if (match?.currentInnings !== undefined) {
      setOpenInningIndex(match.currentInnings);
    }
  }, [match?.currentInnings]);

  if (!match)
    return (
      <div
        className={`text-center py-10 animate-pulse text-sm font-bold flex items-center justify-center h-40 ${theme.sub}`}>
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

  const totalOvers = match.meta?.overs;

  // --- 🛠️ 1. DISMISSAL TEXT (Theme Aware) ---
  const getDismissalText = (stats, isStriker, isNonStriker) => {
    if (isStriker || isNonStriker) {
      return (
        <span
          className={`font-bold uppercase text-[9px] ${lightMode ? "text-teal-600" : "text-teal-400"}`}>
          not out
        </span>
      );
    }

    // Relaxed check: just make sure they are actually marked as out
    if (!stats || !stats.out) return null;

    // Aggressively check all possible keys your input might be sending
    const b = stats.bowler || stats.bowlerName || "";
    const f = stats.fielderName || stats.fielder || stats.catchBy || "";

    // Normalize the type (removes spaces so "run out" becomes "runout" to match your cases)
    const type = String(stats.wicketType || "out")
      .toLowerCase()
      .replace(/\s+/g, "");
    const style = `font-medium lowercase ${lightMode ? "text-gray-500" : "text-slate-400"}`;

    switch (type) {
      case "bowled":
        return <span className={style}>b {b}</span>;
      case "caught":
      case "caughtbehind":
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
          <span className={`${theme.sub} italic text-[9px]`}>retired hurt</span>
        );
      case "retiredout":
        return <span className={style}>retired out</span>;
      default:
        return (
          <span className={`${theme.sub} capitalize`}>
            {stats.wicketType || "out"}
          </span>
        );
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

    // --- 4. STATS CALCULATIONS ---
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
        className={`border rounded-2xl overflow-hidden mb-4 shadow-lg transition-all ${
          theme.card
        } ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        {/* HEADER */}
        <div
          onClick={() => setOpenInningIndex(isOpen ? null : idx)}
          className={`px-4 py-4 flex justify-between items-center cursor-pointer transition-all ${
            isOpen
              ? lightMode
                ? "bg-gray-100"
                : "bg-[#252a33]"
              : lightMode
                ? "hover:bg-gray-50"
                : "hover:bg-white/5"
          }`}>
          <div className="flex items-center gap-3">
            <span
              className={`font-black text-lg tracking-tight uppercase ${theme.text}`}>
              {inn.battingTeam}
            </span>
            {isCurrentInnings && !isFinished && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase animate-pulse border ${
                  lightMode
                    ? "bg-red-100 text-red-600 border-red-200"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}>
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span
                className={`text-2xl font-black italic tracking-tighter ${theme.text}`}>
                {inn.score}/{inn.wickets}
              </span>
              <span className={`text-xs ml-2 font-mono ${theme.sub}`}>
                ({inn.over}.{inn.overBallCount} / {totalOvers} Ov)
              </span>
            </div>
            <ChevronDown
              size={20}
              className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${theme.sub}`}
            />
          </div>
        </div>

        {isOpen && (
          <div
            className={`border-t animate-in fade-in slide-in-from-top-2 ${lightMode ? "bg-white border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
            {/* BATTING TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead
                  className={`text-[10px] uppercase font-black border-b ${
                    lightMode
                      ? "bg-gray-50 text-gray-500 border-gray-200"
                      : "bg-[#1C2128]/50 text-slate-500 border-white/5"
                  }`}>
                  <tr>
                    <th className="px-4 py-3 w-1/2">Batter</th>
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
                <tbody
                  className={`divide-y text-sm ${lightMode ? "divide-gray-100" : "divide-white/5"}`}>
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
                            ? lightMode
                              ? "bg-teal-50"
                              : "bg-teal-500/[0.04]"
                            : lightMode
                              ? "hover:bg-gray-50"
                              : "hover:bg-white/[0.02]"
                        }>
                        <td className="px-4 py-4">
                          <div
                            className={`font-bold ${
                              isAtCrease
                                ? lightMode
                                  ? "text-teal-700"
                                  : "text-teal-400"
                                : theme.text
                            }`}>
                            {name} {isS && "*"}
                          </div>
                          <div className="mt-1">
                            {getDismissalText(stats, isS, isNS)}
                          </div>
                        </td>
                        <td
                          className={`px-2 py-4 text-right font-black ${theme.text}`}>
                          {stats.runs}
                        </td>
                        <td className={`px-2 py-4 text-right ${theme.sub}`}>
                          {stats.balls}
                        </td>
                        <td
                          className={`px-2 py-4 text-right hidden sm:table-cell ${theme.sub}`}>
                          {stats.fours}
                        </td>
                        <td
                          className={`px-2 py-4 text-right hidden sm:table-cell ${theme.sub}`}>
                          {stats.sixes}
                        </td>
                        <td
                          className={`px-2 py-4 text-right text-xs font-mono ${theme.sub}`}>
                          {sr}
                        </td>
                      </tr>
                    );
                  })}
                  {/* EXTRAS */}
                  <tr
                    className={`border-t ${lightMode ? "bg-gray-50/50 border-gray-100" : "bg-[#161920]/50 border-white/5"}`}>
                    <td
                      className={`px-4 py-2 text-[10px] font-bold uppercase ${theme.sub}`}>
                      Extras
                    </td>
                    <td
                      colSpan={5}
                      className={`px-4 py-2 text-right font-mono text-xs ${theme.text}`}>
                      {totalExtras} (wd {extras.wides}, nb {extras.noBalls}, b{" "}
                      {extras.byes}, lb {extras.legByes})
                    </td>
                  </tr>
                  {/* TOTAL */}
                  <tr
                    className={`border-t font-bold ${
                      lightMode
                        ? "bg-gray-100 border-gray-200"
                        : "bg-[#1C2128] border-white/10"
                    }`}>
                    <td className={`px-4 py-3 uppercase text-xs ${theme.text}`}>
                      Total Score
                    </td>
                    <td colSpan={5} className="px-4 py-3 text-right">
                      <span className={`text-base mr-2 ${theme.text}`}>
                        {inn.score}/{inn.wickets}
                      </span>
                      <span className={`text-xs font-mono ${theme.sub}`}>
                        ({inn.over}.{inn.overBallCount} / {totalOvers} Ov)
                      </span>
                      <span
                        className={`text-xs font-mono ml-3 ${lightMode ? "text-teal-600" : "text-teal-400/80"}`}>
                        CRR: {crr}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* YET TO BAT */}
            {dnbBatsmen.length > 0 && (
              <div
                className={`px-4 py-3 border-t ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                <span
                  className={`text-[9px] font-black uppercase mr-3 tracking-[0.2em] ${theme.sub}`}>
                  Yet to Bat:
                </span>
                <span
                  className={`text-xs font-medium italic ${lightMode ? "text-gray-600" : "text-slate-500"}`}>
                  {dnbBatsmen.join(", ")}
                </span>
              </div>
            )}

            {/* BOWLING TABLE */}
            <div
              className={`mt-2 border-t ${lightMode ? "border-gray-200" : "border-white/5"}`}>
              <div
                className={`px-4 py-2 text-[10px] font-black uppercase ${lightMode ? "text-gray-500 bg-gray-100" : "text-slate-600 bg-[#161920]"}`}>
                Bowling
              </div>
              <table className="w-full text-left">
                <thead
                  className={`text-[10px] uppercase font-black border-b ${
                    lightMode
                      ? "bg-gray-50 text-gray-500 border-gray-200"
                      : "bg-[#1C2128]/30 text-slate-500 border-white/5"
                  }`}>
                  <tr>
                    <th className="px-4 py-2 w-1/2">Bowler</th>
                    <th className="px-2 py-2 text-right">O</th>
                    <th className="px-2 py-2 text-right">R</th>
                    <th className="px-2 py-2 text-right">W</th>
                    <th className="px-2 py-2 text-right">Eco</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y text-sm ${lightMode ? "divide-gray-100" : "divide-white/5"}`}>
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
                            ? lightMode
                              ? "bg-teal-50"
                              : "bg-teal-500/[0.04]"
                            : lightMode
                              ? "hover:bg-gray-50"
                              : "hover:bg-white/[0.02]"
                        }>
                        <td
                          className={`px-4 py-3 font-bold ${
                            isCurrent
                              ? lightMode
                                ? "text-teal-700"
                                : "text-teal-400"
                              : theme.sub
                          }`}>
                          {name} {isCurrent && "🥎"}
                        </td>
                        <td
                          className={`px-2 py-3 text-right font-mono ${theme.sub}`}>
                          {Math.floor(s.balls / 6)}.{s.balls % 6}
                        </td>
                        <td
                          className={`px-2 py-3 text-right font-mono ${theme.sub}`}>
                          {s.runs}
                        </td>
                        <td
                          className={`px-2 py-3 text-right font-black ${
                            isCurrent
                              ? lightMode
                                ? "text-teal-700"
                                : "text-teal-400"
                              : theme.text
                          }`}>
                          {s.wickets}
                        </td>
                        <td
                          className={`px-2 py-3 text-right text-xs font-mono ${theme.sub}`}>
                          {eco}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* YET TO BOWL */}
            {dnbBowlers.length > 0 && (
              <div
                className={`px-4 py-3 border-t ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                <span
                  className={`text-[9px] font-black uppercase mr-3 tracking-[0.2em] ${theme.sub}`}>
                  Yet to Bowl:
                </span>
                <span
                  className={`text-xs font-medium italic ${lightMode ? "text-gray-600" : "text-slate-500"}`}>
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
        <div
          className={`border rounded-3xl p-6 flex items-center justify-between shadow-2xl ${
            lightMode
              ? "bg-gradient-to-br from-white to-orange-50 border-orange-200"
              : "bg-gradient-to-br from-[#1C2128] to-[#0F1115] border-amber-500/20"
          }`}>
          <div className="flex items-center gap-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border ${
                lightMode
                  ? "bg-orange-100 text-orange-600 border-orange-200"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              }`}>
              <Trophy size={32} />
            </div>
            <div>
              <div
                className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                  lightMode ? "text-orange-600" : "text-amber-500"
                }`}>
                Player of the Match
              </div>
              <div
                className={`text-2xl font-black italic uppercase ${theme.text}`}>
                {cleanName(mom.name)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl font-black tracking-tighter ${theme.text}`}>
              {mom.mvpScore}
            </div>
            <div
              className={`text-[10px] font-black uppercase mt-1 ${theme.sub}`}>
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
