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

  // --- 1. CALCULATE SITUATION ---
  const battingTeam = currentInn.battingTeam;
  const bowlingTeam = currentInn.bowlingTeam;
  const score = currentInn.score;
  const wickets = currentInn.wickets;
  const overs = `${currentInn.over}.${currentInn.overBallCount}`;

  // Target Logic
  const isChasing = match.currentInnings === 1; 
  const inn1 = match.innings?.[0];
  const target = match.meta?.target || (inn1 ? inn1.score + 1 : 0);

  // --- 2. CHECK IF MATCH IS FINISHED ---
  const hasWon = isChasing && score >= target;
  const isMatchFinished = match.status === "completed" || match.result || hasWon;

  // Need / Balls Left
  const need = Math.max(0, target - score);
  const ballsLeft = (match.meta?.overs || 20) * 6 - (currentInn.over * 6 + currentInn.overBallCount);
  
  const projectedScore = Math.round(
    (score / (currentInn.over * 6 + currentInn.overBallCount || 1)) * ((match.meta?.overs || 20) * 6)
  );

  // Batsmen
  const striker = normalizeName(currentInn.striker);
  const sStats = currentInn.batsmenStats?.[striker] || { runs: 0, balls: 0 };
  
  const nonStriker = normalizeName(currentInn.nonStriker);
  const nsStats = currentInn.batsmenStats?.[nonStriker] || { runs: 0, balls: 0 };

  // Bowler
  const bowler = normalizeName(currentInn.currentBowler);
  const bStats = currentInn.bowlerStats?.[bowler] || { wickets: 0, runs: 0, balls: 0 };
  
  const ballsInThisOver = bStats.balls % 6; 
  const bOvers = `${Math.floor(bStats.balls / 6)}.${ballsInThisOver}`;

  // --- RESULT TEXT GENERATION ---
  let resultText = "";
  if (isMatchFinished) {
    if (match.result) {
      resultText = match.result; 
    } else if (hasWon) {
        resultText = `${battingTeam} won by ${10 - wickets} wickets`;
    } else if (isChasing && ballsLeft <= 0 && score < target - 1) {
        resultText = `${bowlingTeam} won by ${target - score - 1} runs`;
    } else if (isChasing && score === target - 1 && ballsLeft <= 0) {
        resultText = "MATCH TIED";
    } else {
       resultText = "MATCH ENDED";
    }
  }

  // --- TIMELINE LOGIC ---
  const allBalls = currentInn.timeline || [];
  const currentOverIndex = parseInt(currentInn.over || 0);
  let timeline = allBalls.filter((ball) => ball.over != undefined && ball.over == currentOverIndex);
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
      <style>
        {`
          @keyframes obsPopIn {
            0% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .anim-entry { animation: obsPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          .glossy-bg {
            background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%);
          }
        `}
      </style>

      <div className="w-full flex items-center justify-center font-sans px-4">
        
        {/* 1. LEFT TEAM LOGO */}
        <div className="w-24 h-24 flex-shrink-0 rounded-full bg-[#0b0f19] border-4 border-[#00b4d8] shadow-[0_0_20px_rgba(0,180,216,0.3)] z-20 flex items-center justify-center overflow-hidden relative -mr-8 anim-entry">
          <img src={leftLogo} alt="Team A" className="w-full h-full object-cover" onError={(e) => (e.target.src = defaultLogo)} />
        </div>

        {/* 2. CAPSULE CONTAINER */}
        <div className="w-full max-w-[1700px] h-[130px] bg-[#0b0f19] rounded-full border-[3px] border-[#00b4d8]/50 shadow-[0_10px_50px_rgba(0,0,0,0.8)] flex overflow-hidden relative z-10">
          
          {/* Gloss Overlay */}
          <div className="absolute inset-0 glossy-bg pointer-events-none z-0"></div>
          
          {/* --- LEFT SECTION (Batsman) --- */}
          {/* PL-14 pushes content right to avoid logo */}
          <div className="w-[32%] flex flex-col justify-center pl-14 pr-4 border-r border-[#00b4d8]/20 bg-gradient-to-r from-[#002855]/60 to-[#0b0f19] relative z-10">
            {!isMatchFinished ? (
              <>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-0 h-0 border-l-[10px] border-l-[#00b4d8] border-y-[6px] border-y-transparent"></div>
                    <span className="text-white font-black text-2xl uppercase tracking-tight truncate max-w-[180px] drop-shadow-md">{striker}</span>
                  </div>
                  <div className="text-[#00b4d8] font-mono font-black text-3xl drop-shadow-sm">{sStats.runs} <span className="text-slate-400 text-lg font-sans font-bold">({sStats.balls})</span></div>
                </div>
                <div className="flex justify-between items-center opacity-70">
                  <span className="text-slate-300 font-bold text-xl uppercase tracking-tight pl-5 truncate max-w-[180px]">{nonStriker}</span>
                  <div className="text-slate-300 font-mono font-bold text-2xl">{nsStats.runs} <span className="text-slate-500 text-base font-sans">({nsStats.balls})</span></div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                 <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">{match.innings[0]?.battingTeam}</span>
                 <span className="text-white font-black text-4xl">{match.innings[0]?.score}/{match.innings[0]?.wickets}</span>
                 <span className="text-[#00b4d8] font-mono text-sm font-bold">({match.innings[0]?.over}.{match.innings[0]?.overBallCount} Ov)</span>
              </div>
            )}
          </div>

          {/* --- CENTER: SCOREBOARD --- */}
          <div className="flex-1 bg-[#0b0f19] relative flex flex-col items-center justify-center px-4 overflow-hidden border-x border-[#00b4d8]/30">
            {/* Center Gradient Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#00b4d8]/10 to-transparent"></div>

            {!isMatchFinished ? (
              <>
                <div className="relative z-10 w-full flex items-center justify-between px-2">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[#00b4d8] font-black text-3xl uppercase tracking-widest leading-none drop-shadow-[0_0_10px_rgba(0,180,216,0.5)]">{battingTeam.substring(0, 3)}</span>
                    <span className="text-slate-500 font-bold text-sm uppercase tracking-widest">Batting</span>
                  </div>
                  
                  {/* MAIN SCORE CAPSULE */}
                  <div className="bg-gradient-to-b from-[#004e9a] to-[#002855] text-white px-10 py-1 rounded-xl shadow-[0_0_20px_rgba(0,78,154,0.4)] border border-[#00b4d8]/50 transform scale-110">
                    <span className="font-black text-6xl tracking-tighter drop-shadow-xl">{score}/{wickets}</span>
                  </div>

                  <div className="flex flex-col items-start ml-4">
                     <div className="bg-[#111] text-white px-4 py-1 rounded-lg border border-slate-700 flex flex-col items-center min-w-[90px]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Overs</span>
                        <span className="font-black text-3xl leading-none text-[#00b4d8]">{overs}</span>
                     </div>
                  </div>
                </div>
                <div className="relative z-10 mt-3">
                  {isChasing ? (
                    <div className="text-yellow-400 text-sm font-black uppercase tracking-[0.2em] drop-shadow-sm">Need <span className="text-white text-lg">{need}</span> off <span className="text-white text-lg">{ballsLeft}</span> balls</div>
                  ) : (
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Proj. Score: <span className="text-white">{projectedScore}</span></div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center z-10">
                 <span className="text-yellow-400 font-black text-xl uppercase tracking-[0.3em] mb-1 drop-shadow-md">MATCH FINISHED</span>
                 <span className="text-white font-black text-3xl uppercase tracking-wider text-center leading-none">{resultText}</span>
              </div>
            )}
          </div>

          {/* --- RIGHT SECTION (Bowler) --- */}
          {/* PR-14 pushes content left to avoid logo */}
          <div className="w-[32%] flex flex-col justify-center pl-4 pr-14 border-l border-[#00b4d8]/20 bg-gradient-to-l from-[#002855]/60 to-[#0b0f19] relative z-10">
             {!isMatchFinished ? (
                <>
                  <div className="flex justify-between items-center mb-2 border-b border-[#00b4d8]/20 pb-1">
                    <span className="text-white font-bold text-xl uppercase tracking-tight truncate max-w-[180px]">{bowler}</span>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-yellow-400 font-mono font-bold text-2xl">{bStats.wickets}-{bStats.runs}</span>
                      <span className="text-slate-500 text-sm font-bold ml-2">{bOvers} Ov</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end"> 
                    {timeline.map((b, i) => {
                        // NEW BUBBLE COLORS
                        let bubbleClass = "bg-[#1f2937] border-slate-600 text-slate-400"; // Dot ball
                        if(b.isWicket) bubbleClass = "bg-[#ef4444] border-red-400 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                        else if(b.runs === 4) bubbleClass = "bg-[#06b6d4] border-cyan-400 text-black font-black";
                        else if(b.runs === 6) bubbleClass = "bg-[#eab308] border-yellow-300 text-black font-black shadow-[0_0_10px_rgba(234,179,8,0.5)]";
                        else if(b.runs > 0) bubbleClass = "bg-[#374151] border-slate-500 text-white";

                        return (
                          <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${bubbleClass}`}>
                            {b.isWicket ? 'W' : b.runs}
                          </div>
                        );
                    })}
                  </div>
                </>
             ) : (
                match.innings[1] ? (
                  <div className="flex flex-col items-center">
                    <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">{match.innings[1]?.battingTeam}</span>
                    <span className="text-white font-black text-4xl">{match.innings[1]?.score}/{match.innings[1]?.wickets}</span>
                    <span className="text-[#00b4d8] font-mono text-sm font-bold">({match.innings[1]?.over}.{match.innings[1]?.overBallCount} Ov)</span>
                  </div>
                ) : (
                   <div className="flex items-center justify-center h-full text-slate-500 uppercase font-bold text-sm tracking-widest">Innings Break</div>
                )
             )}
          </div>
        </div>

        {/* 3. RIGHT TEAM LOGO */}
        <div className="w-24 h-24 flex-shrink-0 rounded-full bg-[#0b0f19] border-4 border-[#00b4d8] shadow-[0_0_20px_rgba(0,180,216,0.3)] z-20 flex items-center justify-center overflow-hidden relative -ml-8 anim-entry">
          <img src={rightLogo} alt="Team B" className="w-full h-full object-cover" onError={(e) => (e.target.src = defaultLogo)} />
        </div>
      </div>
    </>
  );
}