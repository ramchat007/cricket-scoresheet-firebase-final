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
      // "Runs needed from X balls" formatting for the top center
      equationStr = `NEED ${runsNeeded} RUNS FROM ${ballsRemaining} BALLS`;
    }
  } else if (!isChasing && totalBalls > 0) {
    // Projected Score for 1st Innings
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

  // 🔥 DYNAMIC SIZING FOR LONG OVERS
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
        <div className="w-36 h-36 flex-shrink-0 rounded-full bg-slate-900 border-[5px] border-slate-700 shadow-2xl z-30 flex items-center justify-center overflow-hidden relative -mr-8 anim-entry mb-2">
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
          <div className="bg-slate-900/95 border border-slate-700/50 border-b-0 rounded-t-xl px-10 py-2 grid grid-cols-3 items-center text-slate-300 w-[96%] shadow-lg">
            {/* Left: Match Info */}
            <div className="flex gap-4 items-center justify-start">
              <span className="text-teal-400 font-black tracking-widest text-lg uppercase">
                {match.name || "Match"}
              </span>
              <span className="opacity-40 text-sm">|</span>
              <span className="font-bold text-xl tracking-wide text-white">
                {match.meta?.teamA}{" "}
                <span className="text-slate-500 font-normal mx-1">vs</span>{" "}
                {match.meta?.teamB}
              </span>
            </div>

            {/* Center: 🏏 Equation / Projected Score 🏏 */}
            <div className="flex justify-center items-center">
              {!isMatchFinished &&
                (isChasing && equationStr ? (
                  <span className="text-amber-400 font-black text-base uppercase tracking-widest bg-amber-500/10 px-6 py-1 rounded border border-amber-500/30 drop-shadow-md">
                    {equationStr}
                  </span>
                ) : !isChasing && projScoreStr ? (
                  <span className="text-cyan-400 font-black text-base uppercase tracking-widest bg-cyan-500/10 px-6 py-1 rounded border border-cyan-500/30 drop-shadow-md">
                    {projScoreStr}
                  </span>
                ) : null)}
            </div>

            {/* Right: Toss OR Target */}
            <div className="flex justify-end items-center">
              {showToss && (
                <span className="text-amber-400/90 italic text-base font-bold tracking-wide">
                  {tossStr}
                </span>
              )}

              {isChasing && target && (
                <div className="flex items-center text-amber-400 bg-amber-500/10 px-5 py-1 rounded-md border border-amber-500/20">
                  <span className="font-black tracking-widest uppercase text-sm">
                    Target:{" "}
                    <span className="text-white text-2xl ml-2">{target}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* --- BOTTOM TIER: Live Stats Capsule --- */}
          {/* 🔥 Height increased to 90px to fit larger fonts */}
          <div className="w-full h-[90px] bg-slate-900 rounded-full border-[4px] border-slate-700 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex overflow-hidden">
            {/* 1. Team & Main Score */}
            <div className="bg-teal-600 px-8 flex items-center justify-between text-white min-w-[380px] shadow-[10px_0_20px_rgba(0,0,0,0.3)] z-30">
              <span className="font-black text-3xl tracking-tight truncate max-w-[180px] uppercase">
                {battingTeam}
              </span>
              <div className="flex items-baseline gap-4">
                <div className="font-mono font-black text-[4.5rem] tracking-tighter leading-none mt-2">
                  {score}
                  <span className="text-[2.75rem] text-teal-200 opacity-90 leading-none">
                    /{wickets}
                  </span>
                </div>
                <div className="text-2xl font-bold text-teal-100 bg-teal-800/40 px-3 py-1 rounded leading-none">
                  {displayOvers}
                </div>
              </div>
            </div>

            {!isMatchFinished ? (
              <>
                {/* 2. Batsmen */}
                <div className="flex flex-col justify-center px-8 border-r border-slate-700 bg-slate-800 text-slate-200 min-w-[360px] z-20">
                  <div
                    className={`flex justify-between items-center ${striker ? "font-bold text-white" : ""}`}
                  >
                    <span className="truncate max-w-[200px] flex items-center gap-2 text-xl">
                      {striker || "Striker"}{" "}
                      {striker && (
                        <Zap
                          size={14}
                          className="text-teal-400 fill-teal-400"
                        />
                      )}
                    </span>
                    <span className="font-mono text-3xl font-black">
                      {sStats.runs}
                      <span className="text-base font-sans text-slate-400 font-bold ml-1.5">
                        ({sStats.balls})
                      </span>
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center mt-1 ${!striker ? "font-bold text-white" : "text-slate-400"}`}
                  >
                    <span className="truncate max-w-[200px] text-lg">
                      {nonStriker || "Non-Striker"}
                    </span>
                    <span className="font-mono text-xl font-bold">
                      {nsStats.runs}
                      <span className="text-sm font-sans text-slate-500 ml-1.5">
                        ({nsStats.balls})
                      </span>
                    </span>
                  </div>
                </div>

                {/* 3. 📈 RUN RATES ZONE 📈 */}
                <div className="flex-1 bg-slate-900/40 relative flex items-center justify-center gap-10 overflow-hidden border-r border-slate-700/50">
                  {/* CRR Block */}
                  {totalBalls > 0 && (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-slate-400 font-black text-sm uppercase tracking-widest mb-0.5">
                        CRR
                      </span>
                      <span className="text-white font-mono font-black text-[2.2rem] leading-none">
                        {crr}
                      </span>
                    </div>
                  )}

                  {/* Vertical Divider */}
                  {isChasing && rrrVal && totalBalls > 0 && (
                    <div className="w-px h-12 bg-slate-700"></div>
                  )}

                  {/* REQ Rate Block */}
                  {isChasing && rrrVal && (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-amber-400 font-black text-sm uppercase tracking-widest mb-0.5">
                        REQ
                      </span>
                      <span className="text-amber-400 font-mono font-black text-[2.2rem] leading-none">
                        {rrrVal}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Bowler */}
                <div className="flex flex-col justify-center px-8 border-l border-slate-700 bg-slate-800 min-w-[320px]">
                  <div className="text-sm text-slate-400 uppercase tracking-widest mb-0.5 font-bold">
                    Bowling - {bowlingTeam}
                  </div>
                  <div className="flex justify-between items-baseline font-bold text-white">
                    <span className="truncate max-w-[180px] text-xl">
                      {bowler || "Bowler"}
                    </span>
                    <span className="font-mono text-3xl text-amber-400 font-black pl-2">
                      {bStats.wickets}-{bStats.runs}{" "}
                      <span className="text-base font-sans text-slate-300 font-normal ml-1">
                        ({bOvers} Ov)
                      </span>
                    </span>
                  </div>
                </div>

                {/* 5. Timeline (Ball by Ball) */}
                <div
                  className={`flex items-center px-6 border-l border-slate-700 bg-slate-900 justify-start ${timelineGap} min-w-[280px] max-w-[360px] mr-5 overflow-hidden`}
                >
                  {timeline.map((b, i) => {
                    let text = b.runs === 0 ? "•" : b.runs;
                    let bubbleClass =
                      "bg-slate-700 border-slate-600 text-slate-300";

                    if (b.isWicket) {
                      text = "W";
                      bubbleClass = "bg-rose-600 border-rose-500 text-white";
                    } else if (b.isWide) {
                      text = b.runs > 0 ? `${b.runs}wd` : "wd";
                      bubbleClass =
                        "bg-indigo-600 border-indigo-500 text-white";
                    } else if (b.isNoBall) {
                      text = b.runs > 0 ? `${b.runs}nb` : "nb";
                      bubbleClass =
                        "bg-indigo-600 border-indigo-500 text-white";
                    } else if (b.isLegBye) {
                      text = b.runs > 0 ? `${b.runs}lb` : "lb";
                      bubbleClass = "bg-slate-600 border-slate-500 text-white";
                    } else if (b.isBye) {
                      text = b.runs > 0 ? `${b.runs}b` : "b";
                      bubbleClass = "bg-slate-600 border-slate-500 text-white";
                    } else if (b.runs === 4) {
                      text = "4";
                      bubbleClass =
                        "bg-teal-500 border-teal-400 text-slate-900 font-black";
                    } else if (b.runs === 6) {
                      text = "6";
                      bubbleClass =
                        "bg-amber-500 border-amber-400 text-slate-900 font-black";
                    } else if (b.runs > 0) {
                      text = b.runs;
                      bubbleClass = "bg-slate-600 border-slate-500 text-white";
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
                        className={`${bubbleSize} rounded-full shrink-0 flex items-center justify-center font-black shadow-sm ${bubbleClass} ${textSize} uppercase transition-all duration-300`}
                      >
                        {text}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-800/80">
                <span className="text-amber-500 font-black text-3xl uppercase tracking-[0.4em] mr-6">
                  MATCH FINISHED:
                </span>
                <span className="text-white font-black text-5xl uppercase tracking-wider">
                  {resultText}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT TEAM LOGO --- */}
        <div className="w-36 h-36 flex-shrink-0 rounded-full bg-slate-900 border-[5px] border-slate-700 shadow-2xl z-30 flex items-center justify-center overflow-hidden relative -ml-10 anim-entry mb-2">
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
