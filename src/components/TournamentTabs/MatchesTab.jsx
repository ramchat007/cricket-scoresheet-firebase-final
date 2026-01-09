import React from "react";
import MatchCard from "./MatchCard"; // Adjust path if MatchCard is in src/components/

export default function MatchesTab({
  liveMatches = [],
  upcomingMatches = [],
  finishedMatches = [],
  tournamentId,
  canEdit,
}) {
  return (
    <div className="space-y-12">
      {/* LIVE MATCHES */}
      {liveMatches.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Live Now
          </h3>
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
        </div>
      )}

      {/* UPCOMING MATCHES */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
          Upcoming Matches
        </h3>

        {upcomingMatches.length === 0 ? (
          <div className="text-gray-600 bg-gray-900/50 border border-dashed border-gray-800 rounded-xl p-8 text-center italic">
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
      </div>

      {/* FINISHED MATCHES */}
      {finishedMatches.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-gray-700 rounded-full"></span>
            Results
          </h3>
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
        </div>
      )}
    </div>
  );
}
