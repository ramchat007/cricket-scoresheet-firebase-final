import React from "react";

export default function TournamentSelector({
  tournamentId,
  setTournamentId,
  availableTournaments = [],
}) {
  return (
    <div className="mb-6 group">
      {/* Label with Stats Badge */}
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1 flex justify-between items-center">
        <span>Tournament Context</span>
        <span className="bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/20 font-bold shadow-[0_0_10px_rgba(20,184,166,0.1)]">
          {availableTournaments.length} Active
        </span>
      </label>

      <div className="relative">
        <select
          value={tournamentId || ""}
          onChange={(e) => setTournamentId(e.target.value)}
          disabled={availableTournaments.length === 0}
          className={`
            w-full appearance-none rounded-xl px-5 py-4 text-sm font-bold transition-all border
            outline-none ring-0
            ${
              availableTournaments.length === 0
                ? "bg-[#161920] border-white/5 text-slate-600 cursor-not-allowed italic"
                : "bg-[#0F1115] border-white/10 text-slate-200 hover:border-teal-500/50 cursor-pointer focus:border-teal-500 focus:shadow-[0_0_20px_rgba(20,184,166,0.15)]"
            }
          `}
        >
          <option value="" className="text-slate-500 bg-[#1C2128]">
            {availableTournaments.length === 0
              ? "No tournaments found"
              : "-- Select a Tournament --"}
          </option>

          {availableTournaments.map((t) => (
            <option
              key={t.id}
              value={t.id}
              className="bg-[#1C2128] text-slate-200 py-4 font-medium"
            >
              {t.name || t.id}
            </option>
          ))}
        </select>

        {/* Premium Neon Dropdown Arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
          <div
            className={`p-1.5 rounded-lg transition-colors ${
              availableTournaments.length === 0
                ? "bg-white/5"
                : "bg-teal-500/10 group-hover:bg-teal-500/20"
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${
                availableTournaments.length === 0
                  ? "text-slate-700"
                  : "text-teal-400"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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

      {/* Empty State Help Text */}
      {availableTournaments.length === 0 && (
        <div className="mt-3 p-3 bg-red-900/10 border border-red-500/10 rounded-xl animate-in fade-in slide-in-from-top-1">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            <span className="text-red-400 font-bold uppercase mr-1">
              Notice:
            </span>
            You haven't created any tournaments yet. Use the{" "}
            <strong className="text-slate-400 border-b border-slate-600 border-dashed">
              Match Setup
            </strong>{" "}
            tab to create a "New Match" and initialize a tournament.
          </p>
        </div>
      )}
    </div>
  );
}