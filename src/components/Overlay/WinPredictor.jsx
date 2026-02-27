import React, { useMemo } from "react";
import { calculateWinProbability } from "../../utils/winProbability";

export default function WinPredictor({ match }) {
  const prob = useMemo(() => calculateWinProbability(match), [match]);

  const activeIndex = match?.currentInnings || 0;
  const currentInn = match?.innings?.[activeIndex];

  if (!currentInn) return null;

  const battingTeam = currentInn.battingTeam;
  const bowlingTeam = currentInn.bowlingTeam;

  // The bar width percentage for the batting team
  const batWidth = `${prob.bat}%`;

  return (
    <div className="w-full max-w-2xl mx-auto bg-black/80 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-700">
      {/* Label Row */}
      <div className="flex justify-between items-center px-4 py-1.5 bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-red-900/40 border-b border-white/10">
        <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest truncate w-1/3">
          {battingTeam}
        </span>
        <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em] w-1/3 text-center">
          Win Predictor
        </span>
        <span className="text-[10px] font-black uppercase text-red-400 tracking-widest truncate w-1/3 text-right">
          {bowlingTeam}
        </span>
      </div>

      {/* Probability Numbers & Progress Bar */}
      <div className="relative h-10 w-full flex items-center bg-red-600">
        {/* Batting Team Blue Fill (Animates width dynamically) */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-1000 ease-out flex items-center"
          style={{ width: batWidth }}>
          {/* Slanted edge effect */}
          <div className="absolute right-[-10px] top-0 w-5 h-full bg-blue-600 transform skew-x-12"></div>
        </div>

        {/* Text Overlays (Z-index ensures they stay above the colors) */}
        <div className="absolute inset-0 flex justify-between items-center px-4 z-10 drop-shadow-md">
          <span className="text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {prob.bat}%
          </span>
          <span className="text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {prob.bowl}%
          </span>
        </div>
      </div>
    </div>
  );
}
