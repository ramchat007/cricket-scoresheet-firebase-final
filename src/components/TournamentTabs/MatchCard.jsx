import React, { useMemo } from "react"; // 🟢 Added useMemo
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import {
  Trash2,
  ExternalLink,
  Trophy,
  Swords,
  Clock,
  MapPin,
<<<<<<< HEAD
  Settings,
=======
  Sparkles, // 🟢 Added Sparkles
>>>>>>> 964b336b6c26fb7935e5d817317db01628ea322e
} from "lucide-react";
import { getManOfTheMatch } from "../../utils/statsHelper";

export default function MatchCard({ match, teams, tournamentId, canEdit, onOpenCorrection }) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

  // --- DELETE HANDLER ---
  const handleDelete = async (e) => {
    e.stopPropagation(); // 🛑 Stop the card from opening
    if (
      !window.confirm(
        `Are you sure you want to delete the match:\n${match.teamA} vs ${match.teamB}?`,
      )
    )
      return;

    try {
      await deleteDoc(
        doc(db, "tournaments", tournamentId, "matches", match.id),
      );
    } catch (error) {
      console.error("Error deleting match:", error);
      alert("Failed to delete match.");
    }
  };

  // --- DATA EXTRACTION ---
  const meta = match.meta || {};
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


  const mom = useMemo(() => {
    if (!isFinished) return null;
    // If the match already has a hardcoded MOM, use it, otherwise calculate from stats
    return match.mom || meta.mom || getManOfTheMatch(match);
  }, [match, isFinished, meta.mom]);

  // Helper to extract name safely
  const momName = useMemo(() => {
    if (!mom) return "";
    if (typeof mom === "object") return mom.name || mom.playerName || "";
    return String(mom).trim();
  }, [mom]);
  // --- 🧠 CALCULATE RESULT CONTEXT ---
  let resultText = match.winner || "Match Ended"; // Default fallback

  if (isFinished && match.innings && match.innings.length >= 2) {
    const inn1 = match.innings[0];
    const inn2 = match.innings[1];

    if (inn1 && inn2) {
      if (inn1.score > inn2.score) {
        const diff = inn1.score - inn2.score;
        resultText = `${inn1.battingTeam} won by ${diff} run${diff !== 1 ? "s" : ""}`;
      } else if (inn2.score > inn1.score) {
        const totalWickets = parseInt(meta.totalWickets || 10);
        const diff = Math.max(0, totalWickets - inn2.wickets);
        resultText = `${inn2.battingTeam} won by ${diff} wicket${diff !== 1 ? "s" : ""}`;
      } else {
        resultText = "Match Tied";
      }
    }
  } else if (match.meta?.result) {
    // If backend stored a computed result string
    resultText = match.meta.result;
  }

  return (
    <div
      onClick={() =>
        navigate(`/tournaments/${tournamentId}/scorecard/${match.id}`)
      }
      className={`group border rounded-[2rem] overflow-hidden transition-all duration-300 hover:scale-[1.01] cursor-pointer shadow-lg hover:shadow-xl ${
        isLive
          ? lightMode
            ? "bg-white border-red-500 shadow-red-100"
            : "bg-[#1C2128] border-red-500/50 shadow-red-900/20"
          : `${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`
      }`}>
      {/* Top Bar */}
      <div
        className={`px-6 py-3 flex justify-between items-center border-b ${
          lightMode
            ? "bg-gray-50 border-gray-200"
            : "bg-[#0F1115]/50 border-white/5"
        }`}>
        <span
          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 truncate max-w-[60%] ${theme.sub}`}>
          <span
            className={`px-1.5 py-0.5 rounded truncate ${lightMode ? "bg-white border border-gray-200" : "bg-white/10 text-slate-300"}`}>
            {displayId}
          </span>
          <span className="shrink-0 text-gray-400">•</span>
          <span className="shrink-0">{overs} Overs</span>
        </span>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${
              isLive
                ? "bg-red-600 text-white animate-pulse border-red-600"
                : isFinished
                  ? lightMode
                    ? "bg-teal-50 text-teal-600 border-teal-200"
                    : "bg-teal-500/10 text-teal-500 border-teal-500/20"
                  : lightMode
                    ? "bg-gray-200 text-gray-600 border-gray-300"
                    : "bg-white/10 text-slate-400 border-white/10"
            }`}>
            {statusText}
          </span>

          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // 🟢 Prevent navigating to scorecard
                onOpenCorrection(match); // 🟢 Open the Emergency Console
              }}
              className={`p-2 rounded-lg transition-all ${
                lightMode
                  ? "hover:bg-gray-200 text-gray-600"
                  : "hover:bg-white/10 text-slate-400"
              }`}
              title="Match Settings & Resolution">
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-8">
        <div className="flex items-center justify-between gap-4">
          {/* Team A */}
          <div className="flex flex-col items-center gap-3 flex-1 text-center">
            <div
              className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl p-2 overflow-hidden border flex items-center justify-center shadow-inner group-hover:rotate-[-5deg] transition-transform ${
                lightMode
                  ? "bg-white border-gray-200"
                  : "bg-[#0F1115] border-white/5"
              }`}>
              {logoA ? (
                <img
                  src={logoA}
                  className="w-full h-full object-contain"
                  alt={teamAName}
                />
              ) : (
                <Swords size={32} className="text-gray-400 opacity-50" />
              )}
            </div>
            <h4
              className={`text-sm md:text-base font-black uppercase tracking-tighter leading-tight break-words w-full ${theme.text}`}>
              {teamAName}
            </h4>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col items-center gap-2">
            <span
              className={`text-[10px] font-black px-2 py-1 rounded border italic ${
                lightMode
                  ? "bg-gray-100 text-gray-500 border-gray-200"
                  : "bg-[#0F1115] text-slate-600 border-white/5"
              }`}>
              VS
            </span>
            <span
              className={`text-[10px] font-bold flex items-center gap-1 ${lightMode ? "text-teal-600" : "text-teal-500"}`}>
              <Clock size={10} />
              {formattedDateTime}
            </span>
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-3 flex-1 text-center">
            <div
              className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl p-2 overflow-hidden border flex items-center justify-center shadow-inner group-hover:rotate-[5deg] transition-transform ${
                lightMode
                  ? "bg-white border-gray-200"
                  : "bg-[#0F1115] border-white/5"
              }`}>
              {logoB ? (
                <img
                  src={logoB}
                  className="w-full h-full object-contain"
                  alt={teamBName}
                />
              ) : (
                <Swords
                  size={32}
                  className="text-gray-400 opacity-50 scale-x-[-1]"
                />
              )}
            </div>
            <h4
              className={`text-sm md:text-base font-black uppercase tracking-tighter leading-tight break-words w-full ${theme.text}`}>
              {teamBName}
            </h4>
          </div>
        </div>

        {/* Status Message (Updated with Calculated Result) */}
        <div className="mt-6 text-center space-y-3">
          {/* 🟢 NEW: Player of the Match Badge */}
          {isFinished && momName && (
            <div className="animate-in fade-in zoom-in duration-700">
               <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm ${
                 lightMode 
                   ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                   : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
               }`}>
                 <Sparkles size={12} className="text-indigo-500" />
                 <span className="text-[10px] font-black uppercase tracking-tighter">
                   MOM: {momName}
                 </span>
               </div>
            </div>
          )}

          <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 ${theme.sub}`}>
            {isFinished ? (
              <>
                <Trophy size={12} className="text-amber-500" />
                <span className={lightMode ? "text-amber-600" : "text-amber-400"}>
                  {resultText}
                </span>
              </>
            ) : (
              <>
                <MapPin size={12} />
                {venue || "Venue TBA"}
              </>
            )}
          </p>
        </div>
      </div>

      {/* ADMIN FOOTER */}
      {canEdit && (
        <div
          className={`p-3 border-t flex items-center justify-between gap-3 ${
            lightMode
              ? "bg-gray-50 border-gray-200"
              : "bg-[#0F1115]/30 border-white/5"
          }`}>
          <button
            onClick={handleDelete}
            className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border flex items-center justify-center gap-2 ${
              lightMode
                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
            }`}>
            <Trash2 size={12} /> Delete
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/live/${tournamentId}/${match.id}`);
            }}
            className={`flex-[2] py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border flex items-center justify-center gap-2 ${
              lightMode
                ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                : "bg-teal-500/10 text-teal-500 border-teal-500/20 hover:bg-teal-500/20"
            }`}>
            Scorer Dashboard <ExternalLink size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
