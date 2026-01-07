// src/components/ScoreSummary.jsx
import React from "react";

export default function ScoreSummary({ match }) {
  if (!match)
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center animate-pulse">
        <div className="text-gray-400 text-sm font-bold">
          Loading Match Data...
        </div>
      </div>
    );

  const inningsList = Array.isArray(match.innings) ? match.innings : [];
  const status = match.status || match.meta?.status || "upcoming";
  const result = match.winner || match.meta?.result || match.result?.winner;
  const currentInningIndex = match.currentInnings || 0;
  const currentInning = inningsList[currentInningIndex];
  const inn1 = inningsList[0];
  const inn2 = inningsList[1];

  // --- HELPER: STRICT NAME EXTRACTOR ---
  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const strikerName = cleanName(currentInning?.striker) || "Striker";
  const nonStrikerName = cleanName(currentInning?.nonStriker) || "Non-Striker";
  const bowlerName = cleanName(currentInning?.currentBowler) || "Bowler";

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER CARD */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3">
          <span
            className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded border ${
              status === "finished"
                ? "bg-green-900/30 text-green-400 border-green-500/50"
                : "bg-red-900/30 text-red-400 border-red-500/50 animate-pulse"
            }`}>
            {status === "finished" ? "Finished" : "Live"}
          </span>
        </div>

        <div className="flex justify-between items-center mt-4">
          {/* Team A */}
          <div className="text-center w-5/12">
            <div className="text-lg md:text-2xl font-black text-white leading-tight mb-2 truncate">
              {match.meta?.teamA || "Team A"}
            </div>
            {inn1 ? (
              <div className="text-cyan-400 font-mono font-bold text-xl md:text-2xl">
                {inn1.score}/{inn1.wickets}
                <span className="text-gray-400 text-sm font-sans ml-2">
                  ({inn1.over}.{inn1.overBallCount} ov)
                </span>
              </div>
            ) : (
              <div className="text-gray-500 text-sm font-bold">Yet to bat</div>
            )}
          </div>

          {/* VS Divider */}
          <div className="text-gray-600 font-black text-2xl italic opacity-50">
            VS
          </div>

          {/* Team B */}
          <div className="text-center w-5/12">
            <div className="text-lg md:text-2xl font-black text-white leading-tight mb-2 truncate">
              {match.meta?.teamB || "Team B"}
            </div>
            {inn2 ? (
              <div className="text-cyan-400 font-mono font-bold text-xl md:text-2xl">
                {inn2.score}/{inn2.wickets}
                <span className="text-gray-400 text-sm font-sans ml-2">
                  ({inn2.over}.{inn2.overBallCount} ov)
                </span>
              </div>
            ) : (
              <div className="text-gray-500 text-sm font-bold">Yet to bat</div>
            )}
          </div>
        </div>

        {/* Match Result / Target */}
        {result && (
          <div className="mt-6 text-center border-t border-gray-700 pt-3">
            <span className="text-green-400 text-base font-bold uppercase tracking-wider">
              🏆 {result}
            </span>
          </div>
        )}
        {!result && inn2 && match.meta?.target && (
          <div className="mt-5 text-center bg-yellow-900/20 p-2 rounded-lg border border-yellow-700/30">
            <span className="text-yellow-400 text-sm font-bold block">
              Target: {match.meta.target}
            </span>
            <span className="text-gray-300 text-xs mt-1 block">
              Need{" "}
              <span className="text-white font-bold">
                {match.meta.target - inn2.score}
              </span>{" "}
              runs off{" "}
              <span className="text-white font-bold">
                {Math.max(
                  0,
                  match.meta.overs * 6 - (inn2.over * 6 + inn2.overBallCount)
                )}
              </span>{" "}
              balls
            </span>
          </div>
        )}
      </div>

      {/* CURRENT STATUS */}
      {status !== "finished" && currentInning && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="text-xs text-gray-400 uppercase font-bold mb-3 tracking-wider border-b border-gray-800 pb-2">
            On The Crease
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Striker */}
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 border-l-4 border-l-cyan-500 shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white font-bold text-base flex items-center gap-2">
                    {strikerName}{" "}
                    <span className="text-cyan-400 text-xs">🏏</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-1 font-mono">
                    {currentInning.batsmenStats?.[strikerName]?.runs || 0}
                    <span className="text-xs text-gray-500 ml-1">
                      ({currentInning.batsmenStats?.[strikerName]?.balls || 0})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Non-Striker */}
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-gray-300 font-bold text-base">
                    {nonStrikerName}
                  </div>
                  <div className="text-sm text-gray-400 mt-1 font-mono">
                    {currentInning.batsmenStats?.[nonStrikerName]?.runs || 0}
                    <span className="text-xs text-gray-500 ml-1">
                      (
                      {currentInning.batsmenStats?.[nonStrikerName]?.balls || 0}
                      )
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Bowler */}
          <div className="mt-4 bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center shadow-md">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">
                Current Bowler
              </div>
              <div className="text-white font-bold text-base">{bowlerName}</div>
            </div>
            <div className="text-right">
              <div className="text-white font-mono font-bold text-lg">
                {currentInning.bowlerStats?.[bowlerName]?.wickets || 0}
                <span className="text-gray-500 mx-1">-</span>
                {currentInning.bowlerStats?.[bowlerName]?.runs || 0}
              </div>
              <div className="text-xs text-gray-400">
                {currentInning.bowlerStats?.[bowlerName]?.balls
                  ? `${Math.floor(
                      currentInning.bowlerStats[bowlerName].balls / 6
                    )}.${currentInning.bowlerStats[bowlerName].balls % 6}`
                  : "0.0"}{" "}
                ov
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KEY STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Run Rate",
            value:
              currentInning &&
              currentInning.overBallCount + currentInning.over * 6 > 0
                ? (
                    currentInning.score /
                    ((currentInning.over * 6 + currentInning.overBallCount) / 6)
                  ).toFixed(2)
                : "0.00",
            color: "text-white",
          },
          {
            label: "Extras",
            value:
              (currentInning?.extras?.wides || 0) +
              (currentInning?.extras?.noBalls || 0) +
              (currentInning?.extras?.byes || 0) +
              (currentInning?.extras?.legByes || 0),
            color: "text-white",
          },
          {
            label: "Fours",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.fours || 0),
              0
            ),
            color: "text-green-400",
          },
          {
            label: "Sixes",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.sixes || 0),
              0
            ),
            color: "text-cyan-400",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-gray-900 border border-gray-700 p-3 rounded-lg text-center shadow-sm">
            <div className="text-xs text-gray-400 uppercase font-bold mb-1">
              {stat.label}
            </div>
            <div className={`${stat.color} font-mono font-bold text-lg`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
