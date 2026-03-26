import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import {
  Trash2,
  ExternalLink,
  Settings,
  Shield,
  Clock,
  MapPin,
} from "lucide-react";
import { getManOfTheMatch } from "../../utils/statsHelper";

export default function MatchCard({
  match,
  teams = [],
  tournamentId,
  canEdit,
  onOpenCorrection,
}) {
  const navigate = useNavigate();

  // 🟢 We drop lightMode entirely and rely purely on the dynamic theme engine
  const { theme } = useTheme();

  // Safely fallback to default classes if a theme isn't fully loaded yet
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";
  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const accentText = theme?.accentText || "text-cyan-400";
  const gradientBtn = theme?.gradient || "from-cyan-600 to-blue-600";

  // --- DELETE HANDLER ---
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete this match?`)) return;
    try {
      await deleteDoc(
        doc(db, "tournaments", tournamentId, "matches", match.id),
      );
    } catch (error) {
      console.error("Error deleting match:", error);
      alert("Failed to delete match.");
    }
  };

  // --- 1. BASIC DATA EXTRACTION ---
  const meta = match.meta || {};
  const venue = match.venue || meta.venue || "Venue TBA";

  const teamAName = match.teamA || meta.teamA || "Team A";
  const teamBName = match.teamB || meta.teamB || "Team B";
  const teamAId = match.teamAId || meta.teamAId;
  const teamBId = match.teamBId || meta.teamBId;

  // --- 2. IDENTIFICATION ---
  const bracketId =
    meta.bracketMatchId ||
    (match.id.startsWith("BRACKET-") ? match.id.replace("BRACKET-", "") : null);
  const displayTitle =
    match.matchTitle || meta.matchTitle || `Match ${match.matchNo || ""}`;

  // --- 3. DATE & TIME FORMATTING ---
  const rawDate = match.date || meta.date;
  const rawTime = match.time || meta.time;

  let formattedDate = "";
  let formattedTime = "";

  if (rawDate) {
    try {
      const dateObj = new Date(rawDate);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch (e) {}
  }

  if (rawTime) {
    try {
      const [hours, minutes] = rawTime.split(":");
      const timeObj = new Date();
      timeObj.setHours(parseInt(hours), parseInt(minutes));
      formattedTime = timeObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      formattedTime = rawTime;
    }
  }

  // --- 4. LOGO LOOKUP ---
  const tA = teams.find(
    (t) =>
      (teamAId && t.id === teamAId) ||
      t.name?.trim().toLowerCase() === teamAName?.trim().toLowerCase(),
  );
  const tB = teams.find(
    (t) =>
      (teamBId && t.id === teamBId) ||
      t.name?.trim().toLowerCase() === teamBName?.trim().toLowerCase(),
  );

  const logoA =
    tA?.logoUrl || tA?.logo || tA?.image || match.teamALogo || meta.teamALogo;
  const logoB =
    tB?.logoUrl || tB?.logo || tB?.image || match.teamBLogo || meta.teamBLogo;

  // --- 5. STATUS & SCORES ---
  const status = (match?.status || "upcoming").toLowerCase();
  const isLive = ["in-progress", "ongoing", "live"].includes(status);
  const isFinished = ["finished", "completed"].includes(status);

  const getTeamScore = (teamName) => {
    if (!match.innings) return null;
    const inn = match.innings.find(
      (i) => i?.battingTeam?.trim() === teamName?.trim(),
    );
    if (!inn) return null;
    return {
      runs: inn.score || 0,
      wickets: inn.wickets || 0,
      overs: `${inn.over || 0}.${inn.overBallCount || 0}`,
    };
  };

  const scoreA = getTeamScore(teamAName);
  const scoreB = getTeamScore(teamBName);

  // --- 6. FOOTER LOGIC ---
  let footerText = "";
  let footerColorClass = textSub;

  const mom = useMemo(
    () =>
      isFinished ? match.mom || meta.mom || getManOfTheMatch(match) : null,
    [match, isFinished, meta.mom],
  );
  const momName = useMemo(() => {
    if (!mom) return "";
    if (typeof mom === "object") return mom.name || mom.playerName || "";
    return String(mom).trim();
  }, [mom]);

  if (isFinished) {
    let resultText = match.winner || "Match Ended";
    if (match.innings && match.innings.length >= 2) {
      const [inn1, inn2] = match.innings;
      if (inn1 && inn2) {
        if (inn1.score > inn2.score)
          resultText = `${inn1.battingTeam} won by ${inn1.score - inn2.score} runs`;
        else if (inn2.score > inn1.score) {
          const totalWickets = parseInt(meta.totalWickets || 10);
          resultText = `${inn2.battingTeam} won by ${Math.max(0, totalWickets - inn2.wickets)} wickets`;
        } else resultText = "Match Tied";
      }
    }
    footerText = momName ? `${resultText} • MOM: ${momName}` : resultText;
    footerColorClass = accentText; // 🟢 Adapts to theme's accent color
  } else if (isLive) {
    footerText = "Match is underway";
    footerColorClass = "text-amber-500 font-black tracking-widest uppercase";
  } else {
    footerText = formattedTime
      ? `Starts at ${formattedTime}`
      : "Scheduled Match";
    footerColorClass = textSub;
  }

  return (
    <div
      onClick={() =>
        navigate(`/tournaments/${tournamentId}/scorecard/${match.id}`)
      }
      // 🟢 Premium Glassmorphism Card Wrapper
      className={`group flex flex-col rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer ${cardBg}`}>
      {/* HEADER */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-white/5 bg-black/10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          {bracketId && (
            <span
              className={`bg-gradient-to-r ${gradientBtn} text-white text-[9px] font-black px-2 py-0.5 rounded shadow-md shrink-0`}>
              {bracketId}
            </span>
          )}
          <span
            className={`text-[10px] md:text-xs font-black truncate uppercase tracking-wider ${textMain}`}>
            {displayTitle}
          </span>
          <span
            className={`flex items-center gap-1 text-[10px] md:text-xs font-medium ${textSub}`}>
            <MapPin size={10} className={accentText} /> {venue}
          </span>
          {formattedDate && (
            <span
              className={`flex items-center gap-1 text-[10px] md:text-xs font-medium ${textSub}`}>
              <Clock size={10} /> {formattedDate}
            </span>
          )}
        </div>

        {isLive && (
          <span className="shrink-0 flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Live
          </span>
        )}
      </div>

      {/* BODY */}
      <div className="flex flex-col gap-5 px-5 py-5">
        {/* TEAM A ROW */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center overflow-hidden border border-white/10 bg-black/20 shadow-inner p-1">
              {logoA ? (
                <img
                  src={logoA}
                  className="w-full h-full object-contain drop-shadow-md"
                  alt={teamAName}
                />
              ) : (
                <Shield size={18} className="text-white/20" />
              )}
            </div>
            <span
              className={`text-sm md:text-base font-black leading-snug break-words tracking-wide ${textMain}`}>
              {teamAName}
            </span>
          </div>
          <div className="shrink-0 text-right flex items-baseline gap-1.5">
            {scoreA ? (
              <>
                <span
                  className={`text-lg md:text-xl font-black font-mono leading-none ${textMain}`}>
                  {scoreA.runs}
                  <span className={`text-sm md:text-base ${textSub}`}>
                    /{scoreA.wickets}
                  </span>
                </span>
                <span
                  className={`text-[10px] md:text-xs font-mono font-bold ${textSub}`}>
                  ({scoreA.overs})
                </span>
              </>
            ) : (
              <span
                className={`text-xs italic font-medium ${textSub} opacity-50`}>
                Yet to bat
              </span>
            )}
          </div>
        </div>

        {/* TEAM B ROW */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center overflow-hidden border border-white/10 bg-black/20 shadow-inner p-1">
              {logoB ? (
                <img
                  src={logoB}
                  className="w-full h-full object-contain drop-shadow-md"
                  alt={teamBName}
                />
              ) : (
                <Shield size={18} className="text-white/20" />
              )}
            </div>
            <span
              className={`text-sm md:text-base font-black leading-snug break-words tracking-wide ${textMain}`}>
              {teamBName}
            </span>
          </div>
          <div className="shrink-0 text-right flex items-baseline gap-1.5">
            {scoreB ? (
              <>
                <span
                  className={`text-lg md:text-xl font-black font-mono leading-none ${textMain}`}>
                  {scoreB.runs}
                  <span className={`text-sm md:text-base ${textSub}`}>
                    /{scoreB.wickets}
                  </span>
                </span>
                <span
                  className={`text-[10px] md:text-xs font-mono font-bold ${textSub}`}>
                  ({scoreB.overs})
                </span>
              </>
            ) : (
              <span
                className={`text-xs italic font-medium ${textSub} opacity-50`}>
                Yet to bat
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-5 py-3 border-t border-white/5 bg-black/10">
        <p
          className={`text-[10px] md:text-xs font-bold tracking-wide break-words leading-tight ${footerColorClass}`}>
          {footerText}
        </p>
      </div>

      {/* ADMIN ACTIONS */}
      {canEdit && (
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-t border-white/5 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl hover:bg-red-500/20 text-red-500 transition-colors"
              title="Delete Match">
              <Trash2 size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCorrection(match);
              }}
              className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Match Settings">
              <Settings size={16} />
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/live/${tournamentId}/${match.id}`);
            }}
            // 🟢 Uses the Theme's specific gradient
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 text-white bg-gradient-to-r ${gradientBtn}`}>
            Scoring Board <ExternalLink size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
