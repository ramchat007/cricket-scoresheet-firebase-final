import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, onSnapshot, doc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import OverlayController from "./OverlayController";
import { ArrowLeft, Loader2, Radio } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function OverlayControllerWrapper() {
  const { tournamentId, matchId = "active" } = useParams();
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();
  
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;

    let unsubscribe;

    // 🔥 AUTO-DETECT MODE
    if (matchId === "active") {
      const matchesRef = collection(db, "tournaments", tournamentId, "matches");
      
      unsubscribe = onSnapshot(matchesRef, (snapshot) => {
        const matches = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const getStatus = (m) => (m.status || m.meta?.status || "").toLowerCase().trim();
        
        // 1. Bulletproof Active Match Check
        let activeMatch = matches.find((m) => {
          const status = getStatus(m);
          
          // Condition A: Matches specific keywords
          if (["live", "ongoing", "in-progress", "started", "playing", "running"].includes(status)) return true;
          
          // Condition B: Toss has happened, but the match isn't finished yet
          if (m.toss && !["completed", "finished", "abandoned", "result"].includes(status)) return true;
          
          return false;
        });

        // 2. If no ongoing match, look for the next scheduled/upcoming match
        if (!activeMatch) {
          activeMatch = matches
            .filter((m) => !m.toss && !["completed", "finished"].includes(getStatus(m)))
            .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0];
        }

        if (activeMatch) {
          setMatchData(activeMatch);
        } else {
          setMatchData(null); 
        }
        setLoading(false);
      });
    }
    // 🔥 MANUAL OVERRIDE MODE (Specific Match ID in URL)
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
      <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  // 🔥 STANDBY SCREEN: If looking for "active" but no matches are live/upcoming
  if (!matchData && matchId === "active") {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme.bg} ${theme.text} p-6 text-center`}>
        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 border-4 border-slate-700 shadow-2xl relative">
          <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin opacity-50"></div>
          <Radio size={40} className="text-teal-500 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-widest mb-2 text-white">Standby Mode</h2>
        <p className={`text-lg font-bold ${theme.sub} max-w-md`}>
          Waiting for the scorer to start the next match. This controller will automatically connect when a match goes live.
        </p>
        <button
          onClick={() => navigate(`/tournament/${tournamentId}`)}
          className="mt-8 px-6 py-3 bg-teal-600 text-white font-bold rounded-xl uppercase tracking-widest hover:bg-teal-500 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Fallback if manual ID is invalid
  if (!matchData) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${theme.bg} ${theme.text}`}>
        <h2 className="text-2xl font-bold mb-4">Match Not Found</h2>
        <button onClick={() => navigate(`/tournament/${tournamentId}`)} className="text-teal-500 underline">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} p-4 md:p-8`}>
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(`/live/${tournamentId}/${matchData.id}`)}
          className={`mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
            lightMode
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
        >
          <ArrowLeft size={16} /> Back to Live Scoring
        </button>

        {/* ✅ Passing the RESOLVED matchData.id, NOT the literal word "active" */}
        <OverlayController
          tournamentId={tournamentId}
          matchId={matchData.id} 
          match={matchData}
        />
      </div>
    </div>
  );
}