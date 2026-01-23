import React from "react";

export default function BroadcastSummaryCard({ match, type }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  if (!currentInn) return null;

  const batsmen =
    currentInn.batsmenList || Object.keys(currentInn.batsmenStats || {});
  const bowlers =
    currentInn.bowlersList || Object.keys(currentInn.bowlerStats || {});

  const isWicket = type === "WICKET";
  const headerColor = isWicket ? "bg-red-700" : "bg-blue-800";
  const title = isWicket ? "WICKET FALLEN" : `END OF OVER ${currentInn.over}`;

  return (
    <div className="w-[1400px] bg-[#1a202c] rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-white/10 font-sans">
      {/* HEADER */}
      <div
        className={`${headerColor} h-24 flex items-center justify-between px-12 text-white`}>
        <div className="font-black text-4xl uppercase tracking-widest italic">
          {title}
        </div>
        <div className="font-bold text-4xl">
          {currentInn.score}/{currentInn.wickets}{" "}
          <span className="text-white/60 text-2xl ml-2">
            ({currentInn.over}.{currentInn.overBallCount})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 h-[600px]">
        {/* BATTING COLUMN */}
        <div className="border-r border-white/10 bg-[#121620] p-6 overflow-hidden flex flex-col">
          <div className="flex justify-between text-slate-500 font-bold uppercase mb-4 px-4 text-xl">
            <span>Batter</span>
            <div className="flex gap-12 w-[240px] justify-end">
              <span>R</span>
              <span>B</span>
              <span>SR</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {batsmen.map((name) => {
              const s = currentInn.batsmenStats?.[name] || {};
              const active =
                name === currentInn.striker || name === currentInn.nonStriker;
              return (
                <div
                  key={name}
                  className={`flex justify-between items-center p-4 rounded-xl ${active ? "bg-white/10" : ""}`}>
                  <div
                    className={`text-2xl font-bold truncate w-[300px] ${active ? "text-yellow-400" : s.out ? "text-slate-500" : "text-white"}`}>
                    {name} {active && "*"}
                    {s.out && (
                      <span className="text-xs ml-2 text-red-400 uppercase bg-red-900/30 px-2 py-0.5 rounded">
                        Out
                      </span>
                    )}
                  </div>
                  <div
                    className={`flex gap-12 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-500"}`}>
                    <span>{s.runs}</span>
                    <span className="opacity-60">{s.balls}</span>
                    <span className="text-lg pt-1 opacity-50">
                      {s.balls ? ((s.runs / s.balls) * 100).toFixed(0) : 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOWLING COLUMN */}
        <div className="bg-[#0f121a] p-6 overflow-hidden flex flex-col">
          <div className="flex justify-between text-slate-500 font-bold uppercase mb-4 px-4 text-xl">
            <span>Bowler</span>
            <div className="flex gap-12 w-[240px] justify-end">
              <span>O</span>
              <span>R</span>
              <span>W</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {bowlers.map((name) => {
              const s = currentInn.bowlerStats?.[name] || {};
              const active = name === currentInn.currentBowler;
              return (
                <div
                  key={name}
                  className={`flex justify-between items-center p-4 rounded-xl ${active ? "bg-white/10" : ""}`}>
                  <div
                    className={`text-2xl font-bold truncate w-[300px] ${active ? "text-blue-400" : "text-slate-300"}`}>
                    {name}
                  </div>
                  <div
                    className={`flex gap-12 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-500"}`}>
                    <span className="opacity-60">
                      {Math.floor(s.balls / 6)}.{s.balls % 6}
                    </span>
                    <span>{s.runs}</span>
                    <span
                      className={`${s.wickets > 0 ? "text-yellow-400" : ""}`}>
                      {s.wickets}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
