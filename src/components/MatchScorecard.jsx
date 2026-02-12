import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useTheme } from "../context/ThemeContext"; // ✅ Added Theme Context
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
  const { theme, lightMode } = useTheme(); // ✅ Hook into Global Theme

  const [match, setMatch] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scorecard");

  // --- 1. FETCH MATCH ---
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

  // --- 2. FETCH TOURNAMENT ---
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

  // --- 3. VIDEO ID ---
  const videoId = useMemo(() => {
    const matchUrl = match?.meta?.liveStreamUrl || match?.meta?.liveStreamId;
    const globalUrl = tournament?.liveStreamUrl || tournament?.broadcastUrl;
    return getYouTubeId(matchUrl) || getYouTubeId(globalUrl);
  }, [match, tournament]);

  // --- 4. TEAM LOGIC ---
  const { battingFirstTeam, battingSecondTeam } = useMemo(() => {
    if (!match || !match.meta)
      return { battingFirstTeam: "", battingSecondTeam: "" };

    const inn1 =
      match.innings?.[0] || (match.innings && Object.values(match.innings)[0]);

    if (inn1 && inn1.battingTeam) {
      const first = inn1.battingTeam;
      const second =
        first === match.meta.teamA ? match.meta.teamB : match.meta.teamA;
      return { battingFirstTeam: first, battingSecondTeam: second };
    }

    const tossWinner = match.meta.toss?.winner;
    const decision = match.meta.toss?.decision;

    if (tossWinner && decision) {
      const otherTeam =
        tossWinner === match.meta.teamA ? match.meta.teamB : match.meta.teamA;
      if (decision === "Bat") {
        return { battingFirstTeam: tossWinner, battingSecondTeam: otherTeam };
      } else {
        return { battingFirstTeam: otherTeam, battingSecondTeam: tossWinner };
      }
    }

    return {
      battingFirstTeam: match.meta.teamA,
      battingSecondTeam: match.meta.teamB,
    };
  }, [match]);

  // --- 5. TABS ---
  const tabs = useMemo(() => {
    const list = [
      { id: "scorecard", label: "Scorecard" },
      { id: "commentary", label: "Timeline" },
      { id: "info", label: "Match Info" },
    ];
    if (videoId) {
      list.unshift({ id: "stream", label: "🔴 Live Stream" });
    }
    return list;
  }, [videoId]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // --- RENDER STATES ---
  if (loading)
    return (
      <div
        className={`min-h-screen flex items-center justify-center font-bold tracking-widest uppercase text-sm ${lightMode ? "bg-slate-50 text-teal-600" : "bg-slate-950 text-teal-500"}`}>
        Loading Arena...
      </div>
    );

  if (error)
    return (
      <div
        className={`min-h-screen flex items-center justify-center font-bold ${lightMode ? "bg-slate-50 text-rose-600" : "bg-slate-950 text-rose-500"}`}>
        {error}
      </div>
    );

  if (!match) return null;

  const matchTitle = battingFirstTeam
    ? `${battingFirstTeam} vs ${battingSecondTeam}`
    : "Live Match";
  const isLive = ["ongoing", "live", "in-progress"].includes(
    (match.status || "").toLowerCase(),
  );

  return (
    <div
      className={`min-h-screen font-sans pb-32 transition-colors duration-300 ${lightMode ? "bg-slate-50 text-slate-800" : "bg-slate-950 text-slate-300"}`}>
      {/* HEADER */}
      <div
        className={`sticky top-0 z-[100] backdrop-blur-md border-b transition-colors duration-300 ${
          lightMode
            ? "bg-white/80 border-slate-200 shadow-sm"
            : "bg-slate-900/80 border-slate-800"
        }`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to={`/tournaments/${tournamentId}`}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 border ${
              lightMode
                ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            }`}>
            ←
          </Link>

          <div className="flex flex-col items-center">
            <h1
              className={`text-[11px] font-black uppercase tracking-[0.15em] truncate max-w-[180px] sm:max-w-md italic ${lightMode ? "text-slate-800" : "text-slate-200"}`}>
              {matchTitle}
            </h1>
            {isLive ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-pulse ${lightMode ? "bg-rose-600" : "bg-rose-500"}`}></span>
                <span
                  className={`text-[9px] font-black uppercase tracking-widest ${lightMode ? "text-rose-600" : "text-rose-500"}`}>
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
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${refreshing ? "animate-spin" : ""} ${
              lightMode
                ? "bg-teal-50 border-teal-100 text-teal-600"
                : "bg-teal-500/10 border-teal-500/20 text-teal-500"
            }`}>
            ↻
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <ScoreSummary match={match} />
        </div>

        {/* TAB NAVIGATION */}
        <div
          className={`p-1 rounded-2xl flex gap-1 shadow-lg max-w-lg mx-auto sticky top-20 z-50 backdrop-blur-md overflow-x-auto no-scrollbar border ${
            lightMode
              ? "bg-white border-slate-200 shadow-slate-200/50"
              : "bg-slate-900 border-slate-800 shadow-black/50"
          }`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-tighter whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-teal-600 text-white shadow-md"
                  : lightMode
                    ? "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 min-h-[500px]">
          {/* STREAM TAB */}
          {activeTab === "stream" && videoId && (
            <div
              className={`w-full aspect-video rounded-2xl overflow-hidden shadow-2xl relative border ${
                lightMode
                  ? "bg-black border-slate-200"
                  : "bg-black border-slate-800"
              }`}>
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1`}
                title="Live Match Stream"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen></iframe>
              {match?.meta?.liveStreamUrl ? null : (
                <div className="absolute top-2 left-2 bg-rose-600 text-white text-[8px] font-bold px-2 py-1 rounded shadow">
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

      {/* Footer Gradient Fade */}
      <div
        className={`fixed bottom-0 left-0 w-full h-32 pointer-events-none z-0 bg-gradient-to-t ${
          lightMode
            ? "from-slate-50 to-transparent"
            : "from-slate-950 to-transparent"
        }`}></div>
    </div>
  );
}
