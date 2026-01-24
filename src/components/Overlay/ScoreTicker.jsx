import React from "react";

export default function ScoreTicker({ match }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  if (!currentInn) return null;

  // --- DATA ---
  const battingTeam = currentInn.battingTeam;
  const bowlingTeam = currentInn.bowlingTeam;
  const score = currentInn.score;
  const wickets = currentInn.wickets;
  const overs = `${currentInn.over}.${currentInn.overBallCount}`;

  // Batsmen
  const striker = currentInn.striker;
  const sStats = currentInn.batsmenStats?.[striker] || { runs: 0, balls: 0 };
  const nonStriker = currentInn.nonStriker;
  const nsStats = currentInn.batsmenStats?.[nonStriker] || {
    runs: 0,
    balls: 0,
  };

  // Bowler
  const bowler = currentInn.currentBowler;
  const bStats = currentInn.bowlerStats?.[bowler] || {
    wickets: 0,
    runs: 0,
    balls: 0,
  };
  const bOvers = `${Math.floor(bStats.balls / 6)}.${bStats.balls % 6}`;

  // Situation
  const isChasing = match.currentInnings === 1;
  const inn1 = match.innings?.[0];
  const target = match.meta?.target || (inn1 ? inn1.score + 1 : 0);
  const need = target - score;
  const ballsLeft =
    (match.meta?.overs || 20) * 6 -
    (currentInn.over * 6 + currentInn.overBallCount);
  const projectedScore = Math.round(
    (score / (currentInn.over * 6 + currentInn.overBallCount || 1)) *
      ((match.meta?.overs || 20) * 6),
  );

  // Timeline
  const timeline = (currentInn.timeline || []).slice(-6);

  // Logos
  const defaultLogo = "https://cdn-icons-png.flaticon.com/512/164/164449.png";
  const leftLogo = match?.meta?.teamALogo || match?.teamA_Image || defaultLogo;
  const rightLogo = match?.meta?.teamBLogo || match?.teamB_Image || defaultLogo;

  return (
    <div className="w-full flex items-center justify-center font-sans px-10 pb-8">
      {/* 1. LEFT TEAM LOGO (Added back to your layout) */}
      <div className="w-24 h-24 flex-shrink-0 rounded-full bg-[#1C2128] border-4 border-[#1C2128] shadow-2xl z-20 flex items-center justify-center overflow-hidden relative -mr-6">
        <img
          src={leftLogo}
          alt="Team A"
          className="w-full h-full object-cover"
          onError={(e) => (e.target.src = defaultLogo)}
        />
      </div>

      {/* 2. CAPSULE CONTAINER (Your Exact Layout & Colors) */}
      <div className="w-full max-w-[1800px] h-[130px] bg-[#1C2128] rounded-full border-[3px] border-teal-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex overflow-hidden relative z-10">
        {/* --- LEFT: BATSMEN (30%) --- */}
        <div className="w-[30%] flex flex-col justify-center px-2 border-r border-white/10 bg-gradient-to-r from-[#161920] to-[#1C2128]">
          {/* Striker */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-0 h-0 border-l-[10px] border-l-teal-500 border-y-[6px] border-y-transparent"></div>
              <span className="text-white font-bold text-2xl uppercase tracking-tight truncate max-w-[280px]">
                {striker}
              </span>
            </div>
            <div className="text-teal-400 font-mono font-bold text-3xl">
              {sStats.runs}{" "}
              <span className="text-slate-500 text-lg font-sans font-bold">
                ({sStats.balls})
              </span>
            </div>
          </div>

          {/* Non-Striker */}
          <div className="flex justify-between items-center opacity-60">
            <div className="flex items-center gap-3 pl-5 overflow-hidden">
              <span className="text-slate-300 font-bold text-xl uppercase tracking-tight truncate max-w-[280px]">
                {nonStriker}
              </span>
            </div>
            <div className="text-slate-300 font-mono font-bold text-2xl">
              {nsStats.runs}{" "}
              <span className="text-slate-500 text-base font-sans font-bold">
                ({nsStats.balls})
              </span>
            </div>
          </div>
        </div>

        {/* --- CENTER: SCOREBOARD (40%) --- */}
        <div className="flex-1 bg-[#0F1115] relative flex flex-col items-center justify-center px-4 overflow-hidden border-x border-teal-500/50">
          <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent"></div>

          <div className="relative z-10 w-full flex items-center justify-between px-2">
            {/* Team Names */}
            <div className="flex flex-col items-end mr-4">
              <span className="text-teal-400 font-black text-3xl uppercase tracking-widest leading-none">
                {battingTeam.substring(0, 3)}
              </span>
              <span className="text-slate-600 font-bold text-sm uppercase">
                Batting
              </span>
            </div>

            {/* BIG SCORE (Teal Gradient) */}
            <div className="flex flex-col items-center mx-4">
              <div className="bg-gradient-to-b from-teal-600 to-teal-800 text-white px-10 py-1 rounded-xl shadow-lg border border-teal-400/30">
                <span className="font-black text-6xl tracking-tighter drop-shadow-md">
                  {score}/{wickets}
                </span>
              </div>
            </div>

            {/* Overs (Slate) */}
            <div className="flex flex-col items-start ml-4">
              <div className="bg-slate-800 text-white px-3 py-1 rounded-lg border border-slate-600 flex flex-col items-center min-w-[80px]">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Overs
                </span>
                <span className="font-black text-3xl leading-none">
                  {overs}
                </span>
              </div>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-start ml-4 opacity-50">
              <span className="text-white font-black text-xl uppercase tracking-widest leading-none">
                {bowlingTeam?.substring(0, 3) || "OPP"}
              </span>
              <span className="text-slate-600 font-bold text-[10px] uppercase">
                Bowling
              </span>
            </div>
          </div>

          {/* Bottom Situation Text */}
          <div className="relative z-10 mt-2">
            {isChasing ? (
              <div className="text-yellow-400 text-sm font-bold uppercase tracking-[0.2em] animate-pulse">
                Need <span className="text-white text-lg">{need}</span> off{" "}
                <span className="text-white text-lg">{ballsLeft}</span> balls
              </div>
            ) : (
              <div className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
                Proj. Score:{" "}
                <span className="text-white">{projectedScore}</span>
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT: BOWLER & TIMELINE (30%) --- */}
        <div className="w-[30%] flex flex-col justify-center px-8 border-l border-white/10 bg-gradient-to-l from-[#161920] to-[#1C2128]">
          {/* Top Row: Bowler Info */}
          <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1">
            <div className="flex flex-col overflow-hidden">
              <span className="text-white font-bold text-xl uppercase tracking-tight truncate max-w-[280px]">
                {bowler}
              </span>
            </div>
            <div className="text-right whitespace-nowrap">
              <span className="text-yellow-400 font-mono font-bold text-2xl">
                {bStats.wickets}-{bStats.runs}
              </span>
              <span className="text-slate-500 text-sm font-bold ml-2">
                {bOvers}
              </span>
            </div>
          </div>

          {/* Bottom Row: Timeline Bubbles */}
          <div className="flex items-center gap-2">
            {timeline.length === 0 && (
              <span className="text-xs text-slate-500 font-bold italic uppercase tracking-wider">
                Waiting for first ball...
              </span>
            )}

            {timeline.map((b, i) => {
              let bg = "bg-slate-700 text-white border-slate-600";
              let label = b.runs;

              if (b.isWicket) {
                bg =
                  "bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(220,38,38,0.5)]";
                label = "W";
              } else if (b.runs === 4) {
                bg = "bg-teal-500 text-black border-teal-300";
              } else if (b.runs === 6) {
                bg = "bg-indigo-500 text-white border-indigo-300";
              } else if (b.isWide || b.isNoBall) {
                bg = "bg-amber-600 text-black border-amber-400";
                label = b.isWide ? "wd" : "nb";
              } else if (b.runs === 0) {
                bg = "bg-slate-800 text-slate-500 border-slate-700";
              }

              return (
                <div
                  key={i}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base border ${bg}`}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. RIGHT TEAM LOGO (Added back) */}
      <div className="w-24 h-24 flex-shrink-0 rounded-full bg-[#1C2128] border-4 border-[#1C2128] shadow-2xl z-20 flex items-center justify-center overflow-hidden relative -ml-6">
        <img
          src={rightLogo}
          alt="Team B"
          className="w-full h-full object-cover"
          onError={(e) => (e.target.src = defaultLogo)}
        />
      </div>
    </div>
  );
}
