// src/components/MatchCommentary.jsx
import React, { useMemo, useState, useEffect } from "react";
import { getMatchInsights } from "../utils/commentaryHelper"; 
import { fetchAICommentary, fetchMatchAnalysis } from "../utils/gemini";

export default function MatchCommentary({ match }) {
  if (!match) return null;

  // --- 1. SAFE DATA EXTRACTION ---
  // Fix: Ensure innings is always an array for UI mapping
  const inningsArray = useMemo(() => {
    if (!match.innings) return [];
    // Convert Map to Array and FILTER OUT empty "Ghost" innings
    return Object.keys(match.innings)
      .map(key => ({ ...match.innings[key], dbIndex: key }))
      .filter(inn => inn.battingTeam && inn.timeline) // Only keep valid ones
      .sort((a, b) => a.dbIndex - b.dbIndex);
  }, [match.innings]);

  // --- STATE ---
  const [activeInningIndex, setActiveInningIndex] = useState(match.currentInnings || 0);
  const [aiComments, setAiComments] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Optional: Auto-switch logic
  }, [match.currentInnings]);

  // Get active inning data safely
  const inn = inningsArray[activeInningIndex];

  // --- HELPER: Rule-Based Fallback ---
  const generateFallbackCommentary = (e) => {
    if (e.isWicket) return `${e.bowler} takes the wicket of ${e.batter}! ${e.dismissalText}.`;
    if (e.runs === 4) return `${e.batter} smashes it for FOUR! Great shot.`;
    if (e.runs === 6) return `High and handsome! ${e.batter} clears the rope for SIX!`;
    if (e.extrasType) return `${e.extrasType} from ${e.bowler}. ${e.runs} runs added.`;
    if (e.runs === 0) return `${e.bowler} bowls a dot ball to ${e.batter}.`;
    return `${e.batter} takes ${e.runs} run${e.runs !== 1 ? 's' : ''}.`;
  };

  // --- 2. PROCESS TIMELINE ---
  const timelineData = useMemo(() => {
    if (!inn || (!inn.timeline && !inn.ballsLog)) return [];

    const rawLogs = inn.timeline || inn.ballsLog || [];
    const processedEvents = [];

    // Running Counters
    let currentScore = 0;
    let currentWickets = 0;
    let overRuns = 0;
    let overWickets = 0;
    let legalBallCount = 0;
    let overNumber = 0;

    // Process logs chronologically
    rawLogs.forEach((ball, originalIndex) => {
      // Normalization
      let runs = 0;
      let isW = false;
      let isLegal = true;
      let batter = "Batter";
      let bowler = "Bowler";
      let extrasType = "";
      let dismissalText = "";

      if (typeof ball === "object") {
        runs = ball.runs || 0;
        isW = ball.isWicket;
        batter = ball.batter || batter;
        bowler = ball.bowler || bowler;

        // Check Extras
        if (ball.isWide) { isLegal = false; extrasType = "Wide"; }
        else if (ball.isNoBall) { isLegal = false; extrasType = "No Ball"; }
        else if (ball.isBye) { extrasType = "Bye"; }
        else if (ball.isLegBye) { extrasType = "Leg Bye"; }

        // Check Wicket Details
        if (isW) {
            const wType = ball.wicketType || "bowled";
            if(wType === "caught") dismissalText = `Caught by ${ball.fielderName || "Fielder"}`;
            else if(wType === "runout") dismissalText = `Run Out (${ball.whoOut || "Batter"})`;
            else if(wType === "stumped") dismissalText = `Stumped by ${ball.fielderName || "Keeper"}`;
            else if(wType === "lbw") dismissalText = "LBW";
            else dismissalText = "Bowled";
        }
      } else {
        // Legacy String Handling
        const s = String(ball);
        isW = s === "W";
        if (s.includes("WD") || s.includes("NB")) isLegal = false;
        runs = parseInt(s) || 0;
        if (s.includes("WD")) extrasType = "Wide";
        if (s.includes("NB")) extrasType = "No Ball";
      }

      // Update Totals
      currentScore += runs;
      if (isW) currentWickets++;
      overRuns += runs;
      if (isW) overWickets++;
      if (isLegal) legalBallCount++;

      // Construct Event Object
      processedEvents.push({
        type: "BALL",
        id: `${activeInningIndex}-${originalIndex}`, // Unique ID
        val: typeof ball === "object" ? (ball.isWicket ? "W" : ball.runs) : ball,
        runs,
        isWicket: isW,
        isBoundary: runs === 4 || runs === 6,
        extrasType,
        dismissalText,
        batter,
        bowler,
        raw: typeof ball === "object" ? ball : { runs, isWicket: isW, batter, bowler } // Snapshot for AI
      });

      // Over Summary
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
        // Reset Over Stats
        overRuns = 0; overWickets = 0; legalBallCount = 0;
      }
    });

    // Reverse for display (Newest on top)
    return processedEvents.reverse().map(event => {
        if (event.type === "SUMMARY") return event;
        
        // Hydrate with AI text if available
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
    
    // Only fetch for the very first item (newest) if it's a BALL
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
        if (text) {
          setAiComments(prev => ({ ...prev, [latestEvent.id]: text }));
        }
        setIsTyping(false);
      });

      const ballCount = inn.timeline?.length || 0;
      if (ballCount > 0 && ballCount % 6 === 0) {
        fetchMatchAnalysis(match, inn).then(analysis => {
            if (analysis) setAiInsight(analysis);
        });
      }
    }
  }, [timelineData.length, activeInningIndex]);

  const ruleBasedInsights = getMatchInsights(match, activeInningIndex);

  return (
    <div className="flex flex-col gap-4 h-full">
        
      {/* --- INNINGS TABS (Using Safe Array) --- */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1">
        {inningsArray.map((_, idx) => (
            <button
                key={idx}
                onClick={() => setActiveInningIndex(idx)}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                    activeInningIndex === idx 
                    ? "bg-cyan-900/50 text-cyan-400 shadow-sm border border-cyan-800" 
                    : "text-gray-500 hover:text-gray-300"
                }`}
            >
                {idx === 0 ? "1st Innings" : "2nd Innings"}
            </button>
        ))}
      </div>

      {/* --- AI COACH INSIGHT --- */}
      <div className={`p-4 rounded-xl border shadow-lg transition-all duration-500 ${
          aiInsight ? "bg-indigo-900/20 border-indigo-500/50" : "bg-gray-800 border-gray-700"
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{aiInsight ? "🤖" : "📊"}</span>
          <h4 className="font-bold text-white uppercase text-xs tracking-widest">
            {aiInsight ? "Gemini Coach Analysis" : ruleBasedInsights?.title || "Match Insight"}
          </h4>
        </div>
        <div className="text-gray-300 font-mono text-sm leading-relaxed whitespace-pre-line">
          {aiInsight || ruleBasedInsights?.text || "Waiting for enough data to analyze..."}
        </div>
      </div>

      {/* --- LIVE COMMENTARY FEED --- */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-1 min-h-[400px] flex flex-col relative">
        
        {/* Header */}
        <div className="bg-gray-950/50 p-3 border-b border-gray-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span>🎙️</span> Ball by Ball
          </span>
          <div className="flex items-center gap-2">
            {isTyping && <span className="text-[10px] text-cyan-400 animate-pulse font-bold">AI writing...</span>}
            {activeInningIndex === match.currentInnings && (
                <span className="text-[10px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded border border-red-900/50 animate-pulse">
                ● LIVE
                </span>
            )}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="divide-y divide-gray-800 overflow-y-auto custom-scrollbar">
          {timelineData.length === 0 ? (
            <div className="p-12 text-center text-gray-600 italic text-sm">
              No data for this innings yet.
            </div>
          ) : (
            timelineData.map((event) => {
              
              // --- A. OVER SUMMARY CARD ---
              if (event.type === "SUMMARY") {
                return (
                  <div key={event.id} className="bg-gray-800/50 p-4 border-y border-gray-700/50 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        End of Over {event.over}
                      </div>
                      <div className="text-white font-bold text-sm">
                        {event.runs} Runs • {event.wickets} Wickets
                      </div>
                      <div className="text-xs text-gray-400 italic">
                        Bowled by {event.bowler}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase">Score</div>
                      <div className="text-xl font-mono font-black text-white">
                        {event.totalScore}/{event.totalWickets}
                      </div>
                    </div>
                  </div>
                );
              }

              // --- B. BALL COMMENTARY CARD ---
              return (
                <div key={event.id} className="p-4 flex gap-4 hover:bg-white/5 transition-colors group">
                  
                  {/* Ball Value Circle */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-lg border-2 ${
                        event.isWicket ? "bg-red-600 border-red-400 text-white" :
                        event.val == "6" ? "bg-purple-600 border-purple-400 text-white" :
                        event.val == "4" ? "bg-green-600 border-green-400 text-white" :
                        event.extrasType ? "bg-yellow-600 border-yellow-400 text-white" :
                        "bg-gray-800 border-gray-700 text-gray-400"
                    }`}>
                      {event.val}
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-200 text-sm">
                            {event.bowler} to {event.batter}
                        </span>
                        {/* Tags */}
                        {event.isWicket && (
                            <span className="text-[9px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded border border-red-800 font-bold uppercase">
                                WICKET
                            </span>
                        )}
                        {event.extrasType && (
                            <span className="text-[9px] bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-800 font-bold uppercase">
                                {event.extrasType}
                            </span>
                        )}
                      </div>
                      {event.isAI && (
                        <span className="text-[10px] text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Generated by AI">
                            ✨ AI
                        </span>
                      )}
                    </div>

                    <p className={`text-sm leading-relaxed ${event.isAI ? "text-cyan-100/90" : "text-gray-400"}`}>
                      {event.text}
                    </p>
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