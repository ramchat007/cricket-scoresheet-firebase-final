// src/components/ScoreSummary.jsx
import React from "react";

export default function ScoreSummary({ match }) {
  if (!match) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center animate-pulse">
        <div className="text-gray-500 text-sm">Loading Match Data...</div>
      </div>
    );
  }

  // SAFETY CHECK: Default to empty array
  const inningsList = Array.isArray(match.innings) ? match.innings : [];

  const status = match.status || match.meta?.status || "upcoming";
  const result = match.winner || match.meta?.result || match.result?.winner;

  const currentInningIndex = match.currentInnings || 0;
  const currentInning = inningsList[currentInningIndex];

  const getInning = (idx) => inningsList[idx] || null;
  const inn1 = getInning(0);
  const inn2 = getInning(1);

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER CARD */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
              status === "finished"
                ? "bg-green-900/20 text-green-400 border-green-900/50"
                : "bg-red-900/20 text-red-400 border-red-900/50 animate-pulse"
            }`}>
            {status === "finished" ? "Finished" : "Live"}
          </span>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="text-center w-1/3">
            <div className="text-lg md:text-2xl font-black text-white leading-none mb-1">
              {match.meta?.teamA || "Team A"}
            </div>
            {inn1 && (
              <div className="text-cyan-400 font-mono font-bold text-sm md:text-lg">
                {inn1.score}/{inn1.wickets}{" "}
                <span className="text-gray-500 text-sm ml-1">
                  ({inn1.over}.{inn1.overBallCount})
                </span>
              </div>
            )}
          </div>
          <div className="text-gray-700 font-black text-xl italic opacity-30">
            VS
          </div>
          <div className="text-center w-1/3">
            <div className="text-lg md:text-2xl font-black text-white leading-none mb-1">
              {match.meta?.teamB || "Team B"}
            </div>
            {inn2 ? (
              <div className="text-cyan-400 font-mono font-bold text-sm md:text-lg">
                {inn2.score}/{inn2.wickets}{" "}
                <span className="text-gray-500 text-sm ml-1">
                  ({inn2.over}.{inn2.overBallCount})
                </span>
              </div>
            ) : (
              <div className="text-gray-600 text-sm mt-1">Yet to bat</div>
            )}
          </div>
        </div>

        {result && (
          <div className="mt-6 text-center border-t border-gray-800 pt-3">
            <span className="text-green-400 text-sm font-bold uppercase tracking-wider">
              🏆 {result}
            </span>
          </div>
        )}
        {!result && inn2 && match.meta?.target && (
          <div className="mt-4 text-center">
            <span className="text-yellow-500 text-sm font-bold">
              Target: {match.meta.target}{" "}
              <span className="text-gray-500 font-normal ml-1">
                ({match.meta.target - inn2.score} needed off{" "}
                {match.meta.overs * 6 - (inn2.over * 6 + inn2.overBallCount)}{" "}
                balls)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* CURRENT STATUS */}
      {status !== "finished" && currentInning && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-3 tracking-wider">
            Current Status
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800 border-l-2 border-l-cyan-500">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white font-bold text-sm">
                    {currentInning.striker || "Striker"}{" "}
                    <span className="text-cyan-500">*</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {currentInning.batsmenStats?.[currentInning.striker]
                      ?.runs || 0}{" "}
                    <span className="text-[9px] text-gray-600">
                      {" "}
                      (
                      {currentInning.batsmenStats?.[currentInning.striker]
                        ?.balls || 0}
                      )
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-gray-500 uppercase">SR</div>
                  <div className="text-sm text-gray-400">
                    {currentInning.batsmenStats?.[currentInning.striker]
                      ?.balls > 0
                      ? (
                          (currentInning.batsmenStats[currentInning.striker]
                            .runs /
                            currentInning.batsmenStats[currentInning.striker]
                              .balls) *
                          100
                        ).toFixed(0)
                      : "0"}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-gray-300 font-bold text-sm">
                    {currentInning.nonStriker || "Non-Striker"}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {currentInning.batsmenStats?.[currentInning.nonStriker]
                      ?.runs || 0}{" "}
                    <span className="text-[9px] text-gray-600">
                      {" "}
                      (
                      {currentInning.batsmenStats?.[currentInning.nonStriker]
                        ?.balls || 0}
                      )
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 bg-gray-950/50 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
            <div>
              <div className="text-[9px] text-gray-500 uppercase mb-0.5">
                Bowling
              </div>
              <div className="text-white font-bold text-sm">
                {currentInning.currentBowler || "Bowler"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-mono font-bold">
                {currentInning.bowlerStats?.[currentInning.currentBowler]
                  ?.wickets || 0}
                <span className="text-gray-500 mx-1">-</span>
                {currentInning.bowlerStats?.[currentInning.currentBowler]
                  ?.runs || 0}
              </div>
              <div className="text-[9px] text-gray-500">
                {currentInning.bowlerStats?.[currentInning.currentBowler]?.balls
                  ? `${Math.floor(
                      currentInning.bowlerStats[currentInning.currentBowler]
                        .balls / 6
                    )}.${
                      currentInning.bowlerStats[currentInning.currentBowler]
                        .balls % 6
                    }`
                  : "0.0"}{" "}
                ov
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KEY STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-center">
          <div className="text-[9px] text-gray-500 uppercase">Run Rate</div>
          <div className="text-white font-mono font-bold text-sm">
            {currentInning &&
            currentInning.overBallCount + currentInning.over * 6 > 0
              ? (
                  currentInning.score /
                  ((currentInning.over * 6 + currentInning.overBallCount) / 6)
                ).toFixed(2)
              : "0.00"}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-center">
          <div className="text-[9px] text-gray-500 uppercase">Extras</div>
          <div className="text-white font-mono font-bold text-sm">
            {(currentInning?.extras?.wides || 0) +
              (currentInning?.extras?.noBalls || 0) +
              (currentInning?.extras?.byes || 0) +
              (currentInning?.extras?.legByes || 0)}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-center">
          <div className="text-[9px] text-gray-500 uppercase">Fours</div>
          <div className="text-green-400 font-mono font-bold text-sm">
            {Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.fours || 0),
              0
            )}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg text-center">
          <div className="text-[9px] text-gray-500 uppercase">Sixes</div>
          <div className="text-cyan-400 font-mono font-bold text-sm">
            {Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.sixes || 0),
              0
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
