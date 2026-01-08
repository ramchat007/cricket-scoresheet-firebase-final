// src/components/LiveScoring.jsx
import React, { useEffect, useState } from "react";
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
import MatchInfo from "./MatchInfo.jsx"; // ✅ NEW IMPORT
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";

// Helper to get local backup if network fails
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

  const [match, setMatch] = useState(() =>
    getLocalMatch(tournamentId, matchId)
  );
  const [activeTab, setActiveTab] = useState("summary");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // New State for Permissions
  const [canScore, setCanScore] = useState(false);

  // 1. Permission Logic (Secure the UI)
  useEffect(() => {
    async function checkPermissions() {
      // A. Generic Matches: Open to everyone logged in
      if (tournamentId === "generic") {
        setCanScore(!!user);
        return;
      }

      // B. Private Tournaments: Check DB
      if (!user || !tournamentId) {
        setCanScore(false);
        return;
      }

      try {
        const tRef = doc(db, "tournaments", tournamentId);
        const tSnap = await getDoc(tRef);

        if (tSnap.exists()) {
          const tData = tSnap.data();
          const isOwner = tData.ownerId === user.uid;
          const isScorer = tData.scorers?.includes(user.uid);
          setCanScore(isOwner || isScorer);
        }
      } catch (err) {
        console.error("Permission check failed:", err);
        setCanScore(false);
      }
    }
    checkPermissions();
  }, [tournamentId, user]);

  // 2. Data Subscription
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    const unsub = subscribeMatch(tournamentId, matchId, (data) => {
      if (data) {
        const matchData = { ...data, id: matchId };
        setMatch(matchData);
        localStorage.setItem(
          `dfl-fb-${tournamentId || "default"}-${matchId}`,
          JSON.stringify(matchData)
        );
      } else {
        console.warn("Match not found in DB");
      }
    });

    return () => unsub && unsub();
  }, [tournamentId, matchId]);

  // 3. Initialize Scoring Engine
  const scoring = useScoring({ tournamentId, matchId, match }) || {};
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

  // 4. Loading State
  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-cyan-500 animate-pulse">
        <div className="text-4xl mb-4">🏏</div>
        <div className="text-xl font-bold tracking-widest">
          LOADING LIVE SCORING...
        </div>
        <div className="text-sm text-gray-600 mt-4">
          Waiting for connection...
        </div>
      </div>
    );
  }

  // Helper for Header Title
  const getMatchTitle = () => {
    if (match.meta?.teamA && match.meta?.teamB) {
      return `${match.meta.teamA} vs ${match.meta.teamB}`;
    }
    return match.name || "Live Match";
  };

  // --- VALIDATION LOGIC ---
  const currentInnings = match.innings?.[match.currentInnings || 0] || {};
  const { striker, nonStriker, currentBowler } = currentInnings;
  const isMatchLive =
    !match.status ||
    match.status.toLowerCase() === "live" ||
    match.status.toLowerCase() === "in-progress" ||
    match.status.toLowerCase() === "ongoing";

  const missingFields = [];
  if (isMatchLive) {
    if (!striker) missingFields.push("Striker");
    if (!nonStriker) missingFields.push("Non-Striker");
    if (!currentBowler) missingFields.push("Bowler");
  }
  const hasSetupIssues = missingFields.length > 0;

  // 5. Render Layout
  return (
    <div className="min-h-screen bg-[#0f172a] w-full font-sans text-gray-100">
      {/* --- TOP HEADER --- */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <button
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          className="text-gray-400 hover:text-white text-sm font-bold flex items-center gap-2 transition-colors">
          ← Dashboard
        </button>

        <div className="text-sm font-bold text-white tracking-wide uppercase truncate max-w-[50%] text-center">
          {getMatchTitle()}
        </div>

        <div
          className={`text-[10px] font-mono px-2 py-1 rounded border ${
            match.status === "finished"
              ? "bg-green-900/20 text-green-400 border-green-900/50"
              : "bg-red-900/20 text-red-400 border-red-900/50 animate-pulse"
          }`}>
          {match.status?.toUpperCase() ||
            match.meta?.status?.toUpperCase() ||
            "LIVE"}
        </div>
      </div>

      <div className="w-full max-w-[1920px] mx-auto p-2 sm:p-4 lg:p-6">
        <div className="flex flex-col xl:grid xl:grid-cols-12 gap-6 items-start">
          {/* --- LEFT COLUMN: SCORING CONSOLE (Sticky) --- */}
          <div className="xl:col-span-4 flex flex-col gap-4 order-last xl:order-first w-full">
            <div className="xl:sticky xl:top-20 z-40">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
                <div className="bg-gray-950/50 p-3 border-b border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-500 uppercase tracking-widest pl-1">
                    Scoring Console
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCorrectionModal(true)}
                      className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-1 rounded border border-gray-700 transition-colors">
                      🛠 Fix
                    </button>
                    <span className="text-[10px] text-gray-500 uppercase font-bold">
                      {match.status === "finished" ? "Finished" : "Live"}
                    </span>
                    {match.status !== "finished" && (
                      <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse mr-1"></div>
                    )}
                  </div>
                </div>

                {/* --- WARNING BANNER --- */}
                {hasSetupIssues && canScore && (
                  <div className="bg-yellow-900/20 border-b border-yellow-700/30 p-4 flex items-start gap-3 animate-in slide-in-from-top">
                    <div className="text-xl">⚠️</div>
                    <div>
                      <h4 className="text-yellow-500 font-bold text-sm">
                        Setup Required
                      </h4>
                      <p className="text-yellow-200/70 text-xs mt-1 leading-relaxed">
                        Please select{" "}
                        <strong className="text-yellow-400 border-b border-yellow-400/50">
                          {missingFields.join(", ")}
                        </strong>{" "}
                        to unlock scoring controls.
                      </p>
                    </div>
                  </div>
                )}

                {/* --- CONDITIONAL RENDERING FOR SECURITY --- */}
                {canScore ? (
                  <ScoreInput
                    match={match}
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
                      navigate("/");
                    }}
                    onDeleteMatch={() => {
                      handleDeleteMatch();
                      navigate("/");
                    }}
                  />
                ) : (
                  <div className="p-8 text-center bg-gray-900/80">
                    <div className="text-5xl mb-4">👀</div>
                    <h3 className="text-white font-bold text-lg">
                      Spectator Mode
                    </h3>
                    <p className="text-gray-500 text-sm mt-2">
                      You are viewing the live scorecard. <br /> Scoring
                      controls are restricted to officials.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: SCORECARD & SUMMARY --- */}
          <div className="xl:col-span-8 w-full min-w-0 flex flex-col gap-4">
            {/* 1. Custom Tab Switcher */}
            <div className="bg-gray-900/90 backdrop-blur border border-gray-800 p-1 rounded-xl w-full sm:w-fit flex gap-1 self-start sticky top-[60px] xl:static z-30 shadow-md">
              <button
                onClick={() => setActiveTab("summary")}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  activeTab === "summary"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                📝 Summary
              </button>
              <button
                onClick={() => setActiveTab("scorecard")}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  activeTab === "scorecard"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                📊 Scorecard
              </button>
              <button
                onClick={() => setActiveTab("commentary")}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  activeTab === "commentary"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                🎙️ Commentary
              </button>
              <button
                onClick={() => setActiveTab("info")}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  activeTab === "info"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                ℹ️ Info
              </button>
            </div>

            {/* 2. Content Container */}
            <div className="relative">
              {/* Background Decor */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 rounded-2xl blur-xl opacity-50 -z-10"></div>

              <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl overflow-hidden shadow-2xl p-1 sm:p-2">
                {activeTab === "summary" && (
                  <div className="p-2 sm:p-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <ScoreSummary match={match} />
                  </div>
                )}

                {activeTab === "scorecard" && (
                  <div className="p-0 sm:p-2 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex flex-col gap-6">
                      <ScoreTable match={match} />
                    </div>
                  </div>
                )}

                {activeTab === "commentary" && (
                  <div className="p-0 sm:p-2 animate-in fade-in zoom-in-95 duration-300">
                    <MatchCommentary match={match} />
                  </div>
                )}

                {/* ✅ INFO TAB */}
                {activeTab === "info" && (
                  <div className="p-2 sm:p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <MatchInfo match={match} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ CORRECTION MODAL (Hidden by default) */}
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
