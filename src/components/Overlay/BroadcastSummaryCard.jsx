import React from "react";

export default function BroadcastSummaryCard({ tournamentName, match, type }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  if (!match) return null;

  const isResult =
    type === "RESULT" ||
    match.status === "completed" ||
    match?.meta?.matchStatus === "finished";
  const isToss = type === "TOSS";
  const isInningsBreak = type === "INNINGS_BREAK";
  const isSecondInnings = match.currentInnings === 1;

  // --- 1. ROCK-SOLID APPEARANCE SORTING ---
  const timeline = currentInn?.timeline || [];

  // Build Batting Order by chronological appearance
  const batsmenByAppearance = [];
  timeline.forEach((ball) => {
    if (ball.striker && !batsmenByAppearance.includes(ball.striker)) {
      batsmenByAppearance.push(ball.striker);
    }
    if (ball.nonStriker && !batsmenByAppearance.includes(ball.nonStriker)) {
      batsmenByAppearance.push(ball.nonStriker);
    }
  });
  // Safely catch incoming batters who haven't faced a ball yet
  if (
    currentInn?.striker &&
    !batsmenByAppearance.includes(currentInn.striker)
  ) {
    batsmenByAppearance.push(currentInn.striker);
  }
  if (
    currentInn?.nonStriker &&
    !batsmenByAppearance.includes(currentInn.nonStriker)
  ) {
    batsmenByAppearance.push(currentInn.nonStriker);
  }
  // Fallback for any outliers
  Object.keys(currentInn?.batsmenStats || {}).forEach((b) => {
    if (!batsmenByAppearance.includes(b)) batsmenByAppearance.push(b);
  });

  // Build Bowling Order by chronological appearance
  const bowlersByAppearance = [];
  timeline.forEach((ball) => {
    if (ball.bowler && !bowlersByAppearance.includes(ball.bowler)) {
      bowlersByAppearance.push(ball.bowler);
    }
  });
  // Safely catch a new bowler who hasn't bowled their first legal ball yet
  if (
    currentInn?.currentBowler &&
    !bowlersByAppearance.includes(currentInn.currentBowler)
  ) {
    bowlersByAppearance.push(currentInn.currentBowler);
  }
  // Fallback for any outliers
  Object.keys(currentInn?.bowlerStats || {}).forEach((b) => {
    if (!bowlersByAppearance.includes(b)) bowlersByAppearance.push(b);
  });

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

    if (!isResult) {
      targetSummary = `${match.innings[1]?.battingTeam || match.meta?.teamB || "Chasing Team"} needs ${runsNeeded} runs in ${totalOvers} overs`;
    }
  }

  // 🔥 3. DYNAMIC TEAM COLORS EXTRACTED 🔥
  const teamA = match.meta?.teamA;
  const teamB = match.meta?.teamB;
  const teamAColor = match.meta?.teamAColor || "#0284c7"; // Blue fallback
  const teamBColor = match.meta?.teamBColor || "#e11d48"; // Rose fallback

  const battingTeamName = currentInn?.battingTeam;
  let battingColor = teamAColor;
  let bowlingColor = teamBColor;

  if (battingTeamName === teamB) {
    battingColor = teamBColor;
    bowlingColor = teamAColor;
  }

  const getTeamColor = (teamName) => {
    if (teamName === teamA) return teamAColor;
    if (teamName === teamB) return teamBColor;
    return "#14b8a6"; // Default Teal
  };

  // --- 4. THEME CONFIG ---
  let mainTheme = {
    bg: "bg-slate-900",
    headerGradient: "bg-slate-800",
    headerBorderColor: battingColor,
    accentColorClass: "",
    statusText: currentInn
      ? `END OF OVER ${currentInn?.over || 0}`
      : "MATCH PREVIEW",
    isSemanticAlert: false,
  };

  if (type === "WICKET") {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-rose-900",
      headerBorderClass: "border-rose-500",
      accentColorClass: "text-rose-400",
      statusText: "WICKET FALLEN",
      isSemanticAlert: true,
    };
  } else if (isResult) {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-amber-900",
      headerBorderClass: "border-amber-500",
      accentColorClass: "text-amber-400",
      statusText: "MATCH RESULT",
      isSemanticAlert: true,
    };
  } else if (isToss) {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-indigo-900",
      headerBorderClass: "border-indigo-500",
      accentColorClass: "text-indigo-400",
      statusText: "TOSS UPDATE",
      isSemanticAlert: true,
    };
  } else if (isInningsBreak) {
    mainTheme = {
      ...mainTheme,
      headerGradient: "bg-emerald-900",
      headerBorderClass: "border-emerald-500",
      accentColorClass: "text-emerald-400",
      statusText: "INNINGS BREAK",
      isSemanticAlert: true,
    };
  }

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
        className={`flex flex-col items-center p-6 bg-slate-900 rounded-xl border border-slate-700 w-full relative overflow-hidden shadow-xl`}
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
        <div className="text-6xl font-black text-white mb-4 leading-none">
          {inn.score}/{inn.wickets}
        </div>
        <div className="w-full border-t border-slate-700/50 pt-4 space-y-3">
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
    <div className="w-[1400px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 font-sans">
      <div
        className={`relative flex flex-col border-b-4 ${mainTheme.isSemanticAlert ? mainTheme.headerBorderClass : ""}`}
        style={!mainTheme.isSemanticAlert ? { borderColor: battingColor } : {}}
      >
        <div className="bg-slate-950 px-8 py-2 flex justify-between items-center border-b border-slate-800">
          <div className="flex gap-4 text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
            <span>{match.meta?.matchTitle || match.name || "MATCH"}</span>{" "}
            <span className="text-slate-700">•</span>{" "}
            <span>{tournamentName}</span>
          </div>
          <div
            className={`font-black uppercase tracking-widest text-sm animate-pulse ${mainTheme.isSemanticAlert ? mainTheme.accentColorClass : ""}`}
            style={!mainTheme.isSemanticAlert ? { color: battingColor } : {}}
          >
            {mainTheme.statusText}
          </div>
        </div>

        <div
          className={`h-28 flex items-center justify-between px-10 relative overflow-hidden ${mainTheme.isSemanticAlert ? mainTheme.headerGradient : ""}`}
          style={
            !mainTheme.isSemanticAlert
              ? {
                  background: `linear-gradient(to right, ${battingColor} 0%, rgba(15,23,42,1) 40%, rgba(15,23,42,1) 60%, ${bowlingColor} 100%)`,
                }
              : {}
          }
        >
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
              {/* DYNAMIC MATCH HEADER */}
              <div className="flex flex-col z-10 w-[40%]">
                <span className="text-white font-black text-5xl uppercase leading-none truncate pr-4 drop-shadow-md">
                  {battingTeamName || match?.meta?.teamA || "TEAM 1"}
                </span>
              </div>
              <div className="z-10 flex flex-col items-center w-[20%] shrink-0">
                <div className="text-7xl font-black text-white leading-none drop-shadow-lg">
                  {score}/{wickets}
                </div>
                {isSecondInnings && targetScore > 0 && (
                  <div className="bg-slate-900/80 px-3 py-1 rounded text-amber-400 font-bold text-sm tracking-widest mt-1 border border-white/10 uppercase drop-shadow-md whitespace-nowrap">
                    Need {targetScore - score} off{" "}
                    {totalBallsInInnings - ballsBowled}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end z-10 text-right w-[40%]">
                <span className="text-white font-mono font-black text-2xl uppercase leading-none truncate pl-4 drop-shadow-md">
                  {currentInn?.bowlingTeam || match?.meta?.teamB || "TEAM 2"}
                </span>
                <span className="text-white font-mono font-bold text-4xl leading-none mt-1 drop-shadow-md">
                  {overs} <span className="text-lg text-white/60">OV</span>
                </span>
                <span
                  className="font-bold text-sm tracking-widest mt-1 drop-shadow-md"
                  style={{ color: bowlingColor }}
                >
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
          <div className="flex flex-col items-center justify-center min-w-[350px] px-4 text-center shrink-0">
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
      ) : (
        <div className="grid grid-cols-2 h-[600px] bg-slate-900">
          {/* BATTING CARD */}
          <div className="border-r border-slate-800 flex flex-col relative overflow-hidden">
            {/* Background Batting Hue */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                background: `linear-gradient(to bottom, ${battingColor}, transparent)`,
              }}
            ></div>
            <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800 z-10">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-xl">
                Batting
              </span>
              <div className="flex gap-8 w-[200px] justify-end text-slate-600 font-bold text-sm shrink-0">
                <span className="w-10 text-center">R</span>
                <span className="w-10 text-center">B</span>
                <span className="w-12 text-center">SR</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto z-10">
              {batsmenByAppearance.length > 0 ? (
                batsmenByAppearance.map((name, index) => {
                  // 🔥 FIX: Safe Fallback applied here
                  const s = currentInn.batsmenStats?.[name] || {
                    runs: 0,
                    balls: 0,
                    out: false,
                  };
                  const active =
                    name === currentInn.striker ||
                    name === currentInn.nonStriker;
                  return (
                    <div
                      key={name}
                      style={
                        active
                          ? {
                              backgroundColor: `${battingColor}15`,
                              borderLeft: `4px solid ${battingColor}`,
                            }
                          : {}
                      }
                      className={`flex justify-between items-center px-6 py-4 border-b border-slate-800/50 ${!active && index % 2 !== 0 ? "bg-slate-800/30" : "bg-transparent"} ${!active ? "border-l-4 border-transparent" : ""}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                        {active && (
                          <div
                            className="w-2 h-2 rounded-full animate-pulse shrink-0 shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: battingColor }}
                          ></div>
                        )}
                        <div
                          className={`text-2xl font-bold uppercase truncate w-full ${active ? "text-white" : s.out ? "text-slate-600 line-through" : "text-slate-500"}`}
                        >
                          {name}
                        </div>
                      </div>
                      <div
                        className={`flex gap-8 w-[200px] justify-end font-mono text-2xl font-bold shrink-0 ${active ? "text-white" : "text-slate-600"}`}
                      >
                        <span className="w-10 text-center">{s.runs}</span>
                        <span className="w-10 text-center opacity-60">
                          {s.balls}
                        </span>
                        <span className="w-12 text-center opacity-40">
                          {s.balls > 0
                            ? ((s.runs / s.balls) * 100).toFixed(0)
                            : 0}
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
          <div className="flex flex-col relative bg-slate-900 overflow-hidden">
            {/* Background Bowling Hue */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                background: `linear-gradient(to bottom, ${bowlingColor}, transparent)`,
              }}
            ></div>
            <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800 z-10">
              <span className="text-slate-400 font-bold uppercase tracking-widest text-xl">
                Bowling
              </span>
              <div className="flex gap-8 w-[200px] justify-end text-slate-600 font-bold text-sm shrink-0">
                <span className="w-12 text-center">O</span>
                <span className="w-10 text-center">R</span>
                <span className="w-8 text-center">W</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto z-10">
              {bowlersByAppearance.length > 0 ? (
                bowlersByAppearance.map((name, index) => {
                  // 🔥 FIX: Safe Fallback applied here
                  const s = currentInn.bowlerStats?.[name] || {
                    runs: 0,
                    wickets: 0,
                    balls: 0,
                  };
                  const active = name === currentInn.currentBowler;
                  return (
                    <div
                      key={name}
                      style={
                        active
                          ? {
                              backgroundColor: `${bowlingColor}15`,
                              borderLeft: `4px solid ${bowlingColor}`,
                            }
                          : {}
                      }
                      className={`flex justify-between items-center px-6 py-4 border-b border-slate-800/50 ${!active && index % 2 !== 0 ? "bg-slate-800/30" : "bg-transparent"} ${!active ? "border-l-4 border-transparent" : ""}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                        {active && (
                          <div
                            className="w-2 h-2 rounded-full animate-pulse shrink-0 shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: bowlingColor }}
                          ></div>
                        )}
                        <div
                          className={`text-2xl font-bold uppercase truncate w-full ${active ? "text-white" : "text-slate-500"}`}
                        >
                          {name}
                        </div>
                      </div>
                      <div
                        className={`flex gap-8 w-[200px] justify-end font-mono text-2xl font-bold shrink-0 ${active ? "text-white" : "text-slate-600"}`}
                      >
                        <span className="w-12 text-center opacity-60">
                          {Math.floor(s.balls / 6)}.{s.balls % 6}
                        </span>
                        <span className="w-10 text-center">{s.runs}</span>
                        <span
                          className="w-8 text-center"
                          style={
                            s.wickets > 0 && !active
                              ? { color: bowlingColor }
                              : {}
                          }
                        >
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
