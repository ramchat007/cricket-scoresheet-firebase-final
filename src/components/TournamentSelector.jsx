import React from "react";

export default function TournamentSelector({
  tournamentId,
  setTournamentId,
  availableTournaments = [],
}) {
  return (
    <div className="mb-4">
      <label className="block text-gray-500 text-sm font-bold mb-2 uppercase tracking-wider flex justify-between">
        <span>Select Tournament</span>
        <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400 border border-gray-700">
          {availableTournaments.length} available
        </span>
      </label>

      <div className="relative">
        <select
          value={tournamentId || ""}
          onChange={(e) => setTournamentId(e.target.value)}
          disabled={availableTournaments.length === 0}
          className={`
            w-full appearance-none rounded-lg px-4 py-3 text-sm font-bold transition-all border
            focus:outline-none focus:ring-1 focus:ring-cyan-500
            ${
              availableTournaments.length === 0
                ? "bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-gray-800 border-gray-700 text-white hover:border-gray-600 cursor-pointer focus:border-cyan-500"
            }
          `}>
          <option value="" className="text-gray-500">
            {availableTournaments.length === 0
              ? "No tournaments found"
              : "-- Select a Tournament --"}
          </option>

          {availableTournaments.map((t) => (
            <option
              key={t.id}
              value={t.id}
              className="bg-gray-900 text-white py-2">
              {t.name || t.id} {/* ✅ Displays Name now */}
            </option>
          ))}
        </select>

        {/* Custom Dropdown Arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
          <svg
            className={`w-4 h-4 ${
              availableTournaments.length === 0
                ? "text-gray-700"
                : "text-cyan-500"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Help Text for Empty State */}
      {availableTournaments.length === 0 && (
        <p className="text-[10px] text-gray-500 mt-2 italic">
          You haven't created or been assigned to any tournaments yet. Use the{" "}
          <strong>Match Selector</strong> to create a "New Match" and start a
          tournament.
        </p>
      )}
    </div>
  );
}
