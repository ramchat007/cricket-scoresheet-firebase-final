// src/components/LiveScoring.jsx
import React, { useEffect, useState, useMemo } from "react";
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
  const [canScore, setCanScore] = useState(false);

  // 1. Permission Logic
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
        const tRef = doc(db, "tournaments", tournamentId);
        const tSnap = await getDoc(tRef);
        if (tSnap.exists()) {
          const tData = tSnap.data();
          setCanScore(tData.ownerId === user.uid || tData.scorers?.includes(user.uid));
        }
      } catch (err) {
        setCanScore(false);
      }
    }
    checkPermissions();
  }, [tournamentId, user]);

  // 2. Data Subscription (WITH DATA RECOVERY FIX)
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    const unsub = subscribeMatch(tournamentId, matchId, (data) => {
      if (data) {
        let processedInnings = [];
        if (data.innings) {
          if (Array.isArray(data.innings)) {
            processedInnings = data.innings.filter(inn => inn && inn.battingTeam);
          } else {
            processedInnings = Object.keys(data.innings)
              .sort((a, b) => Number(a) - Number(b))
              .map(key => data.innings[key])
              .filter(inn => inn && inn.battingTeam);
          }
        }
        
        const matchData = { ...data, innings: processedInnings, id: matchId };
        setMatch(matchData);
        localStorage.setItem(`dfl-fb-${tournamentId}-${matchId}`, JSON.stringify(matchData));
      }
    });
    return () => unsub && unsub();
  }, [tournamentId, matchId]);

  const scoring = useScoring({ tournamentId, matchId, match }) || {};
  const {
    handleBall, handleExtraBallRuns, handleNewBatsman, handleConfirmBowler,
    handleChangeBowler, handleStrikeChange, handleUndo, handleEndInnings,
    handleFinishMatch, handleDeleteMatch,
  } = scoring;

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-cyan-500 animate-pulse">
        <div className="text-5xl mb-6">🏏</div>
        <div className="text-2xl font-bold tracking-widest uppercase">Syncing Live Data...</div>
      </div>
    );
  }

  const getMatchTitle = () => {
    if (match.meta?.teamA && match.meta?.teamB) return `${match.meta.teamA} v ${match.meta.teamB}`;
    return match.name || "Live Match";
  };

  return (
    <div className="h-screen w-full bg-[#080c14] font-sans text-gray-100 flex flex-col overflow-hidden">
      
      {/* --- TOP HEADER (Increased Height and Font) --- */}
      <div className="flex-none bg-gray-900 border-b border-gray-800 px-4 h-14 flex items-center justify-between z-50">
        <button onClick={() => navigate(`/tournaments/${tournamentId}`)} className="text-gray-400 text-2xl active:scale-90 p-1">🏠</button>
        <div className="flex flex-col items-center overflow-hidden">
          {/* Increased text size to sm/base */}
          <span className="text-sm font-bold text-gray-300 uppercase truncate max-w-[180px]">{getMatchTitle()}</span>
          <span className={`text-[10px] font-black tracking-widest uppercase px-2 rounded mt-0.5 ${
            match.status === "finished" ? "text-green-500 bg-green-500/10" : "text-red-500 animate-pulse bg-red-500/10"
          }`}>
            {match.status?.toUpperCase() || "LIVE"}
          </span>
        </div>
        {/* Increased padding and text size for Fix button */}
        <button onClick={() => setShowCorrectionModal(true)} className="bg-gray-800 border border-gray-700 text-xs px-3 py-2 rounded-lg font-bold active:scale-95 transition-all text-cyan-400">
            🛠 Fix
        </button>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
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
            onFinishMatch={(winner) => { handleFinishMatch(winner); navigate(`/tournaments/${tournamentId}`); }}
            onDeleteMatch={() => { handleDeleteMatch(); navigate(`/tournaments/${tournamentId}`); }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-4 text-base">
            <ScoreSummary match={match} />
            <ScoreTable match={match} />
          </div>
        )}

        {/* --- TABS OVERLAY --- */}
        {activeTab !== 'summary' && (
          <div className="absolute inset-0 bg-[#080c14] z-40 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900">
              <h3 className="text-cyan-500 font-bold uppercase text-sm tracking-widest">{activeTab}</h3>
              <button onClick={() => setActiveTab('summary')} className="text-gray-400 text-2xl px-3">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-base">
              {activeTab === "scorecard" && <ScoreTable match={match} />}
              {activeTab === "commentary" && <MatchCommentary match={match} />}
              {activeTab === "info" && <MatchInfo match={match} />}
            </div>
          </div>
        )}
      </div>

      {/* --- BOTTOM NAVIGATION (Increased Height and Font) --- */}
      <nav className="flex-none h-16 bg-gray-950 border-t border-gray-800 grid grid-cols-4 items-center">
        <NavBtn active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon="📝" label="Score" />
        <NavBtn active={activeTab === 'scorecard'} onClick={() => setActiveTab('scorecard')} icon="📊" label="Card" />
        <NavBtn active={activeTab === 'commentary'} onClick={() => setActiveTab('commentary')} icon="🎙️" label="Logs" />
        <NavBtn active={activeTab === 'info'} onClick={() => setActiveTab('info')} icon="ℹ️" label="Info" />
      </nav>

      {showCorrectionModal && (
        <MatchCorrectionModal match={match} tournamentId={tournamentId} onClose={() => setShowCorrectionModal(false)} />
      )}
    </div>
  );
}

// Sub-component for Footer (Increased sizes)
function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center h-full w-full transition-all ${
      active ? "text-cyan-400 bg-gray-900 border-t-4 border-cyan-500" : "text-gray-500"
    }`}>
      {/* Icon size increased */}
      <span className="text-xl">{icon}</span>
      {/* Label size increased from 9px to 11px */}
      <span className="text-[11px] font-black uppercase mt-1 tracking-wider">{label}</span>
    </button>
  );
}