import React from "react";

export default function MatchSummary({
  match,
  computeResultString = () => null,
}) {
  const meta = match.meta || {};
  const result = computeResultString(match) || meta.result || "—";
  const status = meta.matchStatus || match.status || "Ongoing";
  const isFinished = status.toLowerCase() === "finished";

  // --- High-End Live Score Integration ---
  const activeIndex = match.currentInnings ?? 0;
  const currentInnings = match.innings?.[activeIndex] || {};
  const score = currentInnings.score ?? 0;
  const wickets = currentInnings.wickets ?? 0;
  const over = currentInnings.over ?? 0;
  const ballCount = currentInnings.overBallCount ?? 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden mb-6">
      {/* Decorative Top Gradient - Blue for Live, Green for Finished */}
      <div
        className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${
          isFinished
            ? "from-emerald-600 to-green-400"
            : "from-cyan-600 to-blue-500"
        } opacity-80`}></div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        {/* Left Side: Match Teams & Live Score */}
        <div className="flex-1">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">
            {meta.tournament || "Championship Series"}
          </h4>
          <div className="text-2xl font-black text-white tracking-tight mb-2">
            {meta.teamA || "Team A"}{" "}
            <span className="text-gray-600 text-lg mx-1">v</span>{" "}
            {meta.teamB || "Team B"}
          </div>

          {!isFinished && (
            <div className="flex items-center gap-3 mt-3">
              <div className="bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg">
                <span className="text-cyan-400 font-black text-lg tracking-tighter">
                  {currentInnings.battingTeam === meta.teamA ? "T1" : "T2"}{" "}
                  {score}/{wickets}
                </span>
                <span className="text-gray-500 text-xs ml-2 font-mono">
                  ({over}.{ballCount})
                </span>
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase animate-pulse">
                Live Scoring
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Status & Requirements */}
        <div className="flex flex-col items-start md:items-end">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${
                isFinished
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}>
              {!isFinished && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              )}
              {status}
            </span>
          </div>

          <div className="space-y-2 text-right">
            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
              Format:{" "}
              <span className="text-white">{meta.overs || 0} Overs</span>
            </div>
            {meta.target && (
              <div className="text-sm font-black text-white bg-white/5 px-3 py-1 rounded-lg border border-white/5 inline-flex items-center gap-2">
                <span className="text-gray-500 text-[10px] uppercase">
                  Target
                </span>
                <span className="text-cyan-400 font-mono text-lg">
                  {meta.target}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Result Section */}
      <div
        className={`mt-6 pt-5 border-t border-white/5 ${isFinished ? "bg-green-500/5 -mx-5 -mb-5 p-5" : ""}`}>
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner ${
              isFinished ? "bg-green-500/20" : "bg-gray-800"
            }`}>
            {isFinished ? "🏆" : "🏁"}
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">
              <span className="text-gray-500 text-[10px] uppercase font-black block mb-0.5 tracking-tighter">
                Match Conclusion
              </span>
              <span className={isFinished ? "text-green-400" : "text-gray-300"}>
                {result}
              </span>
            </div>
            {meta.resultReason && (
              <div className="text-xs text-gray-500 mt-1 italic font-medium">
                {meta.resultReason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
