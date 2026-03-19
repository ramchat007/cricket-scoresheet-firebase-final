import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import { Trash2, ExternalLink, Settings, Shield } from "lucide-react";
import { getManOfTheMatch } from "../../utils/statsHelper";

export default function MatchCard({
  match,
  teams,
  tournamentId,
  canEdit,
  onOpenCorrection,
}) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

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

  // --- DATA EXTRACTION ---
  const meta = match.meta || {};
  const venue = match.venue || meta.venue || "Venue TBA";

  const teamAName = match.teamA || meta.teamA || "Team A";
  const teamBName = match.teamB || meta.teamB || "Team B";

  const teamAId = match.teamAId || meta.teamAId;
  const teamBId = match.teamBId || meta.teamBId;

  // --- DATE & TIME FORMATTING ---
  const rawDate = match.date || meta.date;
  const rawTime = match.time || meta.time;

  let formattedDate = "";
  let formattedTime = "";

  if (rawDate) {
    const dateObj = new Date(rawDate);
    formattedDate = dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (rawTime) {
    try {
      const [hours, minutes] = rawTime.split(":");
      const timeObj = new Date();
      timeObj.setHours(hours);
      timeObj.setMinutes(minutes);
      formattedTime = timeObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      formattedTime = rawTime;
    }
  }

  const displayId =
    match.matchTitle ||
    meta.matchTitle ||
    `Match ${match.matchNo || match.id.substring(0, 4)}`;

  // --- 🛡️ AGGRESSIVE LOGO LOOKUP (Fixed for Live Matches) ---
  // Always prioritize the master 'teams' array over the match document
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

  // --- STATUS CHECK ---
  const status = (match?.status || "upcoming").toLowerCase();
  const isLive = ["in-progress", "ongoing", "live"].includes(status);
  const isFinished = ["finished", "completed"].includes(status);

  // --- EXTRACT LIVE SCORES ---
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

  // --- CALCULATE FOOTER TEXT (Context Aware) ---
  let footerText = "";
  let footerColorClass = theme.sub; // default gray

  // 1. Toss Info
  let tossText = null;
  if (meta?.toss?.winner) {
    tossText = `${meta.toss.winner} elected to ${meta.toss.decision}`;
  }

  // 2. MOM Info
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

  // 3. Determine Final Footer String
  if (isFinished) {
    let resultText = match.winner || "Match Ended";
    if (match.innings && match.innings.length >= 2) {
      const [inn1, inn2] = match.innings;
      if (inn1 && inn2) {
        if (inn1.score > inn2.score) {
          resultText = `${inn1.battingTeam} won by ${inn1.score - inn2.score} runs`;
        } else if (inn2.score > inn1.score) {
          const totalWickets = parseInt(meta.totalWickets || 10);
          resultText = `${inn2.battingTeam} won by ${Math.max(0, totalWickets - inn2.wickets)} wickets`;
        } else {
          resultText = "Match Tied";
        }
      }
    } else if (match.meta?.result) {
      resultText = match.meta.result;
    }
    footerText = momName ? `${resultText} • MOM: ${momName}` : resultText;
    footerColorClass = lightMode ? "text-indigo-600" : "text-indigo-400";
  } else if (isLive) {
    footerText = tossText || "Match is underway";
    footerColorClass = lightMode ? "text-amber-600" : "text-amber-500";
  } else {
    footerText = tossText ? tossText : `Starts at ${formattedTime || "TBA"}`;
    footerColorClass = theme.sub;
  }

  return (
    <div
      onClick={() =>
        navigate(`/tournaments/${tournamentId}/scorecard/${match.id}`)
      }
      className={`group flex flex-col border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer ${
        lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"
      }`}>
      {/* 1. HEADER: Match Info (Settings removed, Live stays right) */}
      <div
        className={`px-4 py-2.5 flex justify-between items-center border-b ${lightMode ? "bg-gray-50/80 border-gray-100" : "bg-white/[0.02] border-white/5"}`}>
        <span
          className={`text-[10px] md:text-xs font-semibold truncate pr-2 ${theme.sub}`}>
          {displayId} • {venue} • {formattedDate}
        </span>
        {isLive && (
          <span className="shrink-0 flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 dark:bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            Live
          </span>
        )}
      </div>

      {/* 2. BODY: Teams & Scores */}
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* TEAM A ROW */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden border p-0.5 shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-black/40 border-white/10"}`}>
              {logoA ? (
                <img
                  src={logoA}
                  className="w-full h-full object-contain"
                  alt={teamAName}
                />
              ) : (
                <Shield size={16} className="text-gray-400" />
              )}
            </div>
            {/* REMOVED TRUNCATE - ALLOWS WRAPPING */}
            <span
              className={`text-sm md:text-base font-bold leading-snug break-words ${theme.text}`}>
              {teamAName}
            </span>
          </div>

          {/* TEAM A SCORE (Locked to the right) */}
          <div className="shrink-0 text-right flex items-baseline gap-1.5">
            {scoreA ? (
              <>
                <span
                  className={`text-base md:text-lg font-black font-mono leading-none ${theme.text}`}>
                  {scoreA.runs}
                  <span className="text-sm md:text-base opacity-60">
                    /{scoreA.wickets}
                  </span>
                </span>
                <span className={`text-[10px] md:text-xs font-mono opacity-60`}>
                  ({scoreA.overs})
                </span>
              </>
            ) : (
              <span
                className={`text-xs italic opacity-40 font-medium ${theme.sub}`}>
                Yet to bat
              </span>
            )}
          </div>
        </div>

        {/* TEAM B ROW */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden border p-0.5 shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-black/40 border-white/10"}`}>
              {logoB ? (
                <img
                  src={logoB}
                  className="w-full h-full object-contain"
                  alt={teamBName}
                />
              ) : (
                <Shield size={16} className="text-gray-400" />
              )}
            </div>
            {/* REMOVED TRUNCATE - ALLOWS WRAPPING */}
            <span
              className={`text-sm md:text-base font-bold leading-snug break-words ${theme.text}`}>
              {teamBName}
            </span>
          </div>

          {/* TEAM B SCORE (Locked to the right) */}
          <div className="shrink-0 text-right flex items-baseline gap-1.5">
            {scoreB ? (
              <>
                <span
                  className={`text-base md:text-lg font-black font-mono leading-none ${theme.text}`}>
                  {scoreB.runs}
                  <span className="text-sm md:text-base opacity-60">
                    /{scoreB.wickets}
                  </span>
                </span>
                <span className={`text-[10px] md:text-xs font-mono opacity-60`}>
                  ({scoreB.overs})
                </span>
              </>
            ) : (
              <span
                className={`text-xs italic opacity-40 font-medium ${theme.sub}`}>
                Yet to bat
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. STATUS FOOTER */}
      <div
        className={`px-4 py-2.5 border-t ${lightMode ? "bg-gray-50/50 border-gray-100" : "bg-white/[0.02] border-white/5"}`}>
        <p
          className={`text-[10px] md:text-xs font-bold tracking-wide break-words leading-tight ${footerColorClass}`}>
          {footerText}
        </p>
      </div>

      {/* 4. ADMIN QUICK ACTIONS (Settings moved here!) */}
      {canEdit && (
        <div
          className={`px-3 py-2 flex items-center justify-between gap-2 border-t ${lightMode ? "bg-gray-50 border-gray-100" : "bg-white/[0.02] border-white/5"}`}>
          {/* Left Side: Delete & Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 transition-colors"
              title="Delete Match">
              <Trash2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCorrection(match);
              }}
              className={`p-1.5 rounded-md transition-colors ${lightMode ? "hover:bg-gray-200 text-gray-500" : "hover:bg-white/10 text-gray-400"}`}
              title="Match Settings & Resolution">
              <Settings size={14} />
            </button>
          </div>

          {/* Right Side: Score Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/live/${tournamentId}/${match.id}`);
            }}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
              lightMode
                ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                : "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30"
            }`}>
            Scoring Board <ExternalLink size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
