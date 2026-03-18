import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import OverlayController from "./OverlayController";
import { ArrowLeft, Loader2, MonitorPlay, Globe } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function OverlayControllerWrapper() {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;

    let unsubscribe;

    // 🔥 MODE 1: GLOBAL TOURNAMENT MODE (No specific match ID in URL)
    if (!matchId) {
      // Just verify the tournament exists so we don't render blindly
      getDoc(doc(db, "tournaments", tournamentId)).then(() => {
        setMatchData(null); // Explicitly null for global mode
        setLoading(false);
      });
      return;
    }

    // 🔥 MODE 2: AUTO-DETECT MODE
    if (matchId === "active") {
      const matchesRef = collection(db, "tournaments", tournamentId, "matches");

      unsubscribe = onSnapshot(matchesRef, (snapshot) => {
        const matches = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const getStatus = (m) =>
          (m.status || m.meta?.status || "").toLowerCase().trim();

        // 1. Look for an ongoing match
        let activeMatch = matches.find((m) =>
          ["live", "ongoing", "in-progress", "started", "playing"].includes(
            getStatus(m),
          ),
        );

        // 2. Look for the next scheduled match
        if (!activeMatch) {
          activeMatch = matches
            .filter((m) =>
              ["upcoming", "scheduled", "pending", "not started", ""].includes(
                getStatus(m),
              ),
            )
            .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0];
        }

        setMatchData(activeMatch || null); // If null, it gracefully falls back to Global Mode
        setLoading(false);
      });
    }
    // 🔥 MODE 3: MANUAL OVERRIDE (Specific Match ID)
    else {
      const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
      unsubscribe = onSnapshot(matchRef, (docSnap) => {
        if (docSnap.exists()) {
          setMatchData({ id: docSnap.id, ...docSnap.data() });
        } else {
          setMatchData(null);
        }
        setLoading(false);
      });
    }

    return () => unsubscribe && unsubscribe();
  }, [tournamentId, matchId]);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  // If a specific match ID was given in the URL (not 'active') but it doesn't exist
  if (!matchData && matchId && matchId !== "active") {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center ${theme.bg} ${theme.text}`}>
        <h2 className="text-2xl font-bold mb-4">Match Not Found</h2>
        <button
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          className="text-teal-500 underline">
          Return to Dashboard
        </button>
      </div>
    );
  }

  // 🧠 THE MAGIC: If no match data is found, we use "global" as the ID.
  // This allows the OverlayController to save ads/settings to `matches/global/overlays`
  const resolvedMatchId = matchData?.id || "global";

  // Dummy data so the OverlayController doesn't crash if it expects team names to exist
  const safeMatchData = matchData || {
    id: "global",
    teamA: "Team A",
    teamB: "Team B",
    meta: { teamA: "Team A", teamB: "Team B" },
  };

  return (
    <div className={`min-h-screen ${theme.bg} p-4 md:p-8`}>
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation & Status Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() =>
              navigate(
                matchData
                  ? `/live/${tournamentId}/${matchData.id}`
                  : `/tournaments/${tournamentId}`,
              )
            }
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all w-fit ${
              lightMode
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}>
            <ArrowLeft size={16} />{" "}
            {matchData ? "Back to Live Scoring" : "Back to Tournament"}
          </button>

          {/* Dynamic Status Badge */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm ${
              matchData
                ? lightMode
                  ? "bg-teal-50 border-teal-200 text-teal-700"
                  : "bg-teal-900/20 border-teal-500/30 text-teal-400"
                : lightMode
                  ? "bg-purple-50 border-purple-200 text-purple-700"
                  : "bg-purple-900/20 border-purple-500/30 text-purple-400"
            }`}>
            {matchData ? <MonitorPlay size={16} /> : <Globe size={16} />}
            <span className="text-[10px] font-black uppercase tracking-widest">
              {matchData
                ? `Controlling: ${matchData.teamA || matchData.meta?.teamA || "Team A"} vs ${matchData.teamB || matchData.meta?.teamB || "Team B"}`
                : "Global Tournament Mode"}
            </span>
          </div>
        </div>

        {/* 🟢 Passing the resolved ID and safe data down to the controller */}
        <OverlayController
          tournamentId={tournamentId}
          matchId={resolvedMatchId}
          match={safeMatchData}
        />
      </div>
    </div>
  );
}
