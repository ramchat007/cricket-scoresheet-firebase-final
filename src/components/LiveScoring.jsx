// src/components/LiveScoring.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { subscribeMatch } from "../utils/firestore";
import { useScoring } from "../hooks/useScoring";
import { useAuth } from "../hooks/useAuth";

// Components
import ScoreInput from "../components/ScoreInput.jsx";
import ScoreTable from "../components/ScoreTable.jsx";
import ScoreSummary from "../components/ScoreSummary.jsx";
import MatchCommentary from "../components/MatchCommentary.jsx";
import MatchInfo from "../components/MatchInfo.jsx";
import MatchCorrectionModal from "../components/MatchCorrectionModal.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";

// Icons & Theme
import {
  Radio,
  Copy,
  ExternalLink,
  Moon,
  Sun,
  ArrowLeft,
  X,
  Loader2,
  FileQuestion,
  Home,
  Layers,
  Sliders, // Added for Overlay Icon
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { syncPendingActions } from "../utils/offlineQueue";

// --- MEMOIZED NAV BUTTON ---
const NavBtn = React.memo(({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center h-14 rounded-2xl transition-all duration-200 active:scale-95 ${
      active
        ? "text-cyan-500 bg-cyan-500/10"
        : "text-gray-500 hover:text-gray-400"
    }`}>
    <span
      className={`text-xl transition-transform duration-300 ${active ? "scale-110" : "grayscale opacity-70"}`}>
      {icon}
    </span>
    <span
      className={`text-[10px] font-black uppercase mt-1 tracking-widest transition-all ${
        active ? "opacity-100" : "opacity-60"
      }`}>
      {label}
    </span>
    {active && (
      <div className="w-1 h-1 bg-cyan-500 rounded-full mt-1 shadow-[0_0_10px_#06b6d4]"></div>
    )}
  </button>
));

// --- HEAVY COMPONENT WRAPPERS ---
const MemoizedScoreTable = React.memo(
  ScoreTable,
  (prev, next) => prev.match?.lastUpdate === next.match?.lastUpdate,
);
const MemoizedScoreSummary = React.memo(
  ScoreSummary,
  (prev, next) => prev.match?.lastUpdate === next.match?.lastUpdate,
);
const MemoizedCommentary = React.memo(MatchCommentary, (prev, next) => {
  const prevLen =
    prev.match?.innings?.[prev.match.currentInnings]?.timeline?.length || 0;
  const nextLen =
    next.match?.innings?.[next.match.currentInnings]?.timeline?.length || 0;
  return prevLen === nextLen;
});

const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const asNumber = (v, fallback = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

const normalizeInnings = (raw = {}) => {
  const innings = asObj(raw);
  return {
    ...innings,
    battingTeam: innings.battingTeam || "",
    bowlingTeam: innings.bowlingTeam || "",
    striker: innings.striker || "",
    nonStriker: innings.nonStriker || "",
    currentBowler: innings.currentBowler || "",
    score: asNumber(innings.score),
    wickets: asNumber(innings.wickets),
    over: asNumber(innings.over),
    overBallCount: asNumber(innings.overBallCount),
    extras: asObj(innings.extras),
    batsmenStats: asObj(innings.batsmenStats),
    bowlerStats: asObj(innings.bowlerStats),
    timeline: Array.isArray(innings.timeline) ? innings.timeline : [],
    fallOfWickets: Array.isArray(innings.fallOfWickets)
      ? innings.fallOfWickets
      : [],
    completed: !!innings.completed,
  };
};

const normalizeMatchData = (raw, matchId) => {
  if (!raw || typeof raw !== "object") return null;

  const meta = asObj(raw.meta);
  const inningsRaw = Array.isArray(raw.innings) ? raw.innings : [];
  const innings = inningsRaw.map((inn) => normalizeInnings(inn));

  const normalizedInnings =
    innings.length > 0
      ? innings
      : [
          normalizeInnings({
            battingTeam: meta.teamA || "",
            bowlingTeam: meta.teamB || "",
          }),
        ];

  let currentInnings = asNumber(raw.currentInnings, 0);
  if (currentInnings < 0 || currentInnings >= normalizedInnings.length) {
    currentInnings = 0;
  }

  return {
    ...raw,
    id: raw.id || matchId,
    meta,
    innings: normalizedInnings,
    currentInnings,
    status: raw.status || meta.matchStatus || meta.status || "upcoming",
    undoStack: Array.isArray(raw.undoStack) ? raw.undoStack : [],
    lastUpdate: asNumber(raw.lastUpdate, Date.now()),
  };
};

const getLocalMatch = (tId, mId) => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(`dfl-fb-${tId || "default"}-${mId}`),
    );
    return normalizeMatchData(parsed, mId);
  } catch (e) {
    return null;
  }
};

export default function LiveScoring() {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme, lightMode } = useTheme();

  const [match, setMatch] = useState(() =>
    getLocalMatch(tournamentId, matchId),
  );

  const [isInit, setIsInit] = useState(true);

  const [activeTab, setActiveTab] = useState("summary");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [canScore, setCanScore] = useState(false);
  const [showObsPanel, setShowObsPanel] = useState(false);

  // --- 2. DATA PROCESSING ---
  const processedMatch = useMemo(() => {
    if (!match) return null;
    return normalizeMatchData(match, matchId);
  }, [match, matchId]);

  const isStreamLinked = useMemo(() => {
    const url =
      processedMatch?.meta?.liveStreamUrl || processedMatch?.meta?.liveStreamId;
    return !!url;
  }, [processedMatch?.meta?.liveStreamUrl, processedMatch?.meta?.liveStreamId]);

  // --- 3. HANDLERS ---
  const handleTabSummary = useCallback(() => setActiveTab("summary"), []);
  const handleTabCard = useCallback(() => setActiveTab("scorecard"), []);
  const handleTabLogs = useCallback(() => setActiveTab("commentary"), []);
  const handleTabInfo = useCallback(() => setActiveTab("info"), []);
  const handleCloseCorrection = useCallback(
    () => setShowCorrectionModal(false),
    [],
  );
  const handleHomeClick = useCallback(
    () => navigate(`/tournaments/${tournamentId}`),
    [navigate, tournamentId],
  );

  // ✅ UPDATED: USE GLOBAL ACTIVE URL
  // This URL automatically points to whichever match is currently "Live" in this tournament.
  const obsUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/overlay/${tournamentId}/active?clean=true`
      : "";

  const copyObsLink = () => {
    navigator.clipboard.writeText(obsUrl);
    alert(
      "✅ Global OBS Link Copied!\nThis link works for ALL matches in this tournament.",
    );
  };

  // --- 4. PERMISSIONS ---
  useEffect(() => {
    async function checkPermissions() {
      if (tournamentId === "generic") {
        setCanScore(!!user);
        return;
      }
      if (!user || !tournamentId) {
        setCanScore(false);
        return;
      }
      try {
        const tSnap = await getDoc(doc(db, "tournaments", tournamentId));
        if (tSnap.exists()) {
          const tData = tSnap.data();
          const isScorer =
            tData.ownerId === user.uid || tData.scorers?.includes(user.uid);
          setCanScore(isScorer);
        }
      } catch (err) {
        setCanScore(false);
      }
    }
    checkPermissions();
  }, [tournamentId, user]);

  // --- 5. DATA SUBSCRIPTION ---
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    const unsub = subscribeMatch(tournamentId, matchId, (data) => {
      if (data) {
        const normalized = normalizeMatchData(data, matchId);
        if (!normalized) {
          setMatch(null);
          setIsInit(false);
          return;
        }

        setMatch((prev) => {
          if (prev && prev.lastUpdate > normalized.lastUpdate) return prev;
          return normalized;
        });
        localStorage.setItem(
          `dfl-fb-${tournamentId}-${matchId}`,
          JSON.stringify(normalized),
        );
      } else {
        setMatch(null);
      }
      setIsInit(false);
    });

    return () => unsub && unsub();
  }, [tournamentId, matchId]);

  // --- 6. SCORING HOOK ---
  const scoring =
    useScoring({
      tournamentId,
      matchId,
      match: processedMatch,
      setMatch,
    }) || {};

  const {
    handleBall,
    handleExtraBallRuns,
    handleNewBatsman,
    handleConfirmBowler,
    handleChangeBowler,
    handleStrikeChange,
    handleUndo,
    handleEndInnings,
    handleFinishMatch,
    handleDeleteMatch,
    processQueuedAction,
  } = scoring;

  const handleSyncNow = useCallback(async () => {
    await syncPendingActions(processQueuedAction);
  }, [processQueuedAction]);

  useEffect(() => {
    const onOnline = () => {
      syncPendingActions(processQueuedAction);
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [processQueuedAction]);

  // --- 7. RENDERING STATES ---

  // A. Loading State
  if (isInit && !processedMatch) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[100dvh] ${theme.bg} ${theme.text}`}>
        <Loader2 size={40} className="text-cyan-500 animate-spin mb-4" />
        <div className="text-[10px] font-black tracking-[0.3em] uppercase opacity-50 animate-pulse">
          Synchronizing Arena...
        </div>
      </div>
    );
  }

  // B. Not Found State
  if (!isInit && !processedMatch) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[100dvh] p-6 text-center ${theme.bg} ${theme.text}`}>
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${lightMode ? "bg-gray-100 text-gray-400" : "bg-white/5 text-slate-600"}`}>
          <FileQuestion size={40} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight mb-2">
          Match Not Found
        </h2>
        <p className={`text-sm mb-8 max-w-xs ${theme.sub}`}>
          The match you are looking for does not exist or has been removed.
        </p>
        <button
          onClick={handleHomeClick}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95 ${
            lightMode
              ? "bg-black text-white hover:bg-gray-800"
              : "bg-white text-black hover:bg-gray-200"
          }`}>
          <Home size={16} /> Back to Tournament
        </button>
      </div>
    );
  }

  // C. Main Content
  const getMatchTitle = () => {
    if (processedMatch.meta?.teamAName && processedMatch.meta?.teamBName)
      return `${processedMatch.meta.teamAName} v ${processedMatch.meta.teamBName}`;
    return processedMatch.name || "Live Match";
  };

  return (
    <div
      className={`h-screen h-[100dvh] w-full font-sans flex flex-col overflow-hidden select-none touch-manipulation transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      <div className="flex-none">
        <OfflineBanner onSyncNow={handleSyncNow} />
      </div>
      {/* --- HEADER --- */}
      <div
        className={`flex-none px-4 h-14 flex items-center justify-between z-[60] border-b ${theme.card} backdrop-blur-xl`}>
        <button
          onClick={handleHomeClick}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-transform ${theme.btnBase}`}>
          <ArrowLeft size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <span
            className={`text-[10px] font-black uppercase tracking-tight truncate max-w-[200px] italic ${theme.text}`}>
            {getMatchTitle()}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${processedMatch.status === "finished" ? "bg-green-500" : "bg-red-500 animate-pulse"}`}></span>
            <span
              className={`text-[8px] font-black tracking-widest uppercase ${processedMatch.status === "finished" ? "text-green-500" : "text-red-500"}`}>
              {processedMatch.status || "Live"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Broadcast Toggle */}
          {canScore && (
            <button
              onClick={() => setShowObsPanel(!showObsPanel)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${
                showObsPanel
                  ? lightMode
                    ? "bg-purple-100 text-purple-600"
                    : "bg-purple-900/30 text-purple-400 border border-purple-500/30"
                  : theme.btnBase
              }`}>
              <Layers
                size={18}
                className={showObsPanel ? "animate-pulse" : ""}
              />
            </button>
          )}

          {/* Theme Toggle */}
          {/* <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${theme.btnBase}`}>
            {lightMode ? <Moon size={18} /> : <Sun size={18} />}
          </button> */}
        </div>
      </div>

      {/* --- 📡 BROADCAST TOOLS PANEL (Collapsible) --- */}
      {canScore && (
        <div
          className={`flex-none border-b relative transition-all duration-300 ease-in-out overflow-hidden ${
            theme.card
          } ${showObsPanel ? "h-auto py-3" : "h-0 py-0 border-0"}`}>
          <div className="px-4">
            <div className="flex justify-between items-center mb-2">
              <h3
                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.sub}`}>
                <span className="text-purple-500 text-sm">📡</span> Broadcast
                Overlay
              </h3>
              {isStreamLinked ? (
                <span className="text-[9px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase">
                  Stream Active
                </span>
              ) : (
                <span className="text-[9px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase">
                  No Input
                </span>
              )}
            </div>

            {/* 1. OBS Source Link (To paste into OBS) */}
            <div
              className={`border rounded-xl p-2 flex gap-2 items-center ${
                lightMode
                  ? "bg-gray-50 border-gray-200"
                  : "bg-black/20 border-white/5"
              }`}>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[8px] font-bold uppercase mb-1 flex items-center gap-1.5 ${theme.sub}`}>
                  <Layers size={10} className="text-purple-500" /> Global
                  Overlay Source
                </div>
                <div
                  className={`text-[10px] truncate font-mono select-all p-1.5 rounded border ${
                    lightMode
                      ? "bg-white border-gray-200 text-gray-600"
                      : "bg-black/50 border-white/5 text-slate-300"
                  }`}>
                  {obsUrl}
                </div>
              </div>
              <button
                onClick={copyObsLink}
                className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition-all active:scale-95 shadow-md"
                title="Copy Global URL">
                <Copy size={16} />
              </button>
              <a
                href={obsUrl}
                target="_blank"
                rel="noreferrer"
                className={`p-2 rounded-lg transition-all active:scale-95 border ${
                  lightMode
                    ? "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
                title="Test in New Tab">
                <ExternalLink size={16} />
              </a>
            </div>

            {/* 2. OVERLAY CONTROLLER BUTTON (To open your control dashboard) */}
            <div className="mt-3">
              <a
                // IMPORTANT: Adjust this href to match whatever route you set up in App.js for the controller
                href={`/broadcast-control/${tournamentId}/active`}
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  lightMode
                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
                    : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                }`}>
                <Sliders size={14} /> Open Overlay Controller
              </a>
            </div>

            <p className={`text-[9px] mt-3 text-center ${theme.sub}`}>
              <strong>Universal Link:</strong> Works for ALL matches. No need to
              update OBS between games.
            </p>
          </div>
        </div>
      )}

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        {canScore ? (
          // SCORING UI (Full Height)
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-20">
            <ScoreInput
              match={processedMatch}
              onBall={handleBall}
              onNewBatsman={handleNewBatsman}
              onChangeBowler={handleChangeBowler}
              onUndo={handleUndo}
              onEndInnings={handleEndInnings}
              onStrikeChange={handleStrikeChange}
              onExtraBallRuns={handleExtraBallRuns}
              onConfirmBowler={handleConfirmBowler}
              onFinishMatch={(winner) => {
                handleFinishMatch(winner);
                navigate(`/tournaments/${tournamentId}`);
              }}
              onDeleteMatch={() => {
                handleDeleteMatch();
                navigate(`/tournaments/${tournamentId}`);
              }}
            />
          </div>
        ) : (
          // VIEW ONLY UI
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-24">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <MemoizedScoreSummary match={processedMatch} />
            </div>
            <div className={`border rounded-[2rem] p-2 ${theme.card}`}>
              <MemoizedScoreTable match={processedMatch} />
            </div>
          </div>
        )}

        {/* TABS MODAL */}
        {activeTab !== "summary" && (
          <div
            className={`absolute inset-0 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 ${theme.bg}`}>
            <div
              className={`flex justify-between items-center p-4 border-b backdrop-blur-md ${theme.card}`}>
              <h3 className="text-cyan-500 font-black uppercase text-xs tracking-[0.3em]">
                {activeTab} View
              </h3>
              <button
                onClick={handleTabSummary}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs active:scale-90 transition-transform ${theme.btnBase}`}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
              {activeTab === "scorecard" && (
                <div className={`border rounded-[2rem] p-2 m-2 ${theme.card}`}>
                  <MemoizedScoreTable match={processedMatch} />
                </div>
              )}
              {activeTab === "commentary" && (
                <MemoizedCommentary match={processedMatch} />
              )}
              {activeTab === "info" && <MatchInfo match={processedMatch} />}
            </div>
          </div>
        )}
      </div>

      {/* NAV */}
      <nav
        className={`fixed bottom-0 left-0 w-full h-16 backdrop-blur-lg border-t grid grid-cols-4 items-center px-2 pb-1 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-[70] transition-colors duration-300 ${
          lightMode
            ? "bg-white/90 border-gray-200"
            : "bg-black/95 border-white/5"
        }`}>
        <NavBtn
          active={activeTab === "summary"}
          onClick={handleTabSummary}
          icon="🏏"
          label="Score"
        />
        <NavBtn
          active={activeTab === "scorecard"}
          onClick={handleTabCard}
          icon="📊"
          label="Card"
        />
        <NavBtn
          active={activeTab === "commentary"}
          onClick={handleTabLogs}
          icon="🎙️"
          label="Logs"
        />
        <NavBtn
          active={activeTab === "info"}
          onClick={handleTabInfo}
          icon="ℹ️"
          label="Info"
        />
      </nav>

      {showCorrectionModal && (
        <MatchCorrectionModal
          match={processedMatch}
          tournamentId={tournamentId}
          onClose={handleCloseCorrection}
        />
      )}
    </div>
  );
}
