// src/pages/MatchScorecard.jsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getMatch } from "../utils/firestore";
import ScoreSummary from "../components/ScoreSummary";
import ScoreTable from "../components/ScoreTable";
import MatchCommentary from "../components/MatchCommentary";
import MatchInfo from "../components/MatchInfo"; // ✅ NEW

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
      <div className="flex justify-center items-center min-h-screen bg-[#0f172a] text-cyan-500 font-bold uppercase tracking-widest">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0f172a] text-red-500 font-bold">
        {error}
      </div>
    );
  if (!match) return null;

  const matchTitle = match.meta
    ? `${match.meta.teamA} vs ${match.meta.teamB}`
    : "Match Details";

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans pb-20">
      {/* HEADER */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="text-gray-400 hover:text-white text-sm font-bold flex items-center gap-2">
            ← Back
          </Link>
          <div className="text-sm font-bold text-white uppercase tracking-wide truncate max-w-[60%]">
            {matchTitle}
          </div>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* SUMMARY */}
        <ScoreSummary match={match} />

        {/* TABS */}
        <div className="bg-gray-900 border border-gray-800 p-1 rounded-xl flex gap-1 shadow-sm mx-auto">
          {["scorecard", "commentary", "info"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              {tab === "info"
                ? "ℹ️ Info"
                : tab === "commentary"
                ? "🎙️ Comm"
                : "📊 Score"}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
