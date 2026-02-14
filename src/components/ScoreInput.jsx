import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../utils/firebase";
// ✅ IMPORT THE FIXED FUNCTION
import { quickAddPlayer } from "../utils/firestore";
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";
import { getDeterministicCommentary } from "../utils/commentaryHelper";
import { fetchAICommentary } from "../utils/gemini";
import {
  RotateCcw,
  Settings,
  Trophy,
  ArrowRightCircle,
  Menu,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// --- SUB-COMPONENT: BUTTON ---
const KeyButton = React.memo(
  ({
    val,
    onClick,
    color = "bg-slate-800/40 border-slate-700/50 text-slate-300",
    disabled,
    loading,
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${color} h-14 text-lg font-bold flex items-center justify-center rounded-xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation border shadow-sm select-none relative`}>
      {val}
    </button>
  ),
);

export default function ScoreInput({
  match,
  onBall,
  onNewBatsman,
  onChangeBowler,
  onUndo,
  onEndInnings,
  onStrikeChange,
  onConfirmBowler,
  onFinishMatch,
  onSetOpeners, // ✅ Ensure this prop is passed from LiveScoring
}) {
  const { theme, lightMode } = useTheme();

  // --- STATES ---
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  // Feature #1: Openers State
  const [openerStriker, setOpenerStriker] = useState("");
  const [openerNonStriker, setOpenerNonStriker] = useState("");

  const [extraType, setExtraType] = useState(null);
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("Bat");
  const [startLoading, setStartLoading] = useState(false);

  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");
  const [wicketRuns, setWicketRuns] = useState(0);

  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const [editStriker, setEditStriker] = useState(false);
  const [editNonStriker, setEditNonStriker] = useState(false);
  const [editBowler, setEditBowler] = useState(false);

  const [localOverlayDismissed, setLocalOverlayDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [aiComments, setAiComments] = useState({});

  // 🔊 AUDIO
  const clickSound = useRef(new Audio("/sounds/click.mp3"));
  const wicketSound = useRef(new Audio("/sounds/wicket.mp3"));

  useEffect(() => {
    clickSound.current.load();
    wicketSound.current.load();
  }, []);

  const triggerFeedback = (type = "click") => {
    if (navigator.vibrate)
      navigator.vibrate(type === "wicket" ? [50, 30, 50] : 15);
    try {
      const sound =
        type === "wicket" ? wicketSound.current : clickSound.current;
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch (e) {}
  };

  // --- DATA EXTRACTION ---
  const activeIndex = match?.currentInnings || 0;

  useEffect(() => {
    setIncoming("");
    setNewBowler("");
    setOpenerStriker("");
    setOpenerNonStriker("");
    setLocalOverlayDismissed(false);
  }, [activeIndex]);

  const m = useMemo(() => {
    if (!match || !match.innings) return {};
    const innArr = Array.isArray(match.innings)
      ? match.innings
      : Object.values(match.innings);
    return innArr[activeIndex] || {};
  }, [match, activeIndex]);

  const isInning2 = activeIndex === 1;

  // --- MATCH CONTEXT ---
  const matchContext = useMemo(() => {
    const inn1 = match?.innings?.[0];
    const inn2 = match?.innings?.[1];
    const isFinished = match?.status === "finished";

    const target = inn1?.score !== undefined ? inn1.score + 1 : null;
    const runsNeeded = target && inn2 ? target - inn2.score : 0;
    const totalOvers = parseInt(match?.meta?.overs || 20);
    const currentBalls = (inn2?.over || 0) * 6 + (inn2?.overBallCount || 0);
    const totalBalls = totalOvers * 6;
    const remainingBalls = Math.max(0, totalBalls - currentBalls);

    return {
      target,
      runsNeeded,
      remainingBalls,
      isFinished,
      crr1: (m.score / (m.over + m.overBallCount / 6) || 0).toFixed(2),
    };
  }, [match, activeIndex, m]);

  // --- HELPERS ---
  const getPlayerName = useCallback(
    (p) =>
      !p
        ? ""
        : typeof p === "object"
          ? p.name || p.playerName || ""
          : String(p).trim(),
    [],
  );
  const strikerName = getPlayerName(m.striker);
  const nonStrikerName = getPlayerName(m.nonStriker);
  const currentBowlerName = getPlayerName(m.currentBowler);

  const { currentBattingSquad, currentBowlingSquad } = useMemo(() => {
    const isTeamA = m.battingTeam === match?.meta?.teamA;
    return {
      currentBattingSquad: isTeamA ? match?.teamASquad : match?.teamBSquad,
      currentBowlingSquad: isTeamA ? match?.teamBSquad : match?.teamASquad,
    };
  }, [match, m.battingTeam]);

  const battingOptions = useMemo(
    () => (currentBattingSquad || []).map((p) => getPlayerName(p)).sort(),
    [currentBattingSquad, getPlayerName],
  );
  const fieldingTeamPlayers = useMemo(
    () => (currentBowlingSquad || []).map((p) => getPlayerName(p)).sort(),
    [currentBowlingSquad, getPlayerName],
  );

  // --- LOGIC: STATE DETERMINATION ---
  const maxOvers = parseInt(match?.meta?.overs || 20);
  const totalWickets = parseInt(match?.meta?.totalWickets || 10);

  const isAllOut = m.wickets >= totalWickets;
  const isOversDone = maxOvers > 0 && m.over >= maxOvers;
  const isTargetChased =
    isInning2 && matchContext.target && m.score >= matchContext.target;

  const isInningsComplete = isAllOut || isOversDone || isTargetChased;
  const isMatchOver = isInningsComplete && isInning2;

  // ✅ Feature 1 Fix: Explicitly check for "Start of Innings" to ask for Openers
  const isStartOfInnings = m.over === 0 && m.overBallCount === 0;
  // If we are at 0.0 overs, and NO batsmen are set, we need openers.
  const needOpeners =
    isStartOfInnings && (!strikerName || !nonStrikerName) && !isInningsComplete;

  const needBatsman =
    !needOpeners && m.awaitingNewBatsman && !isAllOut && !isInningsComplete;
  const needBowler =
    !needOpeners &&
    !needBatsman &&
    m.awaitingNewBowler &&
    !isOversDone &&
    !isInningsComplete;

  const showPlayerSelector =
    !localOverlayDismissed && !isInningsComplete && (needBatsman || needBowler);

  const hasSetup = strikerName && nonStrikerName && currentBowlerName;
  const disableBallEntry =
    isSyncing ||
    match?.status === "finished" ||
    m.completed ||
    needOpeners ||
    needBatsman ||
    needBowler ||
    isWicketMenuOpen ||
    !hasSetup ||
    isInningsComplete;

  // --- SUBMIT HANDLER ---
  const handleSubmitBall = useCallback(
    async (runsVal) => {
      if (isSyncing) return;
      triggerFeedback("click");
      setIsSyncing(true);
      try {
        const runsRan = parseInt(runsVal) || 0;
        const isWide = extraType === "WD";
        const isNoBall = extraType === "NB";
        const isBye = extraType === "B";
        const isLegBye = extraType === "LB";

        let code = runsRan.toString();
        if (isWide) code = runsRan === 0 ? "WD" : `${runsRan + 1}WD`;
        else if (isNoBall) code = runsRan === 0 ? "NB" : `${runsRan + 1}NB`;
        else if (isBye) code = `${runsRan}B`;
        else if (isLegBye) code = `${runsRan}LB`;

        const extraData = {
          isWide,
          isNoBall,
          isBye,
          isLegBye,
          isWicket: false,
        };
        await onBall(code, extraData, runsRan);
        setExtraType(null);
        setLocalOverlayDismissed(false);
      } catch (e) {
        console.error("Ball Sync Error:", e);
        alert("Error saving ball.");
      } finally {
        setIsSyncing(false);
      }
    },
    [extraType, onBall, isSyncing],
  );

  // --- 🔴 TOSS SCREEN FIX ---
  // If match exists but no toss winner is set, show Toss Modal
  if (match && !match.meta?.toss?.winner) {
    return (
      <div
        className={`flex flex-col h-full overflow-hidden ${theme.bg} ${theme.text} p-4`}>
        <div
          className={`border p-8 rounded-3xl text-center max-w-md w-full shadow-2xl mx-auto my-auto ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"}`}>
          <h3 className={`text-xl font-bold mb-8 uppercase ${theme.text}`}>
            Start Match
          </h3>
          <div className="space-y-6">
            <select
              className={`w-full border p-4 rounded-xl font-bold outline-none ${lightMode ? "bg-gray-100 border-gray-200" : "bg-slate-900 border-slate-700"}`}
              value={tossWinner}
              onChange={(e) => setTossWinner(e.target.value)}>
              <option value="">-- Select Toss Winner --</option>
              <option value={match?.meta?.teamA}>{match?.meta?.teamA}</option>
              <option value={match?.meta?.teamB}>{match?.meta?.teamB}</option>
            </select>
            <div className="flex gap-2">
              {["Bat", "Bowl"].map((c) => (
                <button
                  key={c}
                  onClick={() => setTossDecision(c)}
                  className={`flex-1 py-4 rounded-xl font-bold transition-all ${tossDecision === c ? "bg-teal-600 text-white shadow-lg" : theme.btnBase}`}>
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!tossWinner) return;
                setStartLoading(true);
                const isABat =
                  (tossWinner === match.meta.teamA && tossDecision === "Bat") ||
                  (tossWinner === match.meta.teamB && tossDecision === "Bowl");

                // Initialize Innings Array
                await updateDoc(
                  doc(
                    db,
                    "tournaments",
                    match.tournamentId || match.meta.tournament,
                    "matches",
                    match.id,
                  ),
                  {
                    "meta.toss": { winner: tossWinner, decision: tossDecision },
                    status: "ongoing",
                    innings: [
                      {
                        battingTeam: isABat
                          ? match.meta.teamA
                          : match.meta.teamB,
                        bowlingTeam: isABat
                          ? match.meta.teamB
                          : match.meta.teamA,
                        score: 0,
                        wickets: 0,
                        over: 0,
                        overBallCount: 0,
                        timeline: [],
                        striker: null,
                        nonStriker: null,
                        currentBowler: null,
                      },
                    ],
                    currentInnings: 0,
                  },
                );
                setStartLoading(false);
              }}
              disabled={!tossWinner || startLoading}
              className="w-full py-4 bg-teal-700 text-white font-bold rounded-xl shadow-xl active:scale-95 transition-all">
              Start Match 🚀
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  const modalContainerClass = `bg-black/95 absolute inset-0 z-[100] flex flex-col justify-end p-4 pb-10 animate-in slide-in-from-bottom`;
  const modalContentClass = `${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"} p-6 rounded-3xl shadow-2xl`;
  const modalInputClass = `w-full p-4 rounded-xl font-bold mb-4 outline-none border transition-all ${lightMode ? "bg-gray-100 text-black border-gray-300 focus:border-teal-500" : "bg-slate-900 text-white border-slate-700 focus:border-teal-500"}`;
  const modalLabelClass = `text-xs font-bold uppercase mb-2 block ${lightMode ? "text-gray-500" : "text-slate-400"}`;

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${theme.bg} ${theme.text} transition-colors duration-300 font-sans`}>
      {/* SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
        {/* HERO CARD */}
        <div className="py-4 px-4">
          <div
            className={`rounded-2xl p-3 ${theme.card} relative overflow-hidden shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <div className="flex justify-between items-end">
              <div>
                <div
                  className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}>
                  {m.battingTeam}
                </div>
                <div
                  className={`text-6xl font-black leading-none mt-1 tracking-tighter ${theme.text}`}>
                  {m.score || 0}
                  <span className={`text-3xl ${theme.sub}`}>
                    /{m.wickets || 0}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}>
                  Overs
                </div>
                <div className="text-3xl font-mono font-bold">
                  {m.over || 0}.{m.overBallCount || 0}{" "}
                  <span className="text-lg opacity-50">/ {maxOvers}</span>
                </div>
                <div
                  className={`text-[10px] font-bold uppercase mt-1 ${theme.sub}`}>
                  CRR: {matchContext.crr1}
                </div>
              </div>
            </div>
            {isInning2 && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-500/20 text-center">
                <span
                  className={`text-xs font-bold uppercase ${lightMode ? "text-teal-700" : "text-teal-400"}`}>
                  Target: {matchContext.target} • Need {matchContext.runsNeeded}{" "}
                  off {matchContext.remainingBalls} balls
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PLAYERS */}
        <div className="px-4 grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
          {/* Striker */}
          <div
            className={`p-3 rounded-xl border-l-4 border-l-green-500 ${theme.card} shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"} relative`}>
            <div className="flex justify-between mb-1">
              <span className="bg-green-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded">
                STR
              </span>
              <button
                onClick={() => setEditStriker(true)}
                className="opacity-30 p-1">
                <Menu size={12} />
              </button>
            </div>
            {!editStriker ? (
              <div className="font-bold truncate text-lg">
                {strikerName || "Select"}
              </div>
            ) : (
              <select
                className={`w-full text-xs p-1 rounded ${lightMode ? "bg-gray-100" : "bg-black/20"}`}
                value={strikerName}
                onChange={(e) => {
                  onStrikeChange(e.target.value, nonStrikerName);
                  setEditStriker(false);
                }}>
                <option>Select</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <div className={`text-xs ${theme.sub}`}>
              {m.batsmenStats?.[strikerName]?.runs || 0} (
              {m.batsmenStats?.[strikerName]?.balls || 0})
            </div>
          </div>
          {/* Non Striker */}
          <div
            className={`p-3 rounded-xl border-l-4 border-transparent ${theme.card} shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <div className="flex justify-between mb-1">
              <span className={`text-[9px] font-bold ${theme.sub}`}>
                NON-STR
              </span>
              <button
                onClick={() => setEditNonStriker(true)}
                className="opacity-30 p-1">
                <Menu size={12} />
              </button>
            </div>
            {!editNonStriker ? (
              <div className="font-bold truncate text-lg">
                {nonStrikerName || "Select"}
              </div>
            ) : (
              <select
                className={`w-full text-xs p-1 rounded ${lightMode ? "bg-gray-100" : "bg-black/20"}`}
                value={nonStrikerName}
                onChange={(e) => {
                  onStrikeChange(strikerName, e.target.value);
                  setEditNonStriker(false);
                }}>
                <option>Select</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <div className={`text-xs ${theme.sub}`}>
              {m.batsmenStats?.[nonStrikerName]?.runs || 0} (
              {m.batsmenStats?.[nonStrikerName]?.balls || 0})
            </div>
          </div>
          {/* Bowler */}
          <div
            className={`col-span-2 md:col-span-1 p-3 rounded-xl border-l-4 border-l-blue-500 ${theme.card} shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <div className="flex justify-between mb-1">
              <span className={`text-[9px] font-black uppercase ${theme.sub}`}>
                BOWLER
              </span>
              <button
                onClick={() => setEditBowler(true)}
                className="opacity-30 p-1">
                <Menu size={12} />
              </button>
            </div>
            {!editBowler ? (
              <div className="font-bold truncate text-lg">
                {currentBowlerName || "Select"}
              </div>
            ) : (
              <select
                className={`w-full text-xs p-1 rounded ${lightMode ? "bg-gray-100" : "bg-black/20"}`}
                value={currentBowlerName}
                onChange={(e) => {
                  onChangeBowler(e.target.value);
                  setEditBowler(false);
                }}>
                <option>Select</option>
                {fieldingTeamPlayers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <div className={`text-xs ${theme.sub}`}>
              {m.bowlerStats?.[currentBowlerName]?.wickets || 0}-
              {m.bowlerStats?.[currentBowlerName]?.runs || 0}
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div
          className={`h-12 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar border-t ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"} shrink-0 mb-auto`}>
          <span
            className={`text-[10px] font-bold uppercase ${theme.sub} shrink-0`}>
            Last 12:
          </span>
          {(m.timeline || [])
            .slice(-12)
            .reverse()
            .map((b, i) => {
              let label = b.runs;
              let bubble = lightMode
                ? "bg-white border-gray-300 text-black"
                : "bg-slate-700 text-white border-slate-600";
              if (b.isWicket) {
                label = "W";
                bubble = "bg-red-500 text-white border-red-600";
              } else if (b.isWide) {
                label = "WD";
                bubble = "bg-orange-500 text-white border-orange-600";
              } else if (b.isNoBall) {
                label = "NB";
                bubble = "bg-orange-500 text-white border-orange-600";
              } else if (b.runs === 4) {
                bubble = "bg-blue-500 text-white border-blue-600";
              } else if (b.runs === 6) {
                bubble = "bg-yellow-500 text-black border-yellow-600";
              }
              return (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${bubble} shadow-sm border`}>
                  {label}
                </div>
              );
            })}
        </div>

        {/* KEYPAD */}
        <div
          className={`rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] pb-8 pt-4 z-20 ${theme.card} border-t ${lightMode ? "border-gray-200" : "border-white/5"} shrink-0`}>
          <div className="px-6 mb-4 flex justify-between items-center">
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${extraType ? theme.accent : theme.sub}`}>
              {extraType ? `${extraType} SELECTED` : "SELECT RUNS"}
            </span>
            {isSyncing && (
              <span className="text-xs font-bold text-red-500 animate-pulse">
                Saving...
              </span>
            )}
          </div>
          <div className="px-4 grid grid-cols-4 gap-2 mb-3">
            {["WD", "NB", "B", "LB"].map((type) => (
              <KeyButton
                key={type}
                val={type}
                onClick={() => setExtraType(extraType === type ? null : type)}
                disabled={disableBallEntry}
                color={extraType === type ? theme.btnActive : theme.btnBase}
              />
            ))}
          </div>
          <div className="px-4 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 6].map((run) => (
              <KeyButton
                key={run}
                val={run}
                onClick={() => handleSubmitBall(run)}
                disabled={disableBallEntry}
                loading={isSyncing}
                color={`${theme.btnBase} ${run === 4 ? "text-blue-500" : ""} ${run === 6 ? "text-yellow-500" : ""}`}
              />
            ))}
            <KeyButton
              val="OUT"
              onClick={() => {
                setExtraType(null);
                setIsWicketMenuOpen(true);
              }}
              disabled={disableBallEntry}
              color="col-span-2 bg-red-600 text-white"
            />
          </div>

          <div className="flex justify-between items-center px-6 mt-6 opacity-60">
            <button
              onClick={() => onUndo()}
              className="text-xs font-bold flex items-center gap-1 hover:opacity-100">
              <RotateCcw size={14} /> UNDO
            </button>
            <button
              onClick={() => setShowCorrectionModal(true)}
              className="text-xs font-bold flex items-center gap-1 hover:opacity-100 transition-opacity">
              <Settings size={14} /> SETTINGS
            </button>
            <button
              onClick={async () => {
                if (isInning2) {
                  if (
                    window.confirm(
                      "🏆 Are you sure you want to FINISH this match?",
                    )
                  )
                    onFinishMatch("Finished");
                } else {
                  if (
                    window.confirm(
                      "⚠️ Are you sure you want to end this innings?",
                    )
                  )
                    await onEndInnings();
                }
              }}
              className="text-xs font-bold flex items-center gap-1 text-orange-500 hover:opacity-100 uppercase">
              {isInning2 ? "Finish Match" : "End Innings"}{" "}
              {isInning2 ? (
                <Trophy size={14} />
              ) : (
                <ArrowRightCircle size={14} />
              )}
            </button>
          </div>
        </div>

        {/* --- MODALS (THEMED) --- */}

        {/* 1. ✅ OPENERS SELECTOR (Feature #1) */}
        {needOpeners && (
          <div className={modalContainerClass}>
            <div className={modalContentClass}>
              <h3
                className={`text-lg font-bold mb-4 ${lightMode ? "text-teal-700" : "text-teal-400"}`}>
                Select Opening Batsmen
              </h3>
              <p className={`text-xs mb-4 ${theme.sub}`}>
                Innings Start • {m.battingTeam}
              </p>

              <label className={modalLabelClass}>Striker</label>
              <select
                className={modalInputClass}
                value={openerStriker}
                onChange={(e) => setOpenerStriker(e.target.value)}>
                <option value="">Select Striker</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n} disabled={n === openerNonStriker}>
                    {n}
                  </option>
                ))}
              </select>

              <label className={modalLabelClass}>Non-Striker</label>
              <select
                className={modalInputClass}
                value={openerNonStriker}
                onChange={(e) => setOpenerNonStriker(e.target.value)}>
                <option value="">Select Non-Striker</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n} disabled={n === openerStriker}>
                    {n}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (onSetOpeners)
                    onSetOpeners(openerStriker, openerNonStriker);
                  else if (onStrikeChange)
                    onStrikeChange(openerStriker, openerNonStriker);
                }}
                disabled={!openerStriker || !openerNonStriker}
                className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl uppercase tracking-widest disabled:opacity-50">
                Start Innings 🚀
              </button>
            </div>
          </div>
        )}

        {/* 2. MATCH END / INNINGS BREAK */}
        {isInningsComplete && (
          <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div
              className={`max-w-sm w-full p-8 rounded-3xl text-center shadow-2xl ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"}`}>
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-white/5 border-white/10"}`}>
                {isMatchOver ? (
                  <Trophy size={40} className="text-amber-500" />
                ) : (
                  <ArrowRightCircle size={40} className="text-teal-500" />
                )}
              </div>
              <h2
                className={`text-2xl font-black uppercase tracking-tight mb-2 ${theme.text}`}>
                {isMatchOver ? "Match Finished!" : "Innings Complete!"}
              </h2>
              <p className={`text-sm mb-8 ${theme.sub}`}>
                {isMatchOver
                  ? "The match has officially ended."
                  : `Target for ${match.innings[0].bowlingTeam}: ${m.score + 1} Runs.`}
              </p>
              {isMatchOver ? (
                <button
                  onClick={() => onFinishMatch("Finished")}
                  className="w-full py-4 bg-amber-600 text-white font-black uppercase rounded-xl">
                  Confirm Result 🏆
                </button>
              ) : (
                <button
                  onClick={onEndInnings}
                  className="w-full py-4 bg-teal-600 text-white font-black uppercase rounded-xl">
                  Start 2nd Innings 🏏
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. ✅ PLAYER SELECTOR (Feature #2: Quick Add) */}
        {showPlayerSelector && (
          <div className={modalContainerClass}>
            <div className={modalContentClass}>
              <h3 className={`text-lg font-bold mb-4 ${theme.text}`}>
                {needBatsman ? "Select New Batsman" : "Select Next Bowler"}
              </h3>
              {!isAddingNew ? (
                <>
                  <select
                    className={modalInputClass}
                    value={incoming || newBowler}
                    onChange={(e) => {
                      if (e.target.value === "ADD_NEW") {
                        setIsAddingNew(true);
                        setIncoming("");
                        setNewBowler("");
                      } else {
                        needBatsman
                          ? setIncoming(e.target.value)
                          : setNewBowler(e.target.value);
                      }
                    }}>
                    <option value="">Select Player</option>
                    {needBatsman
                      ? battingOptions.map((n) => (
                          <option
                            key={n}
                            value={n}
                            disabled={
                              m.batsmenStats?.[n]?.out ||
                              n === strikerName ||
                              n === nonStrikerName
                            }
                            className={
                              m.batsmenStats?.[n]?.out ? "text-gray-500" : ""
                            }>
                            {n} {m.batsmenStats?.[n]?.out ? "(Out)" : ""}
                          </option>
                        ))
                      : fieldingTeamPlayers.map((n) => (
                          <option
                            key={n}
                            value={n}
                            disabled={n === currentBowlerName}>
                            {n}
                          </option>
                        ))}
                    <option
                      value="ADD_NEW"
                      className={`font-black ${lightMode ? "text-teal-600" : "text-teal-400"}`}>
                      + Add New Player
                    </option>
                  </select>
                  <button
                    onClick={() => {
                      if (needBatsman && incoming) {
                        onNewBatsman(incoming);
                        setIncoming("");
                      } else if (needBowler && newBowler) {
                        onConfirmBowler(newBowler);
                        setNewBowler("");
                      }
                    }}
                    className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl uppercase tracking-widest">
                    Confirm
                  </button>
                </>
              ) : (
                /* QUICK ADD */
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <label className={modalLabelClass}>
                    Enter New Player Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Rohit Sharma"
                    className={modalInputClass}
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewPlayerName("");
                      }}
                      className={`flex-1 py-4 font-bold rounded-xl ${lightMode ? "bg-gray-200 text-gray-700" : "bg-slate-700 text-slate-300"}`}>
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!newPlayerName.trim()) return;
                        setIsSyncing(true);
                        try {
                          const isBattingSide = needBatsman;
                          const teamId = isBattingSide
                            ? match.innings[activeIndex].battingTeam ===
                              match.meta.teamA
                              ? match.meta.teamAId
                              : match.meta.teamBId
                            : match.innings[activeIndex].bowlingTeam ===
                                match.meta.teamA
                              ? match.meta.teamAId
                              : match.meta.teamBId;
                          const teamSide =
                            teamId === match.meta.teamAId ? "A" : "B";

                          // ✅ Updated Call to fixed function
                          const newPlayer = await quickAddPlayer(
                            match.meta.tournament,
                            match.id,
                            teamId,
                            teamSide,
                            newPlayerName,
                          );

                          if (isBattingSide) onNewBatsman(newPlayer.name);
                          else onConfirmBowler(newPlayer.name);
                          setIsAddingNew(false);
                          setNewPlayerName("");
                        } catch (err) {
                          alert("Failed to add player.");
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      className="flex-1 py-4 bg-teal-600 text-white font-bold rounded-xl uppercase">
                      Add & Select
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. WICKET MODAL */}
        {isWicketMenuOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/90">
            <div
              className={`w-full rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom ${theme.card}`}>
              <h3 className="text-xl font-bold mb-4 text-red-500">
                Confirm Wicket
              </h3>
              <select
                className={modalInputClass}
                value={wicketType}
                onChange={(e) => setWicketType(e.target.value)}>
                {[
                  "bowled",
                  "caught",
                  "runout",
                  "lbw",
                  "stumped",
                  "hitwicket",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
              {["caught", "runout", "stumped"].includes(wicketType) && (
                <select
                  className={modalInputClass}
                  value={fielderName}
                  onChange={(e) => setFielderName(e.target.value)}>
                  <option value="">Select Fielder</option>
                  {fieldingTeamPlayers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  onBall(
                    "W",
                    {
                      isWicket: true,
                      wicketType,
                      fielderName,
                      whoOut:
                        whoOut === "striker" ? strikerName : nonStrikerName,
                      isWide: extraType === "WD",
                      isNoBall: extraType === "NB",
                    },
                    wicketRuns,
                  );
                  setIsWicketMenuOpen(false);
                  setExtraType(null);
                }}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-xl text-lg mb-3">
                CONFIRM OUT
              </button>
              <button
                onClick={() => setIsWicketMenuOpen(false)}
                className="w-full py-4 font-bold opacity-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {showCorrectionModal && (
          <MatchCorrectionModal
            match={match}
            tournamentId={match.tournamentId || match.meta.tournament}
            onClose={() => setShowCorrectionModal(false)}
          />
        )}
      </div>
    </div>
  );
}
