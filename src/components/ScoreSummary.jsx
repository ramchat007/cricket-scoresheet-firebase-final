// src/components/ScoreSummary.jsx
import React, { useMemo } from "react";

export default function ScoreSummary({ match }) {
  if (!match)
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center animate-pulse">
        <div className="text-gray-400 text-lg font-bold tracking-widest">
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

  // Partnership Logic
  const partnership = useMemo(() => {
    if (!currentInning) return null;
    const timeline = currentInning.timeline || currentInning.ballsLog || [];
    let runs = 0;
    let balls = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
      const ball = timeline[i];
      let isWicket = false;
      let runVal = 0;
      let isLegal = true;
      if (typeof ball === "object") {
        isWicket = ball.isWicket;
        runVal = ball.runs || 0;
        if (ball.isWide) isLegal = false;
      } else {
        const s = String(ball);
        isWicket = s === "W";
        if (s.includes("WD")) isLegal = false;
        runVal = parseInt(s) || 0;
        if (s.includes("WD") || s.includes("NB"))
          runVal = (parseInt(s.replace(/\D/g, "")) || 0) + 1;
      }
      if (isWicket) break;
      runs += runVal;
      if (isLegal) balls++;
    }
    return { runs, balls };
  }, [currentInning]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. BIG SCOREBOARD HEADER */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <span
            className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm ${
              status === "finished"
                ? "bg-green-500/20 text-green-400 border-green-500/50"
                : "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"
            }`}>
            {status === "finished" ? "FINISHED" : "● LIVE"}
          </span>
        </div>

        <div className="flex justify-between items-center mt-2">
          {/* Team A */}
          <div className="text-left w-5/12">
            <div className="text-base md:text-xl font-bold text-gray-300 mb-1 truncate leading-tight">
              {match.meta?.teamA || "Team A"}
            </div>
            {inn1 ? (
              <div className="text-white font-mono font-black text-2xl md:text-4xl leading-none tracking-tight">
                {inn1.score}/{inn1.wickets}
                {/* Updated Overs Format */}
                <span className="text-gray-500 text-sm md:text-lg font-sans font-medium ml-2 block md:inline">
                  ({inn1.over}.{inn1.overBallCount} / {totalOvers} ov)
                </span>
              </div>
            ) : (
              <div className="text-gray-600 text-sm font-bold italic">
                Yet to bat
              </div>
            )}
          </div>

          <div className="text-gray-700 font-black text-3xl italic opacity-20 select-none">
            VS
          </div>

          {/* Team B */}
          <div className="text-right w-5/12">
            <div className="text-base md:text-xl font-bold text-gray-300 mb-1 truncate leading-tight">
              {match.meta?.teamB || "Team B"}
            </div>
            {inn2 ? (
              <div className="text-white font-mono font-black text-2xl md:text-4xl leading-none tracking-tight">
                {inn2.score}/{inn2.wickets}
                {/* Updated Overs Format */}
                <span className="text-gray-500 text-sm md:text-lg font-sans font-medium ml-2 block md:inline">
                  ({inn2.over}.{inn2.overBallCount} / {totalOvers} ov)
                </span>
              </div>
            ) : (
              <div className="text-gray-600 text-sm font-bold italic">
                Yet to bat
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="mt-6 text-center border-t border-gray-700/50 pt-4">
            <span className="text-green-400 text-lg md:text-xl font-black uppercase tracking-wider drop-shadow-md">
              🏆 {result}
            </span>
          </div>
        )}

        {/* Target Display (If Chasing) */}
        {!result && inn2 && match.meta?.target && (
          <div className="mt-6 bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 text-center">
            <div className="text-blue-300 text-sm uppercase font-bold tracking-wider mb-1">
              Target:{" "}
              <span className="text-white text-lg">{match.meta.target}</span>
            </div>
            <div className="text-gray-300 text-sm">
              Need{" "}
              <span className="text-white font-bold text-lg">
                {match.meta.target - inn2.score}
              </span>{" "}
              runs off{" "}
              <span className="text-white font-bold text-lg">
                {Math.max(
                  0,
                  match.meta.overs * 6 - (inn2.over * 6 + inn2.overBallCount)
                )}
              </span>{" "}
              balls
            </div>
          </div>
        )}
      </div>

      {/* 2. ON THE CREASE */}
      {status !== "finished" && currentInning && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
            <div className="text-xs text-gray-400 uppercase font-black tracking-widest">
              On Strike
            </div>
            {partnership && (
              <div className="text-xs font-bold text-cyan-300 bg-cyan-950/50 px-3 py-1.5 rounded-full border border-cyan-500/30 shadow-sm">
                🤝 Partnership:{" "}
                <span className="text-white text-sm ml-1">
                  {partnership.runs}
                </span>{" "}
                <span className="text-gray-400 font-normal">
                  ({partnership.balls})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700 border-l-4 border-l-cyan-500 shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-cyan-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                STRIKER
              </div>
              <div className="text-white font-bold text-lg truncate pr-2">
                {strikerName}
              </div>
              <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">
                {currentInning.batsmenStats?.[strikerName]?.runs || 0}
                <span className="text-sm text-gray-500 ml-1.5 font-sans font-medium">
                  ({currentInning.batsmenStats?.[strikerName]?.balls || 0})
                </span>
              </div>
            </div>
            <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700 shadow-inner">
              <div className="text-gray-300 font-bold text-lg truncate">
                {nonStrikerName}
              </div>
              <div className="text-2xl font-mono font-bold text-gray-200 mt-1">
                {currentInning.batsmenStats?.[nonStrikerName]?.runs || 0}
                <span className="text-sm text-gray-500 ml-1.5 font-sans font-medium">
                  ({currentInning.batsmenStats?.[nonStrikerName]?.balls || 0})
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-gray-800/40 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1 tracking-wider">
                Bowling
              </div>
              <div className="text-white font-bold text-lg">{bowlerName}</div>
            </div>
            <div className="text-right">
              <div className="text-white font-mono font-black text-2xl leading-none">
                {currentInning.bowlerStats?.[bowlerName]?.wickets || 0}
                <span className="text-gray-600 mx-1">-</span>
                {currentInning.bowlerStats?.[bowlerName]?.runs || 0}
              </div>
              <div className="text-xs text-gray-400 font-medium mt-1">
                {currentInning.bowlerStats?.[bowlerName]?.balls
                  ? `${Math.floor(
                      currentInning.bowlerStats[bowlerName].balls / 6
                    )}.${currentInning.bowlerStats[bowlerName].balls % 6}`
                  : "0.0"}{" "}
                overs
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. KEY STATS */}
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
            color: "text-white",
            bg: "bg-gray-800",
          },
          {
            label: "Extras",
            value:
              (currentInning?.extras?.wides || 0) +
              (currentInning?.extras?.noBalls || 0) +
              (currentInning?.extras?.byes || 0) +
              (currentInning?.extras?.legByes || 0),
            color: "text-white",
            bg: "bg-gray-800",
          },
          {
            label: "Fours",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.fours || 0),
              0
            ),
            color: "text-green-400",
            bg: "bg-green-900/10 border-green-500/20",
          },
          {
            label: "Sixes",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.sixes || 0),
              0
            ),
            color: "text-purple-400",
            bg: "bg-purple-900/10 border-purple-500/20",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`${stat.bg} border border-gray-700/50 p-4 rounded-xl text-center shadow-sm hover:bg-gray-750 transition-colors`}>
            <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">
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
