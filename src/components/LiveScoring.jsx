import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { subscribeMatch } from "../utils/firestore";
import { useScoring } from "../hooks/useScoring";
import { useAuth } from "../hooks/useAuth";

import ScoreInput from "./ScoreInput.jsx";
import ScoreTable from "./ScoreTable.jsx";
import ScoreSummary from "./ScoreSummary.jsx";
import MatchCommentary from "./MatchCommentary.jsx";
import MatchInfo from "./MatchInfo.jsx";
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";

// --- MEMOIZED NAV BUTTON ---
const NavBtn = React.memo(({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center h-14 rounded-2xl transition-all duration-200 active:scale-95 ${
      active ? "text-cyan-400 bg-cyan-500/5" : "text-gray-600"
    }`}>
    <span
      className={`text-xl transition-transform duration-300 ${
        active ? "scale-110" : "grayscale opacity-50"
      }`}>
      {icon}
    </span>
    <span
      className={`text-[10px] font-black uppercase mt-1 tracking-widest transition-all ${
        active ? "opacity-100" : "opacity-40"
      }`}>
      {label}
    </span>
    {active && (
      <div className="w-1 h-1 bg-cyan-500 rounded-full mt-1 shadow-[0_0_10px_#06b6d4]"></div>
    )}
  </button>
));

// --- HEAVY COMPONENT WRAPPERS (Prevent Re-renders) ---
// Only re-render ScoreTable if the innings ID or total score changes significantly
const MemoizedScoreTable = React.memo(ScoreTable, (prev, next) => {
  return prev.match?.lastUpdate === next.match?.lastUpdate;
});

const MemoizedScoreSummary = React.memo(ScoreSummary, (prev, next) => {
  return prev.match?.lastUpdate === next.match?.lastUpdate;
});

const MemoizedCommentary = React.memo(MatchCommentary, (prev, next) => {
  // Commentary only needs to update if the timeline length changes
  const prevLen =
    prev.match?.innings?.[prev.match.currentInnings]?.timeline?.length || 0;
  const nextLen =
    next.match?.innings?.[next.match.currentInnings]?.timeline?.length || 0;
  return prevLen === nextLen;
});

// Helper for local backup
const getLocalMatch = (tId, mId) => {
  try {
    const key = `dfl-fb-${tId || "default"}-${mId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

export default function LiveScoring() {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Raw state
  const [match, setMatch] = useState(() =>
    getLocalMatch(tournamentId, matchId)
  );
  const [activeTab, setActiveTab] = useState("summary");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [canScore, setCanScore] = useState(false);

  // --- 1. DATA PROCESSING (MEMOIZED) ---
  const processedMatch = useMemo(() => {
    if (!match) return null;
    // Fast cloning to ensure pure props
    return { ...match, id: matchId };
  }, [match, matchId]);

  // --- 2. HANDLERS ---
  const handleTabSummary = useCallback(() => setActiveTab("summary"), []);
  const handleTabCard = useCallback(() => setActiveTab("scorecard"), []);
  const handleTabLogs = useCallback(() => setActiveTab("commentary"), []);
  const handleTabInfo = useCallback(() => setActiveTab("info"), []);
  const handleCloseCorrection = useCallback(
    () => setShowCorrectionModal(false),
    []
  );
  const handleHomeClick = useCallback(
    () => navigate(`/tournaments/${tournamentId}`),
    [navigate, tournamentId]
  );

  // --- 3. PERMISSIONS ---
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
          setCanScore(
            tData.ownerId === user.uid || tData.scorers?.includes(user.uid)
          );
        }
      } catch (err) {
        setCanScore(false);
      }
    }
    checkPermissions();
  }, [tournamentId, user]);

  // --- 4. DATA SUBSCRIPTION ---
  useEffect(() => {
    if (!tournamentId || !matchId) return;
    const unsub = subscribeMatch(tournamentId, matchId, (data) => {
      if (data) {
        setMatch((prev) => {
          // STRICT OPTIMISTIC CHECK:
          // If our local state is "ahead" (newer lastUpdate timestamp), ignore the server update
          if (prev && prev.lastUpdate > data.lastUpdate) return prev;
          return data;
        });
        localStorage.setItem(
          `dfl-fb-${tournamentId}-${matchId}`,
          JSON.stringify(data)
        );
      }
    });
    return () => unsub && unsub();
  }, [tournamentId, matchId]);

  // --- 5. SCORING HOOK ---
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
  } = scoring;

  if (!processedMatch) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-cyan-500">
        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
        <div className="text-[10px] font-black tracking-[0.3em] uppercase opacity-50">
          Synchronizing Arena...
        </div>
      </div>
    );
  }

  const getMatchTitle = () => {
    if (processedMatch.meta?.teamAName && processedMatch.meta?.teamBName)
      return `${processedMatch.meta.teamAName} v ${processedMatch.meta.teamBName}`;
    return processedMatch.name || "Live Match";
  };

  return (
    <div className="h-screen w-full bg-black font-sans text-gray-100 flex flex-col overflow-hidden select-none touch-manipulation">
      {/* --- STICKY HEADER --- */}
      <div className="flex-none bg-black/80 border-b border-white/5 px-4 h-16 flex items-center justify-between z-[60] backdrop-blur-xl">
        <button
          onClick={handleHomeClick}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-lg active:scale-90 transition-transform">
          🏠
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="text-[11px] font-black text-white uppercase tracking-tight truncate max-w-[200px] italic">
            {getMatchTitle()}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                processedMatch.status === "finished"
                  ? "bg-green-500"
                  : "bg-red-500 animate-pulse"
              }`}></span>
            <span
              className={`text-[9px] font-black tracking-widest uppercase ${
                processedMatch.status === "finished"
                  ? "text-green-500"
                  : "text-red-500"
              }`}>
              {processedMatch.status || "Live"}
            </span>
          </div>
        </div>

        <div className="w-10"></div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 relative flex flex-col">
        {canScore ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* ScoreInput needs frequent updates, so we don't memoize it aggressively */}
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
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <MemoizedScoreSummary match={processedMatch} />
            </div>
            <div className="bg-gray-900/40 border border-white/5 rounded-[2rem] p-2">
              <MemoizedScoreTable match={processedMatch} />
            </div>
          </div>
        )}

        {/* --- DYNAMIC VIEW OVERLAYS --- */}
        {activeTab !== "summary" && (
          <div className="absolute inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/90 backdrop-blur-md">
              <h3 className="text-cyan-500 font-black uppercase text-xs tracking-[0.3em]">
                {activeTab} View
              </h3>
              <button
                onClick={handleTabSummary}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white text-sm active:scale-90 transition-transform">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 no-scrollbar pb-32">
              {activeTab === "scorecard" && (
                <div className="bg-gray-900/40 border border-white/5 rounded-[2rem] p-2">
                  {/* Only re-render table if open */}
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

      {/* --- MEMOIZED BOTTOM TAB BAR --- */}
      <nav className="flex-none h-20 bg-black border-t border-white/5 grid grid-cols-4 items-center px-2 pb-2 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[60]">
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
