import React from "react";

export default function BroadcastSummaryCard({ match, type }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  if (!currentInn) return null;

  // Check if it's a result card
  const isResult = type === "RESULT" || match.status === "completed";
  const isToss = type === "TOSS";

  // --- 1. RESULT CALCULATION LOGIC ---
  let resultMessage = match.result || "MATCH SUMMARY"; // Default to DB result

  if (isResult && !match.result) {
    // If DB doesn't have the string, calculate it live
    const inn1 = match.innings?.[0];
    const inn2 = match.innings?.[1];

    if (inn1 && inn2) {
        const target = inn1.score + 1;
        const chaserScore = inn2.score;
        const chaserWickets = inn2.wickets;

        if (chaserScore >= target) {
            resultMessage = `${inn2.battingTeam} WON BY ${10 - chaserWickets} WICKETS`;
        } else if (match.status === "completed" || chaserScore < target - 1) {
            // Assuming match is over and chaser lost
            resultMessage = `${inn1.battingTeam} WON BY ${target - 1 - chaserScore} RUNS`;
        } else if (chaserScore === target - 1) {
            resultMessage = "MATCH TIED";
        }
    } else if (inn1 && !inn2) {
        // Only 1 inning played/recorded?
        resultMessage = `${inn1.battingTeam} SCORED ${inn1.score}`;
    }
  }

  // --- 2. COLORS & TITLES ---
  let headerColor = "bg-blue-800";
  let title = `END OF OVER ${currentInn.over}`;

  if (type === "WICKET") {
    headerColor = "bg-red-700";
    title = "WICKET FALLEN";
  } else if (isResult) {
    headerColor = "bg-yellow-600"; // Gold for result
    title = resultMessage.toUpperCase(); // ✅ Show the Winner Name here
  } else if (isToss) {
    headerColor = "bg-purple-700"; // ✅ Purple for Toss
    title = "TOSS UPDATE";
  }

  // --- 3. HELPER: Score Block Component ---
  const ScoreBlock = ({ inn, label }) => {
    if (!inn) return <div className="text-slate-500 text-center text-xl">Yet to Bat</div>;
    return (
        <div className="flex flex-col items-center p-8 bg-[#0f121a] rounded-3xl border border-white/10 w-full relative overflow-hidden">
            {/* Innings Label */}
            <div className="absolute top-0 right-0 bg-white/5 px-4 py-1 text-xs font-bold text-slate-500 rounded-bl-xl">{label}</div>
            
            <h3 className="text-teal-400 font-black uppercase text-3xl mb-2 tracking-widest">{inn.battingTeam}</h3>
            <div className="text-7xl font-black text-white mb-2 leading-none">{inn.score}/{inn.wickets}</div>
            <div className="text-slate-400 font-mono text-2xl font-bold">({inn.over}.{inn.overBallCount} Overs)</div>
            
            <div className="w-full h-px bg-white/10 my-6"></div>
            
            {/* Top Performer (Simple Logic: Highest Run Scorer) */}
            <div className="w-full">
                {(() => {
                    const batters = Object.entries(inn.batsmenStats || {})
                        .sort((a,b) => b[1].runs - a[1].runs) // Sort by runs
                        .slice(0, 1);
                    
                    if(batters.length === 0) return <div className="text-slate-600 italic">No Stats</div>;

                    return batters.map(([name, s]) => (
                        <div key={name} className="flex justify-between items-center text-xl bg-white/5 p-3 rounded-lg">
                            {/* ✅ REMOVED TRUNCATE HERE */}
                            <span className="text-white font-bold whitespace-nowrap">⭐ {name}</span>
                            <span className="text-yellow-400 font-mono font-bold ml-4">{s.runs} <span className="text-sm text-slate-500">({s.balls})</span></span>
                        </div>
                    ))
                })()}
            </div>
        </div>
    );
  };

  return (
    <div className="w-[1400px] bg-[#1a202c] rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] border-4 border-white/10 font-sans transform scale-100">
      {/* HEADER */}
      <div
        className={`${headerColor} h-32 flex items-center justify-center px-12 text-white relative overflow-hidden`}
      >
        {/* Shiny Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
        
        {/* Main Title / Result */}
        <div className="font-black text-5xl uppercase tracking-widest italic drop-shadow-md text-center">
          {title}
        </div>
      </div>

      {/* BODY CONTENT */}
      {isResult ? (
        // --- RESULT VIEW (Side by Side Scores) ---
        <div className="flex items-center justify-center gap-8 h-[600px] bg-[#121620] p-12 bg-opacity-95">
            <ScoreBlock inn={match.innings[0]} label="1st INNINGS" />
            <div className="flex flex-col items-center">
                <span className="text-6xl font-black text-slate-700 uppercase italic transform -skew-x-12">VS</span>
            </div>
            <ScoreBlock inn={match.innings[1]} label="2nd INNINGS" />
        </div>
      ) 
      : isToss ? (
        // ✅ TOSS VIEW (New)
        <div className="flex flex-col items-center justify-center h-[400px] bg-[#121620] p-12 space-y-8">
             <div className="text-4xl text-slate-400 font-bold uppercase tracking-widest">
                {match.toss?.winner || "UNKNOWN"} WON THE TOSS
             </div>
             <div className="text-7xl text-white font-black uppercase italic tracking-tighter drop-shadow-lg">
                ELECTED TO <span className="text-yellow-400">{match.toss?.decision || "PLAY"}</span>
             </div>
             <div className="w-32 h-2 bg-purple-500 rounded-full mt-8"></div>
        </div> 
      )
       : (
        // --- STANDARD LIVE VIEW (Existing Code) ---
        <div className="grid grid-cols-2 h-[600px]">
          {/* BATTING COLUMN */}
          <div className="border-r border-white/10 bg-[#121620] p-6 overflow-hidden flex flex-col">
            <div className="flex justify-between text-slate-500 font-bold uppercase mb-4 px-4 text-xl border-b border-white/5 pb-2">
              <span>Batter</span>
              <div className="flex gap-12 w-[240px] justify-end">
                <span>R</span>
                <span>B</span>
                <span>SR</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(currentInn.batsmenList || Object.keys(currentInn.batsmenStats || {})).map((name) => {
                const s = currentInn.batsmenStats?.[name] || {};
                const active = name === currentInn.striker || name === currentInn.nonStriker;
                return (
                  <div
                    key={name}
                    className={`flex justify-between items-center p-4 rounded-xl ${active ? "bg-white/10 border border-white/5" : "opacity-70"}`}
                  >
                    <div className={`text-2xl font-bold truncate w-[300px] ${active ? "text-yellow-400" : s.out ? "text-slate-500" : "text-white"}`}>
                      {name} {active && "*"}
                      {s.out && (
                        <span className="text-xs ml-2 text-red-400 uppercase bg-red-900/30 px-2 py-0.5 rounded font-bold">
                          Out
                        </span>
                      )}
                    </div>
                    <div className={`flex gap-12 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-500"}`}>
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
            <div className="flex justify-between text-slate-500 font-bold uppercase mb-4 px-4 text-xl border-b border-white/5 pb-2">
              <span>Bowler</span>
              <div className="flex gap-12 w-[240px] justify-end">
                <span>O</span>
                <span>R</span>
                <span>W</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(currentInn.bowlersList || Object.keys(currentInn.bowlerStats || {})).map((name) => {
                const s = currentInn.bowlerStats?.[name] || {};
                const active = name === currentInn.currentBowler;
                return (
                  <div
                    key={name}
                    className={`flex justify-between items-center p-4 rounded-xl ${active ? "bg-white/10 border border-white/5" : "opacity-70"}`}
                  >
                    <div className={`text-2xl font-bold truncate w-[300px] ${active ? "text-blue-400" : "text-slate-300"}`}>
                      {name}
                    </div>
                    <div className={`flex gap-12 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-500"}`}>
                      <span className="opacity-60">
                        {Math.floor(s.balls / 6)}.{s.balls % 6}
                      </span>
                      <span>{s.runs}</span>
                      <span className={`${s.wickets > 0 ? "text-yellow-400" : ""}`}>
                        {s.wickets}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}