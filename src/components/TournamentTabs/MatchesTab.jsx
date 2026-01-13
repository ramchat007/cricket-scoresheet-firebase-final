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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      {renderSection("Live Action", liveMatches, "live")}
      {renderSection("Upcoming Fixtures", upcomingMatches, "upcoming")}
      {renderSection("Recent Results", finishedMatches, "finished")}
    </div>
  );
}
