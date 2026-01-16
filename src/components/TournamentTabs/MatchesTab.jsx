import React from "react";
import MatchCard from "./MatchCard";

export default function MatchesTab({
  liveMatches = [],
  upcomingMatches = [],
  finishedMatches = [],
  tournamentTeams = [], // Passed from parent
  tournamentId,
  canEdit,
}) {
  // --- SORTING HELPER ---
  const sortMatches = (list, direction = "asc") => {
    return [...list].sort((a, b) => {
      // 1. Extract Time (ISO String -> Timestamp)
      // Checks: meta.startAt -> root.startAt -> root.date -> default
      const timeA = new Date(
        a.meta?.startAt || a.startAt || a.date || 0
      ).getTime();
      const timeB = new Date(
        b.meta?.startAt || b.startAt || b.date || 0
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
    if (matches.length === 0 && type !== "upcoming") return null;

    return (
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          {type === "live" && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
          )}
          <h3
            className={`text-xs font-black uppercase tracking-[0.3em] ${
              type === "live" ? "text-white" : "text-slate-500"
            }`}>
            {title}
          </h3>
          <div className="h-px bg-white/5 flex-1"></div>
        </div>

        {matches.length === 0 ? (
          <div className="text-slate-600 bg-[#161920]/50 border border-dashed border-white/5 rounded-[2rem] p-12 text-center italic text-sm">
            No matches found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 md:grid-cols-2 gap-6">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                teams={tournamentTeams}
                tournamentId={tournamentId}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {renderSection("Live Action", sortedLive, "live")}
      {renderSection("Upcoming Fixtures", sortedUpcoming, "upcoming")}
      {renderSection("Recent Results", sortedFinished, "finished")}
    </div>
  );
}
