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

  const inningsList = Array.isArray(match.innings)
    ? match.innings
    : [match.innings?.[0], match.innings?.[1]].filter(Boolean);

  const status = match.status || match.meta?.status || "upcoming";
  const result = match.winner || match.meta?.result || match.result?.winner;
  const currentInningIndex = match.currentInnings || 0;

  // 🔥 GET TOTAL OVERS (Meta or Default)
  const totalOvers = match.meta?.overs || 20;

  const currentInning = inningsList[currentInningIndex];
  const inn1 = inningsList[0];
  const inn2 = inningsList[1];

  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const strikerName = cleanName(currentInning?.striker) || "Striker";
  const nonStrikerName = cleanName(currentInning?.nonStriker) || "Non-Striker";
  const bowlerName = cleanName(currentInning?.currentBowler) || "Bowler";

  // --- ROBUST PARTNERSHIP LOGIC ---
  const partnership = useMemo(() => {
    if (!currentInning) return null;
    const timeline = currentInning.timeline || currentInning.ballsLog || [];

    let runs = 0;
    let balls = 0;

    // Traverse backwards from the last ball
    for (let i = timeline.length - 1; i >= 0; i--) {
      const ball = timeline[i];

      // Stop if we hit a wicket (partnership started after previous wicket)
      if (
        typeof ball === "object" ? ball.isWicket : String(ball).includes("W")
      ) {
        break;
      }

      // Calculate Runs
      let runVal = 0;
      let isLegal = true;

      if (typeof ball === "object") {
        runVal = ball.runs || 0;
        if (ball.isWide || ball.isNoBall) isLegal = false;
        // Note: In partnership stats, balls faced usually excludes wides.
        // Some standards exclude NB from balls faced too, but we keep logic consistent with engine.
      } else {
        // Legacy String Fallback
        const s = String(ball);
        if (s.includes("WD") || s.includes("NB")) isLegal = false;
        runVal = parseInt(s) || 0;
        if (s.includes("WD") || s.includes("NB")) {
          // Extract runs from string like "1wd+1" -> 2 runs
          const extra = parseInt(s.replace(/\D/g, "")) || 0;
          runVal = 1 + extra;
        }
      }

      runs += runVal;
      if (isLegal) balls++;
    }
    return { runs, balls };
  }, [currentInning]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {/* 1. SCOREBOARD HEADER */}
      <div className="bg-gradient-to-b from-[#1C2128] to-[#161920] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span
            className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border shadow-sm ${
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
              {match.meta?.teamA || "Team A"}
            </div>
            {inn1 ? (
              <div className="text-slate-100 font-mono font-black text-3xl md:text-4xl leading-none tracking-tighter">
                {inn1.score}/{inn1.wickets}
                <span className="text-slate-500 text-sm md:text-base font-sans font-medium ml-2 block md:inline">
                  ({inn1.over}.{inn1.overBallCount})
                </span>
              </div>
            ) : (
              <div className="text-slate-600 text-sm font-bold italic">
                Yet to bat
              </div>
            )}
          </div>

          <div className="text-slate-700 font-black text-2xl italic opacity-20 select-none">
            VS
          </div>

          {/* Team B */}
          <div className="text-right w-5/12">
            <div className="text-base md:text-lg font-bold text-slate-300 mb-1 truncate leading-tight">
              {match.meta?.teamB || "Team B"}
            </div>
            {inn2 ? (
              <div className="text-slate-100 font-mono font-black text-3xl md:text-4xl leading-none tracking-tighter">
                {inn2.score}/{inn2.wickets}
                <span className="text-slate-500 text-sm md:text-base font-sans font-medium ml-2 block md:inline">
                  ({inn2.over}.{inn2.overBallCount})
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
        {result && (
          <div className="mt-6 text-center border-t border-white/5 pt-4">
            <span className="text-teal-400 text-lg md:text-xl font-black uppercase tracking-wider drop-shadow-md">
              🏆 {result}
            </span>
          </div>
        )}

        {/* Chase Target */}
        {!result && inn2 && match.meta?.target && (
          <div className="mt-6 bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-3 text-center">
            <div className="text-indigo-300 text-[10px] uppercase font-bold tracking-widest mb-1">
              Target:{" "}
              <span className="text-white text-base">{match.meta.target}</span>
            </div>
            <div className="text-slate-400 text-sm">
              Need{" "}
              <span className="text-white font-bold text-lg">
                {match.meta.target - inn2.score}
              </span>{" "}
              runs off{" "}
              <span className="text-white font-bold text-lg">
                {Math.max(
                  0,
                  match.meta.overs * 6 - (inn2.over * 6 + inn2.overBallCount),
                )}
              </span>{" "}
              balls
            </div>
          </div>
        )}
      </div>

      {/* 2. ON THE CREASE (Active Match) */}
      {status !== "finished" && currentInning && (
        <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
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

          <div className="grid grid-cols-2 gap-3">
            {/* Striker Card */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-teal-500/30 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 bg-teal-600/20 text-teal-400 text-[9px] font-bold px-2 py-1 rounded-bl-lg">
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

          {/* Bowler Card */}
          <div className="mt-3 bg-[#161920] p-4 rounded-xl border border-white/5 flex justify-between items-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase font-bold mb-1 tracking-wider">
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
              <div className="text-[10px] text-slate-500 font-medium mt-1">
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
            <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">
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
