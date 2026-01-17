// src/components/ScorecardViewer.jsx
import React from "react";
import MatchSummary from "./MatchSummary";
import ScoreTable from "./ScoreTable";

export default function ScorecardViewer({ match, onRefresh, isRefreshing }) {
  // --- Empty State ---
  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-900 border border-gray-800 rounded-xl text-center shadow-inner min-h-[300px]">
        <div className="text-5xl mb-4 opacity-50 grayscale">🏏</div>
        <h3 className="text-xl font-bold text-gray-300 mb-2">
          No Match Selected
        </h3>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          Select a match from the list to view the live scorecard and
          statistics.
        </p>
      </div>
    );
  }

  const isLive = match.status === "ongoing" || match.status === "live";

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ✅ NEW: Match Center Header with Refresh */}
      <div className="flex justify-between items-center bg-[#161920] p-4 rounded-2xl border border-white/5 shadow-lg">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-slate-100 uppercase tracking-wide italic">
            Match Center
          </h2>
          {isLive && (
            <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Live
            </span>
          )}
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-teal-400 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50">
            <span className={`text-sm ${isRefreshing ? "animate-spin" : ""}`}>
              🔄
            </span>
            {isRefreshing ? "Updating..." : "Refresh"}
          </button>
        )}
      </div>

      {/* Match Summary Header */}
      <div className="w-full">
        <MatchSummary match={match} />
      </div>

      {/* Detailed Score Table */}
      <div className="w-full">
        <ScoreTable match={match} />
      </div>
    </div>
  );
}
