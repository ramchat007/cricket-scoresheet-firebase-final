// src/components/MatchCommentary.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  generateCommentary,
  getMatchInsights,
} from "../utils/commentaryHelper"; // Keep your old helper as fallback
import { fetchAICommentary, fetchMatchAnalysis } from "../utils/gemini"; // Import AI

export default function MatchCommentary({ match }) {
  if (!match) return null;

  const currentIdx = match.currentInnings || 0;
  const inn = match.innings?.[currentIdx];

  // Local state to store AI generated text (cache)
  const [aiComments, setAiComments] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  // 1. Generate Timeline Data WITH OVER SUMMARIES
  const timelineData = useMemo(() => {
    if (!inn || (!inn.timeline && !inn.ballsLog)) return [];

    const rawLogs = inn.timeline || inn.ballsLog || [];
    const processedEvents = [];

    // Counters for "Running Totals"
    let currentScore = 0;
    let currentWickets = 0;

    // Counters for "This Over"
    let overRuns = 0;
    let overWickets = 0;
    let legalBallCount = 0;
    let overNumber = 0;

    // Iterate Chronologically (Oldest -> Newest) to calculate totals
    rawLogs.forEach((ball, originalIndex) => {
      // Normalize Data
      let runs = 0;
      let isW = false;
      let isLegal = true;
      let batter = "Batter";
      let bowler = "Bowler";

      // Handle Object vs Legacy String
      if (typeof ball === "object") {
        runs = ball.runs || 0;
        isW = ball.isWicket;
        // Wides and NoBalls don't count towards the 6-ball over limit
        if (ball.isWide || ball.isNoBall) isLegal = false;
        batter = ball.batter || batter;
        bowler = ball.bowler || bowler;
      } else {
        const s = String(ball);
        isW = s === "W";
        // Simple heuristic for legacy strings
        if (s.includes("WD") || s.includes("NB")) isLegal = false;
        runs = parseInt(s) || 0;
        // Legacy strings often didn't store the extra run, assume +1 for extras if string
        if (s.includes("WD") || s.includes("NB"))
          runs = (parseInt(s.replace(/\D/g, "")) || 0) + 1;
      }

      // Update Stats
      currentScore += runs;
      if (isW) currentWickets++;

      overRuns += runs;
      if (isW) overWickets++;
      if (isLegal) legalBallCount++;

      // Add BALL Event
      processedEvents.push({
        type: "BALL",
        id: originalIndex, // Key for AI text lookup
        val:
          typeof ball === "object" ? (ball.isWicket ? "W" : ball.runs) : ball,
        runs,
        isWicket: isW,
        batter,
        bowler,
        // Pass raw for AI
        raw:
          typeof ball === "object"
            ? ball
            : { runs, isWicket: isW, batter, bowler },
      });

      // Check for Over Completion (6 legal balls)
      if (isLegal && legalBallCount === 6) {
        overNumber++;
        // Add SUMMARY Event
        processedEvents.push({
          type: "SUMMARY",
          id: `summary-${overNumber}`,
          over: overNumber,
          runs: overRuns,
          wickets: overWickets,
          totalScore: currentScore,
          totalWickets: currentWickets,
          bowler: bowler,
        });

        // Reset Over Stats
        overRuns = 0;
        overWickets = 0;
        legalBallCount = 0;
      }
    });

    // Reverse for Display (Newest First) and Hydrate Text
    return processedEvents.reverse().map((event) => {
      if (event.type === "SUMMARY") return event;

      // For Ball events, generate text
      const aiText = aiComments[event.id];
      return {
        ...event,
        text:
          aiText || generateCommentary(event.raw, event.batter, event.bowler),
        isAI: !!aiText,
      };
    });
  }, [inn, aiComments]);

  // 2. EFFECT: Fetch AI Commentary for the NEWEST Ball Only
  useEffect(() => {
    if (!inn || !inn.timeline || inn.timeline.length === 0) return;

    const latestIndex = inn.timeline.length - 1;
    const latestBall = inn.timeline[latestIndex];

    if (!aiComments[latestIndex]) {
      setIsTyping(true);

      const ballData =
        typeof latestBall === "object"
          ? latestBall
          : {
              runs: parseInt(latestBall) || 0,
              isWicket: latestBall === "W",
              batter: "Batsman",
              bowler: "Bowler",
            };

      fetchAICommentary(ballData).then((text) => {
        if (text) {
          setAiComments((prev) => ({ ...prev, [latestIndex]: text }));
        }
        setIsTyping(false);
      });

      if (latestIndex > 0 && latestIndex % 6 === 0) {
        fetchMatchAnalysis(match, inn).then((analysis) => {
          if (analysis) setAiInsight(analysis);
        });
      }
    }
  }, [inn?.timeline?.length]);

  // 3. Fallback Insights
  const ruleBasedInsights = getMatchInsights(match);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* --- AI INSIGHTS CARD --- */}
      <div
        className={`p-4 rounded-xl border shadow-lg transition-all duration-500
          ${
            aiInsight
              ? "bg-indigo-900/40 border-indigo-500"
              : "bg-gray-800 border-gray-700"
          }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{aiInsight ? "🤖" : "📊"}</span>
          <h4 className="font-bold text-white uppercase text-xs tracking-widest">
            {aiInsight
              ? "Gemini Coach AI"
              : ruleBasedInsights?.title || "Match Insight"}
          </h4>
        </div>
        <div className="text-white font-mono text-sm leading-relaxed whitespace-pre-line">
          {aiInsight ||
            ruleBasedInsights?.text ||
            "Analyzing match situation..."}
        </div>
      </div>

      {/* --- SCROLLING COMMENTARY --- */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-1 min-h-[300px] flex flex-col">
        <div className="bg-gray-950/50 p-3 border-b border-gray-800 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Ball by Ball
          </span>
          <div className="flex items-center gap-2">
            {isTyping && (
              <span className="text-[10px] text-cyan-400 animate-pulse">
                AI is typing...
              </span>
            )}
            <span className="text-[10px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded animate-pulse">
              ● LIVE
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
          {timelineData.length === 0 ? (
            <div className="p-8 text-center text-gray-600 italic text-sm">
              Waiting for the first ball...
            </div>
          ) : (
            timelineData.map((c, i) => {
              // RENDER OVER SUMMARY
              if (c.type === "SUMMARY") {
                return (
                  <div
                    key={`sum-${c.id}`}
                    className="bg-gray-800/80 p-3 border-y border-gray-700 flex justify-between items-center animate-in slide-in-from-left-4">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        End of Over {c.over}
                      </span>
                      <span className="text-white font-bold text-sm">
                        {c.runs} runs •{" "}
                        {c.wickets > 0 ? `${c.wickets} wkts` : "0 wkts"}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 uppercase">
                        Total
                      </div>
                      <div className="text-xl font-black text-cyan-400 font-mono leading-none">
                        {c.totalScore}/{c.totalWickets}
                      </div>
                    </div>
                  </div>
                );
              }

              // RENDER BALL
              return (
                <div
                  key={c.id}
                  className="p-4 flex gap-4 hover:bg-white/5 transition-colors animate-in slide-in-from-top-2">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-lg
                     ${
                       c.val === "W"
                         ? "bg-red-600 text-white"
                         : c.val == 4
                         ? "bg-green-600 text-white"
                         : c.val == 6
                         ? "bg-purple-600 text-white"
                         : "bg-gray-800 text-gray-400 border border-gray-700"
                     }`}>
                      {c.val}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p
                        className={`text-sm leading-relaxed ${
                          c.isAI ? "text-cyan-100" : "text-gray-300"
                        }`}>
                        {c.text}
                      </p>
                      {c.isAI && (
                        <span
                          className="text-[10px] text-cyan-500 ml-2"
                          title="AI Generated">
                          ✨
                        </span>
                      )}
                    </div>
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
