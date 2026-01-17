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
      {loading ? (
        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
      ) : (
        val
      )}
    </button>
  )
);

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

  // -- Toss & Start States --
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("Bat");
  const [startLoading, setStartLoading] = useState(false);

  // -- Wicket & Extra States --
  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");
  const [extraType, setExtraType] = useState("none");

  // -- Input States --
  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const [editStriker, setEditStriker] = useState(false);
  const [editNonStriker, setEditNonStriker] = useState(false);
  const [editBowler, setEditBowler] = useState(false);

  const [localOverlayDismissed, setLocalOverlayDismissed] = useState(false);

  // Sync Lock
  const [isSyncing, setIsSyncing] = useState(false);

  // 🔊 AUDIO REFS (Using URLs)
  // Replace these URLs with your own local files (e.g. "/sounds/click.mp3")
  const clickSound = useRef(
    new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_8f7f6f3f4b.mp3")
  );
  const wicketSound = useRef(
    new Audio("https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3")
  );

  // Preload Audio
  useEffect(() => {
    clickSound.current.load();
    wicketSound.current.load();
  }, []);

  // 📳 FEEDBACK HELPER
  const triggerFeedback = (type = "click") => {
    // 1. HAPTIC
    if (navigator.vibrate) {
      navigator.vibrate(type === "wicket" ? [50, 30, 50] : 15);
    }
    // 2. AUDIO
    try {
      if (type === "wicket") {
        wicketSound.current.currentTime = 0;
        wicketSound.current.play().catch(() => {});
      } else {
        clickSound.current.currentTime = 0;
        clickSound.current.play().catch(() => {});
      }
    } catch (e) {
      // Ignore play errors
    }
  };

  // --- 1. DATA EXTRACTION ---
  const activeIndex = match?.currentInnings || 0;
  const m = useMemo(() => {
    if (!match || !match.innings) return {};
    const innArr = Array.isArray(match.innings)
      ? match.innings
      : Object.values(match.innings);
    return innArr[activeIndex] || {};
  }, [match, activeIndex]);

  // ↩️ SMART UNDO LABEL
  const undoLabel = useMemo(() => {
    if (!m.timeline || m.timeline.length === 0) return "Undo";
    const lastBall = m.timeline[m.timeline.length - 1];

    let text = "";
    if (lastBall.isWicket) text = "W";
    else if (lastBall.isWide) text = "WD";
    else if (lastBall.isNoBall) text = "NB";
    else text = lastBall.runs;

    return `Undo (${text})`;
  }, [m.timeline]);

  // RESET FLAGS
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
    []
  );

  const strikerName = getPlayerName(m.striker);
  const nonStrikerName = getPlayerName(m.nonStriker);
  const currentBowlerName = getPlayerName(m.currentBowler);

  // --- 2. SQUAD & STATS LOGIC ---
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

  const nextBatsmenList = useMemo(() => {
    return currentBattingSquad
      .map((p) => getPlayerName(p))
      .filter((name) => {
        if (m.batsmenStats?.[name]?.out) return false;
        if (name === strikerName || name === nonStrikerName) return false;
        return true;
      })
      .sort();
  }, [m, currentBattingSquad, strikerName, nonStrikerName, getPlayerName]);

  const battingOptions = useMemo(
    () => currentBattingSquad.map((p) => getPlayerName(p)).sort(),
    [currentBattingSquad, getPlayerName]
  );
  const fieldingTeamPlayers = useMemo(
    () => currentBowlingSquad.map((p) => getPlayerName(p)).sort(),
    [currentBowlingSquad, getPlayerName]
  );

  // --- 3. SCORING HANDLERS ---
  const handleBallClick = useCallback(
    async (val) => {
      if (isSyncing) return;
      triggerFeedback("click"); // 🔊
      setIsSyncing(true);
      setExtraType("none");
      await onBall(val);
    },
    [onBall, isSyncing]
  );

  const handleExtra = useCallback(
    async (physicalRuns) => {
      if (extraType === "none")
        return alert("Select Extra Type (WD/NB/BYE/LB) first");

      if (isSyncing) return;
      triggerFeedback("click"); // 🔊
      setIsSyncing(true);

      const runs = parseInt(physicalRuns, 10);
      await onExtraBallRuns(extraType, runs);
    },
    [extraType, onExtraBallRuns, isSyncing]
  );

  const liveCommentary = useMemo(() => {
    if (
      match?.meta?.toss?.winner &&
      m.over === 0 &&
      m.overBallCount === 0 &&
      (!m.timeline || m.timeline.length === 0)
    ) {
      return `📢 ${match.meta.toss.winner} won the toss and elected to ${match.meta.toss.decision} first.`;
    }
    if (m.awaitingNewBatsman)
      return "☝️ Wicket! Waiting for the new batsman to take guard...";
    if (m.awaitingNewBowler)
      return `🥎 Over complete. ${currentBowlerName} finishes. Change of ends...`;
    if (strikerName && currentBowlerName)
      return `🏏 ${strikerName} vs ${currentBowlerName}. ${nonStrikerName} at non-striker.`;
    return "⚡ System ready. Select players to begin.";
  }, [match?.meta, m, strikerName, nonStrikerName, currentBowlerName]);

  const hasSetup = strikerName && nonStrikerName && currentBowlerName;

  const disableBallEntry =
    isSyncing ||
    match?.status === "finished" ||
    m.completed ||
    m.awaitingNewBowler ||
    m.awaitingNewBatsman ||
    isWicketMenuOpen ||
    !hasSetup;

  // --- TOSS UI ---
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
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${
                tossDecision === "Bat"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800 text-slate-500"
              }`}>
              Bat 🏏
            </button>
            <button
              onClick={() => setTossDecision("Bowl")}
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${
                tossDecision === "Bowl"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800 text-slate-500"
              }`}>
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
                }
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

  const showPlayerSelector =
    (m.awaitingNewBatsman || m.awaitingNewBowler) && !localOverlayDismissed;

  return (
    <div className="flex flex-col h-full bg-[#0F1115] text-slate-300 overflow-hidden relative">
      {/* SECTION 1: BANNER */}
      <div className="flex-none bg-[#161920] border-b border-white/5 px-6 py-4 flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[10px] text-teal-600 font-bold uppercase tracking-widest leading-none mb-1">
            {m.battingTeam}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-100 tracking-tighter italic">
              {m.score || 0}/{m.wickets || 0}
            </span>
            <span className="text-base font-medium text-slate-500">
              ({m.over || 0}.{m.overBallCount || 0} /{" "}
              <span className="text-slate-400">{match?.meta?.overs || 0}</span>)
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">
            Innings RR
          </span>
          <div className="bg-slate-800/50 px-3 py-1 rounded-lg border border-white/5">
            <span className="text-lg font-bold text-slate-400">
              {m.over > 0 || m.overBallCount > 0
                ? (m.score / (m.over + m.overBallCount / 6)).toFixed(2)
                : "0.00"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: STATS BAR */}
      <div className="flex-none px-4 py-2 bg-[#12141a] flex justify-around border-b border-white/5 shadow-inner">
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black uppercase text-slate-500 mb-1">
            Extras
          </span>
          <span className="text-sm font-bold text-amber-600/80">
            {statsSummary.extras}
          </span>
        </div>
        <div className="h-6 w-px bg-white/5 self-center"></div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black uppercase text-slate-500 mb-1">
            Total 4s
          </span>
          <span className="text-sm font-bold text-emerald-600/80">
            {statsSummary.fours}
          </span>
        </div>
        <div className="h-6 w-px bg-white/5 self-center"></div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-black uppercase text-slate-500 mb-1">
            Total 6s
          </span>
          <span className="text-sm font-bold text-indigo-500/80">
            {statsSummary.sixes}
          </span>
        </div>
      </div>

      {/* SECTION 3: PLAYER CARDS */}
      <div className="flex-none p-3 grid grid-cols-2 gap-3">
        <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-4 relative flex flex-col justify-center gap-2">
          {/* STRIKER SLOT */}
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              {!strikerName || editStriker ? (
                <select
                  className="bg-slate-900 text-teal-500 text-[10px] w-full border border-slate-700 rounded p-1 outline-none"
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

          {/* NON-STRIKER SLOT */}
          <div className="flex justify-between items-center opacity-50">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              {!nonStrikerName || editNonStriker ? (
                <select
                  className="bg-slate-900 text-teal-500 text-[10px] w-full border border-slate-700 rounded p-1 outline-none"
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
          </div>
          <button
            onClick={() => onStrikeChange?.(nonStrikerName, strikerName)}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center border border-slate-600 shadow-lg active:scale-75 transition-transform">
            ⇄
          </button>
        </div>

        {/* BOWLER SLOT */}
        <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-4 flex flex-col justify-center text-center relative">
          <span className="text-[9px] text-slate-500 font-bold uppercase mb-1">
            Bowler
          </span>
          {!currentBowlerName || editBowler ? (
            <select
              className="bg-slate-900 text-teal-500 text-[10px] w-full border border-slate-700 rounded p-1 outline-none"
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

      {/* SECTION 4: NARRATIVE & TIMELINE */}
      <div className="flex-none px-4 space-y-2 mb-2">
        <div className="bg-slate-900/50 rounded-xl p-2 flex items-center gap-2 overflow-x-auto no-scrollbar border border-white/5 h-10 shadow-inner">
          {(m.timeline || []).slice(-10).map((b, i) => {
            const displayVal = b.code || (b.isWicket ? "W" : b.runs);
            return (
              <span
                key={i}
                className={`h-6 min-w-[32px] px-2 rounded flex items-center justify-center text-[10px] font-bold whitespace-nowrap ${
                  String(displayVal).includes("W") ||
                  String(displayVal).includes("Ret")
                    ? "bg-red-900/40 text-red-400"
                    : String(displayVal).includes("wd") ||
                      String(displayVal).includes("nb")
                    ? "bg-amber-900/40 text-amber-400"
                    : b.runs === 4
                    ? "bg-emerald-900/40 text-emerald-400"
                    : b.runs === 6
                    ? "bg-indigo-900/40 text-indigo-400"
                    : "bg-slate-800 text-slate-500"
                }`}>
                {displayVal}
              </span>
            );
          })}
        </div>
        <div className="bg-teal-900/10 border border-teal-900/20 rounded-xl p-3 min-h-[50px] flex items-center">
          <p className="text-[11px] font-medium text-teal-600 italic leading-snug animate-in fade-in slide-in-from-left duration-500">
            {liveCommentary}
          </p>
        </div>
      </div>

      {/* SECTION 5: KEYPAD */}
      <div className="flex-none bg-[#0F1115] grid grid-cols-4 gap-2 p-4 pt-0">
        {["0", "1", "2", "3"].map((v) => (
          <KeyButton
            key={v}
            val={v}
            onClick={() => handleBallClick(v)}
            disabled={disableBallEntry}
            loading={isSyncing}
          />
        ))}
        <KeyButton
          val="4"
          color="bg-emerald-900/20 border-emerald-800/30 text-emerald-600/90"
          onClick={() => handleBallClick("4")}
          disabled={disableBallEntry}
          loading={isSyncing}
        />
        <KeyButton
          val="6"
          color="bg-indigo-900/20 border-indigo-800/30 text-indigo-600/90"
          onClick={() => handleBallClick("6")}
          disabled={disableBallEntry}
          loading={isSyncing}
        />
        <KeyButton
          val="5"
          onClick={() => handleBallClick("5")}
          disabled={disableBallEntry}
          loading={isSyncing}
        />
        <KeyButton
          val="OUT"
          color="bg-red-900/20 border-red-800/30 text-red-600/90"
          onClick={() => setIsWicketMenuOpen(true)}
          disabled={disableBallEntry}
          loading={isSyncing}
        />

        <div className="col-span-1 row-span-2 bg-slate-800/20 rounded-xl border border-slate-800/50 flex flex-col overflow-hidden">
          {["wides", "noBalls", "byes", "legByes"].map((type) => (
            <button
              key={type}
              onClick={() => setExtraType(type)}
              disabled={isSyncing}
              className={`flex-1 text-[9px] font-bold uppercase transition-all ${
                extraType === type
                  ? "bg-amber-700/40 text-amber-200"
                  : "text-slate-600"
              }`}>
              {type === "noBalls"
                ? "NB"
                : type === "wides"
                ? "WD"
                : type === "byes"
                ? "BYE"
                : "LB"}
            </button>
          ))}
        </div>
        {["+0", "+1", "+2", "+3", "+4", "+6"].map((v) => (
          <KeyButton
            key={v}
            val={v}
            color="bg-amber-900/10 border-amber-800/20 text-amber-600/80"
            onClick={() => handleExtra(v.replace("+", ""))}
            disabled={disableBallEntry}
            loading={isSyncing}
          />
        ))}
        <button
          onClick={onUndo}
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
          onClick={() => onEndInnings()}
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

      {/* OVERLAYS & MODALS (Kept Same) */}
      {showPlayerSelector && (
        <div className="absolute inset-0 z-[100] bg-[#0F1115]/95 backdrop-blur-md flex flex-col justify-end p-6 pb-20 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#1C2128] border border-white/10 p-8 rounded-3xl shadow-2xl relative">
            <button
              onClick={onUndo}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase transition-colors">
              Wrong? Undo
            </button>
            <h3 className="text-lg font-bold text-slate-200 mb-6">
              {m.awaitingNewBatsman
                ? "Select New Batsman"
                : "Select Next Bowler"}
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
              {(m.awaitingNewBatsman
                ? nextBatsmenList
                : fieldingTeamPlayers
              ).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (m.awaitingNewBatsman && incoming) {
                  setLocalOverlayDismissed(true);
                  onNewBatsman(incoming);
                  setIncoming("");
                } else if (m.awaitingNewBowler && newBowler) {
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

      {isWicketMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0F1115]/90 backdrop-blur-md">
          <div className="relative w-full bg-[#1C2128] border-t border-white/10 rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <h3 className="text-lg font-bold text-red-500 uppercase mb-6">
              Dismissal{" "}
              {extraType !== "none" ? `on ${extraType.toUpperCase()}` : ""}
            </h3>
            <div className="space-y-4">
              <select
                value={wicketType}
                onChange={(e) => setWicketType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-300 p-4 rounded-xl outline-none">
                <option value="runout">Run Out</option>
                <option value="retiredhurt">Retired Hurt</option>
                <option value="retiredout">Retired Out</option>
                {(extraType === "none" || extraType === "wides") && (
                  <>
                    <option value="stumped">Stumped</option>
                    <option value="hitwicket">Hit Wicket</option>
                  </>
                )}
                {extraType === "none" && (
                  <>
                    <option value="bowled">Bowled</option>
                    <option value="caught">Caught</option>
                    <option value="lbw">LBW</option>
                  </>
                )}
              </select>
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
                    triggerFeedback("wicket"); // 🔊
                    setIsSyncing(true);
                    await onBall("W", {
                      isWicket: true,
                      wicketType,
                      fielderName,
                      whoOut:
                        whoOut === "striker" ? strikerName : nonStrikerName,
                      next: null,
                      isWide: extraType === "wides",
                      isNoBall: extraType === "noBalls",
                    });
                  }}
                  className="flex-[2] py-4 bg-red-900 text-white font-bold rounded-xl uppercase shadow-xl">
                  Confirm OUT
                </button>
              </div>
            </div>
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
