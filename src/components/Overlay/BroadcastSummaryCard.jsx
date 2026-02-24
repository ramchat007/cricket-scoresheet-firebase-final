import React from "react";

export default function BroadcastSummaryCard({ tournamentName, match, type }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  // 🔥 FIX 1: Removed strict early return so manual cards always render something!
  if (!match) return null;

  const isResult =
    type === "RESULT" ||
    match.status === "completed" ||
    match?.meta?.matchStatus === "finished";
  const isToss = type === "TOSS";
  const isInningsBreak = type === "INNINGS_BREAK";
  const isSecondInnings = match.currentInnings === 1;

  // --- 1. APPEARANCE-BASED SORTING (Safe Fallbacks Added) ---
  const timeline = currentInn?.timeline || [];

  const batsmenByAppearance = Object.keys(currentInn?.batsmenStats || {}).sort(
    (a, b) => {
      const firstBallA = timeline.findIndex(
        (ball) => ball.striker === a || ball.nonStriker === a,
      );
      const firstBallB = timeline.findIndex(
        (ball) => ball.striker === b || ball.nonStriker === b,
      );
      if (firstBallA === -1 && firstBallB === -1) return 0;
      if (firstBallA === -1) return 1;
      if (firstBallB === -1) return -1;
      return firstBallA - firstBallB;
    },
  );

  const bowlersByAppearance = Object.keys(currentInn?.bowlerStats || {}).sort(
    (a, b) => {
      const firstBallA = timeline.findIndex((ball) => ball.bowler === a);
      const firstBallB = timeline.findIndex((ball) => ball.bowler === b);
      if (firstBallA === -1 && firstBallB === -1) return 0;
      if (firstBallA === -1) return 1;
      if (firstBallB === -1) return -1;
      return firstBallA - firstBallB;
    },
  );

  // --- 2. MATCH INFO & TARGET LOGIC ---
  const score = currentInn?.score || 0;
  const wickets = currentInn?.wickets || 0;
  const totalOvers = Number(match.meta?.overs || 20);
  const totalBallsInInnings = totalOvers * 6;
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

    if (ballsRemaining > 0) {
      rrr = ((runsNeeded / ballsRemaining) * 6).toFixed(2);
    }

    // Only show "needs X runs" if the match isn't over
    if (!isResult) {
      targetSummary = `${match.innings[1]?.battingTeam || match.meta?.teamB || "Chasing Team"} needs ${runsNeeded} runs in ${totalOvers} overs`;
    }
  }

  // --- 3. THEME CONFIG ---
  let mainTheme = {
    bg: "bg-slate-900",
    headerGradient: "bg-slate-800",
    headerBorder: "border-b-4 border-teal-500",
    accentColor: "text-teal-400",
    activeRow: "bg-teal-500/10 border-l-4 border-teal-500",
    statusText: currentInn
      ? `END OF OVER ${currentInn?.over || 0}`
      : "MATCH PREVIEW",
  };

  if (type === "WICKET") {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-rose-900",
      headerBorder: "border-b-4 border-rose-500",
      accentColor: "text-rose-400",
      statusText: "WICKET FALLEN",
    };
  } else if (isResult) {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-amber-900",
      headerBorder: "border-b-4 border-amber-500",
      accentColor: "text-amber-400",
      statusText: "MATCH RESULT",
    };
  } else if (isToss) {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-indigo-900",
      headerBorder: "border-b-4 border-indigo-500",
      accentColor: "text-indigo-400",
      statusText: "TOSS UPDATE",
    };
  } else if (isInningsBreak) {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-emerald-900",
      headerBorder: "border-b-4 border-emerald-500",
      accentColor: "text-emerald-400",
      statusText: "INNINGS BREAK",
    };
  }

  const ScoreBlock = ({ inn, label }) => {
    if (!inn || inn.score === undefined)
      return (
        <div
          className={`flex flex-col items-center justify-center p-6 ${mainTheme.bg} rounded-xl border border-slate-700 w-full relative overflow-hidden shadow-xl h-full opacity-60`}>
          <div
            className={`absolute top-0 w-full h-2 ${mainTheme.headerGradient}`}></div>
          <span className="text-slate-500 font-black text-2xl uppercase tracking-widest">
            YET TO BAT
          </span>
        </div>
      );

    const topBatters = Object.entries(inn.batsmenStats || {})
      .sort((a, b) => b[1].runs - a[1].runs)
      .slice(0, 2);

    return (
      <div
        className={`flex flex-col items-center p-6 ${mainTheme.bg} rounded-xl border border-slate-700 w-full relative overflow-hidden shadow-xl`}>
        <div
          className={`absolute top-0 w-full h-2 ${mainTheme.headerGradient}`}></div>
        <div className="absolute top-4 right-4 bg-slate-800 px-3 py-1 text-[10px] font-black text-slate-400 rounded uppercase tracking-widest border border-slate-700">
          {label}
        </div>
        <h3
          className={`${mainTheme.accentColor} font-black uppercase text-2xl mb-1 mt-4 text-center truncate w-full px-2`}>
          {inn.battingTeam || "Team"}
        </h3>
        <div className="text-6xl font-black text-white mb-4 leading-none">
          {inn.score}/{inn.wickets}
        </div>
        <div className="w-full border-t border-slate-700/50 pt-4 space-y-3">
          {topBatters.length > 0 ? (
            topBatters.map(([name, s]) => (
              <div
                key={name}
                className="flex justify-between items-center text-lg">
                <span className="text-white font-bold uppercase truncate w-32">
                  {name}
                </span>
                <span
                  className={`${mainTheme.accentColor} font-mono font-bold`}>
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

  // 🔥 FIX 2: Check if toss actually exists!
  const hasTossData = Boolean(match.meta?.toss?.winner);

  return (
    <div
      className={`w-[1400px] ${mainTheme.bg} rounded-2xl overflow-hidden shadow-2xl border border-slate-700 font-sans`}>
      <div className={`relative flex flex-col ${mainTheme.headerBorder}`}>
        <div className="bg-slate-950 px-8 py-2 flex justify-between items-center border-b border-slate-800">
          <div className="flex gap-4 text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
            <span>{match.name || "MATCH"}</span>{" "}
            <span className="text-slate-700">•</span>{" "}
            <span>{tournamentName}</span>
          </div>
          <div
            className={`${mainTheme.accentColor} font-black uppercase tracking-widest text-sm animate-pulse`}>
            {mainTheme.statusText}
          </div>
        </div>

        <div
          className={`${mainTheme.headerGradient} h-28 flex items-center justify-between px-10 relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

          {isToss ? (
            <div className="w-full text-center z-10">
              <span className="text-white font-black text-5xl uppercase italic tracking-wider">
                TOSS REPORT
              </span>
            </div>
          ) : isResult || isInningsBreak ? (
            <div className="w-full text-center z-10">
              <span className="text-white font-black text-5xl uppercase italic tracking-wider">
                {isInningsBreak ? "INNINGS BREAK" : "MATCH RESULT"}
              </span>
            </div>
          ) : (
            <>
              {/* DEFAULT MATCH HEADER */}
              <div className="flex flex-col z-10 w-1/3">
                <span className="text-white font-black text-5xl uppercase leading-none truncate pr-4">
                  {currentInn?.battingTeam || match?.meta?.teamA || "TEAM 1"}
                </span>
              </div>
              <div className="z-10 flex flex-col items-center w-1/3">
                <div className="text-7xl font-black text-white leading-none">
                  {score}/{wickets}
                </div>
                {isSecondInnings && targetScore > 0 && (
                  <div className="bg-slate-900/50 px-3 py-1 rounded text-amber-400 font-bold text-sm tracking-widest mt-1 border border-white/5 uppercase">
                    Need {targetScore - score} off{" "}
                    {totalBallsInInnings - ballsBowled}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end z-10 text-right w-1/3">
                <span className="text-white font-mono font-black text-2xl uppercase leading-none truncate pl-4">
                  {currentInn?.bowlingTeam || match?.meta?.teamB || "TEAM 2"}
                </span>
                <span className="text-slate-300 font-mono font-bold text-4xl leading-none">
                  {overs} <span className="text-lg text-slate-500">OV</span>
                </span>
                <span
                  className={`${mainTheme.accentColor} font-bold text-sm tracking-widest mt-1`}>
                  CRR {crr}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BODY CONTENT */}
      {isResult || isInningsBreak ? (
        <div className="flex items-center justify-center gap-6 h-[450px] p-10 w-full bg-slate-900">
          <ScoreBlock inn={match.innings?.[0]} label="1st INNINGS" />

          {/* CENTER INFO BLOCK */}
          <div className="flex flex-col items-center justify-center min-w-[350px] px-4 text-center">
            {isInningsBreak ? (
              <>
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
              </>
            ) : (
              // 🔥 FIX 3: Actual Match Result Text inside the middle block instead of just "VS"
              <>
                <span className="text-amber-500/50 text-sm font-black uppercase tracking-[0.3em] mb-2">
                  Final Verdict
                </span>
                <span className="text-white text-3xl font-black uppercase tracking-wider leading-tight drop-shadow-lg text-balance">
                  {match?.meta?.result || "MATCH IN PROGRESS"}
                </span>
              </>
            )}
          </div>

          <ScoreBlock inn={match.innings?.[1]} label="2nd INNINGS" />
        </div>
      ) : isToss ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-slate-900 p-12 space-y-8">
          {/* 🔥 FIX 4: Safe Toss Fallback */}
          {hasTossData ? (
            <>
              <div className="text-4xl text-slate-400 font-bold uppercase tracking-[0.2em] text-center">
                <span
                  className={`${mainTheme.accentColor} font-black drop-shadow-md`}>
                  {match.meta.toss.winner}
                </span>{" "}
                WON THE TOSS
              </div>
              <div className="text-7xl text-white font-black uppercase italic tracking-tighter text-center drop-shadow-2xl">
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
      ) : (
        <div className="grid grid-cols-2 h-[600px] bg-slate-900">
          {/* BATTING CARD */}
          <div className="border-r border-slate-800 flex flex-col relative">
            <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-xl">
                Batting
              </span>
              <div className="flex gap-10 w-[240px] justify-end text-slate-600 font-bold text-sm">
                <span className="w-10 text-center">R</span>
                <span className="w-10 text-center">B</span>
                <span className="w-12 text-center">SR</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {batsmenByAppearance.length > 0 ? (
                batsmenByAppearance.map((name, index) => {
                  const s = currentInn.batsmenStats[name];
                  const active =
                    name === currentInn.striker ||
                    name === currentInn.nonStriker;
                  return (
                    <div
                      key={name}
                      className={`flex justify-between items-center px-6 py-4 border-b border-slate-800/50 ${active ? mainTheme.activeRow : index % 2 === 0 ? "bg-transparent" : "bg-slate-800/30"}`}>
                      <div className="flex items-center gap-3 w-[300px]">
                        {active && (
                          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
                        )}
                        <div
                          className={`text-2xl font-bold uppercase truncate ${active ? "text-white" : s.out ? "text-slate-600 line-through" : "text-slate-500"}`}>
                          {name}
                        </div>
                      </div>
                      <div
                        className={`flex gap-10 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-600"}`}>
                        <span className="w-10 text-center">{s.runs}</span>
                        <span className="w-10 text-center opacity-60">
                          {s.balls}
                        </span>
                        <span className="w-12 text-center opacity-40">
                          {s.balls ? ((s.runs / s.balls) * 100).toFixed(0) : 0}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest">
                  Waiting for First Ball...
                </div>
              )}
            </div>
          </div>

          {/* BOWLING CARD */}
          <div className="flex flex-col relative bg-slate-900">
            <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-xl">
                Bowling
              </span>
              <div className="flex gap-10 w-[240px] justify-end text-slate-600 font-bold text-sm">
                <span className="w-12 text-center">O</span>
                <span className="w-10 text-center">R</span>
                <span className="w-8 text-center">W</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {bowlersByAppearance.length > 0 ? (
                bowlersByAppearance.map((name, index) => {
                  const s = currentInn.bowlerStats[name];
                  const active = name === currentInn.currentBowler;
                  return (
                    <div
                      key={name}
                      className={`flex justify-between items-center px-6 py-4 border-b border-slate-800/50 ${active ? mainTheme.activeRow : index % 2 === 0 ? "bg-transparent" : "bg-slate-800/30"}`}>
                      <div
                        className={`text-2xl font-bold uppercase truncate w-[300px] ${active ? "text-white" : "text-slate-500"}`}>
                        {name}
                      </div>
                      <div
                        className={`flex gap-10 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-600"}`}>
                        <span className="w-12 text-center opacity-60">
                          {Math.floor(s.balls / 6)}.{s.balls % 6}
                        </span>
                        <span className="w-10 text-center">{s.runs}</span>
                        <span
                          className={`w-8 text-center ${s.wickets > 0 ? mainTheme.accentColor : ""}`}>
                          {s.wickets}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest">
                  Waiting for First Over...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
