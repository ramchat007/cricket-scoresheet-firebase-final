import React, { useMemo } from "react";

export default function ScoreSummary({ match }) {
  if (!match)
    return (
      <div className="bg-[#161920] border border-white/5 rounded-2xl p-8 text-center animate-pulse shadow-xl">
        <div className="text-slate-500 text-lg font-bold tracking-widest">
          LOADING MATCH DATA...
        </div>
      </div>
    );

  // --- 1. DATA EXTRACTION & STANDARDIZATION ---
  const inningsList = Array.isArray(match.innings)
    ? match.innings
    : [match.innings?.[0], match.innings?.[1]].filter(Boolean);

  const status =
    match.meta?.matchStatus || match.status || match.meta?.status || "upcoming";

  const currentInningIndex =
    typeof match.currentInnings === "number" ? match.currentInnings : 0;
  const currentInning = inningsList[currentInningIndex];
  // const inn1 = inningsList[0];
  // const inn2 = inningsList[1];

  // 🔥 DETERMINING TEAM ORDER (Left = Bat 1st, Right = Bat 2nd)
  const { battingFirstTeam, battingSecondTeam, inn1, inn2 } = useMemo(() => {
    const firstInn = inningsList[0];
    const secondInn = inningsList[1];

    if (firstInn?.battingTeam) {
      const first = firstInn.battingTeam;
      // Find the second team by looking at meta or the other inning
      const second =
        secondInn?.battingTeam ||
        (first === match.meta?.teamA ? match.meta?.teamB : match.meta?.teamA);
      return {
        battingFirstTeam: first,
        battingSecondTeam: second,
        inn1: firstInn,
        inn2: secondInn,
      };
    }

    // Fallback if innings not started
    return {
      battingFirstTeam: match.meta?.teamA,
      battingSecondTeam: match.meta?.teamB,
      inn1: null,
      inn2: null,
    };
  }, [match, inningsList]);

  const totalOvers = parseInt(match.meta?.overs || 20);

  // --- 2. CALCULATE STANDARD RESULT TEXT 🏆 ---
  const resultText = useMemo(() => {
    // If not finished, return null
    if (status !== "finished") return null;

    // 1. Try to calculate mathematically for standard format
    if (inn1 && inn2) {
      if (inn1.score > inn2.score) {
        const diff = inn1.score - inn2.score;
        return `${inn1.battingTeam} won by ${diff} run${diff !== 1 ? "s" : ""}`;
      } else if (inn2.score > inn1.score) {
        const totalWickets = parseInt(match.meta?.totalWickets || 10);
        const diff = Math.max(0, totalWickets - inn2.wickets);
        return `${inn2.battingTeam} won by ${diff} wicket${diff !== 1 ? "s" : ""}`;
      } else if (inn1.score === inn2.score) {
        return "Match Tied";
      }
    }

    // 2. Fallback to existing meta string if calculation fails
    return (
      match.meta?.result ||
      match.result?.text ||
      match.winner ||
      "Match Completed"
    );
  }, [status, inn1, inn2, match]);

  // --- 3. HELPERS ---
  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const strikerName = cleanName(currentInning?.striker) || "Striker";
  const nonStrikerName = cleanName(currentInning?.nonStriker) || "Non-Striker";
  const bowlerName = cleanName(currentInning?.currentBowler) || "Bowler";

  // --- 4. TARGET & CHASE LOGIC 🧠 ---
  const isSecondInnings =
    currentInningIndex === 1 || (inn2 && status === "finished");

  // Calculate Target: Explicitly from Meta OR derived from Innings 1
  const targetScore = match.meta?.target || (inn1 ? inn1.score + 1 : 0);

  // --- 5. PARTNERSHIP LOGIC ---
  const partnership = useMemo(() => {
    if (!currentInning) return null;
    const timeline = currentInning.timeline || currentInning.ballsLog || [];

    let runs = 0;
    let balls = 0;

    for (let i = timeline.length - 1; i >= 0; i--) {
      const ball = timeline[i];

      if (
        typeof ball === "object" ? ball.isWicket : String(ball).includes("W")
      ) {
        break;
      }

      let runVal = 0;
      let isLegal = true;

      if (typeof ball === "object") {
        runVal = ball.runs || 0;
        // 🔧 FIX: Only wides are illegal balls (NB counts as ball in your engine)
        if (ball.isWide) isLegal = false;
      } else {
        const s = String(ball);
        if (s.includes("WD")) isLegal = false; // 🔧 FIX
        runVal = parseInt(s) || 0;
        if (s.includes("WD") || s.includes("NB")) {
          const extra = parseInt(s.replace(/\D/g, "")) || 0;
          runVal = 1 + extra;
        }
      }

      runs += runVal;
      if (isLegal) balls++;
    }
    return { runs, balls };
  }, [currentInning]);

  const recentTimeline = useMemo(() => {
    if (!currentInning) return [];
    const timeline = currentInning.timeline || currentInning.ballsLog || [];
    // Take last 12 balls for context (scrollable)
    return timeline.slice(-12);
  }, [currentInning]);

  // ✨ NEW: Last ball summary
  const lastBall =
    currentInning?.timeline?.[currentInning.timeline.length - 1] ||
    currentInning?.ballsLog?.[currentInning.ballsLog.length - 1];

  const lastBallText = (() => {
    if (!lastBall) return null;
    if (typeof lastBall === "string") return lastBall;
    if (lastBall.isWicket) return "WICKET";
    if (lastBall.isWide) return "WIDE";
    if (lastBall.isNoBall) return "NO BALL";
    return `${lastBall.runs || 0} run${lastBall.runs === 1 ? "" : "s"}`;
  })();

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      {/* 1. SCOREBOARD HEADER */}
      <div className="bg-gradient-to-b from-[#1C2128] to-[#161920] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span
            className={`text-[12px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border shadow-sm ${
              status === "finished"
                ? "bg-teal-900/30 text-teal-400 border-teal-500/30"
                : "bg-red-900/30 text-red-400 border-red-500/30 animate-pulse"
            }`}>
            {status === "finished" ? "FINISHED" : "● LIVE"}
          </span>
        </div>

        <div className="flex justify-between items-center mt-4">
          {/* Team A */}
          <div className="text-left w-5/12">
            <div className="text-base md:text-lg font-bold text-slate-300 mb-1 truncate leading-tight">
              {/* {match.meta?.teamA || "Team A"} */} {battingFirstTeam}
            </div>
            {inn1 ? (
              <div className="text-slate-100 font-mono font-black text-3xl md:text-4xl leading-none tracking-tighter">
                {inn1.score}/{inn1.wickets}
                <span className="text-slate-500 text-sm md:text-base font-sans font-medium ml-2 block md:inline">
                  ({inn1.over}.{inn1.overBallCount} / {totalOvers} ov)
                </span>
              </div>
            ) : (
              <div className="text-slate-600 text-sm font-bold italic">
                Yet to bat
              </div>
            )}
          </div>

          <div className="text-slate-700 font-black text-xl italic opacity-20 select-none">
            VS
          </div>

          {/* Team B */}
          <div className="text-right w-5/12">
            <div className="text-base md:text-lg font-bold text-slate-300 mb-1 truncate leading-tight">
              {/* {match.meta?.teamB || "Team B"} */}
              {battingSecondTeam}{" "}
              {currentInningIndex === 1 && status !== "finished" && "●"}
            </div>
            {inn2 ? (
              <div className="text-slate-100 font-mono font-black text-3xl md:text-4xl leading-none tracking-tighter">
                {inn2.score}/{inn2.wickets}
                <span className="text-slate-500 text-sm md:text-base font-sans font-medium ml-2 block md:inline">
                  ({inn2.over}.{inn2.overBallCount} / {totalOvers} ov)
                </span>
              </div>
            ) : (
              <div className="text-slate-600 text-sm font-bold italic">
                Yet to bat
              </div>
            )}
          </div>
        </div>

        {/* Match Result */}
        {resultText && (
          <div className="mt-6 text-center border-t border-white/5 pt-4">
            <span className="text-teal-400 text-lg md:text-xl font-black uppercase tracking-wider drop-shadow-md animate-in zoom-in duration-500">
              🏆 {resultText}
            </span>
            {isSecondInnings && status === "finished" && (
              <div className="text-xs text-slate-500 mt-1 uppercase font-bold">
                Target was {targetScore}
              </div>
            )}
          </div>
        )}

        {/* Chase Target (Equation) - Only show if match NOT finished */}
        {status !== "finished" && isSecondInnings && inn2 && (
          <div className="mt-6 bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-3 text-center">
            <div className="text-indigo-300 text-[12px] uppercase font-bold tracking-widest mb-1">
              Target:{" "}
              <span className="text-white text-base">{targetScore}</span>
            </div>
            {(() => {
              const ballsBowled = inn2.over * 6 + inn2.overBallCount;
              const ballsRemaining = Math.max(0, totalOvers * 6 - ballsBowled);
              const remainingRuns = Math.max(0, targetScore - inn2.score);
              const rrr =
                ballsRemaining > 0
                  ? (remainingRuns / (ballsRemaining / 6)).toFixed(2)
                  : "0.00";
              return (
                <>
                  <div className="text-slate-400 text-sm">
                    Need{" "}
                    <span className="text-white font-bold text-lg">
                      {remainingRuns}
                    </span>{" "}
                    runs off{" "}
                    <span className="text-white font-bold text-lg">
                      {ballsRemaining}
                    </span>{" "}
                    balls
                  </div>
                  {/* ✨ NEW: Required Run Rate */}
                  <div className="text-[11px] text-indigo-300 mt-1 font-mono">
                    Required RR:{" "}
                    <span className="text-white font-bold">{rrr}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* 2. ON THE CREASE (Active Match) */}
      {status !== "finished" && currentInning && (
        <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-5 shadow-lg">
          <div className="grid grid-cols-2 gap-3 pb-3">
            {/* Striker Card */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-teal-500/30 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 bg-teal-600/20 text-teal-400 text-[11px] font-bold px-2 py-1 rounded-bl-lg">
                STRIKER
              </div>
              <div className="text-slate-100 font-bold text-lg truncate pr-2">
                {strikerName}
              </div>
              <div className="text-2xl font-mono font-bold text-teal-400 mt-1">
                {currentInning.batsmenStats?.[strikerName]?.runs || 0}
                <span className="text-sm text-slate-500 ml-1.5 font-sans font-medium">
                  ({currentInning.batsmenStats?.[strikerName]?.balls || 0})
                </span>
              </div>
            </div>

            {/* Non-Striker Card */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5 shadow-inner">
              <div className="text-slate-400 font-bold text-lg truncate">
                {nonStrikerName}
              </div>
              <div className="text-2xl font-mono font-bold text-slate-300 mt-1">
                {currentInning.batsmenStats?.[nonStrikerName]?.runs || 0}
                <span className="text-sm text-slate-600 ml-1.5 font-sans font-medium">
                  ({currentInning.batsmenStats?.[nonStrikerName]?.balls || 0})
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
            <div className="text-[12px] text-slate-500 uppercase font-black tracking-widest">
              Current Partnership
            </div>
            {partnership && (
              <div className="text-xs font-bold text-teal-400 bg-teal-900/20 px-3 py-1 rounded-full border border-teal-500/20">
                <span className="text-white text-base mr-1">
                  {partnership.runs}
                </span>
                <span className="text-slate-400">({partnership.balls})</span>
              </div>
            )}
          </div>

          {/* ✨ NEW: RECENT BALLS TIMELINE (Fixed) */}
          {recentTimeline.length > 0 && (
            <div className="mb-5">
              <div className="text-[10px] text-slate-600 uppercase font-bold mb-2 pl-1">
                Recent Balls
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 h-12">
                {recentTimeline.map((ball, i, arr) => {
                  // Safety: Ensure ball is an object
                  if (!ball || typeof ball !== "object") return null;

                  // 1. Divider Logic
                  // We show a divider if the 'over' number changes between this ball and the previous one
                  const showDivider =
                    i > 0 &&
                    ball.over !== undefined &&
                    arr[i - 1]?.over !== undefined &&
                    ball.over !== arr[i - 1].over;

                  // 2. Styling Logic
                  let val = ball.runs;
                  let colorClass = "bg-slate-800 text-slate-400 border-white/5";

                  if (ball.isWicket) {
                    val = "W";
                    colorClass =
                      "bg-red-900/40 text-red-400 border-red-500/30 font-black shadow-[0_0_10px_rgba(239,68,68,0.2)]";
                  } else if (ball.runs === 4) {
                    colorClass =
                      "bg-teal-900/40 text-teal-400 border-teal-500/30 font-black";
                  } else if (ball.runs === 6) {
                    colorClass =
                      "bg-indigo-900/40 text-indigo-400 border-indigo-500/30 font-black shadow-[0_0_10px_rgba(99,102,241,0.2)]";
                  } else if (ball.isWide) {
                    val = "WD";
                    colorClass =
                      "bg-amber-900/40 text-amber-400 border-amber-500/30";
                  } else if (ball.isNoBall) {
                    val = "NB";
                    colorClass =
                      "bg-amber-900/40 text-amber-400 border-amber-500/30";
                  } else if (ball.runs > 0) {
                    colorClass = "bg-slate-700 text-slate-200 border-white/10";
                  }

                  return (
                    <React.Fragment key={i}>
                      {/* Vertical Divider Line */}
                      {showDivider && (
                        <div className="w-[2px] h-5 bg-slate-600 rounded-full mx-0.5 flex-shrink-0 opacity-50"></div>
                      )}

                      {/* Ball Circle */}
                      <div
                        className={`w-9 h-9 rounded-full flex flex-shrink-0 items-center justify-center text-xs border ${colorClass} transition-all`}>
                        {val}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bowler Card */}
          <div className="mt-3 bg-[#161920] p-4 rounded-xl border border-white/5 flex justify-between items-center">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-bold mb-1 tracking-wider">
                Bowling
              </div>
              <div className="text-slate-200 font-bold text-lg">
                {bowlerName}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-100 font-mono font-black text-2xl leading-none">
                {currentInning.bowlerStats?.[bowlerName]?.wickets || 0}
                <span className="text-slate-600 mx-1">-</span>
                {currentInning.bowlerStats?.[bowlerName]?.runs || 0}
              </div>
              <div className="text-[12px] text-slate-500 font-medium mt-1">
                {currentInning.bowlerStats?.[bowlerName]?.balls
                  ? `${Math.floor(currentInning.bowlerStats[bowlerName].balls / 6)}.${currentInning.bowlerStats[bowlerName].balls % 6}`
                  : "0.0"}{" "}
                overs
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. KEY STATS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Run Rate",
            value:
              currentInning &&
              currentInning.overBallCount + currentInning.over * 6 > 0
                ? (
                    currentInning.score /
                    ((currentInning.over * 6 + currentInning.overBallCount) / 6)
                  ).toFixed(2)
                : "0.00",
            color: "text-slate-200",
          },
          {
            label: "Extras",
            value:
              (currentInning?.extras?.wides || 0) +
              (currentInning?.extras?.noBalls || 0) +
              (currentInning?.extras?.byes || 0) +
              (currentInning?.extras?.legByes || 0),
            color: "text-amber-400",
          },
          {
            label: "Fours",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.fours || 0),
              0,
            ),
            color: "text-emerald-400",
          },
          {
            label: "Sixes",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.sixes || 0),
              0,
            ),
            color: "text-indigo-400",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-[#1C2128] border border-white/5 p-4 rounded-2xl text-center shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase font-black tracking-widest mb-1">
              {stat.label}
            </div>
            <div className={`${stat.color} font-mono font-black text-2xl`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
