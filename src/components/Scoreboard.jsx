// src/components/Scoreboard.jsx
import React from "react";
import ScoreTable from "./ScoreTable.jsx";
import MatchSummary from "./MatchSummary.jsx";

export default function Scoreboard({ match }) {
  if (!match) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center shadow-xl">
        <div className="text-gray-500 text-lg font-medium">
          No match selected
        </div>
        <div className="text-gray-600 text-sm mt-2">
          Please go back to matches and select one.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Match Header Card */}
      <MatchSummary match={match} />

      {/* 2. Detailed Scorecard */}
      <div className="mt-6">
        <ScoreTable match={match} />
      </div>
    </div>
  );
}
