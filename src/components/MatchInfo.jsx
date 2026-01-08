// src/components/MatchInfo.jsx
import React from "react";

export default function MatchInfo({ match }) {
  if (!match) return null;

  const meta = match.meta || {};

  // Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Date TBA";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const InfoRow = ({ label, value, icon }) => (
    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-800 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl opacity-80">{icon}</span>
        <span className="text-sm font-bold text-gray-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-white font-medium text-right font-mono">
        {value || "N/A"}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* MATCH DETAILS CARD */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 border-b border-gray-800 pb-4 flex items-center gap-2">
          ℹ️ Match Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow
            label="Tournament"
            value={meta.tournament || "Friendly Match"}
            icon="🏆"
          />
          <InfoRow
            label="Date"
            value={formatDate(match.date || meta.date)}
            icon="📅"
          />
          <InfoRow
            label="Format"
            value={`${meta.overs || "?"} Overs`}
            icon="🏏"
          />
          <InfoRow
            label="Venue"
            value={meta.location || meta.venue || "TBA"}
            icon="📍"
          />
          <InfoRow
            label="Toss"
            value={
              meta.toss
                ? `${meta.toss.winner} opted to ${meta.toss.decision}`
                : "Pending"
            }
            icon="🪙"
          />
          <InfoRow
            label="Status"
            value={match.status || meta.status || "Scheduled"}
            icon="📊"
          />
        </div>
      </div>

      {/* SQUADS CARD (Optional but useful) */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 border-b border-gray-800 pb-4 flex items-center gap-2">
          👥 Squads
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Team A */}
          <div>
            <div className="text-cyan-400 font-bold uppercase tracking-wider mb-3 border-l-4 border-cyan-500 pl-3">
              {meta.teamA}
            </div>
            <ul className="space-y-2">
              {(match.teamASquad || []).map((p, i) => (
                <li
                  key={i}
                  className="text-gray-300 text-sm flex items-center gap-2">
                  <span className="text-gray-600 text-xs w-4">{i + 1}.</span>
                  {typeof p === "object" ? p.name : p}
                </li>
              ))}
              {(!match.teamASquad || match.teamASquad.length === 0) && (
                <li className="text-gray-600 italic text-sm">
                  No squad listed
                </li>
              )}
            </ul>
          </div>

          {/* Team B */}
          <div>
            <div className="text-purple-400 font-bold uppercase tracking-wider mb-3 border-l-4 border-purple-500 pl-3">
              {meta.teamB}
            </div>
            <ul className="space-y-2">
              {(match.teamBSquad || []).map((p, i) => (
                <li
                  key={i}
                  className="text-gray-300 text-sm flex items-center gap-2">
                  <span className="text-gray-600 text-xs w-4">{i + 1}.</span>
                  {typeof p === "object" ? p.name : p}
                </li>
              ))}
              {(!match.teamBSquad || match.teamBSquad.length === 0) && (
                <li className="text-gray-600 italic text-sm">
                  No squad listed
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
