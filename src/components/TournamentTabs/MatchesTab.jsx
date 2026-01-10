import React from "react";
import MatchCard from "./MatchCard"; 

export default function MatchesTab({
  liveMatches = [],
  upcomingMatches = [],
  finishedMatches = [],
  tournamentId,
  canEdit,
}) {
  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* LIVE MATCHES */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
              Live Action
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                tournamentId={tournamentId}
                canEdit={canEdit}
              />
            ))}
          </div>
        </section>
      )}

      {/* UPCOMING MATCHES */}
      <section>
        <div className="flex items-center gap-3 mb-6 border-l-4 border-teal-500 pl-3">
          <h3 className="text-sm font-black text-slate-200 uppercase tracking-[0.2em]">
            Upcoming Fixtures
          </h3>
        </div>

        {upcomingMatches.length === 0 ? (
          <div className="text-slate-600 bg-[#161920] border border-dashed border-white/5 rounded-2xl p-12 text-center italic text-sm">
            No upcoming matches scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                tournamentId={tournamentId}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </section>

      {/* FINISHED MATCHES */}
      {finishedMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6 border-l-4 border-slate-700 pl-3">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
              Recent Results
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {finishedMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                tournamentId={tournamentId}
                canEdit={canEdit}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}