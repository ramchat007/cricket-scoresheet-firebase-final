import React from "react";
import { Star, Award, Trophy, Target, Info } from "lucide-react";
import { getManOfTheMatch } from "../../utils/statsHelper";

export default function BroadcastSummaryCard({ tournamentName, match, type }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  if (!match) return null;

  const isMatchActuallyFinished =
    match.status === "completed" ||
    match?.meta?.matchStatus === "finished" ||
    match?.result;
  const isResult =
    type === "RESULT" || type === "RESULT_CARD" || isMatchActuallyFinished;
  const isToss = type === "TOSS";
  const isInningsBreak = type === "INNINGS_BREAK";
  const isWicket = type === "WICKET";
  const isSummary = type === "SUMMARY" || type === "SUMMARY_CARD";

  const momWinningTeamOnly = match.meta?.compulsoryWinningTeamMOM !== false;
  const mvp = isResult
    ? getManOfTheMatch(
        match,
        isMatchActuallyFinished ? momWinningTeamOnly : false,
      )
    : null;

  const TV_CARD_BASE =
    "bg-[#0B1120] text-white shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden rounded-2xl border border-white/10 flex flex-col animate-in fade-in zoom-in-95 duration-500 drop-shadow-2xl";

  // --- LOGIC: NAME CLEANING & DISMISSALS ---
  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const getDismissalText = (stats, isStriker, isNonStriker) => {
    if (isStriker || isNonStriker) {
      return (
        <span className="font-black uppercase text-[10px] tracking-widest text-teal-400 drop-shadow-md">
          Not Out
        </span>
      );
    }
    if (!stats || !stats.out) return null;

    const b = stats.bowler || stats.bowlerName || "";
    const f = stats.fielderName || stats.fielder || stats.catchBy || "";
    const wType = String(stats.wicketType || "out")
      .toLowerCase()
      .replace(/\s+/g, "");
    const style =
      "font-bold text-xs uppercase tracking-wider text-slate-300 drop-shadow-sm";

    switch (wType) {
      case "bowled":
        return <span className={style}>B {b}</span>;
      case "caught":
      case "caughtbehind":
        return (
          <span className={style}>
            C {f} B {b}
          </span>
        );
      case "lbw":
        return <span className={style}>LBW B {b}</span>;
      case "runout":
        return <span className={style}>RUN OUT ({f})</span>;
      case "stumped":
        return (
          <span className={style}>
            ST {f} B {b}
          </span>
        );
      case "hitwicket":
        return <span className={style}>HIT WICKET B {b}</span>;
      case "retiredhurt":
        return (
          <span className="text-slate-400 italic text-xs font-bold uppercase">
            RETIRED HURT
          </span>
        );
      case "retiredout":
        return <span className={style}>RETIRED OUT</span>;
      default:
        return (
          <span className="text-slate-400 uppercase font-bold text-xs">
            {stats.wicketType || "OUT"}
          </span>
        );
    }
  };

  // --- LOGIC: SORTING PLAYERS BY APPEARANCE ---
  const timeline = currentInn?.timeline || [];

  const playedBatsmen = [];
  const addToPlayed = (name) => {
    const cName = cleanName(name);
    if (cName && !playedBatsmen.includes(cName)) playedBatsmen.push(cName);
  };
  if (currentInn?.batsmenList?.[0]) addToPlayed(currentInn.batsmenList[0]);
  if (currentInn?.batsmenList?.[1]) addToPlayed(currentInn.batsmenList[1]);
  timeline.forEach((ball) => {
    if (ball.batter) addToPlayed(ball.batter);
    if (ball.nextStriker) addToPlayed(ball.nextStriker);
  });
  const striker = cleanName(currentInn?.striker);
  const nonStriker = cleanName(currentInn?.nonStriker);
  addToPlayed(striker);
  addToPlayed(nonStriker);

  const playedBowlers = [];
  const addToBowl = (name) => {
    const cName = cleanName(name);
    if (cName && !playedBowlers.includes(cName)) playedBowlers.push(cName);
  };
  timeline.forEach((ball) => {
    if (ball.bowler) addToBowl(ball.bowler);
  });
  addToBowl(currentInn?.currentBowler);

  // --- MATCH INFO & THEME EXTRACTOR ---
  const totalOvers = Number(match.meta?.overs || 20);
  const totalBallsInInnings = totalOvers * 6;
  const score = currentInn?.score || 0;
  const wickets = currentInn?.wickets || 0;
  const ballsBowled =
    (currentInn?.over || 0) * 6 + (currentInn?.overBallCount || 0);
  const overs = `${currentInn?.over || 0}.${currentInn?.overBallCount || 0}`;
  const crr = ballsBowled > 0 ? ((score / ballsBowled) * 6).toFixed(2) : "0.00";
  let targetScore = 0;
  let rrr = "0.00";
  let targetSummary = "TARGET PENDING...";

  if (
    match.innings?.[0] &&
    (match.currentInnings === 1 || isResult || isInningsBreak)
  ) {
    targetScore = match.innings[0].score + 1;
    const ballsRemaining = totalBallsInInnings - ballsBowled;
    const runsNeeded = targetScore - score;
    if (ballsRemaining > 0)
      rrr = ((runsNeeded / ballsRemaining) * 6).toFixed(2);
    if (!isMatchActuallyFinished)
      targetSummary = `${match.innings[1]?.battingTeam || match.meta?.teamB || "Chasing Team"} needs ${runsNeeded} runs in ${totalOvers} overs`;
  }

  const teamAColor = match.meta?.teamAColor || "#0284c7";
  const teamBColor = match.meta?.teamBColor || "#e11d48";
  const battingTeamName = currentInn?.battingTeam;
  let battingColor = teamAColor;
  let bowlingColor = teamBColor;
  if (battingTeamName === match.meta?.teamB) {
    battingColor = teamBColor;
    bowlingColor = teamAColor;
  }

  const getTeamColor = (teamName) => {
    if (teamName === match.meta?.teamA) return teamAColor;
    if (teamName === match.meta?.teamB) return teamBColor;
    return "#14b8a6";
  };

  // ====================================================================
  // RENDER 1: THE GLOSSY TV SCORECARD (For Summary & Wicket)
  // ====================================================================
  if (isSummary || isWicket) {
    if (!currentInn) return null;
    const extras = currentInn.extras || {
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
    };
    const totalExtras =
      (extras.wides || 0) +
      (extras.noBalls || 0) +
      (extras.byes || 0) +
      (extras.legByes || 0);

    const isSecondInnings = match.currentInnings === 1;

    return (
      <div
        className={`w-[1300px] border-t-[12px] ${isWicket ? "border-rose-600" : "border-slate-400"} ${TV_CARD_BASE}`}
      >
        {/* GLOSSY HEADER */}
        <div
          className={`flex justify-between items-center px-10 py-5 bg-gradient-to-r ${isWicket ? "from-rose-900 via-rose-950 to-[#0B1120]" : "from-slate-800 via-slate-900 to-[#0B1120]"} border-b border-white/10 shadow-lg relative overflow-hidden`}
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <div className="flex flex-col z-10">
            <span
              className={`font-black italic uppercase tracking-[0.3em] text-sm drop-shadow-md ${isWicket ? "text-rose-400 animate-pulse" : "text-slate-400"}`}
            >
              {isWicket ? "Wicket Fallen" : "Match Summary"}
            </span>
            <span className="text-5xl font-black text-white drop-shadow-lg mt-1 uppercase tracking-tight">
              {currentInn.battingTeam}
            </span>
          </div>

          <div className="flex items-center gap-12 z-10">
            {isSecondInnings && targetScore > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-amber-500 font-black uppercase text-xs tracking-widest mb-1">
                  Target: {targetScore}
                </span>
                <span className="text-white font-bold text-sm bg-white/10 px-3 py-1 rounded border border-white/10">
                  Need {targetScore - score} from{" "}
                  {totalBallsInInnings - ballsBowled}
                </span>
              </div>
            )}
            <div className="text-right flex items-center gap-6">
              <div className="text-7xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] leading-none">
                {currentInn.score}
                <span className="text-5xl text-slate-300">
                  /{currentInn.wickets}
                </span>
              </div>
              <div className="flex flex-col items-start justify-center border-l-2 border-white/20 pl-6">
                <span className="text-3xl font-bold text-white leading-none">
                  {overs} <span className="text-lg text-slate-400">OV</span>
                </span>
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest mt-1">
                  CRR: {crr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GLOSSY BODY SPLIT */}
        <div className="flex h-[520px] bg-[#0B1120]">
          {/* BATTING HALF */}
          <div className="w-[55%] relative flex flex-col border-r border-white/10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-800/30 to-transparent">
            <div className="bg-black/40 px-6 py-2 flex justify-between items-center border-b border-white/10 shadow-inner">
              <span className="text-slate-400 font-black uppercase tracking-widest text-sm">
                Batting
              </span>
              <div className="flex gap-6 w-[220px] justify-end text-slate-500 font-black text-xs tracking-widest">
                <span className="w-12 text-center">R</span>
                <span className="w-12 text-center">B</span>
                <span className="w-12 text-center">4s</span>
                <span className="w-12 text-center">6s</span>
                <span className="w-16 text-center">SR</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {playedBatsmen.map((name) => {
                const stats = currentInn.batsmenStats?.[name] || {
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

                // Highlight the batsman who just got out if it's a wicket card
                const justGotOut =
                  isWicket &&
                  stats.out &&
                  timeline.length > 0 &&
                  timeline[timeline.length - 1].whoOut === name;

                let rowStyle = "bg-transparent border-l-4 border-transparent";
                if (isAtCrease)
                  rowStyle =
                    "bg-gradient-to-r from-teal-900/40 to-transparent border-l-4 border-teal-500";
                if (justGotOut)
                  rowStyle =
                    "bg-gradient-to-r from-rose-900/60 to-transparent border-l-4 border-rose-500";

                return (
                  <div
                    key={name}
                    className={`flex justify-between items-center px-6 py-4 border-b border-white/5 transition-all ${rowStyle}`}
                  >
                    <div className="flex flex-col flex-1 min-w-0 pr-4">
                      <div
                        className={`text-2xl font-black uppercase truncate drop-shadow-md ${isAtCrease ? "text-white" : justGotOut ? "text-rose-100" : stats.out ? "text-slate-500" : "text-slate-200"}`}
                      >
                        {name} {isS && <span className="text-teal-400">*</span>}
                      </div>
                      <div className="mt-1">
                        {getDismissalText(stats, isS, isNS)}
                      </div>
                    </div>
                    <div
                      className={`flex gap-6 w-[220px] justify-end font-mono text-xl font-bold shrink-0 ${isAtCrease ? "text-teal-100" : justGotOut ? "text-rose-200" : "text-slate-300"}`}
                    >
                      <span className="w-12 text-center text-white font-black text-2xl drop-shadow-lg">
                        {stats.runs}
                      </span>
                      <span className="w-12 text-center opacity-80">
                        {stats.balls}
                      </span>
                      <span className="w-12 text-center opacity-60">
                        {stats.fours}
                      </span>
                      <span className="w-12 text-center opacity-60">
                        {stats.sixes}
                      </span>
                      <span className="w-16 text-center text-lg opacity-80">
                        {sr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* EXTRAS FOOTER */}
            <div className="bg-black/60 px-6 py-3 border-t border-white/10 flex justify-between items-center mt-auto shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Extras
              </span>
              <span className="font-mono text-white text-lg font-bold">
                {totalExtras}{" "}
                <span className="text-xs text-slate-400 ml-2 tracking-wider">
                  (WD {extras.wides}, NB {extras.noBalls}, B {extras.byes}, LB{" "}
                  {extras.legByes})
                </span>
              </span>
            </div>
          </div>

          {/* BOWLING HALF */}
          <div className="w-[45%] relative flex flex-col bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800/30 to-transparent">
            <div className="bg-black/40 px-6 py-2 flex justify-between items-center border-b border-white/10 shadow-inner">
              <span className="text-slate-400 font-black uppercase tracking-widest text-sm">
                Bowling
              </span>
              <div className="flex gap-6 w-[200px] justify-end text-slate-500 font-black text-xs tracking-widest">
                <span className="w-12 text-center">O</span>
                <span className="w-12 text-center">M</span>
                <span className="w-12 text-center">R</span>
                <span className="w-12 text-center">W</span>
                <span className="w-16 text-center">ECO</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {playedBowlers.map((name) => {
                const s = currentInn.bowlerStats?.[name] || {
                  balls: 0,
                  runs: 0,
                  wickets: 0,
                  maidens: 0,
                };
                const isCurrent = name === cleanName(currentInn.currentBowler);
                const eco =
                  s.balls > 0 ? (s.runs / (s.balls / 6)).toFixed(1) : "0.0";

                return (
                  <div
                    key={name}
                    className={`flex justify-between items-center px-6 py-5 border-b border-white/5 transition-all ${isCurrent ? "bg-gradient-to-r from-transparent to-teal-900/40 border-r-4 border-teal-500" : "bg-transparent border-r-4 border-transparent"}`}
                  >
                    <div
                      className={`text-2xl font-black uppercase truncate flex-1 drop-shadow-md ${isCurrent ? "text-white" : "text-slate-300"}`}
                    >
                      {name}{" "}
                      {isCurrent && (
                        <span className="text-teal-400 text-lg ml-2">●</span>
                      )}
                    </div>
                    <div
                      className={`flex gap-6 w-[200px] justify-end font-mono text-xl font-bold shrink-0 ${isCurrent ? "text-teal-100" : "text-slate-300"}`}
                    >
                      <span className="w-12 text-center opacity-80">
                        {Math.floor(s.balls / 6)}.{s.balls % 6}
                      </span>
                      <span className="w-12 text-center opacity-60">
                        {s.maidens || 0}
                      </span>
                      <span className="w-12 text-center opacity-80">
                        {s.runs}
                      </span>
                      <span
                        className={`w-12 text-center text-2xl font-black drop-shadow-lg ${isCurrent ? "text-white" : s.wickets > 0 ? "text-amber-400" : "text-white"}`}
                      >
                        {s.wickets}
                      </span>
                      <span className="w-16 text-center text-lg opacity-80">
                        {eco}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // RENDER 2: THE BROADCAST TV CARDS (Toss, Break, Match Result)
  // ====================================================================

  const ScoreBlock = ({ inn, label }) => {
    if (!inn || inn.score === undefined)
      return (
        <div
          className={`flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl border border-slate-700 w-full relative overflow-hidden shadow-xl h-full opacity-60`}
        >
          <div className={`absolute top-0 w-full h-2 bg-slate-800`}></div>
          <span className="text-slate-500 font-black text-2xl uppercase tracking-widest">
            YET TO BAT
          </span>
        </div>
      );

    const topBatters = Object.entries(inn.batsmenStats || {})
      .sort((a, b) => b[1].runs - a[1].runs)
      .slice(0, 2);
    const blockTeamColor = getTeamColor(inn.battingTeam);

    return (
      <div
        className={`flex flex-col items-center p-6 bg-slate-900 rounded-xl border border-slate-700 w-full relative overflow-hidden shadow-xl h-full`}
      >
        <div
          className="absolute top-0 w-full h-2"
          style={{ backgroundColor: blockTeamColor }}
        ></div>
        <div className="absolute top-4 right-4 bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-400 rounded uppercase tracking-widest border border-slate-700">
          {label}
        </div>
        <h3
          className="font-black uppercase text-2xl mb-1 mt-4 text-center truncate w-full px-2"
          style={{ color: blockTeamColor }}
        >
          {inn.battingTeam || "Team"}
        </h3>
        <div className="text-6xl font-black text-white mb-4 leading-none drop-shadow-md">
          {inn.score}/{inn.wickets}
        </div>
        <div className="w-full border-t border-slate-700/50 pt-4 space-y-3 mt-auto">
          {topBatters.length > 0 ? (
            topBatters.map(([name, s]) => (
              <div
                key={name}
                className="flex justify-between items-center text-lg"
              >
                <span className="text-white font-bold uppercase truncate flex-1 pr-4">
                  {name}
                </span>
                <span
                  className="font-mono font-bold shrink-0"
                  style={{ color: blockTeamColor }}
                >
                  {s.runs} ({s.balls})
                </span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic text-center w-full">
              No batting data
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasTossData = Boolean(match.meta?.toss?.winner);

  return (
    <div className="w-[1400px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 font-sans animate-in fade-in zoom-in-95 duration-500 drop-shadow-2xl">
      <div className="relative flex flex-col border-b-4 border-slate-500">
        <div className="bg-slate-950 px-8 py-2 flex justify-between items-center border-b border-slate-800">
          <div className="flex gap-4 text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
            <span>{match.meta?.matchTitle || match.name || "MATCH"}</span>{" "}
            <span className="text-slate-700">•</span>{" "}
            <span>{tournamentName}</span>
          </div>
        </div>

        {/* TV Header Backgrounds */}
        <div
          className={`h-28 flex items-center justify-between px-10 relative overflow-hidden ${
            isResult
              ? "bg-emerald-900"
              : isToss
                ? "bg-indigo-900"
                : isInningsBreak
                  ? "bg-amber-900"
                  : "bg-slate-800"
          }`}
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="w-full text-center z-10">
            <span className="text-white font-black text-5xl uppercase italic tracking-wider drop-shadow-md">
              {isToss
                ? "TOSS REPORT"
                : isInningsBreak
                  ? "INNINGS BREAK"
                  : isMatchActuallyFinished
                    ? "MATCH RESULT"
                    : "MATCH SUMMARY"}
            </span>
          </div>
        </div>
      </div>

      {isResult ? (
        <div className="flex flex-col w-full bg-slate-900 p-8 justify-center gap-6">
          <div className="text-center w-full bg-slate-950 py-5 rounded-xl border border-white/5 shadow-inner">
            <span className="text-amber-500/50 text-xs font-black uppercase tracking-[0.3em] block mb-1">
              {isMatchActuallyFinished ? "Final Verdict" : "Live Match Status"}
            </span>
            <h2
              className={`text-5xl font-black uppercase tracking-wider leading-tight drop-shadow-[0_0_15px_rgba(52,211,153,0.3)] text-balance ${isMatchActuallyFinished ? "text-emerald-400" : "text-amber-400"}`}
            >
              {isMatchActuallyFinished
                ? match?.meta?.result || match?.result || "MATCH FINISHED"
                : "MATCH IN PROGRESS"}
            </h2>
          </div>

          <div className="flex gap-6 w-full items-stretch">
            {mvp ? (
              <div className="w-[450px] shrink-0 bg-gradient-to-br from-amber-900/30 to-slate-900 border-2 border-amber-500/40 rounded-xl p-6 flex flex-col items-center relative overflow-hidden shadow-[0_0_40px_rgba(251,191,36,0.15)]">
                <div className="absolute top-[-30px] right-[-30px] text-amber-500/10">
                  <Star size={160} />
                </div>
                <div className="flex items-center gap-2 text-amber-400 mb-4 font-black uppercase tracking-widest text-xs z-10 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/30">
                  <Award size={16} />{" "}
                  {isMatchActuallyFinished
                    ? "Player of the Match"
                    : "Current MVP Leader"}
                </div>
                <img
                  src={
                    mvp.photoURL ||
                    mvp.image ||
                    "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                  }
                  alt={mvp.name}
                  className="w-36 h-36 object-cover rounded-full border-[4px] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] z-10 mb-4 bg-white/5"
                />
                <h2 className="text-3xl font-black uppercase italic leading-none text-white drop-shadow-md text-center mb-1 z-10">
                  {mvp.name}
                </h2>
                <div className="text-amber-500 font-bold text-xs tracking-widest uppercase mb-5 z-10">
                  {mvp.team}
                </div>

                <div className="w-full grid grid-cols-2 gap-3 z-10 mt-auto">
                  {mvp.runs > 0 || mvp.balls > 0 ? (
                    <div className="bg-black/40 border border-white/10 p-3 rounded-lg flex flex-col items-center text-center shadow-inner">
                      <span className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-1">
                        Batting
                      </span>
                      <span className="text-3xl font-mono font-black text-white">
                        {mvp.runs}
                        <span className="text-sm text-slate-400 ml-1">
                          ({mvp.balls})
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                  {mvp.wickets > 0 || mvp.ballsBowled > 0 ? (
                    <div className="bg-black/40 border border-white/10 p-3 rounded-lg flex flex-col items-center text-center shadow-inner">
                      <span className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-1">
                        Bowling
                      </span>
                      <span className="text-3xl font-mono font-black text-white">
                        {mvp.wickets}-{mvp.runsConceded}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            ) : (
              <div className="w-[450px] shrink-0 bg-slate-800/50 border border-white/10 rounded-xl flex items-center justify-center text-white/30 font-black uppercase tracking-widest">
                Gathering Stats...
              </div>
            )}

            <div className="flex-1 flex gap-4">
              <ScoreBlock inn={match.innings?.[0]} label="1st INNINGS" />
              <ScoreBlock inn={match.innings?.[1]} label="2nd INNINGS" />
            </div>
          </div>
        </div>
      ) : isInningsBreak ? (
        <div className="flex items-center justify-center gap-6 h-[450px] p-10 w-full bg-slate-900">
          <ScoreBlock inn={match.innings?.[0]} label="1st INNINGS" />
          <div className="flex flex-col items-center justify-center min-w-[350px] px-4 text-center shrink-0">
            <span className="text-slate-500 text-sm font-black uppercase tracking-[0.3em] mb-1">
              Target
            </span>
            <span className="text-white text-8xl font-black mb-2 drop-shadow-lg">
              {targetScore > 0 ? targetScore : "-"}
            </span>
            {targetScore > 0 && (
              <>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-1 rounded-lg mb-4">
                  <span className="text-emerald-400 text-xl font-mono font-black uppercase">
                    RRR: {rrr}
                  </span>
                </div>
                <span className="text-slate-400 text-xs font-bold text-center tracking-wider uppercase leading-tight max-w-[200px]">
                  {targetSummary}
                </span>
              </>
            )}
          </div>
          <ScoreBlock inn={match.innings?.[1]} label="2nd INNINGS" />
        </div>
      ) : isToss ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-slate-900 p-12 space-y-8">
          {hasTossData ? (
            <>
              <div className="text-4xl text-slate-400 font-bold uppercase tracking-[0.2em] text-center flex flex-col gap-3">
                <span
                  className="font-black drop-shadow-md text-7xl"
                  style={{ color: getTeamColor(match.meta.toss.winner) }}
                >
                  {match.meta.toss.winner}
                </span>{" "}
                WON THE TOSS
              </div>
              <div className="text-5xl text-white font-black uppercase italic tracking-tighter text-center drop-shadow-2xl">
                ELECTED TO{" "}
                <span className="underline decoration-4 decoration-indigo-500 underline-offset-8">
                  {match.meta.toss.decision}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-6">
                <span className="text-white">
                  {match?.meta?.teamA || "TEAM 1"}
                </span>
                <span className="text-indigo-500/50 italic text-2xl">VS</span>
                <span className="text-white">
                  {match?.meta?.teamB || "TEAM 2"}
                </span>
              </div>
              <div className="text-7xl text-indigo-400 font-black uppercase italic tracking-tighter drop-shadow-lg animate-pulse">
                TOSS PENDING...
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
