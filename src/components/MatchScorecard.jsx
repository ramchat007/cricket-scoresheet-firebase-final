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
    const urlObj = new URL(
      cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`,
    );
    if (urlObj.hostname === "youtu.be") return urlObj.pathname.slice(1);
    if (urlObj.searchParams.has("v")) return urlObj.searchParams.get("v");
    if (urlObj.pathname.includes("/live/"))
      return urlObj.pathname.split("/live/")[1].split("?")[0];
  } catch (e) {
    return null;
  }
  return null;
};

export default function MatchScorecard() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scorecard");

  // --- 1. FETCH MATCH (Real-Time) ---
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
          setError("Match record not found.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Sync error:", err);
        setError("Connection lost. Reconnecting...");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [tournamentId, matchId]);

  // --- 2. FETCH TOURNAMENT (Once) ---
  useEffect(() => {
    if (!tournamentId) return;
    const fetchTournament = async () => {
      try {
        const tSnap = await getDoc(doc(db, "tournaments", tournamentId));
        if (tSnap.exists()) {
          setTournament(tSnap.data());
        }
      } catch (e) {
        console.error("Could not fetch tournament config", e);
      }
    };
    fetchTournament();
  }, [tournamentId]);

  // --- 3. SMART VIDEO ID CALCULATION ---
  const videoId = useMemo(() => {
    const matchUrl = match?.meta?.liveStreamUrl || match?.meta?.liveStreamId;
    const globalUrl = tournament?.liveStreamUrl || tournament?.broadcastUrl;

    return getYouTubeId(matchUrl) || getYouTubeId(globalUrl);
  }, [match, tournament]);

  // --- 🧠 NEW STANDARDIZED TEAM LOGIC (MOVE TO HERE) ---
  const { battingFirstTeam, battingSecondTeam } = useMemo(() => {
    // If data isn't here yet, return empty
    if (!match || !match.meta)
      return { battingFirstTeam: "", battingSecondTeam: "" };

    // 1. Try to get team from the first innings record (most reliable)
    const inn1 =
      match.innings?.[0] || (match.innings && Object.values(match.innings)[0]);

    if (inn1 && inn1.battingTeam) {
      const first = inn1.battingTeam;
      // Determine the other team by checking meta
      const second =
        first === match.meta.teamA ? match.meta.teamB : match.meta.teamA;
      return { battingFirstTeam: first, battingSecondTeam: second };
    }

    // 2. Fallback: If no innings yet, use the Toss Decision
    const tossWinner = match.meta.toss?.winner;
    const decision = match.meta.toss?.decision; // "Bat" or "Bowl"

    if (tossWinner && decision) {
      const otherTeam =
        tossWinner === match.meta.teamA ? match.meta.teamB : match.meta.teamA;
      if (decision === "Bat") {
        return { battingFirstTeam: tossWinner, battingSecondTeam: otherTeam };
      } else {
        return { battingFirstTeam: otherTeam, battingSecondTeam: tossWinner };
      }
    }

    // 3. Last Resort: Use meta order
    return {
      battingFirstTeam: match.meta.teamA,
      battingSecondTeam: match.meta.teamB,
    };
  }, [match]);

  // --- 4. DYNAMIC TABS ---
  const tabs = useMemo(() => {
    const list = [
      { id: "scorecard", label: "Scorecard" },
      { id: "commentary", label: "Timeline" },
      { id: "info", label: "Match Info" },
    ];

    // 🔒 HIDDEN: Video Stream Tab (Code preserved for future use)
     if (videoId) {
      list.unshift({ id: "stream", label: "🔴 Live Stream" });
    }
    

    // --- EARLY RETURNS (Wait until hooks are done) ---
    if (loading)
      return (
        <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-teal-500">
          Loading Arena...
        </div>
      );
    if (error)
      return (
        <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-red-500">
          {error}
        </div>
      );
    if (!match) return null;

    return list;
  }, [videoId]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, [tournamentId, matchId]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-teal-500">
        Loading Arena...
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  if (!match) return null;

  // Now update the title variable using the memoized values
  const matchTitle = battingFirstTeam
    ? `${battingFirstTeam} vs ${battingSecondTeam}`
    : "Live Match";
  const isLive = ["ongoing", "live", "in-progress"].includes(
    (match.status || "").toLowerCase(),
  );

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-300 font-sans pb-32 selection:bg-teal-500/30">
      {/* HEADER */}
      <div className="bg-[#161920]/90 backdrop-blur-xl border-b border-white/5 sticky top-0 z-[100]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400">
            ←
          </Link>
          <div className="flex flex-col items-center">
            <h1 className="text-[11px] font-black text-slate-200 uppercase tracking-[0.15em] truncate max-w-[180px] sm:max-w-md italic">
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
            className={`w-10 h-10 rounded-xl bg-teal-500/5 border border-teal-500/10 text-teal-500 flex items-center justify-center ${refreshing && "animate-spin"}`}>
            ↻
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <ScoreSummary match={match} />
        </div>

        {/* TAB NAVIGATION */}
        <div className="bg-[#1C2128] border border-white/10 p-1 rounded-2xl flex gap-1 shadow-2xl max-w-lg mx-auto sticky top-20 z-50 backdrop-blur-md overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-tighter whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 min-h-[500px]">
          {/* 🔴 STREAM TAB (HIDDEN: Code preserved) */}
          {activeTab === "stream" && videoId && (
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1`}
                title="Live Match Stream"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen></iframe>
              {match?.meta?.liveStreamUrl ? null : (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-[8px] font-bold px-2 py-1 rounded shadow">
                  DAY STREAM
                </div>
              )}
            </div>
          )}
         

          {activeTab === "scorecard" && (
            <div className="space-y-6">
              <ScoreTable match={match} />
            </div>
          )}
          {activeTab === "commentary" && (
            <div className="max-w-3xl mx-auto">
              <MatchCommentary match={match} />
            </div>
          )}
          {activeTab === "info" && (
            <div className="max-w-2xl mx-auto">
              <MatchInfo match={match} />
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0F1115] to-transparent pointer-events-none z-0"></div>
    </div>
  );
}
