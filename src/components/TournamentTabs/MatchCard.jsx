import React from "react";
import { useNavigate } from "react-router-dom";

export default function MatchCard({ match, teams, tournamentId, canEdit }) {
  const navigate = useNavigate();

  // Find Team Logos
  const teamAData = teams.find(
    (t) => t.name === (match.teamA || match.meta?.teamA)
  );
  const teamBData = teams.find(
    (t) => t.name === (match.teamB || match.meta?.teamB)
  );

  const status = (match?.status || "upcoming").toLowerCase();
  const isLive = ["in-progress", "ongoing", "live"].includes(status);
  const isFinished = ["finished", "completed"].includes(status);

  let statusText = isLive ? "Live" : isFinished ? "Finished" : "Upcoming";

  return (
    <div
      onClick={() =>
        navigate(`/tournaments/${tournamentId}/scorecard/${match.id}`)
      }
      className={`group bg-[#1C2128] border-2 rounded-[2rem] overflow-hidden transition-all duration-300 hover:scale-[1.01] cursor-pointer ${
        isLive
          ? "border-red-500/30 shadow-lg shadow-red-900/10"
          : "border-white/5"
      }`}>
      {/* Top Bar: Info & Status */}
      <div className="px-6 py-3 bg-[#0F1115]/50 flex justify-between items-center border-b border-white/5">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          {match.date || "Match Day"} • {match.meta?.overs || "T20"}
        </span>
        <span
          className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
            isLive
              ? "bg-red-600 text-white animate-pulse"
              : isFinished
              ? "bg-teal-500/10 text-teal-500"
              : "bg-white/10 text-slate-400"
          }`}>
          {statusText}
        </span>
      </div>

      <div className="p-8">
        <div className="flex items-center justify-between gap-4">
          {/* Team A */}
          <div className="flex flex-col items-center gap-3 flex-1 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0F1115] rounded-3xl p-3 border border-white/5 flex items-center justify-center shadow-inner group-hover:rotate-[-5deg] transition-transform">
              {teamAData?.logoURL ? (
                <img
                  src={teamAData.logoURL}
                  className="w-full h-full object-contain"
                  alt="Logo"
                />
              ) : (
                <span className="text-2xl">🛡️</span>
              )}
            </div>
            <h4 className="text-sm md:text-base font-black text-slate-200 uppercase tracking-tighter leading-tight">
              {match.teamA}
            </h4>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black text-slate-600 bg-[#0F1115] px-2 py-1 rounded border border-white/5 italic">
              VS
            </span>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-3 flex-1 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0F1115] rounded-3xl p-3 border border-white/5 flex items-center justify-center shadow-inner group-hover:rotate-[5deg] transition-transform">
              {teamBData?.logoURL ? (
                <img
                  src={teamBData.logoURL}
                  className="w-full h-full object-contain"
                  alt="Logo"
                />
              ) : (
                <span className="text-2xl">🛡️</span>
              )}
            </div>
            <h4 className="text-sm md:text-base font-black text-slate-200 uppercase tracking-tighter leading-tight">
              {match.teamB}
            </h4>
          </div>
        </div>

        {/* Scoring / Result Overlay */}
        <div className="mt-8 text-center">
          <div
            className={`py-3 px-6 rounded-2xl font-bold text-xs inline-block ${
              isLive
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : isFinished
                ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                : "bg-white/5 text-slate-500 border border-white/5 italic"
            }`}>
            {isFinished
              ? `🏆 ${match.winner} won`
              : isLive
              ? "View Live Scorecard"
              : "Preview Match"}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="p-4 bg-[#0F1115]/30 border-t border-white/5 flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/live/${tournamentId}/${match.id}`);
            }}
            className="text-[10px] font-black text-teal-500 uppercase tracking-widest hover:text-white transition-colors">
            Open Scorer Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
