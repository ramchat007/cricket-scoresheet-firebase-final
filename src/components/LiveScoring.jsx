// src/components/LiveScoring.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { subscribeMatch } from "../utils/firestore";
import { useScoring } from "../hooks/useScoring";
import { useAuth } from "../hooks/useAuth";

// 🟢 NEW: Imports for Supabase Realtime Subscription
import { getScoringAdapter } from "../services/scoringAdapters";
import { supabase } from "../utils/supabase";

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
import { Helmet } from "react-helmet-async";

// --- MEMOIZED NAV BUTTON ---
const NavBtn = React.memo(({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center h-14 rounded-2xl transition-all duration-200 active:scale-95 ${
      active
        ? "text-cyan-500 bg-cyan-500/10"
        : "text-gray-500 hover:text-gray-400"
    }`}
  >
    <span
      className={`text-xl transition-transform duration-300 ${active ? "scale-110" : "grayscale opacity-70"}`}
    >
      {icon}
    </span>
    <span
      className={`text-[10px] font-black uppercase mt-1 tracking-widest transition-all ${
        active ? "opacity-100" : "opacity-60"
      }`}
    >
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
  const [dbConnections, setDbConnections] = useState({
    firebase: false,
    supabase: false,
  });

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

  // --- 5. DATA SUBSCRIPTION (Dual Mirror) ---
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    // A. Listen to Firebase (Primary Data Source)
    const unsubFirebase = subscribeMatch(tournamentId, matchId, (data) => {
      if (data) {
        // 🟢 Light up the Firebase Badge
        setDbConnections((prev) => ({ ...prev, firebase: true }));

        const normalized = normalizeMatchData(data, matchId);
        if (!normalized) {
          setMatch(null);
          setIsInit(false);
          return;
        }

        setMatch((prev) => {
          if (prev && prev.lastUpdate > normalized.lastUpdate) return prev;
          localStorage.setItem(
            `dfl-fb-${tournamentId}-${matchId}`,
            JSON.stringify(normalized),
          );
          return normalized;
        });
      } else {
        setMatch(null);
      }
      setIsInit(false);
    });

    // B. Listen to Supabase Realtime (Fast Override)
    let unsubSupabase;
    const useSupabaseScoring =
      import.meta.env.VITE_USE_SUPABASE_SCORING === "true";

    // console.log("🛠️ Init Supabase Check:", {
    //   useSupabaseScoring,
    //   hasSupabaseClient: !!supabase,
    // });

    if (useSupabaseScoring && supabase) {
      const supabaseAdapter = getScoringAdapter({
        useSupabase: true,
        supabaseClient: supabase,
      });

      if (supabaseAdapter && supabaseAdapter.subscribeMatchLite) {
        // console.log("✅ Adapter ready. Calling subscribeMatchLite...");

        unsubSupabase = supabaseAdapter.subscribeMatchLite(
          tournamentId,
          matchId,
          (newState) => {
            // console.log("🟢 LiveScoring.jsx heard Supabase update!", newState);
            if (newState) {
              setDbConnections((prev) => ({ ...prev, supabase: true }));
              setMatch((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  ...newState,
                  _dataSource: "supabase",
                };
              });
            }
          },
        );
      } else {
        console.error("❌ Adapter is missing subscribeMatchLite!");
      }
    }

    return () => {
      if (unsubFirebase) unsubFirebase();
      if (unsubSupabase) unsubSupabase();
    };
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

  const handleEmergencyScrub = async () => {
    if (
      !window.confirm(
        "This will scrub all heavy images from the match to fix the 1MB limit. Continue?",
      )
    )
      return;

    try {
      // 1. Make a deep copy of the current match state
      const cleanMatch = JSON.parse(JSON.stringify(processedMatch));

      // 2. Nuke Team Logos
      if (cleanMatch.meta) {
        cleanMatch.meta.teamALogo = "";
        cleanMatch.meta.teamBLogo = "";
      }

      // 3. The Aggressive Player Photo Scrubber
      const scrubSquad = (squad) => {
        if (!Array.isArray(squad)) return [];
        return squad.map((p) => ({
          ...p,
          photoURL: "", // Nuke the photo
          image: "", // Nuke the image just in case
        }));
      };

      // 4. Scrub all possible squad locations
      cleanMatch.teamASquad = scrubSquad(cleanMatch.teamASquad);
      cleanMatch.teamBSquad = scrubSquad(cleanMatch.teamBSquad);
      if (cleanMatch.meta) {
        cleanMatch.meta.teamASquad = scrubSquad(cleanMatch.meta.teamASquad);
        cleanMatch.meta.teamBSquad = scrubSquad(cleanMatch.meta.teamBSquad);
      }

      // 5. Force the clean document back into Firestore
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        cleanMatch,
      );

      alert(
        "✅ Match successfully scrubbed and unblocked! You can score again.",
      );
    } catch (error) {
      console.error("Scrub failed:", error);
      alert("Failed to scrub match: " + error.message);
    }
  };

  // --- 7. RENDERING STATES ---

  // A. Loading State
  if (isInit && !processedMatch) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[100dvh] ${theme.bg} ${theme.text}`}
      >
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
        className={`flex flex-col items-center justify-center h-[100dvh] p-6 text-center ${theme.bg} ${theme.text}`}
      >
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${lightMode ? "bg-gray-100 text-gray-400" : "bg-white/5 text-slate-600"}`}
        >
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
          }`}
        >
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
    <>
      <Helmet>
        <title>Live Scoring | CricSync</title>
        <meta
          name="description"
          content="Experience real-time cricket scoring with CricSync's Live Scoring feature. Get instant updates on match events, player performances, and team statistics. Join the action today!"
        />
      </Helmet>
      // 🟢 1. OUTER WRAPPER: 'overflow-hidden' explicitly prevents double
      scrollbars!
      <div
        className={`w-full h-[calc(100dvh-70px)] overflow-hidden flex flex-col lg:flex-row justify-center lg:items-center lg:gap-6 lg:p-6 font-sans transition-colors duration-300 ${theme.bg} ${theme.text}`}
      >
        {/* 🟢 2. LEFT PANEL (The Mobile App Frame) */}
        <div
          className={`w-full h-full max-w-[480px] lg:max-w-[420px] flex flex-col relative overflow-hidden select-none touch-manipulation transition-colors duration-300
          sm:h-[calc(100%-2rem)] sm:my-auto sm:rounded-[2.5rem] sm:border sm:shadow-2xl
          lg:h-full lg:my-0 lg:rounded-[2rem]
          ${theme.bg} ${lightMode ? "border-gray-200" : "border-white/10"}`}
        >
          <div className="flex-none">
            <OfflineBanner onSyncNow={handleSyncNow} />
          </div>

          {/* --- HEADER --- */}
          <div
            className={`flex-none px-4 h-14 flex items-center justify-between z-[60] border-b ${theme.card} backdrop-blur-xl`}
          >
            <button
              onClick={handleHomeClick}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-transform ${theme.btnBase}`}
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex flex-col items-center text-center">
              <span
                className={`text-[10px] font-black uppercase tracking-tight truncate max-w-[200px] italic ${theme.text}`}
              >
                {getMatchTitle()}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${processedMatch.status === "finished" ? "bg-green-500" : "bg-red-500 animate-pulse"}`}
                ></span>
                <span
                  className={`text-[8px] font-black tracking-widest uppercase ${processedMatch.status === "finished" ? "text-green-500" : "text-red-500"}`}
                >
                  {processedMatch.status || "Live"}
                </span>

                {/* 🟢 NEW: DUAL DATABASE MONITORS */}
                <div className="flex gap-1 border-l pl-1.5 border-gray-500/30">
                  {/* Firebase Badge */}
                  <span
                    className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest border transition-colors ${
                      dbConnections.firebase
                        ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                    }`}
                  >
                    FB {dbConnections.firebase ? "ON" : "WAIT"}
                  </span>

                  {/* Supabase Badge */}
                  <span
                    className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest border transition-colors ${
                      dbConnections.supabase
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                    }`}
                  >
                    SB {dbConnections.supabase ? "ON" : "WAIT"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canScore && (
                <button
                  onClick={() => setShowObsPanel(!showObsPanel)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${
                    showObsPanel
                      ? lightMode
                        ? "bg-purple-100 text-purple-600"
                        : "bg-purple-900/30 text-purple-400 border border-purple-500/30"
                      : theme.btnBase
                  }`}
                >
                  <Layers
                    size={18}
                    className={showObsPanel ? "animate-pulse" : ""}
                  />
                </button>
              )}
            </div>
          </div>

          {/* --- 📡 BROADCAST TOOLS PANEL (Collapsible) --- */}
          {canScore && (
            <div
              className={`flex-none border-b relative transition-all duration-300 ease-in-out overflow-hidden ${
                theme.card
              } ${showObsPanel ? "h-auto py-3" : "h-0 py-0 border-0"}`}
            >
              <div className="px-4">
                <div className="flex justify-between items-center mb-2">
                  <h3
                    className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.sub}`}
                  >
                    <span className="text-purple-500 text-sm">📡</span>{" "}
                    Broadcast Overlay
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

                <div
                  className={`border rounded-xl p-2 flex gap-2 items-center ${
                    lightMode
                      ? "bg-gray-50 border-gray-200"
                      : "bg-black/20 border-white/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[8px] font-bold uppercase mb-1 flex items-center gap-1.5 ${theme.sub}`}
                    >
                      <Layers size={10} className="text-purple-500" /> Global
                      Overlay Source
                    </div>
                    <div
                      className={`text-[10px] truncate font-mono select-all p-1.5 rounded border ${
                        lightMode
                          ? "bg-white border-gray-200 text-gray-600"
                          : "bg-black/50 border-white/5 text-slate-300"
                      }`}
                    >
                      {obsUrl}
                    </div>
                  </div>
                  <button
                    onClick={copyObsLink}
                    className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition-all active:scale-95 shadow-md"
                    title="Copy Global URL"
                  >
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
                    title="Test in New Tab"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                <div className="mt-3">
                  <a
                    href={`/broadcast-control/${tournamentId}/active`}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      lightMode
                        ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
                        : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                    }`}
                  >
                    <Sliders size={14} /> Open Overlay Controller
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* --- CONTENT AREA --- */}
          <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden bg-transparent">
            {canScore ? (
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-[76px] lg:pb-4">
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
              <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-[76px] lg:pb-4">
                <MemoizedScoreSummary match={processedMatch} />
                <div className={`border rounded-[2rem] p-2 ${theme.card}`}>
                  <MemoizedScoreTable match={processedMatch} />
                </div>
              </div>
            )}

            {/* MOBILE/TABLET TABS MODAL */}
            {activeTab !== "summary" && (
              <div
                className={`lg:hidden absolute inset-0 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 ${theme.bg}`}
              >
                <div
                  className={`flex justify-between items-center p-4 border-b backdrop-blur-md ${theme.card}`}
                >
                  <h3 className="text-cyan-500 font-black uppercase text-xs tracking-[0.3em]">
                    {activeTab} View
                  </h3>
                  <button
                    onClick={handleTabSummary}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs active:scale-90 transition-transform ${theme.btnBase}`}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar pb-[76px]">
                  {activeTab === "scorecard" && (
                    <div
                      className={`border rounded-[2rem] p-2 m-2 ${theme.card}`}
                    >
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

          {/* 🟢 MOBILE BOTTOM NAV */}
          <nav
            className={`lg:hidden absolute bottom-0 left-0 w-full h-[68px] backdrop-blur-lg border-t grid grid-cols-4 items-center px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-[70] transition-colors duration-300 ${
              lightMode
                ? "bg-white/90 border-gray-200"
                : "bg-black/95 border-white/5"
            }`}
          >
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
        </div>

        {/* 🟢 3. RIGHT PANEL (Desktop Side-by-Side View) */}
        <div
          className={`hidden lg:flex flex-col flex-1 h-full max-w-[800px] rounded-[2.5rem] border shadow-2xl overflow-hidden transition-colors duration-300 ${theme.card} ${
            lightMode
              ? "border-gray-200 bg-gray-50/50"
              : "border-white/10 bg-[#161920]"
          }`}
        >
          {/* Desktop Tabs Header */}
          <div
            className={`flex-none flex items-center gap-2 p-4 border-b ${lightMode ? "border-gray-200 bg-white" : "border-white/5 bg-[#1C2128]"}`}
          >
            <button
              onClick={() => setActiveTab("scorecard")}
              className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                activeTab === "scorecard" || activeTab === "summary"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : lightMode
                    ? "text-gray-500 hover:bg-gray-100"
                    : "text-slate-400 hover:bg-white/5"
              }`}
            >
              Scorecard
            </button>
            <button
              onClick={() => setActiveTab("commentary")}
              className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                activeTab === "commentary"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : lightMode
                    ? "text-gray-500 hover:bg-gray-100"
                    : "text-slate-400 hover:bg-white/5"
              }`}
            >
              Commentary
            </button>
            <button
              onClick={() => setActiveTab("info")}
              className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
                activeTab === "info"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : lightMode
                    ? "text-gray-500 hover:bg-gray-100"
                    : "text-slate-400 hover:bg-white/5"
              }`}
            >
              Match Info
            </button>
          </div>

          {/* Desktop Content Area */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {(activeTab === "scorecard" || activeTab === "summary") && (
              <div className="space-y-6 animate-in fade-in">
                <MemoizedScoreSummary match={processedMatch} />
                <div
                  className={`border rounded-[2rem] p-4 shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/5"}`}
                >
                  <MemoizedScoreTable match={processedMatch} />
                </div>
              </div>
            )}
            {activeTab === "commentary" && (
              <div
                className={`border rounded-[2rem] p-4 shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/5"} animate-in fade-in`}
              >
                <MemoizedCommentary match={processedMatch} />
              </div>
            )}
            {activeTab === "info" && (
              <div
                className={`border rounded-[2rem] p-4 shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/5"} animate-in fade-in`}
              >
                <MatchInfo match={processedMatch} />
              </div>
            )}
          </div>
        </div>

        {showCorrectionModal && (
          <MatchCorrectionModal
            match={processedMatch}
            tournamentId={tournamentId}
            onClose={handleCloseCorrection}
          />
        )}
      </div>
    </>
  );
}
