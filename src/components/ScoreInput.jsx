import React, { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { updateMatch } from "../utils/matchService";
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";

export default function ScoreInput({
  match,
  onBall,
  onNewBatsman,
  onChangeBowler,
  onUndo,
  onEndInnings,
  onStrikeChange,
  onExtraBallRuns,
  onConfirmBowler,
  onFinishMatch,
  onDeleteMatch,
}) {
  const { user } = useAuth();

  // -- States --
  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");
  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // --- 1. DATA EXTRACTION ---
  const activeIndex = match?.currentInnings || 0;
  const m = useMemo(() => {
    if (!match || !match.innings) return {};
    if (match.innings[activeIndex]) return match.innings[activeIndex];
    const values = Object.values(match.innings).filter(i => i && i.battingTeam);
    return values[0] || {};
  }, [match, activeIndex]);

  const tournamentId = match?.meta?.tournament || match?.tournamentId;
  const getPlayerName = (p) => (typeof p === "object" ? p.name || p.playerName : String(p || "").trim());

  // --- 2. FLAGS & PERMISSIONS ---
  const hasStriker = Boolean(m.striker);
  const hasNonStriker = Boolean(m.nonStriker);
  const hasBowler = Boolean(m.currentBowler);
  const isSetupComplete = hasStriker && hasNonStriker && hasBowler;
  const isMatchFinished = match?.meta?.matchStatus === "finished" || match?.status === "finished";
  const canFinishMatch = isMatchFinished || (activeIndex === 1 && m.completed);
  const disableBallEntry = isMatchFinished || m.completed || !!m.awaitingNewBowler || !!m.awaitingNewBatsman || isWicketMenuOpen || !isSetupComplete;

  // --- 3. LISTS ---
  const { currentBattingSquad, currentBowlingSquad } = useMemo(() => {
    const teamAName = (match?.meta?.teamA || "").toLowerCase();
    const currentBattingName = (m.battingTeam || "").toLowerCase();
    const squadA = match?.teamASquad || [];
    const squadB = match?.teamBSquad || [];
    return currentBattingName === teamAName ? { currentBattingSquad: squadA, currentBowlingSquad: squadB } : { currentBattingSquad: squadB, currentBowlingSquad: squadA };
  }, [match, m.battingTeam]);

  const fieldingTeamPlayers = useMemo(() => currentBowlingSquad.map(p => getPlayerName(p)).filter(n => n).sort(), [currentBowlingSquad]);
  
  const battingOptions = useMemo(() => {
    const set = new Set();
    if (m.striker) set.add(getPlayerName(m.striker));
    if (m.nonStriker) set.add(getPlayerName(m.nonStriker));
    currentBattingSquad.forEach(p => { const n = getPlayerName(p); if(n) set.add(n); });
    return Array.from(set).sort();
  }, [m, currentBattingSquad]);

  const lastOverBalls = useMemo(() => {
    const historyArr = Array.isArray(m.timeline) ? m.timeline : Object.values(m.timeline || {});
    return historyArr.slice(-10).map(ball => {
        if (typeof ball !== 'object') return ball;
        if (ball.isWicket) return "W";
        if (ball.isWide) return "wd";
        if (ball.isNoBall) return "nb";
        return ball.runs;
    });
  }, [m.timeline]);

  const strikerName = getPlayerName(m.striker);
  const nonStrikerName = getPlayerName(m.nonStriker);
  const sStats = m.batsmenStats?.[strikerName] || { runs: 0, balls: 0 };
  const nsStats = m.batsmenStats?.[nonStrikerName] || { runs: 0, balls: 0 };
  const bStats = m.bowlerStats?.[getPlayerName(m.currentBowler)] || { wickets: 0, runs: 0, balls: 0 };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-white overflow-hidden select-none">
      
      {/* SECTION 1: SCORE (TOP) */}
      <div className="flex-none bg-gray-900 border-b-2 border-gray-800 px-4 py-3 flex justify-between items-center shadow-xl">
        <div className="flex flex-col">
            <span className="text-[12px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">{m.battingTeam || "Team"}</span>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{m.score || 0}/{m.wickets || 0}</span>
                <span className="text-lg font-bold text-gray-400">({m.over || 0}.{m.overBallCount || 0})</span>
            </div>
        </div>
        <div className="text-right">
            <span className="text-[11px] text-gray-500 font-bold uppercase block">CRR</span>
            <span className="text-2xl font-black text-cyan-400">
                {m.over > 0 || m.overBallCount > 0 ? (m.score / (m.over + m.overBallCount/6)).toFixed(2) : "0.00"}
            </span>
        </div>
      </div>

      {/* SECTION 2: PLAYERS (MIDDLE) */}
      <div className="flex-none p-2 grid grid-cols-2 gap-2">
        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-2 relative h-28 flex flex-col justify-center">
            <div className="flex justify-between items-center border-b border-gray-700/50 pb-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 overflow-hidden w-[65%]">
                    <span className="text-green-400 text-base">🏏</span>
                    {!hasStriker ? 
                        <select className="bg-transparent text-red-400 font-black text-sm outline-none animate-pulse" onChange={e => onStrikeChange?.(e.target.value, nonStrikerName)}><option>Striker</option>{battingOptions.map(n => <option key={n} value={n}>{n}</option>)}</select> 
                        : <span className="font-black truncate text-[15px] text-white">{strikerName}</span>
                    }
                </div>
                <span className="text-[16px] font-black text-white">{sStats.runs}*{`(${sStats.balls})`}</span>
            </div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 overflow-hidden w-[65%]">
                    <span className="text-gray-500 text-base">🏃</span>
                    {!hasNonStriker ? 
                        <select className="bg-transparent text-red-400 font-black text-sm outline-none" onChange={e => onStrikeChange?.(strikerName, e.target.value)}><option>Non-Striker</option>{battingOptions.map(n => <option key={n} value={n} disabled={n === strikerName}>{n}</option>)}</select> 
                        : <span className="font-bold truncate text-[15px] text-gray-300">{nonStrikerName}</span>
                    }
                </div>
                <span className="text-[15px] font-bold text-gray-400">{nsStats.runs}{`(${nsStats.balls})`}</span>
            </div>
            <button onClick={() => isSetupComplete && onStrikeChange?.(nonStrikerName, strikerName)} className="absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-700 border-2 border-gray-600 rounded-full flex items-center justify-center text-sm shadow-lg active:scale-90 z-10">⇄</button>
        </div>

        <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-2 h-28 flex flex-col justify-center">
            <span className="text-[12px] text-gray-500 font-black uppercase mb-1 tracking-tighter">Bowler</span>
            {!hasBowler ? (
                <select className="bg-transparent text-red-400 font-black text-sm outline-none" onChange={e => onChangeBowler?.(e.target.value)}><option>Select</option>{fieldingTeamPlayers.map(n => <option key={n} value={n}>{n}</option>)}</select>
            ) : (
                <span className="font-black text-white truncate text-[15px] mb-1">{getPlayerName(m.currentBowler)}</span>
            )}
            <div className="text-xl font-black text-cyan-400 leading-tight">
                {bStats.wickets}-{bStats.runs} <span className="text-[13px] text-gray-500 font-bold ml-1">({Math.floor(bStats.balls/6)}.{bStats.balls%6})</span>
            </div>
        </div>
      </div>

      {/* SECTION 3: RECENT BALLS */}
      <div className="flex-none px-2 pb-1">
        <div className="bg-black/40 rounded-lg p-2 flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap h-10 border border-gray-800">
            <span className="text-[10px] text-gray-500 font-black uppercase pr-1">Over:</span>
            {lastOverBalls.map((b, i) => (
                <span key={i} className={`h-7 min-w-[28px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg ${String(b).includes('W')?'bg-red-600':String(b)==='4'?'bg-green-600':String(b)==='6'?'bg-purple-600':String(b).toLowerCase().includes('wd')?'bg-yellow-600 text-black':'bg-gray-700'}`}>{b}</span>
            ))}
        </div>
      </div>

      {/* SECTION 4: KEYPAD (MOVED UP - GAP REMOVED) */}
      <div className="flex-none bg-black grid grid-cols-4 gap-1 p-1 mt-2">
        <KeyButton val="0" onClick={() => onBall("0")} disabled={disableBallEntry} />
        <KeyButton val="1" onClick={() => onBall("1")} disabled={disableBallEntry} />
        <KeyButton val="2" onClick={() => onBall("2")} disabled={disableBallEntry} />
        <KeyButton val="3" onClick={() => onBall("3")} disabled={disableBallEntry} />
        
        <KeyButton val="4" onClick={() => onBall("4")} color="bg-green-900 border-2 border-green-700" disabled={disableBallEntry} />
        <KeyButton val="6" onClick={() => onBall("6")} color="bg-purple-900 border-2 border-purple-700" disabled={disableBallEntry} />
        <KeyButton val="5" onClick={() => onBall("5")} disabled={disableBallEntry} />
        <KeyButton val="OUT" onClick={() => setIsWicketMenuOpen(true)} color="bg-red-900 text-red-100 border-2 border-red-700" disabled={disableBallEntry} />

        <KeyButton val="WD" onClick={() => onExtraBallRuns("wides", 1)} color="bg-yellow-900 text-yellow-100 border border-yellow-700" disabled={disableBallEntry} />
        <KeyButton val="NB" onClick={() => onExtraBallRuns("noBalls", 1)} color="bg-yellow-900 text-yellow-100 border border-yellow-700" disabled={disableBallEntry} />
        <KeyButton val="BYE" onClick={() => onExtraBallRuns("byes", 1)} color="bg-gray-800 text-gray-500 border border-gray-700" disabled={disableBallEntry} />
        <KeyButton val="LB" onClick={() => onExtraBallRuns("legByes", 1)} color="bg-gray-800 text-gray-500 border border-gray-700" disabled={disableBallEntry} />

        {/* UTILITY ROW */}
        <button onClick={onUndo} className="bg-gray-900 text-gray-500 flex items-center justify-center text-3xl rounded-xl h-16 border border-gray-800">↩</button>
        
        {/* FIX MATCH */}
        <button onClick={() => setShowCorrectionModal(true)} className="bg-gray-900 text-cyan-600 text-[10px] font-black flex items-center justify-center rounded-xl h-16 border border-gray-800 uppercase leading-tight text-center px-1">Fix<br/>Match</button>
        
        {/* DELETE MATCH (NEW) */}
        <button onClick={() => window.confirm("Delete this match permanently?") && onDeleteMatch()} className="bg-red-950/40 text-red-500 text-[10px] font-black flex items-center justify-center rounded-xl h-16 border border-red-900/50 uppercase leading-tight text-center px-1">Delete<br/>Match</button>
        
        {isMatchFinished ? (
            <button onClick={() => handleResumeMatch()} className="bg-yellow-700 text-white text-[11px] font-black rounded-xl uppercase h-16">Unlock</button>
        ) : (
            <button onClick={() => onFinishMatch("Completed")} disabled={!canFinishMatch} className={`text-[11px] font-black rounded-xl uppercase h-16 ${canFinishMatch ? "bg-green-700 text-white" : "bg-gray-900 text-gray-700"}`}>Finish</button>
        )}
      </div>

      {/* SECTION 5: FILLER (Pushes everything up) */}
      <div className="flex-1 bg-black"></div>

      {showCorrectionModal && <MatchCorrectionModal match={match} tournamentId={tournamentId} onClose={() => setShowCorrectionModal(false)} />}
    </div>
  );
}

const KeyButton = ({ val, onClick, color = "bg-gray-900 border border-gray-800", disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`${color} h-16 text-xl font-black text-white flex items-center justify-center rounded-xl active:scale-90 transition-transform disabled:opacity-20 touch-manipulation`}>
        {val}
    </button>
);