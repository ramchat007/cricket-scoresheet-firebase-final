import React from "react";

// --- HELPER: Handle Object vs String names ---
const normalizeName = (p) => {
  if (!p) return "";
  if (typeof p === "object") return p.name || p.playerName || "";
  return String(p).trim();
};

export default function ScoreTicker({ match }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  if (!currentInn) return null;

  // --- DATA ---
  const battingTeam = currentInn.battingTeam;
  const bowlingTeam = currentInn.bowlingTeam;
  const score = currentInn.score;
  const wickets = currentInn.wickets;
  const overs = `${currentInn.over}.${currentInn.overBallCount}`;

  // Batsmen (Normalized)
  const striker = normalizeName(currentInn.striker);
  const sStats = currentInn.batsmenStats?.[striker] || { runs: 0, balls: 0 };
  
  const nonStriker = normalizeName(currentInn.nonStriker);
  const nsStats = currentInn.batsmenStats?.[nonStriker] || { runs: 0, balls: 0 };

  // Bowler (Normalized)
  const bowler = normalizeName(currentInn.currentBowler);
  const bStats = currentInn.bowlerStats?.[bowler] || { wickets: 0, runs: 0, balls: 0 };
  
  // Calculate balls bowled in THIS over (Modulo 6)
  const ballsInThisOver = bStats.balls % 6; 
  const bOvers = `${Math.floor(bStats.balls / 6)}.${ballsInThisOver}`;

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

  // --- TIMELINE LOGIC ---
  const allBalls = currentInn.timeline || [];
  const currentOverIndex = parseInt(currentInn.over || 0);

  // 1. Primary Strategy: Filter by Over Number
  let timeline = allBalls.filter((ball) => {
      return ball.over != undefined && ball.over == currentOverIndex;
  });

  // 2. Fallback Strategy
  if (timeline.length === 0 && ballsInThisOver > 0) {
      const buffer = ballsInThisOver + 2; 
      timeline = allBalls.slice(-buffer).filter(b => normalizeName(b.bowler) === bowler);
  }

  // Logos
  const defaultLogo = "https://cdn-icons-png.flaticon.com/512/164/164449.png";
  const leftLogo = match?.meta?.teamALogo || match?.teamA_Image || defaultLogo;
  const rightLogo = match?.meta?.teamBLogo || match?.teamB_Image || defaultLogo;

  return (
    <>
      {/* 🔴 OBS-SAFE CSS ANIMATIONS */}
      <style>
        {`
          @keyframes obsPopIn {
            0% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes obsPulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
          }
          @keyframes obsBounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
          }
          .anim-entry { animation: obsPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          .anim-pulse { animation: obsPulse 2s infinite; }
          .anim-bounce { animation: obsBounce 1s infinite; }
        `}
      </style>

      <div className="w-full flex items-center justify-center font-sans px-10">
        {/* 1. LEFT TEAM LOGO */}
        <div className="w-24 h-24 flex-shrink-0 rounded-full bg-[#1C2128] border-4 border-[#1C2128] shadow-2xl z-20 flex items-center justify-center overflow-hidden relative -mr-6 anim-entry">
          <img
            src={leftLogo}
            alt="Team A"
            className="w-full h-full object-cover"
            onError={(e) => (e.target.src = defaultLogo)}
          />
        </div>

        {/* 2. CAPSULE CONTAINER */}
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
                <div className="text-yellow-400 text-sm font-bold uppercase tracking-[0.2em]">
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

            {/* Bottom Row: Timeline Bubbles (Animated) */}
            <div className="flex items-center gap-2">
              {timeline.length === 0 && (
                <span className="text-xs text-slate-500 font-bold italic uppercase tracking-wider anim-pulse">
                  Waiting for first ball...
                </span>
              )}

              {timeline.map((b, i) => {
                let bg = "bg-slate-700 text-white border-slate-600";
                let label = b.runs;
                let animClass = "anim-entry"; // Standard entry

                if (b.isWicket) {
                  bg = "bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.8)]";
                  label = "W";
                  animClass = "anim-bounce"; // Bounce for Wicket
                } else if (b.runs === 4) {
                  bg = "bg-teal-500 text-black border-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.6)]";
                  animClass = ""; // Pulse for 4s
                } else if (b.runs === 6) {
                  bg = "bg-indigo-500 text-white border-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.6)]";
                  animClass = ""; // Pulse for 6s
                } else if (b.isWide || b.isNoBall) {
                  bg = "bg-amber-600 text-black border-amber-400";
                  label = b.isWide ? "wd" : "nb";
                } else if (b.runs === 0) {
                  bg = "bg-slate-800 text-slate-500 border-slate-700";
                }

                // Highlight the Last Ball
                const isLast = i === timeline.length - 1;
                const scaleClass = isLast ? "scale-110 shadow-lg ring-2 ring-white/20" : "scale-100";

                return (
                  <div
                    key={i}
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base border transition-all ${bg} ${animClass} ${scaleClass}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. RIGHT TEAM LOGO */}
        <div className="w-24 h-24 flex-shrink-0 rounded-full bg-[#1C2128] border-4 border-[#1C2128] shadow-2xl z-20 flex items-center justify-center overflow-hidden relative -ml-6 anim-entry">
          <img
            src={rightLogo}
            alt="Team B"
            className="w-full h-full object-cover"
            onError={(e) => (e.target.src = defaultLogo)}
          />
        </div>
      </div>
    </>
  );
}