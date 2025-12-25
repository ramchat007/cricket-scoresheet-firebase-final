// src/components/ScorecardViewer.jsx
import React from "react";
import MatchSummary from "./MatchSummary";
import ScoreTable from "./ScoreTable";

export default function ScorecardViewer({ match }) {
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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
