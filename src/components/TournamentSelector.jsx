import React from "react";
// 1. Import Theme Hook & Icons
import { useTheme } from "../context/ThemeContext";
import { Trophy } from "lucide-react";

export default function TournamentSelector({
  tournamentId,
  setTournamentId,
  availableTournaments = [],
}) {
  // 2. Consume Theme
  const { theme, lightMode } = useTheme();

  return (
    <div className="mb-6 group">
      {/* Label with Stats Badge */}
      <label
        className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-1 flex justify-between items-center ${
          lightMode ? "text-gray-700" : "text-slate-500"
        }`}>
        <div className="flex items-center gap-2">
          {/* Icon matches the text color for consistency */}
          <Trophy
            size={12}
            className={lightMode ? "text-teal-600" : "text-indigo-800"}
          />
          Tournament Context
        </div>

        {/* Badge remains the same */}
        <span
          className={`px-2 py-0.5 rounded-full border font-bold shadow-sm transition-colors ${
            lightMode
              ? "bg-teal-50 text-teal-700 border-teal-200"
              : "bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.1)]"
          }`}>
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
            outline-none ring-0 focus:ring-2
            ${
              availableTournaments.length === 0
                ? `${lightMode ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-[#161920] border-white/5 text-slate-600"} cursor-not-allowed italic`
                : `${
                    lightMode
                      ? "bg-white border-gray-200 text-gray-900 hover:border-teal-500 focus:border-teal-500 focus:ring-teal-100"
                      : "bg-[#0F1115] border-white/10 text-slate-200 hover:border-teal-500/50 focus:border-teal-500 focus:shadow-[0_0_20px_rgba(20,184,166,0.15)] focus:ring-teal-500/20"
                  } cursor-pointer`
            }
          `}>
          <option
            value=""
            className={
              lightMode
                ? "text-gray-500 bg-white"
                : "text-slate-500 bg-[#1C2128]"
            }>
            {availableTournaments.length === 0
              ? "No tournaments found"
              : "-- Select a Tournament --"}
          </option>

          {availableTournaments.map((t) => (
            <option
              key={t.id}
              value={t.id}
              className={`py-4 font-medium ${lightMode ? "bg-white text-gray-900" : "bg-[#1C2128] text-slate-200"}`}>
              {t.name || t.id}
            </option>
          ))}
        </select>

        {/* Premium Neon Dropdown Arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
          <div
            className={`p-1.5 rounded-lg transition-colors ${
              availableTournaments.length === 0
                ? "bg-transparent"
                : lightMode
                  ? "bg-teal-50 text-teal-600 group-hover:bg-teal-100"
                  : "bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20"
            }`}>
            <svg
              className={`w-3.5 h-3.5 ${
                availableTournaments.length === 0
                  ? "text-gray-400"
                  : "currentColor"
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

      {/* Empty State Help Text */}
      {availableTournaments.length === 0 && (
        <div
          className={`mt-3 p-3 border rounded-xl animate-in fade-in slide-in-from-top-1 ${
            lightMode
              ? "bg-red-50 border-red-200"
              : "bg-red-900/10 border-red-500/10"
          }`}>
          <p
            className={`text-[10px] leading-relaxed ${lightMode ? "text-gray-600" : "text-slate-500"}`}>
            <span className="text-red-500 font-bold uppercase mr-1">
              Notice:
            </span>
            You haven't created any tournaments yet. Use the{" "}
            <strong
              className={`border-b border-dashed ${lightMode ? "text-gray-800 border-gray-400" : "text-slate-400 border-slate-600"}`}>
              Match Setup
            </strong>{" "}
            tab to create a "New Match" and initialize a tournament.
          </p>
        </div>
      )}
    </div>
  );
}
