import React from "react";

export default function BroadcastSummaryCard({ tournamentName, match, type }) {
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  // Allow special types to render even if innings logic is fuzzy
  if (!currentInn && type !== "TOSS") return null;

  const isResult = type === "RESULT" || match.status === "completed";
  const isToss = type === "TOSS";
  // ✅ NEW: Check for Innings Break
  const isInningsBreak = type === "INNINGS_BREAK";

  // --- 1. SORTING LOGIC ---
  const batsmenOrdered =
    currentInn?.batsmenList && currentInn.batsmenList.length > 0
      ? currentInn.batsmenList
      : Object.keys(currentInn?.batsmenStats || {});

  const bowlersOrdered =
    currentInn?.bowlersList && currentInn.bowlersList.length > 0
      ? currentInn.bowlersList
      : Object.keys(currentInn?.bowlerStats || {});

  // --- 2. MATCH INFO ---
  const matchName = match.name || `MATCH ${match.matchNo || "1"}`;
  const battingTeam = currentInn?.battingTeam || "Batting Team";
  const bowlingTeam = currentInn?.bowlingTeam || "Bowling Team";
  const score = currentInn?.score || 0;
  const wickets = currentInn?.wickets || 0;
  const overs = `${currentInn?.over || 0}.${currentInn?.overBallCount || 0}`;
  const totalBalls =
    (currentInn?.over || 0) * 6 + (currentInn?.overBallCount || 0);
  const crr = totalBalls > 0 ? ((score / totalBalls) * 6).toFixed(2) : "0.00";

  // Target Logic
  const isChasing = match.currentInnings === 1;
  let targetText = "";
  let targetScore = 0;
  if (match.innings?.[0]) {
    targetScore = match.innings[0].score + 1;
    const need = targetScore - score;
    const ballsLeft = (match.meta?.overs || 20) * 6 - totalBalls;
    targetText = `NEED ${need} OFF ${ballsLeft}`;
  }

  // Result Message Logic
  let resultMessage = match.result || "MATCH SUMMARY";
  if (isResult && !match.result) {
    const inn1 = match.innings?.[0];
    const inn2 = match.innings?.[1];
    if (inn1 && inn2) {
      if (inn2.score >= targetScore)
        resultMessage = `${inn2.battingTeam} WON BY ${10 - inn2.wickets} WICKETS`;
      else if (match.status === "completed" || inn2.score < targetScore - 1)
        resultMessage = `${inn1.battingTeam} WON BY ${targetScore - 1 - inn2.score} RUNS`;
      else if (inn2.score === targetScore - 1) resultMessage = "MATCH TIED";
    } else if (inn1) {
      resultMessage = `${inn1.battingTeam} SCORED ${inn1.score}`;
    }
  }

  // --- 3. THEME CONFIGURATION ---
  let mainTheme = {
    bg: "bg-[#0b0f19]",
    headerGradient:
      "bg-gradient-to-r from-[#002855] via-[#004e9a] to-[#002855]",
    headerBorder: "border-b-4 border-[#00b4d8]",
    titleColor: "text-white",
    accentColor: "text-[#00b4d8]",
    activeRow:
      "bg-gradient-to-r from-[#003e85]/40 to-transparent border-l-4 border-[#00b4d8]",
    statusText: `END OF OVER ${currentInn?.over || 0}`,
  };

  if (type === "WICKET") {
    mainTheme = {
      bg: "bg-[#0f0505]",
      headerGradient:
        "bg-gradient-to-r from-[#6b0505] via-[#9f1239] to-[#6b0505]",
      headerBorder: "border-b-4 border-[#f43f5e]",
      titleColor: "text-white",
      accentColor: "text-[#f43f5e]",
      activeRow:
        "bg-gradient-to-r from-[#831843]/40 to-transparent border-l-4 border-[#f43f5e]",
      statusText: "WICKET FALLEN",
    };
  } else if (isResult) {
    mainTheme = {
      bg: "bg-[#0f0b05]",
      headerGradient:
        "bg-gradient-to-r from-[#422006] via-[#a16207] to-[#422006]",
      headerBorder: "border-b-4 border-[#eab308]",
      titleColor: "text-white",
      accentColor: "text-[#eab308]",
      activeRow: "",
      statusText: "MATCH RESULT",
    };
  } else if (isToss) {
    mainTheme = {
      bg: "bg-[#0b0515]",
      headerGradient:
        "bg-gradient-to-r from-[#3b0764] via-[#7e22ce] to-[#3b0764]",
      headerBorder: "border-b-4 border-[#d8b4fe]",
      titleColor: "text-white",
      accentColor: "text-[#d8b4fe]",
      activeRow: "",
      statusText: "TOSS UPDATE",
    };
  } else if (isInningsBreak) {
    // ✅ NEW THEME: Innings Break (Teal/Cyan)
    mainTheme = {
      bg: "bg-[#042f2e]",
      headerGradient:
        "bg-gradient-to-r from-[#115e59] via-[#14b8a6] to-[#115e59]",
      headerBorder: "border-b-4 border-[#5eead4]",
      titleColor: "text-white",
      accentColor: "text-[#5eead4]",
      activeRow: "",
      statusText: "INNINGS BREAK",
    };
  }

  // --- 4. HELPER: Score Block ---
  const ScoreBlock = ({ inn, label }) => {
    if (!inn)
      return (
        <div className="text-slate-500 text-center text-xl font-bold tracking-widest opacity-50 flex items-center justify-center h-full">
          YET TO BAT
        </div>
      );
    return (
      <div
        className={`flex flex-col items-center p-6 ${mainTheme.bg} rounded-xl border border-white/10 w-full relative overflow-hidden shadow-2xl`}>
        <div
          className={`absolute top-0 w-full h-1.5 ${mainTheme.headerGradient}`}></div>
        <div className="absolute top-4 right-4 bg-white/5 px-3 py-1 text-[10px] font-black text-slate-400 rounded uppercase tracking-widest border border-white/5">
          {label}
        </div>
        <h3
          className={`${mainTheme.accentColor} font-black uppercase text-2xl mb-1 tracking-tighter drop-shadow-md mt-4`}>
          {inn.battingTeam}
        </h3>
        <div className="text-6xl font-black text-white mb-2 leading-none tracking-tighter drop-shadow-2xl">
          {inn.score}
          <span className="text-white/40 text-4xl">/</span>
          {inn.wickets}
        </div>
        <div className="text-slate-400 font-mono text-xl font-bold tracking-widest uppercase">
          {inn.over}.{inn.overBallCount} OVERS
        </div>
        <div className="w-full mt-6 border-t border-white/10 pt-4">
          {(() => {
            const batters = Object.entries(inn.batsmenStats || {})
              .sort((a, b) => b[1].runs - a[1].runs)
              .slice(0, 1);
            if (batters.length === 0) return null;
            return batters.map(([name, s]) => (
              <div
                key={name}
                className="flex justify-between items-center text-lg">
                <span className="text-white font-bold uppercase tracking-tight">
                  {name}
                </span>
                <span
                  className={`${mainTheme.accentColor} font-mono font-bold`}>
                  {s.runs}{" "}
                  <span className="text-sm text-slate-500">({s.balls})</span>
                </span>
              </div>
            ));
          })()}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`w-[1400px] ${mainTheme.bg} rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.9)] border border-white/20 font-sans transform scale-100`}>
      {/* HEADER */}
      <div className={`relative flex flex-col ${mainTheme.headerBorder}`}>
        <div className="bg-[#05080f] px-8 py-2 flex justify-between items-center border-b border-white/10">
          <div className="flex gap-4 text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">
            <span>{matchName}</span>
            <span className="text-white/20">•</span>
            <span>{tournamentName}</span>
          </div>
          <div
            className={`${mainTheme.accentColor} font-black uppercase tracking-widest text-sm animate-pulse`}>
            {mainTheme.statusText}
          </div>
        </div>

        <div
          className={`${mainTheme.headerGradient} h-28 flex items-center justify-between px-10 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

          {/* HEADER CONTENT LOGIC */}
          {isToss ? (
            <div className="w-full text-center">
              <span className="text-white font-black text-5xl uppercase tracking-widest italic drop-shadow-lg">
                TOSS REPORT
              </span>
            </div>
          ) : isResult ? (
            <div className="w-full text-center">
              <span className="text-white font-black text-5xl uppercase tracking-widest italic drop-shadow-lg">
                {resultMessage.toUpperCase()}
              </span>
            </div>
          ) : isInningsBreak ? (
            // ✅ INNINGS BREAK HEADER
            <div className="w-full text-center">
              <span className="text-white font-black text-5xl uppercase tracking-widest italic drop-shadow-lg">
                INNINGS BREAK
              </span>
            </div>
          ) : (
            // LIVE HEADER
            <>
              <div className="flex flex-col z-10">
                <span className="text-white font-black text-5xl uppercase tracking-tighter drop-shadow-lg leading-none">
                  {battingTeam}
                </span>
              </div>
              <div className="z-10 flex flex-col items-center">
                <div className="text-7xl font-black text-white leading-none tracking-tighter drop-shadow-2xl">
                  {score}/{wickets}
                </div>
                {isChasing && (
                  <div className="bg-black/40 px-3 py-1 rounded text-yellow-400 font-bold text-sm tracking-widest mt-1 uppercase border border-white/10">
                    {targetText}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end z-10 text-right">
                <span className="text-white font-mono font-black text-2xl mb-1 uppercase tracking-tighter drop-shadow-lg leading-none">
                  {bowlingTeam}
                </span>
                <span className="text-slate-200 font-mono font-bold text-4xl tracking-widest leading-none">
                  {overs}{" "}
                  <span className="text-lg align-top text-slate-400">OV</span>
                </span>
                <span className="text-[#00b4d8] font-bold text-sm tracking-widest mt-1">
                  CRR {crr}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BODY CONTENT */}
      {isResult || isInningsBreak ? (
        // ✅ SHARED VIEW: RESULT OR INNINGS BREAK (Split View)
        <div className="flex flex-col items-center">
          {/* If Result, we show winner in header. If Break, we show "TARGET" in center of body */}
          <div className="flex items-center justify-center gap-6 h-[450px] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] p-10 w-full">
            <ScoreBlock inn={match.innings[0]} label="1st INNINGS" />

            <div className="flex flex-col items-center justify-center h-full min-w-[200px]">
              {isInningsBreak ? (
                <>
                  <span className="text-slate-400 text-lg font-bold uppercase tracking-widest mb-2">
                    {match.innings[1]?.battingTeam || "Team B"}
                  </span>
                  <span className="text-slate-500 text-md font-bold text-[#5eead4] drop-shadow-[0_0_20px_rgba(94,234,212,0.5)]">
                    {targetText}
                  </span>
                </>
              ) : (
                <span className="text-6xl font-black text-slate-700 italic opacity-50">
                  VS
                </span>
              )}
            </div>

            <ScoreBlock inn={match.innings[1]} label="2nd INNINGS" />
          </div>
        </div>
      ) : isToss ? (
        // TOSS VIEW
        <div className="flex flex-col items-center justify-center h-[400px] bg-gradient-to-b from-[#151020] to-black p-12 space-y-8">
          <div className="text-4xl text-slate-400 font-bold uppercase tracking-[0.2em]">
            <span className={`${mainTheme.accentColor} font-black`}>
              {match.toss?.winner || "UNKNOWN"}
            </span>{" "}
            WON THE TOSS
          </div>
          <div className="text-7xl text-white font-black uppercase italic tracking-tighter drop-shadow-2xl">
            ELECTED TO{" "}
            <span className="underline decoration-4 decoration-purple-500 underline-offset-8">
              {match.toss?.decision || "PLAY"}
            </span>
          </div>
        </div>
      ) : (
        // STANDARD LIVE VIEW
        <div className="grid grid-cols-2 h-[600px] bg-[#0b0f19]">
          {/* ... (Keep existing Batting/Bowling tables) ... */}
          {/* LEFT PANEL: BATTING */}
          <div className="border-r border-white/10 flex flex-col relative">
            <div className="bg-[#131926] p-4 flex justify-between items-center border-b border-white/10 shadow-md">
              <span className="text-slate-300 font-bold uppercase tracking-widest text-xl">
                Batting Card
              </span>
              <div className="flex gap-10 w-[240px] justify-end text-slate-400 font-bold text-sm">
                <span className="w-10 text-center">R</span>
                <span className="w-10 text-center">B</span>
                <span className="w-12 text-center">SR</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {batsmenOrdered.map((name, index) => {
                const s = currentInn.batsmenStats?.[name] || {};
                const active =
                  name === currentInn.striker || name === currentInn.nonStriker;
                const rowBg =
                  index % 2 === 0 ? "bg-transparent" : "bg-[#111623]";
                const activeClass = active ? mainTheme.activeRow : rowBg;
                return (
                  <div
                    key={name}
                    className={`flex justify-between items-center px-6 py-4 border-b border-white/5 ${activeClass}`}>
                    <div className="flex items-center gap-3 w-[300px]">
                      {active && (
                        <div
                          className={`w-2 h-2 rounded-full ${mainTheme.accentColor.replace("text", "bg")} animate-pulse`}></div>
                      )}
                      <div
                        className={`text-2xl font-bold uppercase tracking-tight truncate ${active ? "text-white" : s.out ? "text-slate-600 line-through decoration-slate-600/50" : "text-slate-400"}`}>
                        {name}
                        {s.out && (
                          <span className="ml-2 text-[10px] bg-red-900 text-red-200 px-1 rounded align-middle no-underline inline-block">
                            OUT
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`flex gap-10 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-500"}`}>
                      <span
                        className={`w-10 text-center ${active ? mainTheme.accentColor : ""}`}>
                        {s.runs}
                      </span>
                      <span className="w-10 text-center opacity-60 text-xl pt-1">
                        {s.balls}
                      </span>
                      <span className="w-12 text-center opacity-40 text-lg pt-1.5">
                        {s.balls ? ((s.runs / s.balls) * 100).toFixed(0) : 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* RIGHT PANEL: BOWLING */}
          <div className="flex flex-col relative bg-[#0b0f19]">
            <div className="bg-[#131926] p-4 flex justify-between items-center border-b border-white/10 shadow-md">
              <span className="text-slate-300 font-bold uppercase tracking-widest text-xl">
                Bowling Card
              </span>
              <div className="flex gap-10 w-[240px] justify-end text-slate-400 font-bold text-sm">
                <span className="w-12 text-center">O</span>
                <span className="w-10 text-center">R</span>
                <span className="w-8 text-center">W</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {bowlersOrdered.map((name, index) => {
                const s = currentInn.bowlerStats?.[name] || {};
                const active = name === currentInn.currentBowler;
                const rowBg =
                  index % 2 === 0 ? "bg-transparent" : "bg-[#111623]";
                const activeClass = active ? mainTheme.activeRow : rowBg;
                return (
                  <div
                    key={name}
                    className={`flex justify-between items-center px-6 py-4 border-b border-white/5 ${activeClass}`}>
                    <div
                      className={`text-2xl font-bold uppercase tracking-tight truncate w-[300px] ${active ? "text-white" : "text-slate-400"}`}>
                      {name}
                    </div>
                    <div
                      className={`flex gap-10 w-[240px] justify-end font-mono text-2xl font-bold ${active ? "text-white" : "text-slate-500"}`}>
                      <span className="w-12 text-center opacity-60">
                        {Math.floor(s.balls / 6)}.{s.balls % 6}
                      </span>
                      <span className="w-10 text-center">{s.runs}</span>
                      <span
                        className={`w-8 text-center ${s.wickets > 0 ? mainTheme.accentColor : ""}`}>
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
