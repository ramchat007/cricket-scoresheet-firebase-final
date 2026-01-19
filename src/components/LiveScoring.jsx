// src/components/LiveScoring.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { subscribeMatch } from "../utils/firestore";
import { useScoring } from "../hooks/useScoring";
import { useAuth } from "../hooks/useAuth";

import ScoreInput from "../components/ScoreInput.jsx";
import ScoreTable from "../components/ScoreTable.jsx";
import ScoreSummary from "../components/ScoreSummary.jsx"; // ✅ This component handles the logic you asked for
import MatchCommentary from "../components/MatchCommentary.jsx";
import MatchInfo from "../components/MatchInfo.jsx";
import MatchCorrectionModal from "../components/MatchCorrectionModal.jsx";

// --- MEMOIZED NAV BUTTON ---
const NavBtn = React.memo(({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center h-14 rounded-2xl transition-all duration-200 active:scale-95 ${
      active ? "text-cyan-400 bg-cyan-500/5" : "text-gray-600"
    }`}>
    <span
      className={`text-xl transition-transform duration-300 ${active ? "scale-110" : "grayscale opacity-50"}`}>
      {icon}
    </span>
    <span
      className={`text-[10px] font-black uppercase mt-1 tracking-widest transition-all ${active ? "opacity-100" : "opacity-40"}`}>
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

const getLocalMatch = (tId, mId) => {
  try {
    return JSON.parse(
      localStorage.getItem(`dfl-fb-${tId || "default"}-${mId}`),
    );
  } catch (e) {
    return null;
  }
};

export default function LiveScoring() {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState(() =>
    getLocalMatch(tournamentId, matchId),
  );
  const [activeTab, setActiveTab] = useState("summary");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [canScore, setCanScore] = useState(false);

  // Toggle Broadcast Panel
  const [showObsPanel, setShowObsPanel] = useState(false);

  // --- 1. DATA PROCESSING ---
  const processedMatch = useMemo(() => {
    if (!match) return null;
    return { ...match, id: matchId };
  }, [match, matchId]);

  // Check if Stream is Linked
  const isStreamLinked = useMemo(() => {
    const url =
      processedMatch?.meta?.liveStreamUrl || processedMatch?.meta?.liveStreamId;
    return !!url;
  }, [processedMatch?.meta?.liveStreamUrl, processedMatch?.meta?.liveStreamId]);

  // --- 2. HANDLERS ---
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

  // COPY OBS LINK HANDLER
  const copyObsLink = () => {
    const url = `${window.location.origin}/overlay/${tournamentId}/${matchId}?clean=true`;
    navigator.clipboard.writeText(url);
    alert("✅ OBS Link Copied!\nPaste this as a 'Browser Source' in OBS.");
  };

  // --- 3. PERMISSIONS & INITIAL SETUP ---
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

  // --- 4. DATA SUBSCRIPTION ---
  useEffect(() => {
    if (!tournamentId || !matchId) return;
    const unsub = subscribeMatch(tournamentId, matchId, (data) => {
      if (data) {
        setMatch((prev) => {
          if (prev && prev.lastUpdate > data.lastUpdate) return prev;
          return data;
        });
        localStorage.setItem(
          `dfl-fb-${tournamentId}-${matchId}`,
          JSON.stringify(data),
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
      {/* 📡 BROADCAST TOOLS PANEL */}
      {canScore && (
        <div
          className={`flex-none bg-[#161920] border-b border-white/10 relative transition-all duration-300 ease-in-out overflow-hidden ${showObsPanel ? "h-auto py-4" : "h-0 py-0"}`}>
          <div className="px-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <span className="text-purple-500 text-lg">📡</span> Broadcast
                Tools
              </h3>
              {isStreamLinked ? (
                <span className="text-[9px] bg-green-500/10 text-green-500 px-2 py-1 rounded border border-green-500/20 font-bold uppercase">
                  Stream Linked
                </span>
              ) : (
                <span className="text-[9px] bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20 font-bold uppercase">
                  No Stream URL
                </span>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">
                  OBS Overlay URL (Transparent)
                </div>
                <div className="text-xs text-slate-300 truncate font-mono select-all bg-black/50 p-2 rounded border border-white/5">
                  {`${window.location.origin}/overlay/${tournamentId}/${matchId}?clean=true`}
                </div>
              </div>
              <button
                onClick={copyObsLink}
                className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl transition-all active:scale-95 shadow-lg"
                title="Copy URL">
                📋
              </button>
              <a
                href={`/overlay/${tournamentId}/${matchId}?clean=true`}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl transition-all active:scale-95"
                title="Test in New Tab">
                ↗️
              </a>
            </div>
            <p className="text-[9px] text-slate-500 mt-2 text-center">
              Paste this URL into OBS as a "Browser Source" (1920x1080) to show
              live scores.
            </p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex-none bg-black/80 border-b border-white/5 px-4 h-14 flex items-center justify-between z-[60] backdrop-blur-xl">
        <button
          onClick={handleHomeClick}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-lg active:scale-90 transition-transform">
          🏠
        </button>
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-black text-white uppercase tracking-tight truncate max-w-[200px] italic">
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

        {/* TOGGLE OBS PANEL BUTTON */}
        <button
          onClick={() => setShowObsPanel(!showObsPanel)}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg active:scale-90 transition-transform ${
            showObsPanel
              ? "bg-purple-500/10 border-purple-500/20 text-purple-500"
              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
          }`}
          title={showObsPanel ? "Close Tools" : "Broadcast Tools"}>
          {showObsPanel ? "✕" : "📡"}
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        {canScore ? (
          // SCORING UI (Full Height)
          <div className="flex-1 flex flex-col h-full">
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
          // VIEW ONLY UI (For non-scorers/Admins viewing score)
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <MemoizedScoreSummary match={processedMatch} />
            </div>
            <div className="border border-white/5 rounded-[2rem] p-2">
              <MemoizedScoreTable match={processedMatch} />
            </div>
          </div>
        )}

        {/* TABS MODAL (Viewers/Admins Checking Info) */}
        {activeTab !== "summary" && (
          <div className="absolute inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-black/90 backdrop-blur-md">
              <h3 className="text-cyan-500 font-black uppercase text-xs tracking-[0.3em]">
                {activeTab} View
              </h3>
              <button
                onClick={handleTabSummary}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white text-xs active:scale-90 transition-transform">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 no-scrollbar pb-32">
              {activeTab === "scorecard" && (
                <div className="border border-white/5 rounded-[2rem] p-2">
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
      <nav className="flex-none h-16 bg-black border-t border-white/5 grid grid-cols-4 items-center px-2 pb-1 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[60]">
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