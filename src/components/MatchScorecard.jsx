import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore"; // ✅ Import onSnapshot
import { db } from "../utils/firebase"; // ✅ Import DB instance
import ScoreSummary from "../components/ScoreSummary";
import ScoreTable from "../components/ScoreTable";
import MatchCommentary from "../components/MatchCommentary";
import MatchInfo from "../components/MatchInfo";

export default function MatchScorecard() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scorecard");

  // --- 1. REAL-TIME AUTO SYNC ---
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    setLoading(true);
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);

    // This listener fires every time the DB changes
    const unsubscribe = onSnapshot(
      matchRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setMatch(docSnap.data());
          setError("");
        } else {
          setError("Match not found.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Real-time sync error:", err);
        setError("Live connection lost. Please refresh.");
        setLoading(false);
      }
    );

    // Cleanup listener when leaving page
    return () => unsubscribe();
  }, [tournamentId, matchId]);

  // --- 2. MANUAL REFRESH (Backup) ---
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
      const snap = await getDoc(matchRef);
      if (snap.exists()) {
        setMatch(snap.data());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [tournamentId, matchId]);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0F1115] text-teal-500 font-bold uppercase tracking-widest text-sm">
        <span className="animate-pulse">Loading Live Score...</span>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#0F1115] text-slate-400 font-bold gap-4">
        <span className="text-red-400">{error}</span>
        <button
          onClick={handleManualRefresh}
          className="bg-white/10 px-4 py-2 rounded-lg text-xs uppercase hover:bg-white/20 transition-colors">
          Reconnect
        </button>
      </div>
    );

  if (!match) return null;

  const matchTitle = match.meta
    ? `${match.meta.teamA} vs ${match.meta.teamB}`
    : "Match Details";

  // Check if match is live for the pulsing badge
  const isLive = ["ongoing", "live", "in-progress"].includes(
    (match.status || "").toLowerCase()
  );

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-300 font-sans pb-20">
      {/* HEADER */}
      <div className="bg-[#161920]/80 backdrop-blur-lg border-b border-white/5 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 transition-colors active:scale-95">
            <span className="text-xl">←</span>
            <span className="hidden sm:inline">Back</span>
          </Link>

          <div className="flex flex-col items-center">
            <div className="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-widest truncate max-w-[200px] sm:max-w-md text-center">
              {matchTitle}
            </div>
            {isLive ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></span>
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                  LIVE
                </span>
              </div>
            ) : (
              <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                {match.status || "Completed"}
              </span>
            )}
          </div>

          {/* Refresh Button (Now mostly cosmetic, but good for backup) */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-teal-500 transition-all active:scale-90 active:rotate-180 disabled:opacity-50"
            title="Force Sync">
            <span
              className={`text-lg leading-none ${
                refreshing ? "animate-spin" : ""
              }`}>
              ↻
            </span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* MATCH SUMMARY */}
        <ScoreSummary match={match} />

        {/* TABS */}
        <div className="bg-[#1C2128] border border-white/5 p-1.5 rounded-2xl flex gap-1 shadow-lg max-w-md mx-auto sticky top-[70px] z-40 backdrop-blur-md">
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

        {/* CONTENT */}
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
