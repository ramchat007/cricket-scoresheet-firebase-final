import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
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
  Check,
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
      className={`${color} h-14 text-lg font-bold flex items-center justify-center rounded-xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation border shadow-sm select-none relative`}
    >
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
  onSetOpeners,
}) {
  const { theme, lightMode } = useTheme();

  // --- STATES ---
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  const [openerStriker, setOpenerStriker] = useState("");
  const [openerNonStriker, setOpenerNonStriker] = useState("");
  const [addingOpenerRole, setAddingOpenerRole] = useState(null);
  const [newOpenerName, setNewOpenerName] = useState("");

  const [extraType, setExtraType] = useState(null);
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("Bat");
  const [startLoading, setStartLoading] = useState(false);

  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");
  const [wicketRuns, setWicketRuns] = useState(0);
  const [countAsValidBall, setCountAsValidBall] = useState(false);

  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const [editStriker, setEditStriker] = useState(false);
  const [editNonStriker, setEditNonStriker] = useState(false);
  const [editBowler, setEditBowler] = useState(false);
  const [inlineAddingRole, setInlineAddingRole] = useState(null);
  const [inlineNewName, setInlineNewName] = useState("");

  const [localOverlayDismissed, setLocalOverlayDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 🔥 ESCAPE HATCH STATE
  const [forceInningsComplete, setForceInningsComplete] = useState(false);

  // 🔥 HAPTIC FEEDBACK ONLY (Audio Removed)
  const triggerFeedback = useCallback((type = "click") => {
    if (navigator.vibrate) {
      if (type === "wicket")
        navigator.vibrate([100, 50, 100]); // 3 pulses for Wicket
      else if (type === "four" || type === "six")
        navigator.vibrate([50, 50, 50, 50]); // 4 pulses for Boundary
      else navigator.vibrate(15); // Light tap for normal buttons
    }
  }, []);

  // --- DATA EXTRACTION ---
  const activeIndex = match?.currentInnings || 0;

  useEffect(() => {
    setIncoming("");
    setNewBowler("");
    setOpenerStriker("");
    setOpenerNonStriker("");
    setLocalOverlayDismissed(false);
    setForceInningsComplete(false); // Reset the escape hatch for the next innings
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
    const teamAName = (match?.meta?.teamA || "").trim().toLowerCase();
    const inn1BattingTeam = (match?.innings?.[0]?.battingTeam || "")
      .trim()
      .toLowerCase();
    const inn1WasTeamA = inn1BattingTeam ? inn1BattingTeam === teamAName : true;
    const isTeamABattingNow = activeIndex === 0 ? inn1WasTeamA : !inn1WasTeamA;

    // --- RECOVERY LOGIC ---
    let squadA = match?.teamASquad || match?.meta?.teamASquad || [];
    let squadB = match?.teamBSquad || match?.meta?.teamBSquad || [];

    if (squadB.length === 0 && match?.innings?.[0]) {
      const inn1 = match.innings[0];
      const suspectedTeamBPlayers = !inn1WasTeamA
        ? Object.keys(inn1.batsmenStats || {})
        : Object.keys(inn1.bowlerStats || {});

      squadB = suspectedTeamBPlayers.map((name) => ({ name }));
    }

    return {
      currentBattingSquad: isTeamABattingNow ? squadA : squadB,
      currentBowlingSquad: isTeamABattingNow ? squadB : squadA,
    };
  }, [match, activeIndex]);

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

  // Include the manual force override
  const isInningsComplete =
    forceInningsComplete || isAllOut || isOversDone || isTargetChased;
  const isMatchOver = isInningsComplete && isInning2;

  const isStartOfInnings = m.over === 0 && m.overBallCount === 0;
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
    (runsVal) => {
      if (isSyncing) return;
      if (runsVal === 6) triggerFeedback("six");
      else if (runsVal === 4) triggerFeedback("four");
      else triggerFeedback("click");

      //setIsSyncing(true);
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
        onBall(code, extraData, runsRan);
        setExtraType(null);
        setLocalOverlayDismissed(false);
      } catch (e) {
        console.error("Ball Sync Error:", e);
        alert("Error saving ball.");
      } finally {
        setIsSyncing(false);
      }
    },
    [extraType, onBall, isSyncing, triggerFeedback],
  );

  // --- 🔴 TOSS SCREEN FIX ---
  if (match && !match.meta?.toss?.winner) {
    return (
      <div
        className={`flex flex-col h-full overflow-hidden ${theme.bg} ${theme.text} p-4`}
      >
        <div
          className={`border p-8 rounded-3xl text-center max-w-md w-full shadow-2xl mx-auto my-auto ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"}`}
        >
          <h3 className={`text-xl font-bold mb-8 uppercase ${theme.text}`}>
            Start Match
          </h3>
          <div className="space-y-6">
            <select
              className={`w-full border p-4 rounded-xl font-bold outline-none ${lightMode ? "bg-gray-100 border-gray-200" : "bg-slate-900 border-slate-700"}`}
              value={tossWinner}
              onChange={(e) => setTossWinner(e.target.value)}
            >
              <option value="">-- Select Toss Winner --</option>
              <option value={match?.meta?.teamA}>{match?.meta?.teamA}</option>
              <option value={match?.meta?.teamB}>{match?.meta?.teamB}</option>
            </select>
            <div className="flex gap-2">
              {["Bat", "Bowl"].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    triggerFeedback("click");
                    setTossDecision(c);
                  }}
                  className={`flex-1 py-4 rounded-xl font-bold transition-all ${tossDecision === c ? "bg-teal-600 text-white shadow-lg" : theme.btnBase}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!tossWinner) return;
                setStartLoading(true);

                try {
                  const tId = match.tournamentId || match.meta.tournament;
                  const isABat =
                    (tossWinner === match.meta.teamA &&
                      tossDecision === "Bat") ||
                    (tossWinner === match.meta.teamB &&
                      tossDecision === "Bowl");

                  // 🟢 1. FETCH FULL ROSTERS FROM TOURNAMENT TEAMS
                  let rosterA = [];
                  let rosterB = [];

                  // 🔥 THE BOUNCER: Removes heavy images before they enter the match
                  const stripImages = (squad) => {
                    if (!Array.isArray(squad)) return [];
                    return squad.map((player) => {
                      const cleanPlayer = { ...player };
                      delete cleanPlayer.photoURL; // Nuke the photo
                      delete cleanPlayer.image; // Nuke the image field just in case
                      return cleanPlayer;
                    });
                  };

                  if (match.meta.teamAId && match.meta.teamBId) {
                    const teamASnap = await getDoc(
                      doc(db, "tournaments", tId, "teams", match.meta.teamAId),
                    );
                    const teamBSnap = await getDoc(
                      doc(db, "tournaments", tId, "teams", match.meta.teamBId),
                    );

                    const rawRosterA = teamASnap.exists()
                      ? teamASnap.data().roster ||
                        teamASnap.data().players ||
                        []
                      : [];
                    const rawRosterB = teamBSnap.exists()
                      ? teamBSnap.data().roster ||
                        teamBSnap.data().players ||
                        []
                      : [];

                    // 🟢 Pass the raw rosters through the bouncer
                    rosterA = stripImages(rawRosterA);
                    rosterB = stripImages(rawRosterB);
                  }

                  // 🟢 2. SAVE SECURELY TO THE MATCH DOCUMENT
                  await updateDoc(
                    doc(db, "tournaments", tId, "matches", match.id),
                    {
                      "meta.toss": {
                        winner: tossWinner,
                        decision: tossDecision,
                      },
                      status: "ongoing",
                      teamASquad: rosterA, // Clean, lightweight array
                      teamBSquad: rosterB, // Clean, lightweight array
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
                } catch (error) {
                  console.error("Error starting match:", error);
                  alert("Failed to start match. Please try again.");
                } finally {
                  setStartLoading(false);
                }
              }}
              disabled={!tossWinner || startLoading}
              className="w-full py-4 bg-teal-700 text-white font-bold rounded-xl shadow-xl active:scale-95 transition-all"
            >
              {startLoading ? "Syncing Rosters..." : "Start Match 🚀"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  // 🟢 Fixed: Added lightMode logic to make the overlay softer in Light Mode
  const modalContainerClass = `absolute inset-0 z-[100] flex flex-col justify-end p-4 pb-10 animate-in slide-in-from-bottom transition-colors ${
    lightMode
      ? "bg-slate-900/40 backdrop-blur-sm"
      : "bg-black/90 backdrop-blur-sm"
  }`;

  // ✅ Correctly Themed
  const modalContentClass = `${theme.card} border ${
    lightMode ? "border-gray-200" : "border-white/10"
  } p-6 rounded-3xl shadow-2xl transition-colors`;

  // ✅ Correctly Themed
  const modalInputClass = `w-full p-4 rounded-xl font-bold mb-4 outline-none border transition-all ${
    lightMode
      ? "bg-gray-50 text-gray-900 border-gray-300 focus:border-teal-500 focus:bg-white"
      : "bg-slate-900 text-white border-slate-700 focus:border-teal-500"
  }`;

  // ✅ Correctly Themed
  const modalLabelClass = `text-xs font-bold uppercase mb-2 block ${
    lightMode ? "text-gray-500" : "text-slate-400"
  }`;

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${theme.bg} ${theme.text} transition-colors duration-300 font-sans`}
    >
      {/* SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
        {/* HERO CARD */}
        <div className="py-4 px-4">
          <div
            className={`rounded-2xl p-3 ${theme.card} relative overflow-hidden shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"}`}
          >
            <div className="flex justify-between items-end">
              <div>
                <div
                  className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}
                >
                  {m.battingTeam}
                </div>
                <div
                  className={`text-6xl font-black leading-none mt-1 tracking-tighter ${theme.text}`}
                >
                  {m.score || 0}
                  <span className={`text-3xl ${theme.sub}`}>
                    /{m.wickets || 0}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}
                >
                  Overs
                </div>
                <div className="text-3xl font-mono font-bold">
                  {m.over || 0}.{m.overBallCount || 0}{" "}
                  <span className="text-lg opacity-50">/ {maxOvers}</span>
                </div>
                <div
                  className={`text-[10px] font-bold uppercase mt-1 ${theme.sub}`}
                >
                  CRR: {matchContext.crr1}
                </div>
              </div>
            </div>
            {isInning2 && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-500/20 text-center">
                <span
                  className={`text-xs font-bold uppercase ${lightMode ? "text-teal-700" : "text-teal-400"}`}
                >
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
            onClick={(e) => {
              if (editStriker || inlineAddingRole) return;
              triggerFeedback("click");
              onStrikeChange && onStrikeChange(nonStrikerName, strikerName);
            }}
            className={`p-3 rounded-xl border-l-4 border-l-green-500 ${theme.card} shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"} relative`}
          >
            <div className="flex justify-between mb-1">
              <span className="bg-green-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded">
                STR
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFeedback("click");
                  setEditStriker(true);
                }}
                className="opacity-50 p-1"
              >
                <Menu size={15} />
              </button>
            </div>

            {inlineAddingRole === "striker" ? (
              // 🔥 INLINE QUICK ADD UI
              <div onClick={(e) => e.stopPropagation()} className="mt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="New Striker"
                  className={`w-full text-xs p-1 rounded mb-1 border ${lightMode ? "bg-white border-gray-300" : "bg-black/40 border-white/20"}`}
                  value={inlineNewName}
                  onChange={(e) => setInlineNewName(e.target.value)}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setInlineAddingRole(null);
                      setInlineNewName("");
                      setEditStriker(false);
                    }}
                    className="text-[9px] bg-red-500/20 text-red-500 px-2 py-1 rounded w-full"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!inlineNewName.trim()) return;
                      triggerFeedback("click");
                      setIsSyncing(true);
                      try {
                        let batTeamStr = match.innings[activeIndex].battingTeam;
                        if (
                          !batTeamStr &&
                          activeIndex === 1 &&
                          match?.innings?.[0]
                        )
                          batTeamStr = match.innings[0].bowlingTeam;
                        const isTeamABatting =
                          batTeamStr?.trim() === match?.meta?.teamA?.trim();
                        const teamId = isTeamABatting
                          ? match.meta.teamAId
                          : match.meta.teamBId;

                        const newP = await quickAddPlayer(
                          match.tournamentId || match.meta.tournament,
                          match.id,
                          teamId,
                          isTeamABatting ? "A" : "B",
                          inlineNewName,
                        );
                        onStrikeChange(newP.name, nonStrikerName);
                        setInlineAddingRole(null);
                        setInlineNewName("");
                        setEditStriker(false);
                      } catch (e) {
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="text-[9px] bg-teal-500 text-white px-2 py-1 rounded w-full font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : !editStriker ? (
              <div className="font-bold truncate text-lg">
                {strikerName || "Select"}
              </div>
            ) : (
              <select
                onClick={(e) => e.stopPropagation()}
                className={`w-full text-xs p-1 rounded ${lightMode ? "bg-gray-100" : "bg-black/20"}`}
                value={strikerName}
                onChange={(e) => {
                  e.stopPropagation();
                  triggerFeedback("click");
                  if (e.target.value === "ADD_NEW") {
                    setInlineAddingRole("striker");
                  } else {
                    onStrikeChange(e.target.value, nonStrikerName);
                    setEditStriker(false);
                  }
                }}
              >
                <option>Select</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="ADD_NEW" className="font-bold text-teal-500">
                  + Add New Player
                </option>
              </select>
            )}
            {!inlineAddingRole && (
              <div className={`text-xs ${theme.sub}`}>
                {m.batsmenStats?.[strikerName]?.runs || 0} (
                {m.batsmenStats?.[strikerName]?.balls || 0})
              </div>
            )}
          </div>

          {/* Non Striker */}
          <div
            className={`p-3 rounded-xl border-l-4 border-transparent ${theme.card} shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"}`}
          >
            <div className="flex justify-between mb-1">
              <span className={`text-[9px] font-bold ${theme.sub}`}>
                NON-STR
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFeedback("click");
                  setEditNonStriker(true);
                }}
                className="opacity-50 p-1"
              >
                <Menu size={15} />
              </button>
            </div>

            {inlineAddingRole === "nonStriker" ? (
              <div onClick={(e) => e.stopPropagation()} className="mt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="New Non-Striker"
                  className={`w-full text-xs p-1 rounded mb-1 border ${lightMode ? "bg-white border-gray-300" : "bg-black/40 border-white/20"}`}
                  value={inlineNewName}
                  onChange={(e) => setInlineNewName(e.target.value)}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      triggerFeedback("click");
                      setInlineAddingRole(null);
                      setInlineNewName("");
                      setEditNonStriker(false);
                    }}
                    className="text-[9px] bg-red-500/20 text-red-500 px-2 py-1 rounded w-full"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!inlineNewName.trim()) return;
                      setIsSyncing(true);
                      try {
                        let batTeamStr = match.innings[activeIndex].battingTeam;
                        if (
                          !batTeamStr &&
                          activeIndex === 1 &&
                          match?.innings?.[0]
                        )
                          batTeamStr = match.innings[0].bowlingTeam;
                        const isTeamABatting =
                          batTeamStr?.trim() === match?.meta?.teamA?.trim();
                        const teamId = isTeamABatting
                          ? match.meta.teamAId
                          : match.meta.teamBId;

                        const newP = await quickAddPlayer(
                          match.tournamentId || match.meta.tournament,
                          match.id,
                          teamId,
                          isTeamABatting ? "A" : "B",
                          inlineNewName,
                        );
                        onStrikeChange(strikerName, newP.name);
                        setInlineAddingRole(null);
                        setInlineNewName("");
                        setEditNonStriker(false);
                      } catch (e) {
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="text-[9px] bg-teal-500 text-white px-2 py-1 rounded w-full font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : !editNonStriker ? (
              <div className="font-bold truncate text-lg">
                {nonStrikerName || "Select"}
              </div>
            ) : (
              <select
                onClick={(e) => e.stopPropagation()}
                className={`w-full text-xs p-1 rounded ${lightMode ? "bg-gray-100" : "bg-black/20"}`}
                value={nonStrikerName}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.value === "ADD_NEW")
                    setInlineAddingRole("nonStriker");
                  else {
                    onStrikeChange(strikerName, e.target.value);
                    setEditNonStriker(false);
                  }
                }}
              >
                <option>Select</option>
                {battingOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="ADD_NEW" className="font-bold text-teal-500">
                  + Add New Player
                </option>
              </select>
            )}
            {!inlineAddingRole && (
              <div className={`text-xs ${theme.sub}`}>
                {m.batsmenStats?.[nonStrikerName]?.runs || 0} (
                {m.batsmenStats?.[nonStrikerName]?.balls || 0})
              </div>
            )}
          </div>

          {/* Bowler */}
          <div
            className={`col-span-2 md:col-span-1 p-3 rounded-xl border-l-4 border-l-blue-500 ${theme.card} shadow-sm border ${lightMode ? "border-gray-200" : "border-white/5"}`}
          >
            <div className="flex justify-between mb-1">
              <span className={`text-[9px] font-black uppercase ${theme.sub}`}>
                BOWLER
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditBowler(true);
                }}
                className="opacity-50 p-1"
              >
                <Menu size={15} />
              </button>
            </div>

            {inlineAddingRole === "bowler" ? (
              <div onClick={(e) => e.stopPropagation()} className="mt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="New Bowler"
                  className={`w-full text-xs p-1 rounded mb-1 border ${lightMode ? "bg-white border-gray-300" : "bg-black/40 border-white/20"}`}
                  value={inlineNewName}
                  onChange={(e) => setInlineNewName(e.target.value)}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setInlineAddingRole(null);
                      setInlineNewName("");
                      setEditBowler(false);
                    }}
                    className="text-[9px] bg-red-500/20 text-red-500 px-2 py-1 rounded w-full"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!inlineNewName.trim()) return;
                      setIsSyncing(true);
                      try {
                        let batTeamStr = match.innings[activeIndex].battingTeam;
                        if (
                          !batTeamStr &&
                          activeIndex === 1 &&
                          match?.innings?.[0]
                        )
                          batTeamStr = match.innings[0].bowlingTeam;
                        const isTeamABatting =
                          batTeamStr?.trim() === match?.meta?.teamA?.trim();
                        // BOWLER logic is opposite
                        const teamId = isTeamABatting
                          ? match.meta.teamBId
                          : match.meta.teamAId;

                        const newP = await quickAddPlayer(
                          match.tournamentId || match.meta.tournament,
                          match.id,
                          teamId,
                          isTeamABatting ? "B" : "A",
                          inlineNewName,
                        );
                        onChangeBowler(newP.name);
                        setInlineAddingRole(null);
                        setInlineNewName("");
                        setEditBowler(false);
                      } catch (e) {
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="text-[9px] bg-teal-500 text-white px-2 py-1 rounded w-full font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : !editBowler ? (
              <div className="font-bold truncate text-lg">
                {currentBowlerName || "Select"}
              </div>
            ) : (
              <select
                onClick={(e) => e.stopPropagation()}
                className={`w-full text-xs p-1 rounded ${lightMode ? "bg-gray-100" : "bg-black/20"}`}
                value={currentBowlerName}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.value === "ADD_NEW")
                    setInlineAddingRole("bowler");
                  else {
                    onChangeBowler(e.target.value);
                    setEditBowler(false);
                  }
                }}
              >
                <option>Select</option>
                {fieldingTeamPlayers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="ADD_NEW" className="font-bold text-teal-500">
                  + Add New Player
                </option>
              </select>
            )}
            {!inlineAddingRole && (
              <div className={`text-xs ${theme.sub}`}>
                {m.bowlerStats?.[currentBowlerName]?.wickets || 0}-
                {m.bowlerStats?.[currentBowlerName]?.runs || 0}
              </div>
            )}
          </div>
        </div>

        {/* TIMELINE */}
        <div
          className={`h-12 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar border-t ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"} shrink-0 mb-auto`}
        >
          <span
            className={`text-[10px] font-bold uppercase ${theme.sub} shrink-0`}
          >
            Last 12:
          </span>
          {(m.timeline || [])
            .slice(-12)
            .reverse()
            .map((b, i) => {
              // 🟢 NEW SMART LABEL LOGIC
              let label = b.runs;
              let bubble = lightMode
                ? "bg-white border-gray-300 text-black"
                : "bg-slate-700 text-white border-slate-600";

              if (b.isWicket) {
                // If it's a wicket, check if it also has extras
                if (b.isNoBall) {
                  label = `W+${b.runs}NB`; // Displays W+1NB, W+2NB, etc.
                } else if (b.isWide) {
                  label = `W+${b.runs}WD`;
                } else {
                  // Standard wicket
                  label = b.physicalRuns > 0 ? `W+${b.physicalRuns}` : "W";
                }
                bubble = "bg-red-500 text-white border-red-600";
              } else if (b.isWide) {
                label = b.runs - 1 + "+WD";
                bubble = "bg-orange-500 text-white border-orange-600";
              } else if (b.isNoBall) {
                label = b.runs - 1 + "+NB";
                bubble = "bg-orange-500 text-white border-orange-600";
              } else if (b.runs === 4) {
                bubble = "bg-blue-500 text-white border-blue-600";
              } else if (b.runs === 6) {
                bubble = "bg-yellow-500 text-black border-yellow-600";
              }

              return (
                <div
                  key={i}
                  className={`w-12 h-9 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${bubble} shadow-sm border px-1`}
                >
                  {label}
                </div>
              );
            })}
        </div>

        {/* KEYPAD */}
        <div
          className={`rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] pb-8 pt-4 z-20 ${theme.card} border-t ${lightMode ? "border-gray-200" : "border-white/5"} shrink-0`}
        >
          <div className="px-6 mb-4 flex justify-between items-center">
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${extraType ? theme.accent : theme.sub}`}
            >
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
                onClick={() => {
                  triggerFeedback("click");
                  setExtraType(extraType === type ? null : type);
                }}
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
                onClick={() => {
                  triggerFeedback("click");
                  handleSubmitBall(run);
                }}
                disabled={disableBallEntry}
                loading={isSyncing}
                color={`${theme.btnBase} ${run === 4 ? "text-blue-500" : ""} ${run === 6 ? "text-yellow-500" : ""}`}
              />
            ))}
            <KeyButton
              val="OUT"
              onClick={() => {
                triggerFeedback("click");
                // setExtraType(null);
                setIsWicketMenuOpen(true);
              }}
              disabled={disableBallEntry}
              color="col-span-2 bg-red-600 text-white"
            />
          </div>

          <div className="flex justify-between items-center px-6 mt-6 opacity-60">
            <button
              onClick={() => onUndo()}
              className="text-xs font-bold flex items-center gap-1 hover:opacity-100"
            >
              <RotateCcw size={14} /> UNDO
            </button>
            <button
              onClick={() => setShowCorrectionModal(true)}
              className="text-xs font-bold flex items-center gap-1 hover:opacity-100 transition-opacity"
            >
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
              className="text-xs font-bold flex items-center gap-1 text-orange-500 hover:opacity-100 uppercase"
            >
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
                className={`text-lg font-bold mb-4 ${lightMode ? "text-teal-700" : "text-teal-400"}`}
              >
                Select Opening Batsmen
              </h3>

              {!addingOpenerRole ? (
                <>
                  <p className={`text-xs mb-4 ${theme.sub}`}>
                    Innings Start • {m.battingTeam}
                  </p>

                  <label className={modalLabelClass}>Striker</label>
                  <select
                    className={modalInputClass}
                    value={openerStriker}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.value === "ADD_NEW")
                        setAddingOpenerRole("striker");
                      else setOpenerStriker(e.target.value);
                    }}
                  >
                    <option value="">Select Striker</option>
                    {battingOptions.map((n) => (
                      <option
                        key={n}
                        value={n}
                        disabled={n === openerNonStriker}
                      >
                        {n}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className={`font-black ${lightMode ? "text-teal-600" : "text-teal-400"}`}
                    >
                      + Add New Player
                    </option>
                  </select>

                  <label className={modalLabelClass}>Non-Striker</label>
                  <select
                    className={modalInputClass}
                    value={openerNonStriker}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.value === "ADD_NEW")
                        setAddingOpenerRole("nonStriker");
                      else setOpenerNonStriker(e.target.value);
                    }}
                  >
                    <option value="">Select Non-Striker</option>
                    {battingOptions.map((n) => (
                      <option key={n} value={n} disabled={n === openerStriker}>
                        {n}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className={`font-black ${lightMode ? "text-teal-600" : "text-teal-400"}`}
                    >
                      + Add New Player
                    </option>
                  </select>

                  <button
                    onClick={() => {
                      if (onSetOpeners)
                        onSetOpeners(openerStriker, openerNonStriker);
                      else if (onStrikeChange)
                        onStrikeChange(openerStriker, openerNonStriker);
                    }}
                    disabled={!openerStriker || !openerNonStriker}
                    className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl uppercase tracking-widest disabled:opacity-50"
                  >
                    Start Innings 🚀
                  </button>
                </>
              ) : (
                /* QUICK ADD UI FOR OPENERS */
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <label className={modalLabelClass}>
                    Enter New{" "}
                    {addingOpenerRole === "striker" ? "Striker" : "Non-Striker"}{" "}
                    Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Virat Kohli"
                    className={modalInputClass}
                    value={newOpenerName}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewOpenerName(e.target.value);
                    }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setAddingOpenerRole(null);
                        setNewOpenerName("");
                      }}
                      className={`flex-1 py-4 font-bold rounded-xl ${lightMode ? "bg-gray-200 text-gray-700" : "bg-slate-700 text-slate-300"}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!newOpenerName.trim()) return;
                        setIsSyncing(true);
                        try {
                          let batTeamStr =
                            match.innings[activeIndex].battingTeam;
                          if (
                            !batTeamStr &&
                            activeIndex === 1 &&
                            match?.innings?.[0]
                          ) {
                            batTeamStr = match.innings[0].bowlingTeam;
                          }

                          const isTeamABatting =
                            batTeamStr?.trim() === match?.meta?.teamA?.trim();

                          const teamId = isTeamABatting
                            ? match.meta.teamAId
                            : match.meta.teamBId;
                          const teamSide = isTeamABatting ? "A" : "B";
                          const tId =
                            match.tournamentId || match.meta.tournament;

                          const newPlayer = await quickAddPlayer(
                            tId,
                            match.id,
                            teamId,
                            teamSide,
                            newOpenerName,
                          );

                          if (addingOpenerRole === "striker")
                            setOpenerStriker(newPlayer.name);
                          else setOpenerNonStriker(newPlayer.name);

                          setAddingOpenerRole(null);
                          setNewOpenerName("");
                        } catch (err) {
                          alert("Failed to add opener.");
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      className="flex-1 py-4 bg-teal-600 text-white font-bold rounded-xl uppercase"
                    >
                      Add & Select
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. MATCH END / INNINGS BREAK */}
        {isInningsComplete && (
          <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div
              className={`max-w-sm w-full p-8 rounded-3xl text-center shadow-2xl ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"}`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-white/5 border-white/10"}`}
              >
                {isMatchOver ? (
                  <Trophy size={40} className="text-amber-500" />
                ) : (
                  <ArrowRightCircle size={40} className="text-teal-500" />
                )}
              </div>
              <h2
                className={`text-2xl font-black uppercase tracking-tight mb-2 ${theme.text}`}
              >
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
                  className="w-full py-4 bg-amber-600 text-white font-black uppercase rounded-xl"
                >
                  Confirm Result 🏆
                </button>
              ) : (
                <button
                  onClick={onEndInnings}
                  className="w-full py-4 bg-teal-600 text-white font-black uppercase rounded-xl"
                >
                  Start 2nd Innings 🏏
                </button>
              )}

              {/* 🔥 ESCAPE HATCH: Added Undo & Settings to the overlay! */}
              <div className="mt-6 flex justify-between items-center px-2 opacity-60">
                <button
                  onClick={() => onUndo()}
                  className={`text-xs font-bold flex items-center gap-1 hover:opacity-100 transition-opacity ${theme.text}`}
                >
                  <RotateCcw size={14} /> UNDO LAST BALL
                </button>
                <button
                  onClick={() => setShowCorrectionModal(true)}
                  className={`text-xs font-bold flex items-center gap-1 hover:opacity-100 transition-opacity ${theme.text}`}
                >
                  <Settings size={14} /> CONSOLE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. ✅ PLAYER SELECTOR (Feature #2: Quick Add) */}
        {showPlayerSelector && (
          <div className={modalContainerClass}>
            <div className={modalContentClass}>
              <h3 className={`text-lg font-bold mb-4 ${theme.text}`}>
                {needBatsman
                  ? `Select New ${!strikerName ? "Striker" : !nonStrikerName ? "Non-Striker" : "Batsman"}`
                  : "Select Next Bowler"}
              </h3>
              {!isAddingNew ? (
                <>
                  <select
                    className={modalInputClass}
                    value={incoming || newBowler}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.value === "ADD_NEW") {
                        setIsAddingNew(true);
                        setIncoming("");
                        setNewBowler("");
                      } else {
                        needBatsman
                          ? setIncoming(e.target.value)
                          : setNewBowler(e.target.value);
                      }
                    }}
                  >
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
                            }
                          >
                            {n} {m.batsmenStats?.[n]?.out ? "(Out)" : ""}
                          </option>
                        ))
                      : fieldingTeamPlayers.map((n) => (
                          <option
                            key={n}
                            value={n}
                            disabled={n === currentBowlerName}
                          >
                            {n}
                          </option>
                        ))}
                    <option
                      value="ADD_NEW"
                      className={`font-black ${lightMode ? "text-teal-600" : "text-teal-400"}`}
                    >
                      + Add New Player
                    </option>
                  </select>

                  {/* Buttons Container */}
                  <div className="flex flex-col gap-3">
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
                      className="w-full py-4 bg-teal-600 text-white font-bold rounded-xl uppercase tracking-widest active:scale-95 transition-transform"
                    >
                      Confirm {needBatsman ? "Batsman" : "Bowler"}
                    </button>

                    {/* 🔥 END INNINGS ESCAPE HATCH (Only show if we need a batsman) */}
                    {needBatsman && (
                      <button
                        onClick={() => setForceInningsComplete(true)}
                        className={`w-full py-3.5 border-2 border-red-500 text-red-500 font-bold rounded-xl uppercase tracking-widest active:scale-95 transition-all ${lightMode ? "bg-red-50 hover:bg-red-100" : "bg-red-500/10 hover:bg-red-500/20"}`}
                      >
                        All Out (End Innings)
                      </button>
                    )}
                  </div>
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
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewPlayerName(e.target.value);
                    }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewPlayerName("");
                      }}
                      className={`flex-1 py-4 font-bold rounded-xl ${lightMode ? "bg-gray-200 text-gray-700" : "bg-slate-700 text-slate-300"}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!newPlayerName.trim()) return;
                        setIsSyncing(true);
                        try {
                          const isBattingSide = needBatsman;

                          let batTeamStr =
                            match.innings[activeIndex].battingTeam;
                          if (
                            !batTeamStr &&
                            activeIndex === 1 &&
                            match?.innings?.[0]
                          ) {
                            batTeamStr = match.innings[0].bowlingTeam;
                          }

                          const isTeamABatting =
                            batTeamStr?.trim() === match?.meta?.teamA?.trim();

                          let teamId, teamSide;
                          if (isBattingSide) {
                            teamId = isTeamABatting
                              ? match.meta.teamAId
                              : match.meta.teamBId;
                            teamSide = isTeamABatting ? "A" : "B";
                          } else {
                            teamId = isTeamABatting
                              ? match.meta.teamBId
                              : match.meta.teamAId;
                            teamSide = isTeamABatting ? "B" : "A";
                          }

                          const tId =
                            match.tournamentId || match.meta.tournament;

                          const newPlayer = await quickAddPlayer(
                            tId,
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
                      className="flex-1 py-4 bg-teal-600 text-white font-bold rounded-xl uppercase"
                    >
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
              className={`w-full rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom ${theme.card}`}
            >
              <h3 className="text-xl font-bold mb-4 text-red-500">
                Confirm Wicket
              </h3>

              <select
                className={modalInputClass}
                value={wicketType}
                onChange={(e) => {
                  e.stopPropagation();
                  const newType = e.target.value;
                  setWicketType(newType);

                  if (newType !== "runout") {
                    setWhoOut("striker");
                  }
                }}
              >
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

              {/* 🔥 SHOW "WHO IS OUT" ONLY FOR RUNOUTS */}
              {wicketType === "runout" && (
                <div className="animate-in fade-in space-y-4 mb-4">
                  {/* 1. Runs Completed Row */}
                  <div>
                    <label className={modalLabelClass}>
                      Runs Completed Before Run Out?
                    </label>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3].map((r) => (
                        <button
                          key={r}
                          onClick={(e) => {
                            e.stopPropagation();
                            setWicketRuns(r);
                          }}
                          className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
                            wicketRuns === r
                              ? "bg-teal-600 text-white border-teal-500 shadow-md"
                              : lightMode
                                ? "bg-white text-teal-700 border-gray-200"
                                : "bg-black/20 text-teal-400 border-white/10"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Who is Out? */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWhoOut("striker");
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                        whoOut === "striker"
                          ? "bg-red-600 text-white border-red-500 shadow-lg"
                          : lightMode
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-white/5 text-slate-400 border-white/10"
                      }`}
                    >
                      Striker Out
                      <span className="block text-[10px] font-normal opacity-80 truncate px-2">
                        {strikerName}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWhoOut("nonStriker");
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                        whoOut === "nonStriker"
                          ? "bg-red-600 text-white border-red-500 shadow-lg"
                          : lightMode
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-white/5 text-slate-400 border-white/10"
                      }`}
                    >
                      Non-Striker Out
                      <span className="block text-[10px] font-normal opacity-80 truncate px-2">
                        {nonStrikerName}
                      </span>
                    </button>
                  </div>

                  {/* 3. NB LOCAL RULE TOGGLE (Only shows if extraType is NB) */}
                  {extraType === "NB" && (
                    <div
                      className={`p-3 rounded-xl border flex items-center gap-3 ${lightMode ? "bg-amber-50 border-amber-200" : "bg-amber-900/10 border-amber-500/20"}`}
                    >
                      <div className="relative flex items-center shrink-0">
                        <input
                          type="checkbox"
                          id="validBallCheck"
                          checked={countAsValidBall}
                          onChange={(e) =>
                            setCountAsValidBall(e.target.checked)
                          }
                          className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-amber-400 bg-white checked:bg-amber-500 checked:border-amber-500 transition-all"
                        />
                        <Check
                          size={14}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="validBallCheck"
                          className="text-xs font-black text-amber-700 cursor-pointer uppercase tracking-widest"
                        >
                          Count as Valid Ball?
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FIELDER SELECTION WITH QUICK ADD */}
              {["caught", "runout", "stumped"].includes(wicketType) &&
                (!isAddingNew ? (
                  <select
                    className={modalInputClass}
                    value={fielderName}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.value === "ADD_NEW") {
                        setIsAddingNew(true);
                        setNewPlayerName("");
                      } else {
                        setFielderName(e.target.value);
                      }
                    }}
                  >
                    <option value="">Select Fielder (Optional)</option>
                    {fieldingTeamPlayers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option
                      value="ADD_NEW"
                      className={`font-black ${lightMode ? "text-teal-600" : "text-teal-400"}`}
                    >
                      + Add New Player
                    </option>
                  </select>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 mb-4">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Enter Fielder Name"
                      className={modalInputClass}
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsAddingNew(false)}
                        className={`flex-1 py-3 font-bold rounded-xl ${lightMode ? "bg-gray-200 text-gray-700" : "bg-slate-700 text-slate-300"}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!newPlayerName.trim()) return;
                          setIsSyncing(true);
                          try {
                            let batTeamStr =
                              match.innings[activeIndex].battingTeam;
                            if (
                              !batTeamStr &&
                              activeIndex === 1 &&
                              match?.innings?.[0]
                            ) {
                              batTeamStr = match.innings[0].bowlingTeam;
                            }

                            const isTeamABatting =
                              batTeamStr?.trim() === match?.meta?.teamA?.trim();

                            const teamId = isTeamABatting
                              ? match.meta.teamBId
                              : match.meta.teamAId;
                            const teamSide = isTeamABatting ? "B" : "A";
                            const tId =
                              match.tournamentId || match.meta.tournament;

                            const newPlayer = await quickAddPlayer(
                              tId,
                              match.id,
                              teamId,
                              teamSide,
                              newPlayerName,
                            );

                            setFielderName(newPlayer.name);
                            setIsAddingNew(false);
                            setNewPlayerName("");
                          } catch (err) {
                            alert("Failed to add fielder.");
                          } finally {
                            setIsSyncing(false);
                          }
                        }}
                        className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl uppercase"
                      >
                        {isSyncing ? "Saving..." : "Save Fielder"}
                      </button>
                    </div>
                  </div>
                ))}

              {/* HIDE Confirm buttons while typing a new fielder's name to prevent accidental clicks */}
              {!isAddingNew && (
                <>
                  <button
                    disabled={isSyncing}
                    onClick={async () => {
                      triggerFeedback("wicket");
                      setIsSyncing(true);

                      try {
                        await onBall(
                          "W",
                          {
                            isWicket: true,
                            wicketType,
                            fielderName,
                            whoOut:
                              wicketType === "runout" && whoOut === "nonStriker"
                                ? nonStrikerName
                                : strikerName,
                            isWide: extraType === "WD",
                            isNoBall: extraType === "NB",
                            // 🟢 ADD THIS LINE:
                            isValidBall: countAsValidBall,
                          },
                          wicketRuns,
                        );
                      } catch (e) {
                        console.error("Wicket Sync Error:", e);
                      } finally {
                        setIsWicketMenuOpen(false);
                        setExtraType(null);
                        setFielderName("");
                        setWhoOut("striker");
                        setIsSyncing(false);
                        setWicketRuns(0); // 🟢 Add this
                        setCountAsValidBall(false); // 🟢 Add this
                        setEditStriker(false);
                        setEditNonStriker(false);
                      }
                    }}
                    className="w-full py-4 bg-red-600 text-white font-bold rounded-xl text-lg mb-3 shadow-lg active:scale-95 transition-transform flex items-center justify-center"
                  >
                    {isSyncing ? "SAVING WICKET..." : "CONFIRM OUT"}
                  </button>
                  <button
                    onClick={() => {
                      setIsWicketMenuOpen(false);
                      setIsAddingNew(false);
                      setFielderName("");
                      setWhoOut("striker");
                      setWicketRuns(0); // 🟢 Add this
                      setCountAsValidBall(false); // 🟢 Add this
                    }}
                    className="w-full py-4 font-bold opacity-50 active:opacity-100 transition-opacity"
                  >
                    Cancel
                  </button>
                </>
              )}
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
