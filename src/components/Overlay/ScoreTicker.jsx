import React from "react";

export default function ScoreTicker({ match }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  if (!currentInn) return null;

  // --- DATA ---
  const battingTeam = currentInn.battingTeam;
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
  const crr =
    currentInn.over > 0
      ? (score / (currentInn.over + currentInn.overBallCount / 6)).toFixed(2)
      : "0.0";
  const isChasing = match.currentInnings === 1;
  const target = match.meta?.target || 0;
  const need = target - score;
  const ballsLeft =
    (match.meta?.overs || 20) * 6 -
    (currentInn.over * 6 + currentInn.overBallCount);
  const rrr = ballsLeft > 0 ? (need / (ballsLeft / 6)).toFixed(2) : "-";

  // Timeline
  const timeline = (currentInn.timeline || []).slice(-8);

  return (
    <div className="flex flex-col items-end gap-2">
      {/* 1. FLOATING TIMELINE STRIP (Above the bar) */}
      <div className="flex gap-2 mr-4 animate-in slide-in-from-right duration-700">
        {timeline.map((b, i) => {
          let bg = "bg-white text-black";
          if (b.isWicket) bg = "bg-red-600 text-white shadow-[0_0_15px_red]";
          else if (b.runs === 4) bg = "bg-green-500 text-black";
          else if (b.runs === 6) bg = "bg-indigo-600 text-white";
          else if (b.runs === 0) bg = "bg-slate-700 text-slate-400";

          return (
            <div
              key={i}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 border-slate-900 ${bg}`}>
              {b.isWicket ? "W" : b.runs}
            </div>
          );
        })}
      </div>

      {/* 2. MAIN TV BAR */}
      <div className="w-full h-[140px] flex rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border-2 border-white/10 relative bg-[#0a0f1c]">
        {/* --- LEFT: SCORE BLOCK (Deep Blue Gradient) --- */}
        <div className="w-[380px] bg-gradient-to-r from-blue-900 to-blue-950 flex flex-col justify-center px-8 border-r-2 border-white/10 relative overflow-hidden">
          {/* Team Name */}
          <div className="text-blue-300 font-bold text-2xl uppercase tracking-wider truncate mb-1">
            {battingTeam}
          </div>
          {/* BIG Score */}
          <div className="flex items-baseline gap-4">
            <span className="text-white font-black text-7xl tracking-tighter drop-shadow-lg">
              {score}/{wickets}
            </span>
          </div>
          <div className="text-slate-400 font-medium text-2xl mt-1">
            In {overs} Overs
          </div>
          {/* Decorative Gloss */}
          <div className="absolute top-0 right-0 w-32 h-full bg-white/5 skew-x-[-20deg] blur-xl"></div>
        </div>

        {/* --- MIDDLE: STATS BLOCK (Dark Slate) --- */}
        <div className="flex-1 flex bg-[#161b2c] relative">
          {/* Batsmen (60%) */}
          <div className="flex-[3] flex flex-col justify-center px-8 gap-3 border-r border-white/5">
            {/* Striker */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-0 h-0 border-l-[12px] border-l-yellow-400 border-y-[8px] border-y-transparent"></div>
                <span className="text-yellow-400 font-bold text-3xl uppercase tracking-tight">
                  {striker}
                </span>
              </div>
              <div className="text-white font-mono text-4xl font-bold">
                {sStats.runs}
                <span className="text-slate-500 text-2xl ml-1">
                  ({sStats.balls})
                </span>
              </div>
            </div>
            {/* Non-Striker */}
            <div className="flex justify-between items-center opacity-60">
              <div className="flex items-center gap-3 pl-6">
                <span className="text-white font-bold text-3xl uppercase tracking-tight">
                  {nonStriker}
                </span>
              </div>
              <div className="text-white font-mono text-4xl font-bold">
                {nsStats.runs}
                <span className="text-slate-500 text-2xl ml-1">
                  ({nsStats.balls})
                </span>
              </div>
            </div>
          </div>

          {/* Bowler (40%) */}
          <div className="flex-[2] flex flex-col justify-center px-8 bg-black/20">
            <div className="text-slate-500 font-bold text-sm uppercase mb-1">
              Current Bowler
            </div>
            <div className="text-white font-bold text-2xl uppercase truncate mb-1">
              {bowler}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-yellow-400 font-mono text-4xl font-black">
                {bStats.wickets}-{bStats.runs}
              </span>
              <span className="text-slate-400 text-xl font-medium">
                {bOvers} Ov
              </span>
            </div>
          </div>
        </div>

        {/* --- RIGHT: SITUATION BLOCK (Gradient) --- */}
        <div className="w-[320px] bg-gradient-to-br from-slate-800 to-black flex flex-col justify-center px-6 border-l-2 border-white/10">
          {isChasing ? (
            <>
              <div className="text-slate-400 text-sm font-bold uppercase mb-1 text-center">
                To Win
              </div>
              <div className="text-center mb-2">
                <span className="text-white font-black text-5xl">{need}</span>
                <span className="text-slate-500 text-xl mx-2 font-bold">
                  OFF
                </span>
                <span className="text-white font-black text-5xl">
                  {ballsLeft}
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">
                    CRR
                  </div>
                  <div className="text-white font-bold text-xl">{crr}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">
                    REQ
                  </div>
                  <div className="text-yellow-400 font-bold text-xl">{rrr}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-slate-500 font-bold text-xl uppercase mb-2">
                Run Rate
              </div>
              <div className="text-white font-black text-6xl">{crr}</div>
              <div className="text-blue-400 text-sm font-bold mt-2 uppercase">
                1st Innings
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
