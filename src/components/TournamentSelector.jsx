import React from "react";

export default function TournamentSelector({
  tournamentId,
  setTournamentId,
  availableTournaments = [],
}) {
  return (
    <div className="mb-4 group">
      {/* Label with Stats Badge */}
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-1 flex justify-between items-center">
        <span>Tournament Context</span>
        <span className="bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full border border-cyan-500/20 font-bold">
          {availableTournaments.length} Slots
        </span>
      </label>

      <div className="relative">
        <select
          value={tournamentId || ""}
          onChange={(e) => setTournamentId(e.target.value)}
          disabled={availableTournaments.length === 0}
          className={`
            w-full appearance-none rounded-2xl px-5 py-4 text-sm font-black transition-all border
            outline-none ring-0
            ${
              availableTournaments.length === 0
                ? "bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed italic"
                : "bg-black border-white/10 text-white hover:border-cyan-500/50 cursor-pointer focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            }
          `}>
          <option value="" className="text-gray-500 bg-gray-900">
            {availableTournaments.length === 0
              ? "No tournaments found"
              : "-- Select a Tournament --"}
          </option>

          {availableTournaments.map((t) => (
            <option
              key={t.id}
              value={t.id}
              className="bg-gray-900 text-white py-4 font-bold">
              {t.name || t.id}
            </option>
          ))}
        </select>

        {/* Premium Neon Dropdown Arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none">
          <div className={`p-1.5 rounded-lg transition-colors ${
              availableTournaments.length === 0 ? "bg-gray-800" : "bg-cyan-500/10"
          }`}>
            <svg
              className={`w-3.5 h-3.5 ${
                availableTournaments.length === 0
                  ? "text-gray-700"
                  : "text-cyan-400"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Help Text for Empty State - Styling preserved but updated to match neon theme */}
      {availableTournaments.length === 0 && (
        <div className="mt-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            <span className="text-red-400 font-bold uppercase mr-1">Notice:</span>
            You haven't created or been assigned to any tournaments yet. Use the{" "}
            <strong className="text-gray-400">Match Selector</strong> to create a "New Match" and start a
            tournament.
          </p>
        </div>
      )}
    </div>
  );
}