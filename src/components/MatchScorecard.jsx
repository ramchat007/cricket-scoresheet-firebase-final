import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import ScoreSummary from "../components/ScoreSummary";
import ScoreTable from "../components/ScoreTable";
import MatchCommentary from "../components/MatchCommentary";
import MatchInfo from "../components/MatchInfo";

// --- HELPER: Extract YouTube ID ---
const getYouTubeId = (url) => {
  if (!url) return null;
  const cleanUrl = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
  try {
    const urlObj = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`);
    if (urlObj.hostname === "youtu.be") return urlObj.pathname.slice(1);
    if (urlObj.searchParams.has("v")) return urlObj.searchParams.get("v");
    if (urlObj.pathname.includes("/live/")) return urlObj.pathname.split("/live/")[1].split("?")[0];
  } catch (e) { return null; }
  return null;
};

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

    const unsubscribe = onSnapshot(
      matchRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setMatch(docSnap.data());
          setError("");
        } else {
          setError("Match record not found in the arena.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Real-time sync error:", err);
        setError("Connection to arena lost. Attempting to reconnect...");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tournamentId, matchId]);

  // --- 2. CALCULATE VIDEO ID ---
  const videoId = useMemo(() => {
    return getYouTubeId(match?.meta?.liveStreamUrl || match?.meta?.liveStreamId);
  }, [match?.meta?.liveStreamUrl, match?.meta?.liveStreamId]);

  // --- 3. DYNAMIC TABS LIST ---
  const tabs = useMemo(() => {
    // Default tabs
    const list = [
      { id: "scorecard", label: "Scorecard" },
      { id: "commentary", label: "Timeline" },
      { id: "info", label: "Match Info" },
    ];
    // Prepend Stream tab if video is available
    if (videoId) {
      list.unshift({ id: "stream", label: "🔴 Live Stream" });
    }
    return list;
  }, [videoId]);

  // --- 4. MANUAL REFRESH ---
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
      const snap = await getDoc(matchRef);
      if (snap.exists()) setMatch(snap.data());
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }, [tournamentId, matchId]);

  if (loading)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#0F1115] text-teal-500">
        <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mb-4"></div>
        <span className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
          Syncing Arena Data
        </span>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#0F1115] text-slate-400 p-6 text-center">
        <div className="text-4xl mb-4">📡</div>
        <span className="text-red-400 font-bold mb-6">{error}</span>
        <button
          onClick={() => window.location.reload()}
          className="bg-teal-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-teal-500 transition-all shadow-lg shadow-teal-900/20">
          Force Reconnect
        </button>
      </div>
    );

  if (!match) return null;

  const matchTitle = match.meta
    ? `${match.meta.teamA} vs ${match.meta.teamB}`
    : "Live Match Statistics";

  const isLive = ["ongoing", "live", "in-progress"].includes(
    (match.status || "").toLowerCase(),
  );

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-300 font-sans pb-32 selection:bg-teal-500/30">
      
      {/* 🏛 HEADER (Sticky) */}
      <div className="bg-[#161920]/90 backdrop-blur-xl border-b border-white/5 sticky top-0 z-[100]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-all active:scale-90">
            ←
          </Link>

          <div className="flex flex-col items-center">
            <h1 className="text-[11px] font-black text-slate-200 uppercase tracking-[0.15em] truncate max-w-[180px] sm:max-w-md text-center italic">
              {matchTitle}
            </h1>
            {isLive ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]"></span>
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                  LIVE BROADCAST
                </span>
              </div>
            ) : (
              <span className="text-[9px] font-black text-slate-500 uppercase mt-1 tracking-widest">
                Match Result
              </span>
            )}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={`w-10 h-10 rounded-xl bg-teal-500/5 border border-teal-500/10 flex items-center justify-center text-teal-500 transition-all active:scale-90 ${refreshing ? "opacity-50 pointer-events-none" : "hover:bg-teal-500/10"}`}>
            <span className={`text-xl ${refreshing ? "animate-spin" : ""}`}>
              ↻
            </span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        
        {/* MATCH SUMMARY (Always Visible) */}
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <ScoreSummary match={match} />
        </div>

        {/* 📑 TABS: Dynamic List */}
        <div className="bg-[#1C2128] border border-white/10 p-1 rounded-2xl flex gap-1 shadow-2xl max-w-lg mx-auto sticky top-20 z-50 backdrop-blur-md overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-tighter whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-900/40"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 📉 DYNAMIC CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 min-h-[500px]">
          
          {/* TAB: STREAM */}
          {activeTab === "stream" && videoId && (
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`}
                title="Live Match Stream"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}

          {/* TAB: SCORECARD */}
          {activeTab === "scorecard" && (
            <div className="space-y-6">
              <ScoreTable match={match} />
            </div>
          )}

          {/* TAB: COMMENTARY */}
          {activeTab === "commentary" && (
            <div className="max-w-3xl mx-auto">
              <MatchCommentary match={match} />
            </div>
          )}

          {/* TAB: INFO */}
          {activeTab === "info" && (
            <div className="max-w-2xl mx-auto">
              <MatchInfo match={match} />
            </div>
          )}
        </div>
      </div>

      {/* 🏁 BOTTOM DECORATIVE GRADIENT */}
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0F1115] to-transparent pointer-events-none z-0"></div>
    </div>
  );
}