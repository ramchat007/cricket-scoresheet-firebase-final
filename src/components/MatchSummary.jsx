// src/components/MatchSummary.jsx
import React from "react";

export default function MatchSummary({
  match,
  computeResultString = () => null,
}) {
  const meta = match.meta || {};
  const result = computeResultString(match) || meta.result || "—";
  const status = meta.matchStatus || "Ongoing";
  const isFinished = status.toLowerCase() === "finished";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden mb-6">
      {/* Decorative Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent opacity-70"></div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        {/* Left Side: Match Details */}
        <div>
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">
            {meta.tournament || "Tournament"}
          </h4>
          <div className="text-xl font-bold text-white tracking-wide">
            {meta.teamA || "Team A"}{" "}
            <span className="text-gray-600 text-sm mx-1">vs</span>{" "}
            {meta.teamB || "Team B"}
          </div>
          <div className="text-sm text-cyan-400 font-mono mt-1">
            Max Overs: <span className="text-white">{meta.overs ?? "—"}</span>
          </div>
        </div>

        {/* Right Side: Status & Meta */}
        <div className="text-left md:text-right">
          {/* <div className="text-[10px] text-gray-600 font-mono mb-2">
            ID: {match.id || "—"}
          </div> */}

          <div className="flex items-center md:justify-end gap-2 mb-2">
            <span
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-2 ${
                isFinished
                  ? "bg-green-900/20 text-green-400 border-green-900/50"
                  : "bg-yellow-900/20 text-yellow-400 border-yellow-900/50"
              }`}>
              {!isFinished && (
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
              )}
              Status: {status}
            </span>
          </div>

          {meta.target && (
            <div className="text-sm font-medium text-white bg-gray-800/50 px-2 py-1 rounded inline-block border border-gray-700">
              Target: <span className="text-cyan-400">{meta.target}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Result */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-start gap-3">
          <span className="text-lg">🏆</span>
          <div>
            <div className="text-gray-200 font-medium">
              <span className="text-gray-500 text-sm uppercase font-bold mr-2">
                Result:
              </span>
              {result}
            </div>
            {meta.resultReason && (
              <div className="text-sm text-gray-500 mt-1 italic">
                Reason: {meta.resultReason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
