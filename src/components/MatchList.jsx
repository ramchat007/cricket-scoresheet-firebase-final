// src/components/MatchList.jsx
import React from "react";

export default function MatchList({
  availableMatches = [],
  onClickMatch,
  readOnly = false,
  onDelete,
}) {
  if (availableMatches.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic p-4 bg-gray-900/30 rounded-xl border border-gray-800/50 text-center">
        No matches in this category.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableMatches.map((m) => {
        const isLive = m.status === "in-progress" || m.status === "ongoing";
        const isFinished = m.status === "finished";
        const isUpcoming = !isLive && !isFinished;

        return (
          <div
            key={m.id}
            onClick={() => onClickMatch(m.id)}
            className={`
              relative group bg-gray-900 border rounded-xl p-4 cursor-pointer 
              transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden
              ${
                isLive
                  ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                  : "border-gray-800 hover:border-cyan-500/50"
              }
            `}>
            {/* Status Badge */}
            <div className="absolute top-0 right-0 p-2">
              {isLive && (
                <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 text-[10px] font-black px-2 py-1 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{" "}
                  Live
                </span>
              )}
              {isFinished && (
                <span className="bg-green-500/10 text-green-500 text-[10px] font-black px-2 py-1 rounded border border-green-500/20 uppercase tracking-widest">
                  Finished
                </span>
              )}
              {isUpcoming && (
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-2 py-1 rounded border border-blue-500/20 uppercase tracking-widest">
                  Upcoming
                </span>
              )}
            </div>

            {/* Teams */}
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="font-bold text-white text-lg truncate w-5/12 text-right">
                  {m.meta?.teamA}
                </div>
                <div className="text-gray-600 font-black text-sm px-2">VS</div>
                <div className="font-bold text-white text-lg truncate w-5/12 text-left">
                  {m.meta?.teamB}
                </div>
              </div>
            </div>

            {/* Meta Info */}
            <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-[11px] text-gray-400 font-mono">
              <div>📅 {m.date || "Date TBD"}</div>
              <div>🏏 {m.meta?.overs || 0} Ov</div>
            </div>

            {/* Delete Button (Hover Only) */}
            {!readOnly && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m.id);
                }}
                className="absolute bottom-2 right-2 p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Delete Match">
                🗑️
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
