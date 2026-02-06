import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";
import { getDeterministicCommentary } from "../utils/commentaryHelper";
import { fetchAICommentary } from "../utils/gemini";
import { RotateCcw, Wrench, Menu, Settings } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

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
}) {
  const { user } = useAuth();
  const { theme, lightMode } = useTheme();

  // --- 🏏 SCORING STATE ---
  const [extraType, setExtraType] = useState(null);

  // -- Toss & Start States --
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("Bat");
  const [startLoading, setStartLoading] = useState(false);

  // -- Wicket States --
  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");
  const [wicketRuns, setWicketRuns] = useState(0);

  // -- Input States --
  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // -- Edit Triggers --
  const [editStriker, setEditStriker] = useState(false);
  const [editNonStriker, setEditNonStriker] = useState(false);

  const [localOverlayDismissed, setLocalOverlayDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [aiComments, setAiComments] = useState({});

  // 🔊 AUDIO REFS
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
  const m = useMemo(() => {
    if (!match || !match.innings) return {};
    const innArr = Array.isArray(match.innings)
      ? match.innings
      : Object.values(match.innings);
    return innArr[activeIndex] || {};
  }, [match, activeIndex]);

  const battingFirstTeam = useMemo(() => {
    const inn1 = match?.innings?.[0];
    if (inn1) return inn1.battingTeam;
    const tossWinner = match?.meta?.toss?.winner;
    const tossChoice = match?.meta?.toss?.decision;
    if (tossWinner && tossChoice) {
      return tossChoice === "Bat"
        ? tossWinner
        : tossWinner === match.meta.teamA
          ? match.meta.teamB
          : match.meta.teamA;
    }
    return match?.meta?.teamA;
  }, [match]);

  const battingSecondTeam =
    battingFirstTeam === match?.meta?.teamA
      ? match?.meta?.teamB
      : match?.meta?.teamA;
  const isInning2 = activeIndex === 1;

  // --- MATCH CONTEXT ---
  const matchContext = useMemo(() => {
    const inn1 = match?.innings?.[0];
    const inn2 = match?.innings?.[1];
    const isFinished =
      match?.status === "finished" || match?.meta?.matchStatus === "finished";

    const target = inn1?.score !== undefined ? inn1.score + 1 : null;
    const runsNeeded = target && inn2 ? target - inn2.score : 0;
    const totalOvers = parseInt(match?.meta?.overs || 0);
    const remainingBalls = Math.max(
      0,
      totalOvers * 6 - (inn2?.over * 6 + (inn2?.overBallCount || 0)),
    );

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

  // --- SQUAD LOGIC ---
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

  // --- AI COMMENTARY ---
  useEffect(() => {
    const timeline = m.timeline || [];
    if (timeline.length === 0 || matchContext.isFinished) return;
    const latestBallIndex = timeline.length - 1;
    const latestBallId = `${activeIndex}-${latestBallIndex}`;
    const latestBall = timeline[latestBallIndex];
    const last6 = timeline.slice(-6);

    const localComment = getDeterministicCommentary(
      latestBall,
      last6,
      strikerName,
      currentBowlerName,
    );
    if (!aiComments[latestBallId])
      setAiComments((prev) => ({ ...prev, [latestBallId]: localComment }));

    const isOverEnd =
      latestBall.overBallCount === 0 &&
      !latestBall.isWide &&
      !latestBall.isNoBall;
    if (
      (latestBall.isWicket || (isOverEnd && latestBall.over > 0)) &&
      (!aiComments[latestBallId] || !aiComments[latestBallId].includes("🤖"))
    ) {
      fetchAICommentary({
        ...latestBall,
        type: latestBall.isWicket ? "WICKET_ANALYSIS" : "OVER_SUMMARY",
        matchSituation: `${m.score}/${m.wickets}`,
        last6Balls: last6,
      }).then((aiText) => {
        if (aiText)
          setAiComments((prev) => ({
            ...prev,
            [latestBallId]: `🤖 ${aiText}`,
          }));
      });
    }
  }, [m.timeline?.length, activeIndex]);

  // --- ⚡️ CORE SCORING HANDLER ---
  const handleSubmitBall = useCallback(
    async (runsVal) => {
      if (isSyncing) return;
      triggerFeedback("click");
      setIsSyncing(true);

      try {
        const runs = parseInt(runsVal);
        const isWide = extraType === "WD";
        const isNoBall = extraType === "NB";
        const isBye = extraType === "B";
        const isLegBye = extraType === "LB";

        let calculatedRuns = runs;
        if (isWide || isNoBall) {
          calculatedRuns = runs + 1;
        }

        let code = runsVal;
        if (isWide) code = runs > 0 ? `${runs + 1}wd` : "WD";
        else if (isNoBall) code = "NB";

        const extraData = {
          isWide,
          isNoBall,
          isBye,
          isLegBye,
          isWicket: false,
        };

        await onBall(code, extraData, calculatedRuns);

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

  useEffect(() => {
    if (m.awaitingNewBatsman || m.awaitingNewBowler)
      setLocalOverlayDismissed(false);
    setIsSyncing(false);
  }, [m.awaitingNewBatsman, m.awaitingNewBowler]);

  const maxOvers = parseInt(match?.meta?.overs || 0);
  const totalWickets = parseInt(match?.meta?.totalWickets || 10);
  const isAllOut = m.wickets >= totalWickets;
  const isMatchOver = isAllOut || (maxOvers > 0 && m.over >= maxOvers);
  const needBatsman = m.awaitingNewBatsman && !isAllOut;
  const needBowler = !needBatsman && m.awaitingNewBowler && !isMatchOver;
  const showPlayerSelector =
    !localOverlayDismissed && (needBatsman || needBowler);
  const hasSetup = strikerName && nonStrikerName && currentBowlerName;
  const disableBallEntry =
    isSyncing ||
    match?.status === "finished" ||
    m.completed ||
    m.awaitingNewBowler ||
    m.awaitingNewBatsman ||
    isWicketMenuOpen ||
    !hasSetup;

  // --- TOSS SCREEN ---
  if (!match?.meta?.toss?.winner) {
    return (
      <div
        className={`flex flex-col h-full overflow-hidden ${theme.bg} ${theme.text} p-4`}>
        <div
          className={`border p-8 rounded-3xl text-center max-w-md w-full shadow-2xl mx-auto my-auto ${theme.card}`}>
          <h3 className={`text-xl font-bold mb-8 uppercase ${theme.text}`}>
            Start Match
          </h3>
          <div className="space-y-6">
            <select
              className={`w-full border p-4 rounded-xl font-bold ${lightMode ? "bg-gray-100 border-gray-200" : "bg-slate-900 border-slate-700"}`}
              value={tossWinner}
              onChange={(e) => setTossWinner(e.target.value)}>
              <option value="">-- Winner --</option>
              <option value={match?.meta?.teamA}>{match?.meta?.teamA}</option>
              <option value={match?.meta?.teamB}>{match?.meta?.teamB}</option>
            </select>
            <div className="flex gap-2">
              {["Bat", "Bowl"].map((c) => (
                <button
                  key={c}
                  onClick={() => setTossDecision(c)}
                  className={`flex-1 py-4 rounded-xl font-bold ${tossDecision === c ? "bg-teal-600 text-white" : `${theme.btnBase}`}`}>
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
                await updateDoc(
                  doc(
                    db,
                    "tournaments",
                    match.tournamentId || match.meta.tournament,
                    "matches",
                    match.id,
                  ),
                  {
                    "meta.toss": {
                      winner: tossWinner,
                      decision: tossDecision,
                    },
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
              className="w-full py-4 bg-teal-700 text-white font-bold rounded-xl">
              Start Match 🚀
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${theme.bg} ${theme.text} transition-colors duration-300 font-sans`}>
      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
        {/* Score Hero Card */}
        <div className="py-4">
          <div
            className={`rounded-2xl p-5 ${theme.card} relative overflow-hidden`}>
            <div className="flex justify-between items-end">
              <div>
                <div
                  className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}>
                  {m.battingTeam}
                </div>
                <div
                  className={`text-6xl font-black leading-none mt-1 tracking-tighter ${lightMode ? "text-black" : "text-white"}`}>
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
                  <span className="text-lg text-slate-500">/ {maxOvers}</span>
                </div>
                <div
                  className={`text-[10px] font-bold uppercase mt-1 ${theme.sub}`}>
                  CRR: {matchContext.crr1}
                </div>
              </div>
            </div>
            {isInning2 && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-500/20 text-center">
                <span className={`text-xs font-bold uppercase ${theme.accent}`}>
                  Target: {matchContext.target} • Need {matchContext.runsNeeded}{" "}
                  off {matchContext.remainingBalls}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Players Area */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
          {/* 1. Striker */}
          <div
            onClick={() =>
              onStrikeChange && onStrikeChange(nonStrikerName, strikerName)
            }
            className={`p-3 rounded-xl border-l-4 border-l-green-500 ${theme.card} relative active:scale-95 transition-transform`}>
            <div className="flex justify-between mb-1">
              <span className="bg-green-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded">
                STR
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditStriker(true);
                }}
                className="opacity-30 p-1 -mr-1">
                <Menu size={12} />
              </button>
            </div>
            {!editStriker ? (
              <div className="font-bold truncate text-lg leading-tight">
                {strikerName || "Select"}
              </div>
            ) : (
              <select
                className="w-full bg-black/20 text-xs p-1 rounded"
                value={strikerName}
                onChange={(e) => {
                  onStrikeChange(e.target.value, nonStrikerName);
                  setEditStriker(false);
                }}>
                <option value="">Select</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n} disabled={n === nonStrikerName}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <div className={`text-xs ${theme.sub} mt-1`}>
              {m.batsmenStats?.[strikerName]?.runs || 0} (
              {m.batsmenStats?.[strikerName]?.balls || 0})
            </div>
          </div>

          {/* 2. Non-Striker */}
          <div
            className={`p-3 rounded-xl border-l-4 border-transparent ${theme.card} opacity-80`}>
            <div className="flex justify-between mb-1">
              <span className={`text-[9px] font-bold ${theme.sub}`}>
                NON-STR
              </span>
              <button
                onClick={() => setEditNonStriker(true)}
                className="opacity-30 p-1 -mr-1">
                <Menu size={12} />
              </button>
            </div>
            {!editNonStriker ? (
              <div className="font-bold truncate text-lg leading-tight">
                {nonStrikerName || "Select"}
              </div>
            ) : (
              <select
                className="w-full bg-black/20 text-xs p-1 rounded"
                value={nonStrikerName}
                onChange={(e) => {
                  onStrikeChange(strikerName, e.target.value);
                  setEditNonStriker(false);
                }}>
                <option value="">Select</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n} disabled={n === strikerName}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <div className={`text-xs ${theme.sub} mt-1`}>
              {m.batsmenStats?.[nonStrikerName]?.runs || 0} (
              {m.batsmenStats?.[nonStrikerName]?.balls || 0})
            </div>
          </div>

          {/* 3. Bowler Bar */}
          <div
            className={`col-span-2 md:col-span-1 p-3 rounded-xl border-l-4 border-l-blue-500 border-transparent ${theme.card} opacity-90`}>
            <div className="flex justify-between items-center mb-1">
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${theme.sub}`}>
                BOWLER
              </span>
              <span className={`text-xs font-mono font-bold ${theme.text}`}>
                <span className={lightMode ? "text-red-600" : "text-red-400"}>
                  {m.bowlerStats?.[currentBowlerName]?.wickets ?? 0}
                </span>
                <span className="mx-1 text-black opacity-50">-</span>
                {/* ✅ FORCE HIGH CONTRAST COLOR */}
                <span className={lightMode ? "text-black" : "text-white"}>
                  {m.bowlerStats?.[currentBowlerName]?.runs ??
                    m.bowlerStats?.[currentBowlerName]?.runsConceded ??
                    0}
                </span>
                <span className={`ml-1 text-[9px] ${theme.sub}`}>
                  (
                  {m.bowlerStats?.[currentBowlerName]?.balls
                    ? `${Math.floor(m.bowlerStats[currentBowlerName].balls / 6)}.${m.bowlerStats[currentBowlerName].balls % 6}`
                    : "0.0"}
                  )
                </span>
              </span>
            </div>
            <select
              className={`w-full p-1 bg-transparent font-bold text-sm outline-none truncate appearance-none cursor-pointer ${theme.text}`}
              value={currentBowlerName}
              onChange={(e) => onChangeBowler(e.target.value)}>
              <option value="" className="text-gray-500">
                Select Bowler
              </option>
              {fieldingTeamPlayers.map((n) => (
                <option key={n} value={n} className="text-black">
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* History Timeline */}
        <div
          className={`h-12 mb-2 rounded-2xl flex items-center px-4 gap-2 overflow-x-auto no-scrollbar ${theme.card} shrink-0`}>
          <span
            className={`text-[10px] font-bold uppercase ${theme.sub} shrink-0`}>
            Last 12:
          </span>
          {(m.timeline || [])
            .slice(-12)
            .reverse()
            .map((b, i) => {
              let label = b.runs;
              // Default bubble style (visible text)
              let bubble = lightMode
                ? "bg-gray-200 text-black"
                : "bg-slate-700 text-white";

              if (b.isWicket) {
                label = "W";
                bubble = "bg-red-500 text-white";
              } else if (b.isWide) {
                // Checks for extra runs on the wide
                const extraRuns = (b.runs || 1) - 1; // Basic WD is 1 run
                label = extraRuns > 0 ? `${b.runs}WD` : "WD";
                bubble = "bg-orange-500 text-white";
              } else if (b.isNoBall) {
                const extraRuns = (b.runs || 1) - 1;
                label = extraRuns > 0 ? `${b.runs}NB` : "NB";
                bubble = "bg-orange-500 text-white";
              } else if (b.runs === 4) {
                bubble = "bg-blue-500 text-white";
              } else if (b.runs === 6) {
                bubble = "bg-yellow-500 text-black";
              } else if (
                typeof b.code === "string" &&
                (b.code.includes("B") || b.code.includes("LB"))
              ) {
                label = b.code;
              }

              return (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${bubble} shadow-sm border border-black/10`}>
                  {label}
                </div>
              );
            })}
        </div>

        {/* --- 🏏 THE COMPOSER (Bottom) --- */}
        <div
          className={`rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.3)] pb-8 pt-4 z-20 ${theme.card} border-t shrink-0`}>
          {/* Status Feedback */}
          <div className="px-6 mb-4 flex justify-between items-center">
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${extraType ? theme.accent : theme.sub}`}>
              {extraType
                ? extraType === "WD"
                  ? "WIDE SELECTED (Add runs if ran)"
                  : extraType === "NB"
                    ? "NO BALL SELECTED"
                    : `${extraType} SELECTED`
                : "SELECT RUNS"}
            </span>
            {isSyncing && (
              <span className="text-xs font-bold text-red-500 animate-pulse">
                Saving...
              </span>
            )}
          </div>

          {/* Extras Toggles */}
          <div className="px-4 grid grid-cols-4 gap-2 mb-3">
            {["WD", "NB", "B", "LB"].map((type) => (
              <button
                key={type}
                onClick={() => setExtraType(extraType === type ? null : type)}
                disabled={disableBallEntry}
                className={`h-12 rounded-lg font-bold text-xs tracking-wider border transition-all ${extraType === type ? theme.btnActive : theme.btnBase}`}>
                {type}
              </button>
            ))}
          </div>

          {/* Run Grid */}
          <div className="px-4 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 6].map((run) => (
              <button
                key={run}
                onClick={() => handleSubmitBall(run)}
                disabled={disableBallEntry}
                className={`h-14 rounded-xl text-2xl font-black transition-transform active:scale-95 ${theme.btnBase} ${run === 4 ? "text-blue-500 border-blue-500/20" : ""} ${run === 6 ? "text-yellow-500 border-yellow-500/20" : ""}`}>
                {run}
              </button>
            ))}
            <button
              onClick={() => {
                setExtraType(null);
                setIsWicketMenuOpen(true);
              }}
              disabled={disableBallEntry}
              className="col-span-2 h-14 bg-red-600 text-white rounded-xl font-black text-xl tracking-widest shadow-lg active:scale-95">
              OUT
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center px-6 mt-6 opacity-60">
            <button
              onClick={() => onUndo()}
              className="text-xs font-bold flex items-center gap-1 hover:opacity-100">
              <RotateCcw size={14} /> UNDO LAST
            </button>

            {/* ✅ Settings Button in Footer */}
            <button
              onClick={() => setShowCorrectionModal(true)}
              className="text-xs font-bold flex items-center gap-1 hover:opacity-100 transition-opacity">
              <Settings size={14} /> SETTINGS
            </button>

            <button
              onClick={() => onFinishMatch("Finished")}
              className="text-xs font-bold flex items-center gap-1 text-red-500 hover:opacity-100">
              FINISH MATCH
            </button>
          </div>
        </div>

        {/* --- MODALS --- */}
        {isWicketMenuOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/90">
            <div
              className={`w-full ${!theme.isDark ? "bg-white text-black" : "bg-[#1C2128] text-white"} rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom`}>
              <h3 className="text-xl font-bold mb-4 text-red-500">
                Confirm Wicket
              </h3>
              <select
                className="w-full p-4 rounded-xl bg-gray-500/20 mb-4 font-bold"
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
                  className="w-full p-4 rounded-xl bg-gray-500/20 mb-4"
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

        {/* New Batsman / Bowler Overlay */}
        {showPlayerSelector && (
          <div className="absolute inset-0 z-[90] bg-black/95 flex flex-col justify-end p-4 pb-10">
            <div className="bg-[#1C2128] border border-white/10 p-6 rounded-3xl text-white">
              <h3 className="text-lg font-bold mb-4">
                {needBatsman ? "Select New Batsman" : "Select Next Bowler"}
              </h3>
              <select
                className="w-full p-4 rounded-xl bg-slate-900 text-white font-bold mb-4 outline-none border border-slate-700"
                value={incoming || newBowler}
                onChange={(e) =>
                  needBatsman
                    ? setIncoming(e.target.value)
                    : setNewBowler(e.target.value)
                }>
                <option value="">Select Player</option>
                {needBatsman
                  ? battingOptions.map((n) => {
                      const isOut = m.batsmenStats?.[n]?.out;
                      const isOnCrease =
                        n === strikerName || n === nonStrikerName;
                      return (
                        <option
                          key={n}
                          value={n}
                          disabled={isOut || isOnCrease}
                          className={
                            isOut || isOnCrease ? "text-gray-500" : ""
                          }>
                          {n} {isOut ? "(Out)" : ""}
                        </option>
                      );
                    })
                  : fieldingTeamPlayers.map((n) => (
                      <option
                        key={n}
                        value={n}
                        disabled={n === currentBowlerName}>
                        {n}
                      </option>
                    ))}
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
