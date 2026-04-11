import React, { useState, useEffect, useRef } from "react";
import { Zap } from "lucide-react";

// --- HELPERS ---
const normalizeName = (p) => {
  if (!p) return "";
  if (typeof p === "object") return p.name || p.playerName || "";
  return String(p).trim();
};

const normalizeTeam = (t) => {
  return (t || "").toString().trim().toLowerCase();
};

const getInitials = (name) => {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
};

export default function ScoreTicker({ match }) {
  // 🔥 NEW: State and Ref to track Score Changes for the "Pop" Animation
  const [scoreAnim, setScoreAnim] = useState(false);
  const prevScoreRef = useRef(0);

  const currentInnIdx = match?.currentInnings || 0;
  const currentInn = match?.innings?.[currentInnIdx];

  // 🔥 NEW: Trigger animation when the score goes up
  useEffect(() => {
    if (currentInn && currentInn.score !== prevScoreRef.current) {
      // Only animate if the score actually increased (don't pop on initial load of 0)
      if (prevScoreRef.current !== 0 || currentInn.score > 0) {
        setScoreAnim(true);
        const timer = setTimeout(() => setScoreAnim(false), 400); // 400ms animation duration
        prevScoreRef.current = currentInn.score;
        return () => clearTimeout(timer);
      }
      prevScoreRef.current = currentInn.score;
    }
  }, [currentInn?.score]);

  if (!match || !currentInn) return null;

  // --- 1. CALCULATE SITUATION ---
  const battingTeam = currentInn.battingTeam || match.meta?.teamA;
  const bowlingTeam = currentInn.bowlingTeam || match.meta?.teamB;
  const score = currentInn.score || 0;
  const wickets = currentInn.wickets || 0;
  const overs = currentInn.over || 0;
  const balls = currentInn.overBallCount || 0;
  const displayOvers = `${overs}.${balls}`;
  const totalBalls = overs * 6 + balls;

  const crr = totalBalls > 0 ? ((score / totalBalls) * 6).toFixed(1) : "0.0";

  // Target & Equations Logic
  const isChasing = currentInnIdx === 1;
  const inn1 = match.innings?.[0];
  const target = match.meta?.target || (inn1 ? inn1.score + 1 : null);
  const totalMatchOvers = match.meta?.overs || 20;
  const totalMatchBalls = totalMatchOvers * 6;

  let rrrVal = "";
  let equationStr = "";
  let projScoreStr = "";
  let runsNeeded = 0;

  if (isChasing && target) {
    runsNeeded = target - score;
    const ballsRemaining = totalMatchBalls - totalBalls;
    
    if (runsNeeded <= 0) {
      equationStr = "SCORES LEVEL";
    } else if (ballsRemaining > 0) {
      rrrVal = ((runsNeeded / ballsRemaining) * 6).toFixed(1);
      equationStr = `NEED ${runsNeeded} IN ${ballsRemaining}`;
    }
  } else if (!isChasing && totalBalls > 0) {
    const projScore = Math.round((score / totalBalls) * totalMatchBalls);
    projScoreStr = `PROJ: ${projScore}`;
  }

  // --- 2. CHECK IF MATCH IS FINISHED ---
  const hasWon = isChasing && score >= target;
  const isMatchFinished = match.status === "completed" || match.result || hasWon;

  // Player Stats
  const striker = normalizeName(currentInn.striker);
  const nonStriker = normalizeName(currentInn.nonStriker);
  const bowler = normalizeName(currentInn.currentBowler);

  const sStats = currentInn.batsmenStats?.[striker] || { runs: 0, balls: 0 };
  const nsStats = currentInn.batsmenStats?.[nonStriker] || { runs: 0, balls: 0 };
  const bStats = currentInn.bowlerStats?.[bowler] || { wickets: 0, runs: 0, balls: 0 };
  
  const ballsInThisOver = bStats.balls % 6;
  const bOvers = `${Math.floor(bStats.balls / 6)}.${ballsInThisOver}`;

  // --- 3. TIMELINE LOGIC ---
  const allBalls = currentInn.timeline || [];
  const currentOverIndex = parseInt(currentInn.over || 0);
  let timeline = allBalls.filter((ball) => ball.over != undefined && ball.over == currentOverIndex);
  
  if (timeline.length === 0 && ballsInThisOver > 0) {
    const buffer = ballsInThisOver + 2;
    timeline = allBalls.slice(-buffer).filter((b) => normalizeName(b.bowler) === bowler);
  }

  // --- 4. SMART LOGIC (Strict Left=Batting, Right=Bowling Sync) ---
  const teamA = match.meta?.teamA;
  
  const isTeamABatting = normalizeTeam(battingTeam) === normalizeTeam(teamA);

  const defaultLogo = "https://cdn-icons-png.flaticon.com/512/164/164449.png";
  
  const battingLogo = isTeamABatting 
    ? (match?.meta?.teamALogo || match?.teamA_Image || defaultLogo) 
    : (match?.meta?.teamBLogo || match?.teamB_Image || defaultLogo);
    
  const bowlingLogo = isTeamABatting 
    ? (match?.meta?.teamBLogo || match?.teamB_Image || defaultLogo) 
    : (match?.meta?.teamALogo || match?.teamA_Image || defaultLogo);

  const defaultTeamAColor = match?.meta?.teamAColor || "#0284c7"; 
  const defaultTeamBColor = match?.meta?.teamBColor || "#e11d48"; 

  const battingColor = isTeamABatting ? defaultTeamAColor : defaultTeamBColor;
  const bowlingColor = isTeamABatting ? defaultTeamBColor : defaultTeamAColor;

  const battingInitials = getInitials(battingTeam);
  const bowlingInitials = getInitials(bowlingTeam);

  const tossWinner = match.toss?.winner || match.meta?.toss?.winner;
  const tossDecision = match.toss?.decision || match.meta?.toss?.decision;
  
  let scoreContextText = `${bowlingTeam} Bowling`;
  if (currentInnIdx === 0 && overs < 2 && tossWinner) {
    scoreContextText = `${tossWinner} won toss, elected to ${tossDecision}`;
  }

  let resultText = "";
  if (isMatchFinished) {
    if (match.result) resultText = match.result;
    else if (isChasing && score >= target) resultText = `${battingTeam} won by ${match.meta?.totalWickets || 10 - wickets} wickets`;
    else if (isChasing && (wickets >= (match.meta?.totalWickets || 10) || totalBalls >= match.meta?.overs * 6)) {
      resultText = `${bowlingTeam} won by ${target - 1 - score} runs`;
    } else resultText = "MATCH ENDED";
  }

  return (
    <>
      <style>
        {`
          /* 1. Global Ticker Entry */
          @keyframes slideUpFade {
            0% { transform: translateY(100%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .anim-entry { animation: slideUpFade 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

          /* 🔥 2. Score Pop Animation */
          @keyframes scorePop {
            0% { transform: scale(1); color: white; text-shadow: none; }
            30% { transform: scale(1.15); color: #fde047; text-shadow: 0 0 20px rgba(253, 224, 71, 0.8); }
            100% { transform: scale(1); color: white; text-shadow: none; }
          }
          .animate-scorePop { animation: scorePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

          /* 🔥 3. Striker Pulse Glow */
          @keyframes pulseGlow {
            0% { opacity: 0.7; transform: scale(0.9); filter: drop-shadow(0 0 2px rgba(251,191,36,0.5)); }
            50% { opacity: 1; transform: scale(1.15); filter: drop-shadow(0 0 10px rgba(251,191,36,1)); }
            100% { opacity: 0.7; transform: scale(0.9); filter: drop-shadow(0 0 2px rgba(251,191,36,0.5)); }
          }
          .animate-pulseGlow { animation: pulseGlow 1.5s ease-in-out infinite; }

          /* 🔥 4. Timeline Stagger Pop */
          @keyframes popIn {
            0% { transform: scale(0.3); opacity: 0; }
            70% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>

      {/* Main Container */}
      <div className="absolute bottom-6 left-0 w-full flex flex-col items-center font-sans px-8 anim-entry drop-shadow-2xl">
        
        {/* --- DYNAMIC TOP BAR --- */}
        <div className="w-full max-w-[1750px] flex justify-between items-end px-4 mb-2 z-10">
          <div className="w-[200px] text-center">
            <span className="block bg-slate-900/95 border border-white/20 rounded-full px-4 py-1.5 shadow-lg text-xs font-black uppercase tracking-widest text-white truncate drop-shadow-md">
              {battingTeam}
            </span>
          </div>

          {!isMatchFinished && (
            <div className="flex items-center gap-6 bg-slate-900/95 border border-white/20 rounded-full px-8 py-1.5 shadow-lg text-xs font-black uppercase tracking-widest text-white">
              <span className="text-amber-400">
                {currentInnIdx === 0 ? "1st Innings" : "2nd Innings"}
              </span>
              <span className="text-white/40">|</span>
              <span className="drop-shadow-md truncate max-w-[300px]">
                {match.meta?.matchTitle || "Live Match"}
              </span>
              
              {isChasing && target ? (
                <>
                  <span className="text-white/40">|</span>
                  <span className="text-cyan-400 drop-shadow-md">
                    {battingTeam} needs {runsNeeded} runs
                  </span>
                </>
              ) : (currentInnIdx === 0 && overs < 2 && tossWinner) ? (
                <>
                  <span className="text-white/40">|</span>
                  <span className="text-cyan-400 drop-shadow-md">
                    {tossWinner} won toss, elected to {tossDecision}
                  </span>
                </>
              ) : null}
            </div>
          )}

          <div className="w-[200px] text-center">
            <span className="block bg-slate-900/95 border border-white/20 rounded-full px-4 py-1.5 shadow-lg text-xs font-black uppercase tracking-widest text-white truncate drop-shadow-md">
              {bowlingTeam}
            </span>
          </div>
        </div>

        {/* --- MAIN CAPSULE TICKER --- */}
        <div 
          className="w-full max-w-[1750px] h-[110px] flex relative overflow-hidden rounded-full border-[3px] border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          style={{ 
            background: `linear-gradient(to right, ${battingColor} 0%, ${battingColor} 15%, rgba(15, 23, 42, 0.95) 28%, rgba(15, 23, 42, 0.95) 72%, ${bowlingColor} 85%, ${bowlingColor} 100%)` 
          }}>
          
          <div className="relative z-10 w-full flex h-full">
            
            {/* 1. LEFT BATTING LOGO */}
            <div className="w-[160px] h-full shrink-0 flex items-center justify-center p-2">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-lg border-[3px] border-white/50 relative z-20">
                <img src={battingLogo} alt="Batting Team" className="w-full h-full object-contain" onError={(e) => (e.target.src = defaultLogo)} />
              </div>
            </div>

            {isMatchFinished ? (
              <div className="flex-1 flex items-center justify-center bg-black/40 backdrop-blur-md">
                <span className="text-amber-400 font-black text-3xl uppercase tracking-[0.3em] mr-6 drop-shadow-md">Match Finished:</span>
                <span className="text-white font-black text-5xl uppercase tracking-wider drop-shadow-lg">{resultText}</span>
              </div>
            ) : (
              <>
                {/* 2. SCORE COLUMN */}
                <div className="w-[360px] h-full flex flex-col justify-center border-r border-white/10 shrink-0 bg-black/30">
                  <div className="text-white text-xl font-black tracking-widest mt-2 uppercase drop-shadow-md px-10">
                    {battingInitials} <span className="text-white/50 mx-2 text-lg">VS</span> {bowlingInitials}
                  </div>
                  <div className="flex items-baseline gap-4 px-10">
                    {/* 🔥 SCORE POP APPLIED HERE 🔥 */}
                    <span className={`font-mono text-[5rem] font-black leading-none drop-shadow-lg tracking-tighter origin-left inline-block ${scoreAnim ? 'animate-scorePop' : 'text-white'}`}>
                      {score}<span className="text-[3.5rem] text-white/80">/{wickets}</span>
                    </span>
                    <span className="font-bold text-2xl text-white/90 leading-none drop-shadow-md bg-black/30 px-3 py-1.5 rounded border border-white/10">
                      {displayOvers} <span className="text-lg font-normal text-white/60">Ov</span>
                    </span>
                  </div>
                  <div className="text-xs text-amber-400 font-bold uppercase tracking-wider truncate mt-1.5 drop-shadow-sm px-10">
                    {scoreContextText}
                  </div>
                </div>

                {/* 3. BATSMEN COLUMN */}
                <div className="w-[400px] h-full flex flex-col justify-center px-8 border-r border-white/10 shrink-0 text-white shadow-[10px_0_20px_rgba(0,0,0,0.2)] bg-black/20">
                  <div className={`flex justify-between items-end ${striker ? "font-bold" : "opacity-50"}`}>
                    <span className="truncate pr-3 flex items-center gap-2 text-2xl drop-shadow-md">
                      {striker || "Striker"}
                      {/* 🔥 STRIKER PULSE APPLIED HERE 🔥 */}
                      {striker && <Zap size={18} className="text-amber-400 fill-amber-400 animate-pulseGlow" />}
                    </span>
                    <span className="font-mono text-4xl font-black drop-shadow-md leading-none">
                      {sStats.runs}<span className="text-lg font-sans font-bold text-white/60 ml-2">({sStats.balls})</span>
                    </span>
                  </div>
                  <div className={`flex justify-between items-end mt-2 ${!striker ? "font-bold" : "text-white/70"}`}>
                    <span className="truncate pr-3 text-xl drop-shadow-md">
                      {nonStriker || "Non-Striker"}
                    </span>
                    <span className="font-mono text-3xl font-bold drop-shadow-md leading-none">
                      {nsStats.runs}<span className="text-base font-sans text-white/50 ml-2">({nsStats.balls})</span>
                    </span>
                  </div>
                </div>

                {/* 4. CENTER MATH BOX */}
                <div className="w-[280px] h-full flex flex-col justify-center items-center px-4 bg-black/50 border-r border-white/10 shrink-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                  {isChasing ? (
                    <>
                      <div className="flex w-full justify-between items-center px-4 mb-2">
                        <div className="text-center">
                          <div className="text-[10px] font-black text-white/50 tracking-widest uppercase">Target</div>
                          <div className="text-xl font-black text-white drop-shadow-md">{target}</div>
                        </div>
                        <div className="h-8 w-px bg-white/20"></div>
                        <div className="text-center">
                          <div className="text-[10px] font-black text-white/50 tracking-widest uppercase">CRR</div>
                          <div className="text-xl font-black text-white drop-shadow-md">{crr}</div>
                        </div>
                        <div className="h-8 w-px bg-white/20"></div>
                        <div className="text-center">
                          <div className="text-[10px] font-black text-amber-500/70 tracking-widest uppercase">RRR</div>
                          <div className="text-xl font-black text-amber-400 drop-shadow-md">{rrrVal || "-"}</div>
                        </div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded text-amber-400 font-black text-[11px] tracking-widest uppercase drop-shadow-md whitespace-nowrap">
                        {equationStr}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex w-full justify-center gap-8 items-center">
                        <div className="text-center">
                          <div className="text-xs font-black text-white/50 tracking-widest uppercase mb-1">CRR</div>
                          <div className="text-3xl font-black text-white drop-shadow-md">{crr}</div>
                        </div>
                        <div className="h-10 w-px bg-white/20"></div>
                        <div className="text-center">
                          <div className="text-xs font-black text-cyan-500/70 tracking-widest uppercase mb-1">Projected</div>
                          <div className="text-3xl font-black text-cyan-400 drop-shadow-md">{projScoreStr.replace("PROJ: ", "")}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 5. BOWLER & TIMELINE COLUMN */}
                <div className="flex-1 h-full flex flex-col justify-center px-8 border-r border-white/10 overflow-hidden min-w-[300px] bg-black/10">
                  <div className="flex justify-between items-end mb-2.5 w-full">
                    <span className="font-bold text-white text-2xl truncate pr-4 drop-shadow-md">
                      {bowler || "Bowler"}
                    </span>
                    <span className="font-mono text-3xl text-white font-black shrink-0 drop-shadow-md leading-none">
                      {bStats.wickets}-{bStats.runs} 
                      <span className="text-lg font-sans font-normal text-white/70 ml-2">({bOvers})</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-start gap-2 overflow-hidden w-full py-1">
                    {timeline.length === 0 ? (
                      <span className="text-sm text-white/40 italic font-bold">Starting over...</span>
                    ) : (
                      timeline.map((b, i) => {
                        let text = b.runs === 0 ? "•" : b.runs;
                        let bubbleClass = "bg-white/10 border-white/20 text-white";

                        if (b.isWicket) {
                          text = "W";
                          bubbleClass = "bg-rose-600 border-rose-400 text-white shadow-[0_0_10px_rgba(225,29,72,0.5)]";
                        } else if (b.isWide || b.isNoBall) {
                          text = b.runs > 0 ? `${b.runs}${b.isWide ? 'wd' : 'nb'}` : (b.isWide ? 'wd' : 'nb');
                          bubbleClass = "bg-indigo-600 border-indigo-400 text-white";
                        } else if (b.isLegBye || b.isBye) {
                          text = b.runs > 0 ? `${b.runs}${b.isBye ? 'b' : 'lb'}` : (b.isBye ? 'b' : 'lb');
                          bubbleClass = "bg-white/20 border-white/30 text-white";
                        } else if (b.runs === 4) {
                          text = "4";
                          bubbleClass = "bg-teal-400 border-teal-200 text-slate-900 shadow-[0_0_10px_rgba(45,212,191,0.5)]";
                        } else if (b.runs === 6) {
                          text = "6";
                          bubbleClass = "bg-amber-400 border-amber-200 text-slate-900 shadow-[0_0_10px_rgba(251,191,36,0.5)]";
                        }

                        const textStr = text.toString();
                        const textSize = textStr.length > 2 ? "text-[11px]" : "text-lg";

                        return (
                          // 🔥 TIMELINE STAGGER POP APPLIED HERE 🔥
                          <div 
                            key={b.id || i} // Use a unique ID if possible, otherwise index
                            className={`w-11 h-11 border-2 rounded-full shrink-0 flex items-center justify-center font-black ${bubbleClass} ${textSize} uppercase opacity-0`}
                            style={{
                              animation: `popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
                              animationDelay: `${i * 0.08}s` // 80ms stagger delay per ball
                            }}
                          >
                            {text}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 6. RIGHT BOWLING LOGO */}
            <div className="w-[160px] h-full shrink-0 flex items-center justify-center p-2">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-lg border-[3px] border-white/50 relative z-20">
                <img src={bowlingLogo} alt="Bowling Team" className="w-full h-full object-contain" onError={(e) => (e.target.src = defaultLogo)} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}