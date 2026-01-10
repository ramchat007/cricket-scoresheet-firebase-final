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
import MatchInfo from "./MatchInfo.jsx"; 
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";

// Helper for local backup (Preserved)
const getLocalMatch = (tId, mId) => {
  try {
    const key = `dfl-fb-${tId || "default"}-${mId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (e) { return null; }
};

export default function LiveScoring() {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState(() => getLocalMatch(tournamentId, matchId));
  const [activeTab, setActiveTab] = useState("summary");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [canScore, setCanScore] = useState(false);

  // 1. Permission Logic (Preserved)
  useEffect(() => {
    async function checkPermissions() {
      if (tournamentId === "generic") { setCanScore(!!user); return; }
      if (!user || !tournamentId) { setCanScore(false); return; }
      try {
        const tSnap = await getDoc(doc(db, "tournaments", tournamentId));
        if (tSnap.exists()) {
          const tData = tSnap.data();
          setCanScore(tData.ownerId === user.uid || tData.scorers?.includes(user.uid));
        }
      } catch (err) { setCanScore(false); }
    }
    checkPermissions();
  }, [tournamentId, user]);

  // 2. Data Subscription (Preserved Logic)
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
      <div className="flex flex-col items-center justify-center h-screen bg-black text-cyan-500">
        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
        <div className="text-[10px] font-black tracking-[0.3em] uppercase opacity-50">Synchronizing Arena...</div>
      </div>
    );
  }

  const getMatchTitle = () => {
    if (match.meta?.teamAName && match.meta?.teamBName) return `${match.meta.teamAName} v ${match.meta.teamBName}`;
    if (match.meta?.teamA && match.meta?.teamB) return `${match.meta.teamA} v ${match.meta.teamB}`;
    return match.name || "Live Match";
  };

  return (
    <div className="h-screen w-full bg-black font-sans text-gray-100 flex flex-col overflow-hidden select-none">
      
      {/* --- PREMIUM STICKY HEADER --- */}
      <div className="flex-none bg-black/80 border-b border-white/5 px-4 h-16 flex items-center justify-between z-[60] backdrop-blur-xl">
        <button onClick={() => navigate(`/tournaments/${tournamentId}`)} 
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-lg active:scale-90 transition-transform">
          🏠
        </button>
        
        <div className="flex flex-col items-center text-center">
          <span className="text-[11px] font-black text-white uppercase tracking-tight truncate max-w-[150px] italic">{getMatchTitle()}</span>
          <div className="flex items-center gap-1.5 mt-1">
             <span className={`w-1.5 h-1.5 rounded-full ${match.status === "finished" ? "bg-green-500" : "bg-red-500 animate-pulse"}`}></span>
             <span className={`text-[9px] font-black tracking-widest uppercase ${match.status === "finished" ? "text-green-500" : "text-red-500"}`}>
                {match.status || "Live"}
             </span>
          </div>
        </div>

        {/* <button onClick={() => setShowCorrectionModal(true)} 
                className="bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] text-black text-[10px] font-black uppercase px-4 py-2 rounded-xl active:scale-95 transition-all">
            Fix
        </button> */}
      </div>

      {/* --- SCORING AREA / VIEW AREA --- */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {canScore ? (
          <div className="flex-1 flex flex-col overflow-hidden">
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
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <ScoreSummary match={match} />
            </div>
            <div className="bg-gray-900/40 border border-white/5 rounded-[2rem] p-2">
                <ScoreTable match={match} />
            </div>
          </div>
        )}

        {/* --- DYNAMIC TABS OVERLAY (App-style) --- */}
        {activeTab !== 'summary' && (
          <div className="absolute inset-0 bg-black z-50 flex flex-col animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/50 backdrop-blur-md">
              <h3 className="text-cyan-500 font-black uppercase text-xs tracking-[0.3em]">{activeTab} View</h3>
              <button onClick={() => setActiveTab('summary')} 
                      className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 no-scrollbar pb-32">
              {activeTab === "scorecard" && (
                <div className="bg-gray-900/40 border border-white/5 rounded-[2rem] p-2">
                    <ScoreTable match={match} />
                </div>
              )}
              {activeTab === "commentary" && <MatchCommentary match={match} />}
              {activeTab === "info" && <MatchInfo match={match} />}
            </div>
          </div>
        )}
      </div>

      {/* --- BOTTOM TAB BAR (Elevated Neon) --- */}
      <nav className="flex-none h-20 bg-black border-t border-white/5 grid grid-cols-4 items-center px-2 pb-2 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[60]">
        <NavBtn active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon="🏏" label="Score" />
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

// Sub-component for Footer (Custom Styled)
function NavBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center h-14 rounded-2xl transition-all duration-300 ${
      active ? "text-cyan-400 bg-cyan-500/5" : "text-gray-600 active:scale-90"
    }`}>
      <span className={`text-xl transition-transform duration-300 ${active ? 'scale-110' : 'grayscale opacity-50'}`}>{icon}</span>
      <span className={`text-[10px] font-black uppercase mt-1 tracking-widest transition-all ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
      {active && <div className="w-1 h-1 bg-cyan-500 rounded-full mt-1 shadow-[0_0_10px_#06b6d4]"></div>}
    </button>
  );
}