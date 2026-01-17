import React from "react";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../utils/firebase"; // Double check this path matches your folder structure

export default function MatchCard({ match, teams, tournamentId, canEdit }) {
  const navigate = useNavigate();

  // --- DELETE HANDLER ---
  const handleDelete = async (e) => {
    e.stopPropagation(); // 🛑 Stop the card from opening
    if (
      !window.confirm(
        `Are you sure you want to delete the match:\n${match.teamA} vs ${match.teamB}?`
      )
    )
      return;

    try {
      await deleteDoc(
        doc(db, "tournaments", tournamentId, "matches", match.id)
      );
    } catch (error) {
      console.error("Error deleting match:", error);
      alert("Failed to delete match.");
    }
  };

  // --- DATA EXTRACTION ---
  const meta = match.meta || {};

  // ✅ FIX: Extract Venue Here
  const venue = match.venue || meta.venue;

  // 1. Team Names
  const teamAName = match.teamA || meta.teamA || "Team A";
  const teamBName = match.teamB || meta.teamB || "Team B";

  // 2. Format Date & Time
  const rawDate = match.date || meta.date;
  const rawTime = match.time || meta.time;

  let formattedDateTime = "TBA";

  if (rawDate) {
    const dateObj = new Date(rawDate);
    const datePart = dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

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
  const displayId =
    match.matchTitle ||
    meta.matchTitle ||
    `#${match.matchNo || match.id.substring(0, 4)}`;
  const overs = match.overs || meta.overs || "T20";

  // --- LOGO LOOKUP ---
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
      {/* Top Bar */}
      <div className="px-6 py-3 bg-[#0F1115]/50 flex justify-between items-center border-b border-white/5">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 truncate max-w-[60%]">
          <span className="bg-white/10 text-slate-300 px-1.5 py-0.5 rounded truncate">
            {displayId}
          </span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">{overs} Overs</span>
        </span>

        <div className="flex items-center gap-2">
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
      </div>

      <div className="p-8">
        <div className="flex items-center justify-between gap-4">
          {/* Team A */}
          <div className="flex flex-col items-center gap-3 flex-1 text-center">
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
            <span className="text-[10px] font-bold text-teal-600">
              {formattedDateTime}
            </span>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-3 flex-1 text-center">
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

        {/* Status Message */}
        <div className="mt-6 text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {isFinished
              ? `🏆 ${match.winner || "Match Ended"}`
              : venue || "TBA"}
          </p>
        </div>
      </div>

      {/* ADMIN FOOTER */}
      {canEdit && (
        <div className="p-3 bg-[#0F1115]/30 border-t border-white/5 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
            🗑 Delete
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/live/${tournamentId}/${match.id}`);
            }}
            className="flex-[2] bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 border border-teal-500/20 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">
            Scorer Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
