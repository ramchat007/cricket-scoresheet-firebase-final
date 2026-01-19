import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { subscribeMatch } from "../utils/firestore";

// --- HELPER: Calculate Partnership ---
const calculatePartnership = (timeline) => {
  if (!timeline || timeline.length === 0) return { runs: 0, balls: 0 };
  let runs = 0;
  let balls = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const ball = timeline[i];
    if (ball.isWicket) break;
    runs += ball.runs;
    if (!ball.isWide && !ball.isNoBall) balls++;
  }
  return { runs, balls };
};

// --- SUB-COMPONENT: ANIMATED EVENT POPUP ---
const EventAnimation = ({ type }) => {
  if (!type) return null;

  // 🎨 STYLES
  const styles = {
    FOUR: {
      bg: "bg-gradient-to-r from-emerald-600 to-green-500",
      border: "border-green-300",
      text: "4",
      sub: "BOUNDARY",
      anim: "animate-in slide-in-from-left duration-500 fade-in zoom-in",
      shadow: "shadow-[0_0_100px_rgba(16,185,129,0.8)]",
    },
    SIX: {
      bg: "bg-gradient-to-r from-purple-700 to-indigo-600",
      border: "border-purple-300",
      text: "6",
      sub: "MAXIMUM",
      anim: "animate-in slide-in-from-bottom duration-700 fade-in zoom-in-50",
      shadow: "shadow-[0_0_100px_rgba(124,58,237,0.8)]",
    },
    WICKET: {
      bg: "bg-gradient-to-r from-red-700 to-rose-600",
      border: "border-red-300",
      text: "OUT",
      sub: "DISMISSED",
      anim: "animate-in zoom-in-150 duration-300 fade-in",
      shadow: "shadow-[0_0_100px_rgba(225,29,72,0.9)]",
    },
  };

  const current = styles[type];

  return (
    // ✅ Z-INDEX 100: Ensures it is strictly on top of everything
    <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none overflow-hidden">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200`}
      />

      <div className={`relative transform skew-x-[-12deg] ${current.anim}`}>
        <div
          className={`${current.bg} ${current.shadow} border-y-4 ${current.border} px-16 py-8 lg:px-24 lg:py-12 flex flex-col items-center justify-center shadow-2xl rounded-xl`}>
          <div className="text-white font-black text-8xl lg:text-[10rem] leading-none drop-shadow-md italic tracking-tighter">
            {current.text}
          </div>
          <div className="bg-black/40 mt-4 px-8 py-2 rounded-sm w-full text-center border-t border-white/20">
            <span className="text-white font-bold text-lg lg:text-2xl tracking-[0.4em] uppercase">
              {current.sub}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: FULL SCORECARD MODAL ---
const FullScorecardModal = ({ data, onClose }) => {
  if (!data) return null;
  const { match } = data;
  const innIndex = match.currentInnings || 0;
  const inn = match.innings?.[innIndex] || {};
  const batsmen = inn.batsmenStats ? Object.entries(inn.batsmenStats) : [];
  const bowlers = inn.bowlerStats ? Object.entries(inn.bowlerStats) : [];

  const getDismissalText = (stats) => {
    if (!stats || !stats.out)
      return (
        <span className="text-teal-400 font-bold text-[9px] uppercase">
          not out
        </span>
      );
    const b = stats.bowler || "";
    const f = stats.fielderName || "";
    const type = stats.wicketType || "out";
    const style = "text-slate-400 font-medium text-[10px] lowercase";
    switch (type) {
      case "bowled":
        return <span className={style}>b {b}</span>;
      case "caught":
        return (
          <span className={style}>
            c {f} b {b}
          </span>
        );
      case "lbw":
        return <span className={style}>lbw b {b}</span>;
      case "runout":
        return <span className={style}>run out ({f})</span>;
      default:
        return <span className="text-slate-500 capitalize">{type}</span>;
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in duration-300 p-4 lg:p-12 overflow-hidden pointer-events-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
            Scorecard
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            {data.battingTeam} vs {data.bowlingTeam}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-20">
        {/* Batting */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-black/40 text-xs uppercase font-bold text-slate-500">
              <tr>
                <th className="p-3">Batter</th>
                <th className="p-3 text-right">R</th>
                <th className="p-3 text-right">B</th>
                <th className="p-3 text-right">SR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {batsmen.map(([name, s]) => (
                <tr
                  key={name}
                  className={s.out ? "opacity-50" : "font-bold bg-white/5"}>
                  <td className="p-3">
                    <div className="text-white">{name}</div>
                    <div>{getDismissalText(s)}</div>
                  </td>
                  <td className="p-3 text-right text-white font-mono">
                    {s.runs}
                  </td>
                  <td className="p-3 text-right font-mono">{s.balls}</td>
                  <td className="p-3 text-right font-mono text-xs">
                    {s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(0) : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Bowling */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-black/40 text-xs uppercase font-bold text-slate-500">
              <tr>
                <th className="p-3">Bowler</th>
                <th className="p-3 text-right">O</th>
                <th className="p-3 text-right">R</th>
                <th className="p-3 text-right">W</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bowlers.map(([name, s]) => (
                <tr key={name}>
                  <td className="p-3 font-bold text-white">{name}</td>
                  <td className="p-3 text-right font-mono">
                    {Math.floor(s.balls / 6)}.{s.balls % 6}
                  </td>
                  <td className="p-3 text-right font-mono">{s.runs}</td>
                  <td className="p-3 text-right font-bold text-yellow-400 font-mono">
                    {s.wickets}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function MatchOverlay() {
  const { tournamentId, matchId } = useParams();
  const [searchParams] = useSearchParams();
  const [match, setMatch] = useState(null);

  // STATE
  const [eventType, setEventType] = useState(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [showFullCard, setShowFullCard] = useState(false);

  const isClean = searchParams.get("clean") === "true";

  // --- ✅ FIXED: TRIGGER ANIMATION LOGIC ---
  useEffect(() => {
    const unsub = subscribeMatch(tournamentId, matchId, (data) => {
      setMatch((prev) => {
        // 1. Ensure we have previous data to compare against (skips first load)
        if (prev && data) {
          const prevInn = prev.innings?.[prev.currentInnings || 0];
          const currInn = data.innings?.[data.currentInnings || 0];

          const prevTimeline = prevInn?.timeline || [];
          const currTimeline = currInn?.timeline || [];

          // 2. Check if a NEW ball was added (Length increased)
          if (currTimeline.length > prevTimeline.length) {
            const lastBall = currTimeline[currTimeline.length - 1];

            // 3. Fire Animation based on the new ball
            if (lastBall) {
              if (
                lastBall.runs === 4 &&
                !lastBall.isWide &&
                !lastBall.isNoBall
              ) {
                triggerAnimation("FOUR");
              } else if (
                lastBall.runs === 6 &&
                !lastBall.isWide &&
                !lastBall.isNoBall
              ) {
                triggerAnimation("SIX");
              } else if (lastBall.isWicket) {
                triggerAnimation("WICKET");
              }
            }
          }
        }
        return data;
      });
    });
    return () => unsub();
  }, [tournamentId, matchId]);

  const triggerAnimation = (type) => {
    setEventType(type);
    setTimeout(() => setEventType(null), 3500);
  };

  const data = useMemo(() => {
    if (!match) return null;
    const innIndex = match.currentInnings || 0;
    const inn = match.innings?.[innIndex] || {};

    const battingTeam = inn.battingTeam || "Batting";
    const bowlingTeam = inn.bowlingTeam || "Bowling";
    const score = inn.score || 0;
    const wickets = inn.wickets || 0;
    const overs = inn.over || 0;
    const balls = inn.overBallCount || 0;

    const striker = inn.striker;
    const nonStriker = inn.nonStriker;
    const bowler = inn.currentBowler;

    const sStats = inn.batsmenStats?.[striker] || { runs: 0, balls: 0 };
    const nsStats = inn.batsmenStats?.[nonStriker] || { runs: 0, balls: 0 };
    const bStats = inn.bowlerStats?.[bowler] || {
      wickets: 0,
      runs: 0,
      balls: 0,
    };

    const totalBallsBowled = overs * 6 + balls;
    const crr =
      totalBallsBowled > 0
        ? (score / (totalBallsBowled / 6)).toFixed(2)
        : "0.00";

    let targetInfo = null;
    if (innIndex === 1) {
      const target = match.meta?.target || 0;
      const runsNeeded = target - score;
      const totalOvers = parseInt(match.meta?.overs || 20);
      const ballsRemaining = totalOvers * 6 - totalBallsBowled;
      const rrr =
        ballsRemaining > 0
          ? (runsNeeded / (ballsRemaining / 6)).toFixed(2)
          : "-";
      targetInfo = { needed: runsNeeded, balls: ballsRemaining, rrr };
    }

    const partnership = calculatePartnership(inn.timeline);
    const lastWicket =
      inn.fallOfWickets?.[inn.fallOfWickets.length - 1] || null;
    const recent = (inn.timeline || []).slice(-8).reverse();

    return {
      match,
      battingTeam,
      bowlingTeam,
      score,
      wickets,
      overs,
      balls,
      striker,
      nonStriker,
      sStats,
      nsStats,
      bowler,
      bStats,
      crr,
      targetInfo,
      partnership,
      lastWicket,
      recent,
    };
  }, [match]);

  if (!data) return null;

  return (
    <div
      className={`w-full h-screen overflow-hidden flex flex-col justify-end pb-0 lg:pb-6 xl:pb-12 px-0 lg:px-6 xl:px-16 font-sans select-none pointer-events-none bg-transparent`}>
      {/* 💥 BROADCAST ANIMATIONS */}
      <EventAnimation type={eventType} />

      {/* 📜 FULL SCORECARD MODAL */}
      {showFullCard && (
        <FullScorecardModal
          data={data}
          onClose={() => setShowFullCard(false)}
        />
      )}

      {/* ✅ MAIN CONTAINER */}
      <div className="flex flex-col lg:flex-row lg:items-end w-full max-w-7xl mx-auto lg:mx-0 lg:max-w-none pointer-events-auto pb-2 px-2 lg:px-0 lg:pb-0 gap-0">
        {/* LEFT COLUMN: DETAILS */}
        <div
          className={`
            w-full flex-col lg:flex-row gap-2 lg:gap-3 xl:gap-4 lg:contents
            ${isMobileExpanded ? "flex animate-in slide-in-from-bottom-10 fade-in duration-200 mb-0" : "hidden lg:contents"}
        `}>
          {/* 1. BATSMEN CARD */}
          <div className="order-1 flex flex-col gap-1 w-full lg:w-[28%] lg:min-w-[240px] xl:min-w-[280px]">
            <div className="hidden lg:flex bg-slate-900/90 backdrop-blur-md rounded-t-lg border-l-4 border-blue-500 px-2 xl:px-3 py-1 shadow-lg justify-between items-center mb-1">
              <span className="text-[9px] xl:text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Partnership
              </span>
              <div className="text-white font-bold text-[10px] xl:text-xs">
                {data.partnership.runs}{" "}
                <span className="text-slate-500 font-normal">
                  ({data.partnership.balls})
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-black text-white rounded-lg overflow-hidden shadow-2xl border border-white/10">
              <div
                className={`px-2 xl:px-3 py-1.5 xl:py-2 flex justify-between items-center border-b border-white/10 ${data.striker ? "bg-white/5" : ""}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e] flex-shrink-0"></div>
                  <span className="font-bold text-xs xl:text-base uppercase truncate max-w-[120px] xl:max-w-[140px]">
                    {data.striker || "Striker"}
                  </span>
                </div>
                <div className="font-mono text-sm xl:text-lg text-yellow-400 font-bold whitespace-nowrap">
                  {data.sStats.runs}
                  <span className="text-[9px] xl:text-[10px] text-slate-400 ml-1">
                    ({data.sStats.balls})
                  </span>
                </div>
              </div>
              <div className="px-2 xl:px-3 py-1.5 xl:py-2 flex justify-between items-center opacity-70">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-1.5 h-1.5 flex-shrink-0"></div>
                  <span className="font-bold text-xs xl:text-base uppercase truncate max-w-[120px] xl:max-w-[140px]">
                    {data.nonStriker || "Non-Striker"}
                  </span>
                </div>
                <div className="font-mono text-sm xl:text-lg font-bold whitespace-nowrap">
                  {data.nsStats.runs}
                  <span className="text-[9px] xl:text-[10px] text-slate-400 ml-1">
                    ({data.nsStats.balls})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. BOWLER CARD */}
          <div className="order-2 lg:order-3 flex flex-col gap-1 w-full lg:w-[28%] lg:min-w-[240px] xl:min-w-[280px]">
            <div className="bg-gradient-to-bl from-slate-900 to-black text-white rounded-lg p-2 xl:p-3 shadow-lg border border-white/10">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-[8px] xl:text-[10px] uppercase text-blue-400 font-bold tracking-wider mb-0.5">
                    Current Bowler
                  </div>
                  <span className="font-bold text-xs xl:text-base uppercase truncate max-w-[120px] xl:max-w-[140px] block">
                    {data.bowler || "Bowler"}
                  </span>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-sm xl:text-xl font-mono font-bold text-yellow-400">
                    {data.bStats.wickets}-{data.bStats.runs}
                  </span>
                  <span className="text-[9px] xl:text-[10px] text-slate-400 ml-1">
                    ({Math.floor(data.bStats.balls / 6)}.{data.bStats.balls % 6}
                    )
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-black/60 backdrop-blur-md rounded-lg p-1 xl:p-1.5 flex gap-1 justify-end overflow-hidden h-[30px] xl:h-[36px] items-center">
              {data.recent.length === 0 && (
                <span className="text-[9px] text-slate-500 px-2">
                  No balls yet
                </span>
              )}
              {data.recent.map((b, i) => {
                let bg = "bg-slate-700 text-white";
                if (b.isWicket) bg = "bg-red-600 text-white font-black";
                else if (b.runs === 4) bg = "bg-green-600 text-white font-bold";
                else if (b.runs === 6)
                  bg = "bg-purple-600 text-white font-bold";
                else if (b.isWide || b.isNoBall)
                  bg = "bg-amber-600 text-black font-bold";
                let label = b.isWicket ? "W" : b.runs;
                if (b.isWide) label = "wd";
                if (b.isNoBall) label = "nb";
                return (
                  <div
                    key={i}
                    className={`${bg} flex-shrink-0 w-5 h-5 xl:w-6 xl:h-6 rounded-full flex items-center justify-center text-[8px] xl:text-[9px] shadow-sm border border-white/10`}>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- CENTER: SCORING UNIT --- */}
        <div className="order-3 lg:order-2 flex-1 w-full relative z-30 lg:mx-3 xl:mx-4">
          {/* MOBILE BUTTONS */}
          <div className="lg:hidden w-full flex gap-1 px-1 mt-1">
            <button
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="flex-1 bg-black/90 backdrop-blur-md text-white/90 px-3 py-2 rounded-t-xl border-t border-x border-white/10 shadow-lg text-[10px] font-black uppercase tracking-widest active:bg-gray-800 transition-all border-b-0">
              {isMobileExpanded ? "⌄ Hide" : "⌃ Details"}
            </button>
            <button
              onClick={() => setShowFullCard(true)}
              className="bg-blue-600/90 backdrop-blur-md text-white px-6 py-2 rounded-t-xl border-t border-x border-white/10 shadow-lg text-[10px] font-black uppercase tracking-widest active:bg-blue-700 transition-all border-b-0">
              📊 Card
            </button>
          </div>

          {/* TOP BAR */}
          <div className="flex justify-between items-center bg-black/90 backdrop-blur-md px-4 lg:px-4 xl:px-6 py-1.5 lg:py-1 xl:py-2 rounded-t-none lg:rounded-t-lg mx-0 border-t lg:border-x border-white/10 relative z-10 lg:mb-0">
            <div className="flex items-center gap-4">
              <div className="text-[10px] lg:text-[10px] xl:text-xs font-bold text-slate-300">
                CRR: <span className="text-white">{data.crr}</span>
              </div>
              <button
                onClick={() => setShowFullCard(true)}
                className="hidden lg:flex bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all">
                📊 Card
              </button>
            </div>

            {data.targetInfo ? (
              <div className="text-[10px] lg:text-[10px] xl:text-xs font-bold text-yellow-400 animate-pulse text-right">
                NEED {data.targetInfo.needed} IN {data.targetInfo.balls}
                <span className="text-slate-400 ml-2 hidden lg:inline">
                  (RRR: {data.targetInfo.rrr})
                </span>
              </div>
            ) : data.lastWicket ? (
              <div className="text-[9px] lg:text-[10px] xl:text-xs font-bold text-red-400 text-right truncate max-w-[150px] lg:max-w-[180px] xl:max-w-[200px]">
                LW: {data.lastWicket.batsman} ({data.lastWicket.score})
              </div>
            ) : null}
          </div>

          {/* MAIN SCORE STRIPE */}
          <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 h-16 lg:h-14 xl:h-20 lg:rounded-b-lg flex items-center px-4 lg:px-4 xl:px-8 justify-between shadow-[0_8px_32px_rgba(0,0,0,0.6)] border-t border-white/10 w-full relative z-20">
            <div className="text-lg lg:text-lg xl:text-3xl font-black text-white uppercase tracking-widest drop-shadow-sm truncate w-1/3">
              {data.battingTeam}
            </div>
            <div className="flex items-baseline gap-2 lg:gap-2 xl:gap-3 justify-center w-1/3">
              <div className="text-4xl lg:text-4xl xl:text-6xl font-black text-white tracking-tighter leading-none drop-shadow-lg">
                {data.score}/{data.wickets}
              </div>
              <div className="text-sm lg:text-sm xl:text-2xl font-bold text-blue-400">
                {data.overs}.{data.balls}
              </div>
            </div>
            <div className="text-sm lg:text-sm xl:text-2xl font-bold text-slate-500 uppercase tracking-wider truncate w-1/3 text-right">
              {data.bowlingTeam}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
