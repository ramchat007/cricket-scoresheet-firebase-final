// src/components/MatchSelector.jsx
import React from "react";

export default function MatchSelector({
  matchId,
  setMatchId,
  availableMatches = [],
}) {
  return (
    <div className="mb-4">
      <label className="block text-gray-400 text-sm font-medium mb-2 uppercase tracking-wider">
        Select Match
      </label>

      {/* Fix: flex-col stacks them on mobile. 
         md:flex-row puts them in a line on desktop. 
      */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Dropdown Input */}
        <select
          value={matchId || ""}
          onChange={(e) => setMatchId(e.target.value)}
          className="w-full md:flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer max-w-full">
          <option value="" className="text-gray-500">
            -- Choose a Match --
          </option>
          {availableMatches.map((m) => {
            const name =
              m.meta?.name ||
              `${m.meta?.teamA || "Team A"} vs ${m.meta?.teamB || "Team B"}`;
            const date = m.date || m.meta?.date || "No Date";

            return (
              <option
                key={m.id}
                value={m.id}
                className="text-gray-200 bg-gray-800">
                {date} : {name}
              </option>
            );
          })}
        </select>

        {/* Start Button */}
        <button
          onClick={() => setMatchId("new")}
          className="w-full md:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg shadow-[0_0_10px_rgba(8,145,178,0.5)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] transition-all whitespace-nowrap border border-transparent">
          + Start New Match
        </button>
      </div>
    </div>
  );
}
