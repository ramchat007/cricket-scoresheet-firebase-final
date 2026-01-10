import React, { useMemo, useState, useEffect } from "react";
import { getMatchInsights } from "../utils/commentaryHelper"; 
import { fetchAICommentary, fetchMatchAnalysis } from "../utils/gemini";

export default function MatchCommentary({ match }) {
  if (!match) return null;

  // --- 1. SAFE DATA EXTRACTION ---
  const inningsArray = useMemo(() => {
    if (!match.innings) return [];
    const innData = Array.isArray(match.innings) ? match.innings : Object.values(match.innings);
    return innData
      .filter(inn => inn && inn.battingTeam) 
      .sort((a, b) => (a.index || 0) - (b.index || 0));
  }, [match.innings]);

  const [activeInningIndex, setActiveInningIndex] = useState(match.currentInnings || 0);
  const [aiComments, setAiComments] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (match.currentInnings !== undefined) {
        setActiveInningIndex(match.currentInnings);
    }
  }, [match.currentInnings]);

  const inn = inningsArray[activeInningIndex];

  // --- HELPER: FALLBACK COMMENTARY ---
  const generateFallbackCommentary = (e) => {
    if (e.isWicket) return `${e.bowler} strikes! ${e.batter} is out (${e.dismissalText}).`;
    if (e.runs === 4) return `${e.batter} finds the gap perfectly for FOUR!`;
    if (e.runs === 6) return `High and handsome! ${e.batter} clears the ropes for SIX!`;
    if (e.extrasType === "Wide") return `Wide ball down the leg side from ${e.bowler}.`;
    if (e.extrasType === "No Ball") return `No Ball! ${e.bowler} oversteps. Free hit coming up.`;
    if (e.runs === 0) return `Good length delivery from ${e.bowler}, played straight to the fielder.`;
    if (e.runs === 1) return `Pushed into the gap for a single.`;
    return `${e.runs} runs added to the score.`;
  };

  // --- HELPER: BADGE TEXT FORMATTER (FIXED) ---
  const getBadgeText = (val, extrasType, physicalRuns) => {
    if (String(val).includes("W") && !String(val).includes("WD")) return "W";
    
    if (extrasType === "Wide") {
      // If physical runs exist (e.g. Wide + 1), return "WD+1"
      return physicalRuns > 0 ? `WD+${physicalRuns}` : "WD";
    }
    
    if (extrasType === "No Ball") {
      // If physical runs exist (e.g. NB + 1), return "NB+1"
      return physicalRuns > 0 ? `NB+${physicalRuns}` : "NB";
    }

    // Standard runs
    return val;
  };

  // --- 2. PROCESS TIMELINE ---
  const timelineData = useMemo(() => {
    if (!inn || (!inn.timeline && !inn.ballsLog)) return [];

    const rawLogs = inn.timeline || inn.ballsLog || [];
    const processedEvents = [];

    // Counters
    let currentScore = 0;
    let currentWickets = 0;
    let overRuns = 0;
    let overWickets = 0;
    let legalBallCount = 0;
    let overNumber = 0;

    rawLogs.forEach((ball, originalIndex) => {
      let runs = 0;
      let isW = false;
      let isLegal = true;
      let batter = "Batter";
      let bowler = "Bowler";
      let extrasType = "";
      let dismissalText = "";
      let displayVal = "";
      let physicalRuns = 0;

      if (typeof ball === "object") {
        runs = ball.runs || 0;
        physicalRuns = ball.physicalRuns || 0; // Capture physical runs
        isW = ball.isWicket;
        batter = ball.batter || batter;
        bowler = ball.bowler || bowler;
        displayVal = ball.code || (isW ? "W" : runs);

        if (ball.isWide) { isLegal = false; extrasType = "Wide"; }
        else if (ball.isNoBall) { isLegal = false; extrasType = "No Ball"; }
        else if (ball.isBye) { extrasType = "Bye"; }
        else if (ball.isLegBye) { extrasType = "Leg Bye"; }

        if (isW) {
            const wType = ball.wicketType || "bowled";
            if(wType === "caught") dismissalText = `Caught by ${ball.fielderName || "Fielder"}`;
            else if(wType === "runout") dismissalText = `Run Out (${ball.whoOut || "Batter"})`;
            else if(wType === "stumped") dismissalText = `Stumped`;
            else if(wType === "lbw") dismissalText = "LBW";
            else dismissalText = "Bowled";
        }
      } else {
        // Legacy handling
        const s = String(ball);
        displayVal = s;
        isW = s === "W";
        if (s.includes("WD") || s.includes("NB")) isLegal = false;
        runs = parseInt(s) || 0;
        if (s.includes("WD")) extrasType = "Wide";
        if (s.includes("NB")) extrasType = "No Ball";
      }

      currentScore += runs;
      if (isW) currentWickets++;
      overRuns += runs;
      if (isW) overWickets++;
      if (isLegal) legalBallCount++;

      processedEvents.push({
        type: "BALL",
        id: `${activeInningIndex}-${originalIndex}`,
        val: displayVal,
        runs,
        physicalRuns, // Pass to renderer
        isWicket: isW,
        isBoundary: runs === 4 || runs === 6,
        extrasType,
        dismissalText,
        batter,
        bowler,
        raw: typeof ball === "object" ? ball : { runs, isWicket: isW, batter, bowler }
      });

      if (isLegal && legalBallCount === 6) {
        overNumber++;
        processedEvents.push({
          type: "SUMMARY",
          id: `summary-${activeInningIndex}-${overNumber}`,
          over: overNumber,
          runs: overRuns,
          wickets: overWickets,
          totalScore: currentScore,
          totalWickets: currentWickets,
          bowler: bowler
        });
        overRuns = 0; overWickets = 0; legalBallCount = 0;
      }
    });

    return processedEvents.reverse().map(event => {
        if (event.type === "SUMMARY") return event;
        const aiText = aiComments[event.id];
        return {
            ...event,
            text: aiText || generateFallbackCommentary(event),
            isAI: !!aiText
        };
    });

  }, [inn, aiComments, activeInningIndex]);

  // --- 3. AI TRIGGER ---
  useEffect(() => {
    if (!inn || !timelineData.length) return;
    const latestEvent = timelineData.find(e => e.type === "BALL");
    if (!latestEvent) return;

    if (!aiComments[latestEvent.id]) {
      setIsTyping(true);
      const context = {
        batter: latestEvent.batter,
        bowler: latestEvent.bowler,
        runs: latestEvent.runs,
        isWicket: latestEvent.isWicket,
        wicketType: latestEvent.dismissalText,
        extras: latestEvent.extrasType,
        matchSituation: `${inn.score}/${inn.wickets} in ${inn.over}.${inn.overBallCount} overs`
      };

      fetchAICommentary(context).then(text => {
        if (text) setAiComments(prev => ({ ...prev, [latestEvent.id]: text }));
        setIsTyping(false);
      });

      const ballCount = inn.timeline?.length || 0;
      if (ballCount > 0 && ballCount % 6 === 0) {
        fetchMatchAnalysis(match, inn).then(analysis => { if (analysis) setAiInsight(analysis); });
      }
    }
  }, [timelineData.length, activeInningIndex]);

  const ruleBasedInsights = getMatchInsights(match, activeInningIndex);

  return (
    <div className="flex flex-col gap-4 h-full pb-10">
      
      {/* INNINGS TABS */}
      <div className="flex bg-[#1C2128] border border-white/5 rounded-2xl p-1 shadow-md">
        {inningsArray.map((_, idx) => (
            <button key={idx} onClick={() => setActiveInningIndex(idx)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${activeInningIndex === idx ? "bg-slate-700 text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}>
                {idx === 0 ? "1st Innings" : "2nd Innings"}
            </button>
        ))}
      </div>

      {/* AI INSIGHT */}
      <div className={`p-5 rounded-2xl border shadow-lg transition-all duration-500 ${aiInsight ? "bg-indigo-900/10 border-indigo-500/30" : "bg-[#1C2128] border-white/5"}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl animate-pulse">{aiInsight ? "🤖" : "📊"}</span>
          <h4 className={`font-black uppercase text-[10px] tracking-[0.2em] ${aiInsight ? "text-indigo-400" : "text-slate-500"}`}>
            {aiInsight ? "Gemini Coach Analysis" : ruleBasedInsights?.title || "Match Insight"}
          </h4>
        </div>
        <div className="text-slate-300 font-medium text-sm leading-relaxed whitespace-pre-line">
          {aiInsight || ruleBasedInsights?.text || "Analyzing match situation..."}
        </div>
      </div>

      {/* COMMENTARY FEED */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden flex-1 min-h-[400px] flex flex-col relative shadow-2xl">
        <div className="bg-[#161920]/90 p-4 border-b border-white/5 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span>🎙️</span> Live Commentary
          </span>
          <div className="flex items-center gap-3">
            {isTyping && <span className="text-[10px] text-teal-500 animate-pulse font-bold tracking-wider">AI WRITING...</span>}
            {activeInningIndex === match.currentInnings && <span className="text-[9px] bg-red-900/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse font-black tracking-wider">● LIVE</span>}
          </div>
        </div>

        <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar">
          {timelineData.length === 0 ? (
            <div className="p-12 text-center text-slate-600 italic text-sm">Waiting for the first ball...</div>
          ) : (
            timelineData.map((event) => {
              if (event.type === "SUMMARY") {
                return (
                  <div key={event.id} className="bg-[#161920] p-4 border-y border-white/5 flex justify-between items-center shadow-inner">
                    <div>
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">End of Over {event.over}</div>
                      <div className="text-slate-200 font-bold text-sm">{event.runs} Runs • {event.wickets} Wickets</div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">Bowled by {event.bowler}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Score</div>
                      <div className="text-xl font-mono font-black text-slate-100">{event.totalScore}/{event.totalWickets}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={event.id} className="p-5 flex gap-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex flex-col items-center pt-1">
                    {/* BADGE RENDERING FIX */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-md border ${
                        event.isWicket ? "bg-red-900/20 border-red-500/50 text-red-400" :
                        event.val == "6" ? "bg-indigo-900/20 border-indigo-500/50 text-indigo-400 text-sm" :
                        event.val == "4" ? "bg-emerald-900/20 border-emerald-500/50 text-emerald-400 text-sm" :
                        event.extrasType ? "bg-amber-900/20 border-amber-500/50 text-amber-400" :
                        "bg-[#0F1115] border-white/10 text-slate-400 text-sm"
                    }`}>
                      {getBadgeText(event.val, event.extrasType, event.physicalRuns)}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-200 text-xs">
                            {event.bowler} <span className="text-slate-600 font-light">to</span> {event.batter}
                        </span>
                        {event.isWicket && <span className="text-[8px] bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-black uppercase tracking-wider">WICKET</span>}
                        {event.extrasType && <span className="text-[8px] bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-black uppercase tracking-wider">{event.extrasType}</span>}
                      </div>
                      {event.isAI && <span className="text-[9px] text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity font-black tracking-widest" title="Generated by AI">✨ AI</span>}
                    </div>
                    <p className={`text-sm leading-relaxed ${event.isAI ? "text-slate-300" : "text-slate-400"}`}>{event.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}