import React from "react";
import { useNavigate } from "react-router-dom";

export default function MatchCard({ match, teams, tournamentId, canEdit }) {
  const navigate = useNavigate();

  // --- DATA EXTRACTION ---
  const meta = match.meta || {};

  // 1. Team Names
  const teamAName = match.teamA || meta.teamA || "Team A";
  const teamBName = match.teamB || meta.teamB || "Team B";

  // 2. Format Date & Time: "16 Jan 2026, 9.00 AM"
  const rawDate = match.date || meta.date;
  const rawTime = match.time || meta.time;

  let formattedDateTime = "TBA";

  if (rawDate) {
    // Format Date: "16 Jan 2026"
    const dateObj = new Date(rawDate);
    const datePart = dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // Format Time: "9.00 AM"
    let timePart = "";
    if (rawTime) {
      try {
        const [hours, minutes] = rawTime.split(":");
        const timeObj = new Date();
        timeObj.setHours(hours);
        timeObj.setMinutes(minutes);

        timePart = timeObj
          .toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          .replace(":", ".");
      } catch (e) {
        timePart = rawTime;
      }
    } else if (match.startAt || meta.startAt) {
      const startObj = new Date(match.startAt || meta.startAt);
      if (!isNaN(startObj)) {
        timePart = startObj
          .toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          .replace(":", ".");
      }
    }

    formattedDateTime = timePart ? `${datePart}, ${timePart}` : datePart;
  }

  // 3. Match Details
  const matchNo = match.matchNo || meta.matchNo || match.id.substring(0, 4);
  const overs = match.overs || meta.overs || "T20";

  // --- LOGO LOOKUP (Fallback if meta logos missing) ---
  // Ideally, meta.teamALogo is present. If not, look up from teams array.
  let logoA = meta.teamALogo;
  let logoB = meta.teamBLogo;

  if (!logoA) {
    const teamAData = teams.find((t) => t.name === teamAName);
    logoA = teamAData?.logoUrl;
  }
  if (!logoB) {
    const teamBData = teams.find((t) => t.name === teamBName);
    logoB = teamBData?.logoUrl;
  }

  // --- STATUS CHECK ---
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
      {/* Top Bar: Match Info */}
      <div className="px-6 py-3 bg-[#0F1115]/50 flex justify-between items-center border-b border-white/5">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
            #{matchNo}
          </span>
          <span>•</span>
          <span>{overs} Overs</span>
        </span>

        {/* Date & Time */}
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
          <span className="text-teal-500">{formattedDateTime}</span>
        </div>

        <span
          className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ml-2 ${
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
            {/* ✅ UPDATED: Added overflow-hidden and p-0 */}
            <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0F1115] rounded-3xl p-0 overflow-hidden border border-white/5 flex items-center justify-center shadow-inner group-hover:rotate-[-5deg] transition-transform">
              {logoA ? (
                <img
                  src={logoA}
                  className="w-full h-full object-contain"
                  alt={teamAName}
                />
              ) : (
                <span className="text-2xl">🛡️</span>
              )}
            </div>
            <h4 className="text-sm md:text-base font-black text-slate-200 uppercase tracking-tighter leading-tight break-words w-full">
              {teamAName}
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
            {/* ✅ UPDATED: Added overflow-hidden and p-0 */}
            <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0F1115] rounded-3xl p-0 overflow-hidden border border-white/5 flex items-center justify-center shadow-inner group-hover:rotate-[5deg] transition-transform">
              {logoB ? (
                <img
                  src={logoB}
                  className="w-full h-full object-contain"
                  alt={teamBName}
                />
              ) : (
                <span className="text-2xl">🛡️</span>
              )}
            </div>
            <h4 className="text-sm md:text-base font-black text-slate-200 uppercase tracking-tighter leading-tight break-words w-full">
              {teamBName}
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
              ? `🏆 ${match.winner || "Result Pending"}`
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
