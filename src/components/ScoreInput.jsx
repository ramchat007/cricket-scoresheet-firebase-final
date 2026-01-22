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
import { getMatchInsights, getDeterministicCommentary } from "../utils/commentaryHelper";
import { fetchAICommentary } from "../utils/gemini";

// --- SUB-COMPONENT: EYE-FRIENDLY BUTTON (Memoized) ---
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
  onDeleteMatch,
}) {
  const { user } = useAuth();

  // -- Toss & Start States --
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("Bat");
  const [startLoading, setStartLoading] = useState(false);

  // -- Wicket States --
  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");

  // ✅ NEW: Wicket Runs State (for Run Outs)
  const [wicketRuns, setWicketRuns] = useState(0);

  // -- Extras States --
  const [deliveryType, setDeliveryType] = useState("legal"); // 'legal', 'wides', 'noBalls'
  const [runType, setRunType] = useState("bat"); // 'bat', 'byes', 'legByes'
  const [isLegalOverride, setIsLegalOverride] = useState(false); // For Box Cricket

  // -- Input States --
  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [editStriker, setEditStriker] = useState(false);
  const [editNonStriker, setEditNonStriker] = useState(false);
  const [editBowler, setEditBowler] = useState(false);
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
      if (type === "wicket") {
        wicketSound.current.currentTime = 0;
        wicketSound.current.play().catch(() => {});
      } else {
        clickSound.current.currentTime = 0;
        clickSound.current.play().catch(() => {});
      }
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

    // Fallback to toss logic if inn1 isn't initialized yet
    const tossWinner = match?.meta?.toss?.winner;
    const tossChoice = match?.meta?.toss?.decision;
    if (tossWinner && tossChoice) {
      if (tossChoice === "Bat") return tossWinner;
      return tossWinner === match.meta.teamA
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

  // --- 🧠 NEW CONTEXT LOGIC (Side-by-Side, CRR, Standard Result) ---
  const matchContext = useMemo(() => {
    const inn1 = match?.innings?.[0];
    const inn2 = match?.innings?.[1];
    const isFinished =
      match?.status === "finished" || match?.meta?.matchStatus === "finished";

    // ✅ STANDARD RESULT LOGIC
    let resultText = null;
    if (isFinished && inn1 && inn2) {
      if (inn1.score > inn2.score) {
        const margin = inn1.score - inn2.score;
        resultText = `${inn1.battingTeam} won by ${margin} run${margin > 1 ? "s" : ""}`;
      } else if (inn2.score > inn1.score) {
        const totalWickets = parseInt(match.meta?.totalWickets || 10);
        const margin = Math.max(0, totalWickets - inn2.wickets);
        resultText = `${inn2.battingTeam} won by ${margin} wicket${margin > 1 ? "s" : ""}`;
      } else {
        resultText = "Match Tied";
      }
    } else if (isFinished) {
      resultText = match?.meta?.result || "Match Completed";
    }

    const target = inn1 && inn1.score !== undefined ? inn1.score + 1 : null;
    const runsNeeded = target && inn2 ? target - inn2.score : 0;
    const totalOvers = parseInt(match?.meta?.overs || 0);
    const currentBalls = inn2 ? inn2.over * 6 + inn2.overBallCount : 0;
    const remainingBalls = Math.max(0, totalOvers * 6 - currentBalls);

    const getCRR = (inn) => {
      if (!inn) return "0.00";
      const totalLegalBalls = inn.over * 6 + inn.overBallCount;
      return totalLegalBalls > 0
        ? ((inn.score / totalLegalBalls) * 6).toFixed(2)
        : "0.00";
    };

    return {
      inn1,
      inn2,
      target,
      runsNeeded,
      remainingBalls,
      resultText,
      isFinished,
      crr1: getCRR(inn1),
      crr2: getCRR(inn2),
    };
  }, [match, activeIndex]);

  useEffect(() => {
    if (!m.awaitingNewBatsman && !m.awaitingNewBowler) {
      setLocalOverlayDismissed(false);
    }
    setIsSyncing(false);
  }, [match, m.awaitingNewBatsman, m.awaitingNewBowler]);

  const tournamentId = match?.meta?.tournament || match?.tournamentId;
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
    const teamA = match?.meta?.teamA;
    const teamB = match?.meta?.teamB;
    const batting = m.battingTeam;
    if (batting === teamA)
      return {
        currentBattingSquad: match?.teamASquad || [],
        currentBowlingSquad: match?.teamBSquad || [],
      };
    if (batting === teamB)
      return {
        currentBattingSquad: match?.teamBSquad || [],
        currentBowlingSquad: match?.teamASquad || [],
      };
    return {
      currentBattingSquad: m.batsmenList || [],
      currentBowlingSquad: m.bowlersList || [],
    };
  }, [match, m.battingTeam]);

  const statsSummary = useMemo(() => {
    const stats = { fours: 0, sixes: 0, extras: 0 };
    if (m.batsmenStats) {
      Object.values(m.batsmenStats).forEach((p) => {
        stats.fours += p.fours || 0;
        stats.sixes += p.sixes || 0;
      });
    }
    if (m.extras) {
      stats.extras =
        (m.extras.wides || 0) +
        (m.extras.noBalls || 0) +
        (m.extras.byes || 0) +
        (m.extras.legByes || 0);
    }
    return stats;
  }, [m]);

  const battingOptions = useMemo(
    () => currentBattingSquad.map((p) => getPlayerName(p)).sort(),
    [currentBattingSquad, getPlayerName],
  );
  const fieldingTeamPlayers = useMemo(
    () => currentBowlingSquad.map((p) => getPlayerName(p)).sort(),
    [currentBowlingSquad, getPlayerName],
  );

  // ✅ Trigger AI Commentary for the latest ball
  // useEffect(() => {
  //   const timeline = m.timeline || [];
  //   if (timeline.length === 0 || matchContext.isFinished) return;

  //   const latestBallIndex = timeline.length - 1;
  //   const latestBallId = `${activeIndex}-${latestBallIndex}`;
  //   const latestBall = timeline[latestBallIndex];

  //   // Only fetch if we don't have a comment for this ball yet
  //   if (latestBall && !aiComments[latestBallId]) {
  //     fetchAICommentary({
  //       ...latestBall,
  //       batter: latestBall.batter || strikerName,
  //       bowler: latestBall.bowler || currentBowlerName,
  //       matchSituation: `${m.score}/${m.wickets} in ${m.over}.${m.overBallCount}`,
  //     }).then((text) => {
  //       if (text) {
  //         setAiComments((prev) => ({ ...prev, [latestBallId]: text }));
  //       }
  //     });
  //   }
  // }, [m.timeline?.length, activeIndex]); // Runs whenever the ball count changes

  useEffect(() => {
    const timeline = m.timeline || [];
    if (timeline.length === 0 || matchContext.isFinished) return;

    const latestBallIndex = timeline.length - 1;
    const latestBallId = `${activeIndex}-${latestBallIndex}`;
    const latestBall = timeline[latestBallIndex];

    // 1. GENERATE INSTANT COMMENTARY (Local)
    // We pass the last 6 balls so the engine can detect "Maiden Overs" or "Expensive Overs"
    const last6 = timeline.slice(-6);
    const localComment = getDeterministicCommentary(latestBall, last6, strikerName, currentBowlerName);

    // If no comment exists yet, set the local one immediately
    if (!aiComments[latestBallId]) {
      setAiComments((prev) => ({ ...prev, [latestBallId]: localComment }));
    }

    // 2. CHECK FOR HIGH-IMPACT MOMENTS (Trigger AI)
    // Trigger on: Wicket OR End of Over
    const isOverEnd = latestBall.overBallCount === 0 && !latestBall.isWide && !latestBall.isNoBall;
    const needsAI = latestBall.isWicket || (isOverEnd && latestBall.over > 0);

    // Only fetch AI if we haven't already fetched it (to save costs)
    const hasAiComment = aiComments[latestBallId] && aiComments[latestBallId].includes("🤖");

    if (needsAI && !hasAiComment) {
      // Optional: Show a loading state or just keep the local text while loading
      fetchAICommentary({
        ...latestBall,
        type: latestBall.isWicket ? "WICKET_ANALYSIS" : "OVER_SUMMARY",
        matchSituation: `${m.score}/${m.wickets} in ${m.over}.${m.overBallCount}`,
        last6Balls: last6,
      }).then((aiText) => {
        if (aiText) {
          // Prefix with robot icon so the UI knows to highlight it in Purple
          setAiComments((prev) => ({ ...prev, [latestBallId]: `🤖 ${aiText}` }));
        }
      });
    }
  }, [m.timeline?.length, activeIndex]);

  // --- ⚡️ CORE SCORING HANDLER ---
  const handleSubmitBall = useCallback(
    async (val) => {
      if (isSyncing) return;
      triggerFeedback("click");
      setIsSyncing(true);

      let code = val;
      const isWide = deliveryType === "wides";
      const isNoBall = deliveryType === "noBalls";
      const isBye = runType === "byes";
      const isLegBye = runType === "legByes";

      if (isWide) code = "WD";
      else if (isNoBall) code = "NB";

      const extraData = {
        isWide,
        isNoBall,
        isBye: isBye && !isWide,
        isLegBye: isLegBye && !isWide,
        isWicket: false,
      };

      const runs = parseInt(val) || 0;

      await onBall(code, extraData, runs);

      setDeliveryType("legal");
      setRunType("bat");
    },
    [deliveryType, runType, onBall, isSyncing],
  );

  const undoLabel = useMemo(() => {
    if (!m.timeline || m.timeline.length === 0) return "Undo";
    const lastBall = m.timeline[m.timeline.length - 1];
    let text = lastBall.isWicket
      ? "W"
      : lastBall.isWide
        ? "WD"
        : lastBall.isNoBall
          ? "NB"
          : lastBall.runs;
    return `Undo (${text})`;
  }, [m.timeline]);

  // ✅ UPDATED LIVE NARRATIVE LOGIC
  const displayInsightText = useMemo(() => {
    if (matchContext.isFinished) return `🏆 ${matchContext.resultText}`;
    if (m.awaitingNewBatsman) return "☝️ Wicket! Waiting for new batsman...";
    if (m.awaitingNewBowler) return `🥎 Over complete. Waiting for new bowler.`;

    // Check for AI commentary for the latest ball
    const timeline = m.timeline || [];
    const latestId = `${activeIndex}-${timeline.length - 1}`;

    if (aiComments[latestId]) {
      return `🤖 ${aiComments[latestId]}`;
    }

    // Fallback narrative
    if (strikerName && currentBowlerName)
      return `🏏 ${strikerName} vs ${currentBowlerName}.`;

    return "⚡ System ready.";
  }, [
    m,
    strikerName,
    currentBowlerName,
    matchContext,
    aiComments,
    activeIndex,
  ]);

  const hasSetup = strikerName && nonStrikerName && currentBowlerName;
  const disableBallEntry =
    isSyncing ||
    match?.status === "finished" ||
    m.completed ||
    m.awaitingNewBowler ||
    m.awaitingNewBatsman ||
    isWicketMenuOpen ||
    !hasSetup;

  if (!match?.meta?.toss?.winner) {
    return (
      <div className="bg-[#161920] border border-white/5 rounded-3xl p-8 text-center max-w-md mx-auto mt-10 shadow-2xl">
        <h3 className="text-xl font-bold text-slate-100 mb-8 uppercase tracking-tighter">
          Match Toss
        </h3>
        <div className="space-y-6">
          <select
            className="w-full bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-xl outline-none"
            value={tossWinner}
            onChange={(e) => setTossWinner(e.target.value)}>
            <option value="">-- Choose Toss Winner --</option>
            <option value={match?.meta?.teamA}>{match?.meta?.teamA}</option>
            <option value={match?.meta?.teamB}>{match?.meta?.teamB}</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setTossDecision("Bat")}
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${tossDecision === "Bat" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-500"}`}>
              Bat 🏏
            </button>
            <button
              onClick={() => setTossDecision("Bowl")}
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${tossDecision === "Bowl" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-500"}`}>
              Bowl 🥎
            </button>
          </div>
          <button
            onClick={async () => {
              if (!tossWinner) return alert("Choose Winner");
              setStartLoading(true);
              const isABat =
                (tossWinner === match.meta.teamA && tossDecision === "Bat") ||
                (tossWinner === match.meta.teamB && tossDecision === "Bowl");
              await updateDoc(
                doc(db, "tournaments", tournamentId, "matches", match.id),
                {
                  "meta.toss": { winner: tossWinner, decision: tossDecision },
                  status: "ongoing",
                  innings: [
                    {
                      battingTeam: isABat ? match.meta.teamA : match.meta.teamB,
                      bowlingTeam: isABat ? match.meta.teamB : match.meta.teamA,
                      score: 0,
                      wickets: 0,
                      over: 0,
                      overBallCount: 0,
                      ballsLog: [],
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
            className="w-full py-4 bg-teal-700 text-white font-bold rounded-xl active:scale-95 disabled:opacity-20">
            Start Match 🚀
          </button>
        </div>
      </div>
    );
  }

  // const showPlayerSelector =
  //   (m.awaitingNewBatsman || m.awaitingNewBowler) && !localOverlayDismissed;
  const maxOvers = parseInt(match?.meta?.overs || 0);
  const isLastOverOfInnings = m.over >= maxOvers;

  const showPlayerSelector =
    (m.awaitingNewBatsman || (m.awaitingNewBowler && !isLastOverOfInnings)) &&
    !localOverlayDismissed;

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#0F1115] text-slate-300 overflow-y-auto no-scrollbar relative pb-32">
      {/* SECTION 1: SIDE-BY-SIDE SCORE SUMMARY (Standard Professional Layout) */}
      <div className="flex-none bg-[#161920] border-b border-white/5 px-4 py-4 relative shadow-lg">
        <div className="flex justify-between items-start gap-4">
          {/* LEFT SIDE: 1st Innings Team (The Target Setter) */}
          <div className="flex-1 text-left border-r border-white/10 pr-3">
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate mb-1">
              {battingFirstTeam}
            </div>
            {matchContext.inn1 ? (
              <>
                <div className="text-2xl font-black text-slate-200 leading-none">
                  {matchContext.inn1.score}/{matchContext.inn1.wickets}
                  <span className="text-xs font-medium text-slate-500 ml-1">
                    ({matchContext.inn1.over}.{matchContext.inn1.overBallCount}{" "}
                    / {maxOvers} ov)
                  </span>
                </div>
                {/* Target Placement: Stays under the team that set it */}
                {isInning2 && !matchContext.isFinished && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-black text-yellow-500 uppercase tracking-tighter">
                    Target: {matchContext.target}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-600 font-bold italic">
                Waiting...
              </div>
            )}
          </div>

          {/* RIGHT SIDE: 2nd Innings Team (The Live Chaser) */}
          <div className="flex-1 text-right pl-3">
            <div
              className={`text-[10px] font-black uppercase tracking-widest truncate mb-1 ${isInning2 ? "text-teal-400" : "text-slate-500"}`}>
              {battingSecondTeam}{" "}
              {isInning2 && !matchContext.isFinished && (
                <span className="animate-pulse ml-1 text-[8px]">LIVE</span>
              )}
            </div>
            {matchContext.inn2 ? (
              <>
                <div
                  className={`text-3xl font-black leading-none ${isInning2 ? "text-white" : "text-slate-600"}`}>
                  {matchContext.inn2.score}/{matchContext.inn2.wickets}
                  <span className="text-sm font-medium text-slate-400 ml-1">
                    ({matchContext.inn2.over}.{matchContext.inn2.overBallCount}{" "}
                    / {maxOvers} ov)
                  </span>
                </div>
                {/* Equation Placement: Under the chasing team */}
                {isInning2 && !matchContext.isFinished && (
                  <div className="mt-2 text-[11px] font-bold text-teal-500 uppercase tracking-tighter">
                    Need {matchContext.runsNeeded} in{" "}
                    {matchContext.remainingBalls} balls
                  </div>
                )}
              </>
            ) : (
              <div className="text-2xl font-black text-slate-800">0/0</div>
            )}
          </div>
        </div>

        {/* BOTTOM CENTER: FINAL RESULT OVERLAY */}
        {matchContext.isFinished && (
          <div className="mt-4 text-center border-t border-white/5 pt-3 animate-in fade-in zoom-in duration-500">
            <span className="text-teal-400 text-lg font-black uppercase tracking-wider drop-shadow-md">
              🏆 {matchContext.resultText}
            </span>
          </div>
        )}
      </div>

      {/* SECTION 2: STATS BAR */}
      <div className="flex-none px-4 py-2 bg-[#12141a] flex justify-around border-b border-white/5">
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black uppercase text-slate-500">
            Extras
          </span>
          <span className="text-sm font-bold text-amber-600">
            {statsSummary.extras}
          </span>
        </div>
        <div className="h-6 w-px bg-white/5 self-center"></div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black uppercase text-slate-500">
            4s
          </span>
          <span className="text-sm font-bold text-emerald-600">
            {statsSummary.fours}
          </span>
        </div>
        <div className="h-6 w-px bg-white/5 self-center"></div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black uppercase text-slate-500">
            6s
          </span>
          <span className="text-sm font-bold text-indigo-500">
            {statsSummary.sixes}
          </span>
        </div>
      </div>

      {/* SECTION 3: PLAYER CARDS */}
      <div className="flex-none p-3 grid grid-cols-2 gap-3">
        <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-4 relative flex flex-col justify-center gap-2 shadow-lg">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              {!strikerName || editStriker ? (
                <select
                  className="bg-slate-900 text-teal-500 text-[10px] w-full border border-slate-700 rounded p-1"
                  value={strikerName}
                  onChange={(e) => {
                    onStrikeChange?.(e.target.value, nonStrikerName);
                    setEditStriker(false);
                  }}>
                  <option value="">STRIKER</option>
                  {battingOptions.map((n) => (
                    <option key={n} value={n} disabled={n === nonStrikerName}>
                      {n}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <span className="text-xs text-slate-200 uppercase truncate font-bold">
                    {strikerName}
                  </span>
                  <span className="text-[10px] font-black text-teal-500 bg-teal-500/10 px-1.5 rounded">
                    {m.batsmenStats?.[strikerName]?.runs || 0}*
                  </span>
                  <button
                    onClick={() => setEditStriker(true)}
                    className="text-[10px] opacity-30 hover:opacity-100">
                    ✎
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center opacity-50 overflow-hidden">
            {!nonStrikerName || editNonStriker ? (
              <select
                className="bg-slate-900 text-teal-500 text-[10px] w-full border border-slate-700 rounded p-1"
                value={nonStrikerName}
                onChange={(e) => {
                  onStrikeChange?.(strikerName, e.target.value);
                  setEditNonStriker(false);
                }}>
                <option value="">NON-STRIKER</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n} disabled={n === strikerName}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs uppercase truncate font-medium">
                  {nonStrikerName}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {m.batsmenStats?.[nonStrikerName]?.runs || 0}
                </span>
                <button
                  onClick={() => setEditNonStriker(true)}
                  className="text-[10px] opacity-30 hover:opacity-100">
                  ✎
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => onStrikeChange?.(nonStrikerName, strikerName)}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center border border-slate-600 shadow-lg active:scale-75 transition-transform">
            ⇄
          </button>
        </div>
        <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-4 flex flex-col justify-center text-center relative shadow-lg">
          <span className="text-[9px] text-slate-500 font-bold uppercase mb-1">
            Bowler
          </span>
          {!currentBowlerName || editBowler ? (
            <select
              className="bg-slate-900 text-teal-500 text-[10px] w-full border border-slate-700 rounded p-1"
              value={currentBowlerName}
              onChange={(e) => {
                onChangeBowler?.(e.target.value);
                setEditBowler(false);
              }}>
              <option value="">BOWLER</option>
              {fieldingTeamPlayers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <>
              <button
                onClick={() => setEditBowler(true)}
                className="absolute top-2 right-2 text-[10px] opacity-20 hover:opacity-100">
                ✎
              </button>
              <span className="text-xs text-slate-200 uppercase truncate mb-1">
                {currentBowlerName}
              </span>
              <div className="text-lg font-bold text-teal-600/80">
                {m.bowlerStats?.[currentBowlerName]?.wickets || 0}-
                {m.bowlerStats?.[currentBowlerName]?.runs || 0}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SECTION 4: LIVE LOG (With Over Dividers Integrated) */}
      <div className="flex-none px-4 space-y-2 mb-2">
        <div className="bg-slate-900/50 rounded-xl p-2 flex items-center gap-2 overflow-x-auto no-scrollbar border border-white/5 h-10 shadow-inner">
          {(m.timeline || []).slice(-12).map((b, i, arr) => {
            let displayVal = b.runs;
            let isExtra = false;

            if (b.isWicket) {
              displayVal = "W";
            } else if (b.isNoBall) {
              isExtra = true;
              const extraRuns = b.runs - 1;
              displayVal = extraRuns > 0 ? `NB+${extraRuns}` : "NB";
            } else if (b.isWide) {
              isExtra = true;
              const extraRuns = b.runs - 1;
              displayVal = extraRuns > 0 ? `WD+${extraRuns}` : "WD";
            } else if (b.isLegBye) {
              displayVal = `${b.runs}LB`;
            } else if (b.isBye) {
              displayVal = `${b.runs}B`;
            }

            // Over Divider Logic
            const showDivider =
              i > 0 &&
              b.over !== undefined &&
              arr[i - 1].over !== undefined &&
              b.over !== arr[i - 1].over;

            return (
              <React.Fragment key={i}>
                {showDivider && (
                  <div className="w-px h-4 bg-slate-600/50 mx-1"></div>
                )}
                <span
                  key={i}
                  className={`h-6 px-2 min-w-[36px] rounded flex items-center justify-center text-[10px] font-bold whitespace-nowrap border border-white/5 ${
                    b.isWicket
                      ? "bg-red-900/40 text-red-400 border-red-500/20"
                      : isExtra
                        ? "bg-amber-900/40 text-amber-400 border-amber-500/20"
                        : b.runs === 4 || (b.runs >= 4 && !isExtra)
                          ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/20"
                          : b.runs === 6
                            ? "bg-indigo-900/40 text-indigo-400 border-indigo-500/20"
                            : "bg-slate-800 text-slate-500"
                  }`}>
                  {displayVal}
                </span>
              </React.Fragment>
            );
          })}
        </div>
        <div className="bg-[#1C2128] p-0 mb-2">
          <div
            className={`${
              displayInsightText.includes("🤖")
                ? "bg-indigo-500/5 border-indigo-500/20"
                : "bg-teal-900/10 border-teal-900/20"
            } border rounded-xl p-3 min-h-[55px] flex items-center transition-all duration-500`}>
            <p
              className={`text-[11px] font-medium leading-snug animate-in fade-in slide-in-from-left duration-500 ${
                displayInsightText.includes("🤖")
                  ? "text-indigo-300"
                  : "text-teal-600 italic"
              }`}>
              {displayInsightText}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 5: KEYPAD */}
      <div className="flex-none bg-[#0F1115] grid grid-cols-4 gap-2 p-4 pt-0 relative">
        {isSyncing && (
          <div className="absolute inset-0 bg-[#0F1115]/80 z-50 flex items-center justify-center rounded-xl backdrop-blur-sm">
            <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-3 rounded-full font-bold uppercase tracking-widest text-xs flex items-center gap-3 shadow-lg">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>{" "}
              Saving...
            </div>
          </div>
        )}

        {["0", "1", "2", "3"].map((v) => (
          <KeyButton
            key={v}
            val={v}
            onClick={() => handleSubmitBall(v)}
            disabled={disableBallEntry}
            loading={isSyncing}
          />
        ))}

        {/* ROW 2: Boundaries & 5 */}
        <KeyButton
          val="4"
          color="bg-emerald-900/20 border-emerald-800/30 text-emerald-600/90"
          onClick={() => handleSubmitBall("4")}
          disabled={disableBallEntry}
          loading={isSyncing}
        />
        <KeyButton
          val="6"
          color="bg-indigo-900/20 border-indigo-800/30 text-indigo-600/90"
          onClick={() => handleSubmitBall("6")}
          disabled={disableBallEntry}
          loading={isSyncing}
        />
        <KeyButton
          val="5"
          onClick={() => handleSubmitBall("5")}
          disabled={disableBallEntry}
          loading={isSyncing}
        />
        <KeyButton
          val="OUT"
          color="bg-red-900/20 border-red-800/30 text-red-600/90"
          onClick={() => {
            setIsWicketMenuOpen(true);
            setWicketRuns(0); // ✅ Reset wicket runs
          }}
          disabled={disableBallEntry}
          loading={isSyncing}
        />

        {/* ROW 3: EXTRAS CONTROLS */}
        <div className="col-span-1 row-span-2 bg-slate-800/20 rounded-xl border border-slate-800/50 flex flex-col overflow-hidden">
          <button
            onClick={() => {
              const newVal = deliveryType === "wides" ? "legal" : "wides";
              setDeliveryType(newVal);
              if (newVal === "wides") setRunType("bat");
            }}
            disabled={isSyncing}
            className={`flex-1 text-[9px] font-bold uppercase transition-all border-b border-white/5 ${
              deliveryType === "wides"
                ? "bg-amber-600 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}>
            WD
          </button>

          <button
            onClick={() =>
              setDeliveryType(deliveryType === "noBalls" ? "legal" : "noBalls")
            }
            disabled={isSyncing}
            className={`flex-1 text-[9px] font-bold uppercase transition-all border-b border-white/5 ${
              deliveryType === "noBalls"
                ? "bg-amber-600 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}>
            NB
          </button>

          <button
            onClick={() => setRunType(runType === "byes" ? "bat" : "byes")}
            disabled={isSyncing || deliveryType === "wides"}
            className={`flex-1 text-[9px] font-bold uppercase transition-all border-b border-white/5 ${
              runType === "byes"
                ? "bg-cyan-600 text-white"
                : "text-slate-600 hover:text-slate-400 disabled:opacity-30"
            }`}>
            BYE
          </button>

          <button
            onClick={() =>
              setRunType(runType === "legByes" ? "bat" : "legByes")
            }
            disabled={isSyncing || deliveryType === "wides"}
            className={`flex-1 text-[9px] font-bold uppercase transition-all ${
              runType === "legByes"
                ? "bg-cyan-600 text-white"
                : "text-slate-600 hover:text-slate-400 disabled:opacity-30"
            }`}>
            LB
          </button>
        </div>

        {/* Runs Buttons (+0 to +6) */}
        {["+0", "+1", "+2", "+3", "+4", "+6"].map((v) => (
          <KeyButton
            key={v}
            val={v}
            color={`bg-amber-900/10 border-amber-800/20 text-amber-600/80 ${
              deliveryType !== "legal" || runType !== "bat"
                ? "ring-1 ring-amber-500/50"
                : ""
            }`}
            onClick={() => handleSubmitBall(v.replace("+", ""))}
            disabled={disableBallEntry}
            loading={isSyncing}
          />
        ))}

        {/* BOTTOM CONTROLS */}
        <button
          onClick={() => {
            setIsSyncing(true);
            onUndo();
          }}
          disabled={isSyncing}
          className="bg-slate-800/40 text-slate-500 text-xs font-bold rounded-xl h-14 active:scale-95 border border-white/5 disabled:opacity-30 flex items-center justify-center gap-1">
          ↩ {undoLabel}
        </button>
        <button
          onClick={() => setShowCorrectionModal(true)}
          className="bg-slate-800/40 text-teal-600 text-[10px] font-bold rounded-xl h-14 uppercase border border-white/5">
          Fix
        </button>
        <button
          onClick={() => {
            setIsSyncing(true);
            onEndInnings();
          }}
          disabled={isSyncing}
          className="bg-slate-800/40 text-red-800 text-[10px] font-bold rounded-xl h-14 uppercase border border-red-900/10 disabled:opacity-30">
          End
        </button>
        <button
          onClick={() => onFinishMatch("Completed")}
          disabled={isSyncing}
          className="bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl h-14 uppercase disabled:opacity-30">
          Finish
        </button>
      </div>

      {/* WICKET MODAL */}
      {isWicketMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0F1115]/90 backdrop-blur-md">
          <div className="relative w-full bg-[#1C2128] border-t border-white/10 rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <h3 className="text-lg font-bold text-red-500 uppercase mb-6">
              Dismissal {deliveryType !== "legal" ? `on ${deliveryType}` : ""}
            </h3>
            <div className="space-y-4">
              <select
                value={wicketType}
                onChange={(e) => setWicketType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-xl outline-none">
                <option value="runout">Run Out</option>
                <option value="retiredhurt">Retired Hurt</option>
                <option value="retiredout">Retired Out</option>

                {deliveryType !== "noBalls" && (
                  <>
                    <option value="stumped">Stumped</option>
                    <option value="hitwicket">Hit Wicket</option>
                  </>
                )}

                {deliveryType === "legal" && (
                  <>
                    <option value="bowled">Bowled</option>
                    <option value="caught">Caught</option>
                    <option value="lbw">LBW</option>
                  </>
                )}
              </select>

              {/* ✅ NEW: Completed Runs Selector (For Run Outs) */}
              {wicketType === "runout" && (
                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">
                    Completed Runs (Before Wicket)
                  </span>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        onClick={() => setWicketRuns(r)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                          wicketRuns === r
                            ? "bg-teal-600 text-white shadow-lg scale-105"
                            : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                        }`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Override for Underarm Box Cricket */}
              {deliveryType === "noBalls" && wicketType === "runout" && (
                <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl border border-white/10">
                  <input
                    type="checkbox"
                    id="legalOverride"
                    checked={isLegalOverride}
                    onChange={(e) => setIsLegalOverride(e.target.checked)}
                    className="w-5 h-5 rounded accent-teal-500 bg-slate-900 border-slate-600"
                  />
                  <label
                    htmlFor="legalOverride"
                    className="text-xs font-bold text-slate-300 uppercase select-none">
                    Count as Legal Ball?{" "}
                    <span className="text-slate-500 text-[10px] normal-case block">
                      (Underarm Rule: Ball counts in over)
                    </span>
                  </label>
                </div>
              )}

              {["caught", "runout", "stumped"].includes(wicketType) && (
                <select
                  value={fielderName}
                  onChange={(e) => setFielderName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-xl outline-none">
                  <option value="">Select Fielder</option>
                  {fieldingTeamPlayers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={whoOut}
                onChange={(e) => setWhoOut(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-xl outline-none">
                <option value="striker">Striker Out ({strikerName})</option>
                <option value="nonStriker">
                  Non-Striker Out ({nonStrikerName})
                </option>
              </select>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsWicketMenuOpen(false)}
                  className="flex-1 py-4 bg-slate-800 text-slate-500 font-bold rounded-xl uppercase">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (
                      ["caught", "runout", "stumped"].includes(wicketType) &&
                      !fielderName
                    )
                      return alert("Select Fielder");
                    setIsWicketMenuOpen(false);
                    if (isSyncing) return;
                    triggerFeedback("wicket");
                    setIsSyncing(true);

                    // Construct Wicket Payload
                    await onBall(
                      "W",
                      {
                        isWicket: true,
                        wicketType,
                        fielderName,
                        whoOut:
                          whoOut === "striker" ? strikerName : nonStrikerName,
                        nextStriker: null,
                        isWide: deliveryType === "wides",
                        isNoBall: deliveryType === "noBalls",
                        isBye: runType === "byes" && deliveryType !== "wides",
                        isLegBye:
                          runType === "legByes" && deliveryType !== "wides",
                        isLegalOverride: isLegalOverride,
                      },
                      wicketRuns,
                    ); // ✅ Pass Completed Runs here

                    // Reset
                    setDeliveryType("legal");
                    setRunType("bat");
                    setIsLegalOverride(false);
                    setWicketRuns(0);
                  }}
                  className="flex-[2] py-4 bg-red-900 text-white font-bold rounded-xl uppercase shadow-xl">
                  Confirm OUT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAYS: New Batsman/Bowler */}
      {showPlayerSelector && (
        <div className="absolute inset-0 z-[100] bg-[#0F1115]/95 backdrop-blur-md flex flex-col justify-end p-6 pb-20 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#1C2128] border border-white/10 p-8 rounded-3xl shadow-2xl relative">
            <button
              onClick={() => {
                setIsSyncing(true);
                onUndo();
              }}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase">
              Wrong? Undo
            </button>
            <h3 className="text-lg font-bold text-slate-200 mb-6">
              {m.awaitingNewBatsman
                ? "Select New Batsman"
                : "Over Complete! Select Bowler"}
            </h3>
            <select
              className="w-full bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-xl font-medium outline-none mb-6"
              value={incoming || newBowler}
              onChange={(e) =>
                m.awaitingNewBatsman
                  ? setIncoming(e.target.value)
                  : setNewBowler(e.target.value)
              }>
              <option value="">Choose Member</option>
              {m.awaitingNewBatsman
                ? battingOptions.map((n) => {
                    const isOut = m.batsmenStats?.[n]?.out;
                    const isOnCrease =
                      n === strikerName || n === nonStrikerName;
                    return (
                      <option key={n} value={n} disabled={isOut || isOnCrease}>
                        {n} {isOut ? "(Out)" : ""}{" "}
                        {isOnCrease ? "(Playing)" : ""}
                      </option>
                    );
                  })
                : fieldingTeamPlayers.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
            </select>
            <button
              onClick={() => {
                if (m.awaitingNewBatsman && incoming) {
                  triggerFeedback();
                  const alsoNeedsBowler = m.awaitingNewBowler;
                  setLocalOverlayDismissed(!alsoNeedsBowler);
                  onNewBatsman(incoming);
                  setIncoming("");
                } else if (m.awaitingNewBowler && newBowler) {
                  triggerFeedback();
                  setLocalOverlayDismissed(true);
                  onConfirmBowler(newBowler);
                  setNewBowler("");
                }
              }}
              className="w-full py-4 bg-slate-700 text-slate-100 font-bold uppercase rounded-xl">
              Confirm Selection
            </button>
          </div>
        </div>
      )}

      {showCorrectionModal && (
        <MatchCorrectionModal
          match={match}
          tournamentId={tournamentId}
          onClose={() => setShowCorrectionModal(false)}
        />
      )}
    </div>
  );
}
