import React from "react";
import { useNavigate } from "react-router-dom";

export default function MatchCard({ match, tournamentId, canEdit }) {
  const navigate = useNavigate();

  // --- SAFETY CHECKS ---
  const status = match?.status || match?.meta?.status || "upcoming";
  const normStatus = status.toLowerCase();

  const isLive = ["in-progress", "ongoing", "live"].includes(normStatus);
  const isFinished = ["finished", "completed"].includes(normStatus);

  // Safe access to innings
  const innings = match?.innings || [];
  // Calculate result text safely
  let resultText = "Match not started";
  if (isFinished) {
    resultText = `🏆 ${match.winner || match.meta?.winner || "Result TBA"}`;
  } else if (isLive) {
    const currentInningIndex = match.currentInnings || 0;
    const currentInning = innings[currentInningIndex];
    if (currentInning) {
      resultText = `${currentInning.battingTeam} Batting - ${currentInning.score}/${currentInning.wickets} (${currentInning.over}.${currentInning.overBallCount})`;
    } else {
      resultText = "Toss Done - Play starting soon";
    }
  }

  return (
    <div
      onClick={() =>
        navigate(`/tournaments/${tournamentId}/scorecard/${match.id}`)
      }
      className={`group relative bg-gray-900 border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        isLive
          ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          : "border-gray-800 hover:border-gray-600"
      }`}>
      {/* Abstract Gradient Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>

      {/* Status Badge */}
      <div className="absolute top-3 right-3">
        {isLive && (
          <span className="flex items-center gap-1.5 text-[10px] font-black text-white bg-red-600 px-2 py-1 rounded-full shadow-lg shadow-red-600/40 animate-pulse">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
          </span>
        )}
        {isFinished && (
          <span className="text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded-full border border-green-900/50">
            FINISHED
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col h-full">
        {/* Meta Info */}
        <div className="text-xs font-mono text-gray-500 mb-4 flex items-center gap-2">
          <span>{match.date || "Date TBA"}</span>
          <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
          <span>{match.meta?.overs ? `${match.meta.overs} Ov` : "LO"}</span>
        </div>

        {/* Teams */}
        <div className="flex flex-col gap-3 flex-1 justify-center">
          <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform duration-300">
            <span className="text-lg font-bold text-white leading-tight">
              {match.meta?.teamA || match.teamA || "Team A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-600 bg-gray-800 px-1.5 rounded">
              VS
            </span>
            <div className="h-px bg-gray-800 flex-1"></div>
          </div>
          <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform duration-300 delay-75">
            <span className="text-lg font-bold text-white leading-tight">
              {match.meta?.teamB || match.teamB || "Team B"}
            </span>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="mt-5 pt-3 border-t border-gray-800/50 min-h-[30px] flex items-end justify-between">
          <div
            className={`text-xs font-medium truncate max-w-[70%] ${
              isFinished ? "text-green-400/90" : "text-gray-600 italic"
            }`}>
            {resultText}
          </div>

          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/live/${tournamentId}/${match.id}`);
              }}
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all ${
                isLive
                  ? "bg-red-600 text-white hover:bg-red-500 shadow-md"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
              }`}>
              {isLive ? "Scoring..." : "Manage"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
