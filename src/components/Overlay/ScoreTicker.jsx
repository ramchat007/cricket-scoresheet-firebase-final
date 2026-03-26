import React from "react";
import { Zap } from "lucide-react";

// --- HELPER: Handle Object vs String names ---
const normalizeName = (p) => {
  if (!p) return "";
  if (typeof p === "object") return p.name || p.playerName || "";
  return String(p).trim();
};

export default function ScoreTicker({ match }) {
  if (!match) return null;

  const currentInnIdx = match.currentInnings || 0;
  const currentInn = match.innings?.[currentInnIdx];
  if (!currentInn) return null;

  // --- 1. CALCULATE SITUATION ---
  const battingTeam = currentInn.battingTeam;
  const bowlingTeam = currentInn.bowlingTeam;
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

  if (isChasing && target) {
    const runsNeeded = target - score;
    const ballsRemaining = totalMatchBalls - totalBalls;

    if (runsNeeded <= 0) {
      equationStr = "SCORES LEVEL";
    } else if (ballsRemaining > 0) {
      rrrVal = ((runsNeeded / ballsRemaining) * 6).toFixed(1);
      equationStr = `NEED ${runsNeeded} RUNS FROM ${ballsRemaining} BALLS`;
    }
  } else if (!isChasing && totalBalls > 0) {
    const projScore = Math.round((score / totalBalls) * totalMatchBalls);
    projScoreStr = `PROJ. SCORE: ${projScore}`;
  }

  // --- 2. CHECK IF MATCH IS FINISHED ---
  const hasWon = isChasing && score >= target;
  const isMatchFinished =
    match.status === "completed" || match.result || hasWon;

  const striker = normalizeName(currentInn.striker);
  const nonStriker = normalizeName(currentInn.nonStriker);
  const bowler = normalizeName(currentInn.currentBowler);

  const sStats = currentInn.batsmenStats?.[striker] || { runs: 0, balls: 0 };
  const nsStats = currentInn.batsmenStats?.[nonStriker] || {
    runs: 0,
    balls: 0,
  };

  const bStats = currentInn.bowlerStats?.[bowler] || {
    wickets: 0,
    runs: 0,
    balls: 0,
  };
  const ballsInThisOver = bStats.balls % 6;
  const bOvers = `${Math.floor(bStats.balls / 6)}.${ballsInThisOver}`;

  // --- 3. TIMELINE LOGIC ---
  const allBalls = currentInn.timeline || [];
  const currentOverIndex = parseInt(currentInn.over || 0);
  let timeline = allBalls.filter(
    (ball) => ball.over != undefined && ball.over == currentOverIndex,
  );
  if (timeline.length === 0 && ballsInThisOver > 0) {
    const buffer = ballsInThisOver + 2;
    timeline = allBalls
      .slice(-buffer)
      .filter((b) => normalizeName(b.bowler) === bowler);
  }

  const isLongOver = timeline.length > 6;
  const timelineGap = isLongOver ? "gap-2" : "gap-3";

  // --- 4. SMART TOSS LOGIC ---
  const tossWinner = match.toss?.winner || match.meta?.toss?.winner;
  const tossDecision = match.toss?.decision || match.meta?.toss?.decision;
  const showToss = currentInnIdx === 0 && overs < 1 && tossWinner;
  const tossStr = showToss
    ? `${tossWinner} won toss, elected to ${tossDecision}`
    : "";

  // Logos
  const defaultLogo = "https://cdn-icons-png.flaticon.com/512/164/164449.png";
  const leftLogo = match?.meta?.teamALogo || match?.teamA_Image || defaultLogo;
  const rightLogo = match?.meta?.teamBLogo || match?.teamB_Image || defaultLogo;

  let resultText = "";
  if (isMatchFinished) {
    if (match.result) {
      resultText = match.result;
    } else if (isChasing && score >= target) {
      resultText = `${battingTeam} won by ${match.meta?.totalWickets || 10 - wickets} wickets`;
    } else if (
      isChasing &&
      (wickets >= (match.meta?.totalWickets || 10) ||
        totalBalls >= match.meta?.overs * 6)
    ) {
      const runsShort = target - 1 - score;
      resultText = `${bowlingTeam} won by ${runsShort} runs`;
    } else {
      resultText = "MATCH ENDED";
    }
  }

  // 🔥 5. DYNAMIC TEAM THEME COLORS 🔥
  const teamA = match.meta?.teamA;
  const teamB = match.meta?.teamB;

  const defaultTeamAColor = "#0284c7"; // Blue
  const defaultTeamBColor = "#e11d48"; // Rose

  const teamAColor = match.meta?.teamAColor || defaultTeamAColor;
  const teamBColor = match.meta?.teamBColor || defaultTeamBColor;

  let battingColor = defaultTeamAColor;
  let bowlingColor = defaultTeamBColor;

  if (battingTeam === teamA) {
    battingColor = teamAColor;
    bowlingColor = teamBColor;
  } else if (battingTeam === teamB) {
    battingColor = teamBColor;
    bowlingColor = teamAColor;
  }

  return (
    <>
      <style>
        {`
          @keyframes obsPopIn {
            0% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .anim-entry { animation: obsPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        `}
      </style>

      <div className="w-full flex items-end justify-center font-sans px-4 pb-4">
        {/* --- LEFT TEAM LOGO --- */}
        <div
          className="w-36 h-36 flex-shrink-0 rounded-full bg-slate-900 border-[5px] shadow-[0_0_20px_rgba(0,0,0,0.5)] z-30 flex items-center justify-center overflow-hidden relative -mr-8 anim-entry mb-2"
          style={{ borderColor: teamAColor }}>
          <img
            src={leftLogo}
            alt="Team A"
            className="w-full h-full object-cover bg-white"
            onError={(e) => (e.target.src = defaultLogo)}
          />
        </div>

        {/* --- MAIN TICKER CONTAINER --- */}
        <div className="w-full max-w-[1750px] flex flex-col items-center relative z-20">
          {/* --- TOP TIER: Match Context Bar --- */}
          <div 
            className="rounded-t-xl px-10 py-2 flex items-center justify-between relative text-slate-300 w-[96%] shadow-lg border-t border-x border-white/20"
            // 🔥 REDUCED TOP BAR GRADIENT
            style={{
              background: `linear-gradient(to right, ${teamAColor} 0%, ${teamAColor} 15%, rgba(15, 23, 42, 0.95) 25%, rgba(15, 23, 42, 0.95) 75%, ${teamBColor} 85%, ${teamBColor} 100%)`
            }}
          >
            {/* Left: Match Info (🟢 Now has 45% of the screen to expand) */}
            <div className="flex gap-4 items-center justify-start w-[45%] z-10 pr-4">
              <span className="text-white font-black tracking-widest text-lg uppercase drop-shadow-md bg-black/30 px-3 py-0.5 rounded shadow shrink-0 max-w-[50%] truncate">
                {match.meta?.matchTitle || "Match"}
              </span>
              <span className="opacity-40 text-sm shrink-0">|</span>
              <span className="font-bold text-xl tracking-wide text-white drop-shadow-md flex items-center truncate">
                <span className="truncate" style={{ color: teamAColor }}>{match.meta?.teamA}</span>
                <span className="text-white/60 font-normal mx-2 drop-shadow-none shrink-0">vs</span>
                <span className="truncate" style={{ color: teamBColor }}>{match.meta?.teamB}</span>
              </span>
            </div>

            {/* Center: 🏏 Equation / Projected Score (🟢 Absolutely centered) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex justify-center items-center z-10">
              {!isMatchFinished &&
                (isChasing && equationStr ? (
                  <span className="text-amber-400 font-black text-base uppercase tracking-widest bg-amber-500/10 px-6 py-1 rounded border border-amber-500/30 drop-shadow-md whitespace-nowrap">
                    {equationStr}
                  </span>
                ) : !isChasing && projScoreStr ? (
                  <span className="text-cyan-400 font-black text-base uppercase tracking-widest bg-cyan-500/10 px-6 py-1 rounded border border-cyan-500/30 drop-shadow-md whitespace-nowrap">
                    {projScoreStr}
                  </span>
                ) : null)}
            </div>

            {/* Right: Toss OR Target */}
            <div className="flex justify-end items-center z-10 w-[30%]">
              {showToss && (
                <span className="text-white italic text-base font-bold tracking-wide drop-shadow-md truncate">
                  {tossStr}
                </span>
              )}

              {isChasing && target && (
                <div className="flex items-center text-amber-400 bg-amber-500/10 px-5 py-1 rounded-md border border-amber-500/20 whitespace-nowrap shrink-0">
                  <span className="font-black tracking-widest uppercase text-sm">
                    Target:{" "}
                    <span className="text-white text-2xl ml-2">{target}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* --- BOTTOM TIER: Live Stats Capsule --- */}
          <div
            className="w-full h-[90px] rounded-full border-[4px] border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex overflow-hidden"
            // 🔥 SMOOTH LONG FADE: Color fades smoothly starting from 0% out to 35%
            style={{
              background: `linear-gradient(to right, ${battingColor} 0%, rgba(11, 17, 32, 0.95) 35%, rgba(11, 17, 32, 0.95) 65%, ${bowlingColor} 100%)`,
            }}>
            {/* 1. Team & Main Score */}
            <div className="px-8 flex items-center justify-between text-white w-[460px] shrink-0 bg-black/20 shadow-[10px_0_20px_rgba(0,0,0,0.3)] z-30 border-r border-white/10">
              <span className="font-black text-3xl tracking-tight truncate flex-1 pr-4 uppercase drop-shadow-md">
                {battingTeam}
              </span>
              <div className="flex items-baseline gap-4 shrink-0">
                <div className="font-mono font-black text-[4.5rem] tracking-tighter leading-none mt-2 drop-shadow-md">
                  {score}
                  <span className="text-[2.75rem] text-white/70 leading-none">
                    /{wickets}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white bg-black/30 px-3 py-1 rounded leading-none border border-white/10">
                  {displayOvers}
                </div>
              </div>
            </div>

            {!isMatchFinished ? (
              <>
                {/* 2. Batsmen */}
                <div className="flex flex-col justify-center px-8 border-r border-white/10 text-slate-200 w-[420px] shrink-0 z-20">
                  <div
                    className={`flex justify-between items-center ${striker ? "font-bold text-white" : ""}`}>
                    <span className="truncate flex-1 pr-3 flex items-center gap-2 text-xl drop-shadow-md">
                      {striker || "Striker"}
                      {striker && (
                        <Zap
                          size={14}
                          className="text-amber-400 fill-amber-400 drop-shadow-md shrink-0"
                        />
                      )}
                    </span>
                    <span className="font-mono text-3xl font-black drop-shadow-md text-white shrink-0">
                      {sStats.runs}
                      <span className="text-base font-sans text-slate-300 font-bold ml-1.5">
                        ({sStats.balls})
                      </span>
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center mt-1 ${!striker ? "font-bold text-white" : "text-white/70"}`}>
                    <span className="truncate flex-1 pr-3 text-lg drop-shadow-md">
                      {nonStriker || "Non-Striker"}
                    </span>
                    <span className="font-mono text-xl font-bold drop-shadow-md text-white shrink-0">
                      {nsStats.runs}
                      <span className="text-sm font-sans text-white/50 ml-1.5">
                        ({nsStats.balls})
                      </span>
                    </span>
                  </div>
                </div>

                {/* 3. 📈 RUN RATES ZONE (Center) 📈 */}
                <div className="flex-1 relative flex items-center justify-center gap-10 overflow-hidden border-r border-white/10">
                  {/* CRR Block */}
                  {totalBalls > 0 && (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-white/60 font-black text-sm uppercase tracking-widest mb-0.5">
                        CRR
                      </span>
                      <span className="text-white font-mono font-black text-[2.2rem] leading-none drop-shadow-md">
                        {crr}
                      </span>
                    </div>
                  )}

                  {/* Vertical Divider */}
                  {isChasing && rrrVal && totalBalls > 0 && (
                    <div className="w-px h-12 bg-white/10"></div>
                  )}

                  {/* REQ Rate Block */}
                  {isChasing && rrrVal && (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-amber-400 font-black text-sm uppercase tracking-widest mb-0.5 drop-shadow-md">
                        REQ
                      </span>
                      <span className="text-amber-400 font-mono font-black text-[2.2rem] leading-none drop-shadow-md">
                        {rrrVal}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Bowler */}
                <div className="flex flex-col justify-center px-8 border-l border-white/20 w-[400px] shrink-0 text-white bg-black/20 z-20 shadow-[-10px_0_20px_rgba(0,0,0,0.3)]">
                  <div className="text-sm uppercase tracking-widest mb-0.5 font-bold opacity-80">
                    Bowling - {bowlingTeam}
                  </div>
                  <div className="flex justify-between items-baseline font-bold text-white drop-shadow-md">
                    <span className="truncate flex-1 pr-3 text-xl">
                      {bowler || "Bowler"}
                    </span>
                    <span className="font-mono text-3xl text-white font-black pl-2 shrink-0">
                      {bStats.wickets}-{bStats.runs}{" "}
                      <span className="text-base font-sans text-white/70 font-normal ml-1">
                        ({bOvers} Ov)
                      </span>
                    </span>
                  </div>
                </div>

                {/* 5. Timeline (Ball by Ball) */}
                <div
                  className={`flex items-center px-6 border-l border-white/10 bg-black/30 justify-start ${timelineGap} min-w-[280px] max-w-[360px] mr-5 overflow-hidden z-20`}>
                  {timeline.map((b, i) => {
                    let text = b.runs === 0 ? "•" : b.runs;
                    let bubbleClass =
                      "bg-white/10 border-white/20 text-white backdrop-blur-sm";

                    if (b.isWicket) {
                      text = "W";
                      bubbleClass =
                        "bg-rose-600 border-rose-400 text-white shadow-[0_0_10px_rgba(225,29,72,0.5)]";
                    } else if (b.isWide) {
                      text = b.runs > 0 ? `${b.runs}wd` : "wd";
                      bubbleClass =
                        "bg-indigo-600 border-indigo-400 text-white";
                    } else if (b.isNoBall) {
                      text = b.runs > 0 ? `${b.runs}nb` : "nb";
                      bubbleClass =
                        "bg-indigo-600 border-indigo-400 text-white";
                    } else if (b.isLegBye) {
                      text = b.runs > 0 ? `${b.runs}lb` : "lb";
                      bubbleClass = "bg-white/20 border-white/30 text-white";
                    } else if (b.isBye) {
                      text = b.runs > 0 ? `${b.runs}b` : "b";
                      bubbleClass = "bg-white/20 border-white/30 text-white";
                    } else if (b.runs === 4) {
                      text = "4";
                      bubbleClass =
                        "bg-teal-400 border-teal-200 text-slate-900 font-black shadow-[0_0_10px_rgba(45,212,191,0.5)]";
                    } else if (b.runs === 6) {
                      text = "6";
                      bubbleClass =
                        "bg-amber-400 border-amber-200 text-slate-900 font-black shadow-[0_0_10px_rgba(251,191,36,0.5)]";
                    }

                    const textStr = text.toString();
                    let textSize = isLongOver ? "text-base" : "text-xl";
                    if (textStr.length > 2)
                      textSize = "text-[11px] tracking-tighter";
                    else if (textStr.length > 1)
                      textSize = isLongOver ? "text-[13px]" : "text-[15px]";

                    const bubbleSize = isLongOver
                      ? "w-10 h-10 border-[1.5px]"
                      : "w-12 h-12 border-2";

                    return (
                      <div
                        key={i}
                        className={`${bubbleSize} rounded-full shrink-0 flex items-center justify-center font-black shadow-sm ${bubbleClass} ${textSize} uppercase transition-all duration-300`}>
                        {text}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-black/60 backdrop-blur-md z-20">
                <span className="text-amber-500 font-black text-3xl uppercase tracking-[0.4em] mr-6 drop-shadow-lg">
                  MATCH FINISHED:
                </span>
                <span className="text-white font-black text-5xl uppercase tracking-wider drop-shadow-xl">
                  {resultText}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT TEAM LOGO --- */}
        <div
          className="w-36 h-36 flex-shrink-0 rounded-full bg-slate-900 border-[5px] shadow-[0_0_20px_rgba(0,0,0,0.5)] z-30 flex items-center justify-center overflow-hidden relative -ml-10 anim-entry mb-2"
          style={{ borderColor: teamBColor }}>
          <img
            src={rightLogo}
            alt="Team B"
            className="w-full h-full object-cover bg-white"
            onError={(e) => (e.target.src = defaultLogo)}
          />
        </div>
      </div>
    </>
  );
}
