import React from "react";
import MatchCard from "./MatchCard";
import { useTheme } from "../../context/ThemeContext";
import { CalendarX, Radio } from "lucide-react";

export default function MatchesTab({
  liveMatches = [],
  upcomingMatches = [],
  finishedMatches = [],
  tournamentTeams = [], // Passed from parent
  tournamentId,
  canEdit,
  onOpenCorrection,
}) {
  const { theme, lightMode } = useTheme();

  // --- SORTING HELPER ---
  const sortMatches = (list, direction = "asc") => {
    return [...list].sort((a, b) => {
      // 1. Extract Time (ISO String -> Timestamp)
      // Checks: meta.startAt -> root.startAt -> root.date -> default
      const timeA = new Date(
        a.meta?.startAt || a.startAt || a.date || 0,
      ).getTime();
      const timeB = new Date(
        b.meta?.startAt || b.startAt || b.date || 0,
      ).getTime();

      // 2. Extract Match Number
      const noA = Number(a.meta?.matchNo || a.matchNo || 0);
      const noB = Number(b.meta?.matchNo || b.matchNo || 0);

      if (direction === "asc") {
        // Ascending: Earliest Time first, then Lowest Match #
        if (timeA !== timeB) return timeA - timeB;
        return noA - noB;
      } else {
        // Descending: Latest Time first, then Highest Match #
        if (timeA !== timeB) return timeB - timeA;
        return noB - noA;
      }
    });
  };

  // ✅ Processed Lists
  const sortedLive = sortMatches(liveMatches, "asc");
  const sortedUpcoming = sortMatches(upcomingMatches, "asc"); // Match #1 -> #15
  const sortedFinished = sortMatches(finishedMatches, "desc"); // Match #15 -> #1

  const renderSection = (title, matches, type) => {
    // Hide empty sections except for "Upcoming" which acts as a default placeholder if nothing else exists
    if (matches.length === 0 && type !== "upcoming") return null;

    return (
      <section className="mb-6 md:mb-12">
        <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-6">
          {type === "live" && (
            <div className="relative flex items-center justify-center w-5 h-5 md:w-6 md:h-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <Radio
                size={14}
                className="relative z-10 text-red-600 md:w-4 md:h-4"
              />
            </div>
          )}
          <h3
            className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em] ${
              type === "live" ? "text-red-600" : theme.sub
            }`}>
            {title}
          </h3>
          <div
            className={`h-px flex-1 ${lightMode ? "bg-gray-200" : "bg-white/5"}`}></div>
        </div>

        {matches.length === 0 ? (
          <div
            className={`border border-dashed rounded-2xl md:rounded-[2rem] p-6 md:p-12 flex flex-col items-center justify-center gap-2 md:gap-3 text-center transition-colors ${
              lightMode
                ? "bg-gray-50 border-gray-200 text-gray-400"
                : "bg-[#161920]/50 border-white/5 text-slate-600"
            }`}>
            <CalendarX size={24} className="opacity-50 md:w-8 md:h-8" />
            <span className="text-xs md:text-sm italic font-medium">
              No matches found in this category.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                teams={tournamentTeams}
                tournamentId={tournamentId}
                canEdit={canEdit}
                onOpenCorrection={onOpenCorrection}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="mt-4 md:mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {renderSection("Live Action", sortedLive, "live")}
      {renderSection("Upcoming Fixtures", sortedUpcoming, "upcoming")}
      {renderSection("Recent Results", sortedFinished, "finished")}
    </div>
  );
}
