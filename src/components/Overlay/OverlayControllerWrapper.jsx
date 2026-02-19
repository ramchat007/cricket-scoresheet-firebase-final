import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import OverlayController from "./OverlayController";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function OverlayControllerWrapper() {
  const { tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();
  const [matchData, setMatchData] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "tournaments", tournamentId, "matches", matchId),
      (docSnap) => {
        if (docSnap.exists()) {
          setMatchData(docSnap.data());
        }
      },
    );
    return () => unsub();
  }, [tournamentId, matchId]);

  if (!matchData) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} p-4 md:p-8`}>
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(`/live/${tournamentId}/${matchId}`)}
          className={`mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
            lightMode
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-white/10 text-slate-300 hover:bg-white/20"
          }`}>
          <ArrowLeft size={16} /> Back to Live Scoring
        </button>

        {/* ✅ PASSING THE FULL MATCH OBJECT HERE */}
        <OverlayController
          tournamentId={tournamentId}
          matchId={matchId}
          match={matchData}
        />
      </div>
    </div>
  );
}
