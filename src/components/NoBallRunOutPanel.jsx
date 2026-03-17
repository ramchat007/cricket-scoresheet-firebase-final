import React, { useState } from "react";
import { Check, Info } from "lucide-react";

export default function NoBallRunOutPanel({ onSave }) {
  // State for the custom local rules
  const [completedRuns, setCompletedRuns] = useState(0);
  const [countAsValidBall, setCountAsValidBall] = useState(false);
  const [runOutBatter, setRunOutBatter] = useState("striker"); // or "non-striker"

  const handleApply = () => {
    // Send this custom logic back to your main scoring function
    onSave({
      isNoBall: true,
      isWicket: true,
      wicketType: "Run Out",
      outBatter: runOutBatter,
      completedRuns: completedRuns,
      isValidBall: countAsValidBall, 
    });
  };

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mt-4">
      <h4 className="font-black text-amber-800 uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
        <Info size={16} /> NB + Run Out Settings
      </h4>

      {/* 1. EXTRA RUNS PANEL */}
      <div className="mb-4">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
          Runs Completed Before Wicket?
        </label>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((run) => (
            <button
              key={run}
              onClick={() => setCompletedRuns(run)}
              className={`flex-1 py-2 rounded-lg font-black text-sm transition-all border ${
                completedRuns === run
                  ? "bg-amber-500 text-white border-amber-600 shadow-md"
                  : "bg-white text-amber-700 border-amber-300 hover:bg-amber-100"
              }`}
            >
              {run}
            </button>
          ))}
        </div>
      </div>

      {/* 2. WHO GOT OUT? */}
      <div className="mb-4">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
          Who was Run Out?
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setRunOutBatter("striker")}
            className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all border ${
              runOutBatter === "striker"
                ? "bg-red-500 text-white border-red-600 shadow-md"
                : "bg-white text-red-700 border-red-300 hover:bg-red-50"
            }`}
          >
            Striker
          </button>
          <button
            onClick={() => setRunOutBatter("non-striker")}
            className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all border ${
              runOutBatter === "non-striker"
                ? "bg-red-500 text-white border-red-600 shadow-md"
                : "bg-white text-red-700 border-red-300 hover:bg-red-50"
            }`}
          >
            Non-Striker
          </button>
        </div>
      </div>

      {/* 3. VALID BALL TOGGLE (The Local Cricket Rule) */}
      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 mb-4">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            id="validBallToggle"
            checked={countAsValidBall}
            onChange={(e) => setCountAsValidBall(e.target.checked)}
            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-amber-300 bg-white checked:bg-amber-500 checked:border-amber-500 transition-all"
          />
          <Check
            size={14}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
          />
        </div>
        <div>
          <label
            htmlFor="validBallToggle"
            className="text-xs font-black text-amber-900 cursor-pointer uppercase tracking-widest"
          >
            Count as Valid Ball?
          </label>
          <p className="text-[9px] font-bold text-amber-700 mt-0.5 leading-tight">
            Check this if your local tournament rules count this delivery towards the over.
          </p>
        </div>
      </div>

      <button
        onClick={handleApply}
        className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg active:scale-95 transition-all"
      >
        Confirm NB Run Out
      </button>
    </div>
  );
}