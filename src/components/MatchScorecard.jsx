import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getMatch } from "../utils/firestore";
import ScoreSummary from "../components/ScoreSummary";
import ScoreTable from "../components/ScoreTable";
import MatchCommentary from "../components/MatchCommentary";
import MatchInfo from "../components/MatchInfo";

export default function MatchScorecard() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scorecard");

  useEffect(() => {
    async function fetch() {
      try {
        if (!tournamentId || !matchId) throw new Error("Missing IDs");
        const data = await getMatch(tournamentId, matchId);
        setMatch(data);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [tournamentId, matchId]);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0F1115] text-teal-500 font-bold uppercase tracking-widest text-sm">
        <span className="animate-pulse">Loading Match Data...</span>
      </div>
    );
  if (error)
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0F1115] text-red-400 font-bold">
        {error}
      </div>
    );
  if (!match) return null;

  const matchTitle = match.meta
    ? `${match.meta.teamA} vs ${match.meta.teamB}`
    : "Match Details";

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-300 font-sans pb-20">
      
      {/* 1. GLASS HEADER */}
      <div className="bg-[#161920]/80 backdrop-blur-lg border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 transition-colors">
            <span className="text-xl">←</span> Back
          </Link>
          <div className="text-sm font-black text-slate-200 uppercase tracking-widest truncate max-w-[60%]">
            {matchTitle}
          </div>
          <div className="w-12"></div> {/* Spacer for balance */}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* 2. MATCH SUMMARY CARD */}
        <ScoreSummary match={match} />

        {/* 3. NAVIGATION TABS */}
        <div className="bg-[#1C2128] border border-white/5 p-1.5 rounded-2xl flex gap-1 shadow-lg max-w-md mx-auto">
          {["scorecard", "commentary", "info"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab
                  ? "bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md transform scale-100"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
              }`}>
              {tab === "info"
                ? "ℹ️ Info"
                : tab === "commentary"
                ? "🎙️ Comm"
                : "📊 Score"}
            </button>
          ))}
        </div>

        {/* 4. TAB CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[400px]">
          {activeTab === "scorecard" && <ScoreTable match={match} />}
          {activeTab === "commentary" && (
            <div className="max-w-3xl mx-auto">
              <MatchCommentary match={match} />
            </div>
          )}
          {activeTab === "info" && <MatchInfo match={match} />}
        </div>
      </div>
    </div>
  );
}