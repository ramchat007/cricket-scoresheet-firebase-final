import React, { useMemo, useState, useEffect } from "react";
import { getMatchInsights } from "../utils/commentaryHelper";
import { fetchAICommentary, fetchMatchAnalysis } from "../utils/gemini";

export default function MatchCommentary({ match }) {
  if (!match) return null;

  const inningsArray = useMemo(() => {
    if (!match.innings) return [];
    const innData = Array.isArray(match.innings)
      ? match.innings
      : Object.values(match.innings);
    return innData
      .filter((inn) => inn && inn.battingTeam)
      .sort((a, b) => (a.index || 0) - (b.index || 0));
  }, [match.innings]);

  const [activeInningIndex, setActiveInningIndex] = useState(
    match.currentInnings || 0,
  );
  const [aiComments, setAiComments] = useState({});
  const [aiInsight, setAiInsight] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (match.currentInnings !== undefined) {
      setActiveInningIndex(match.currentInnings);
    }
  }, [match.currentInnings]);

  const inn = inningsArray[activeInningIndex];

  // --- HELPERS ---
  const generateFallbackCommentary = (e) => {
    if (e.isWicket)
      return `${e.bowler} strikes! ${e.batter} is out (${e.dismissalText}).`;
    if (e.runs === 4) return `${e.batter} finds the gap perfectly for FOUR!`;
    if (e.runs === 6)
      return `High and handsome! ${e.batter} clears the ropes for SIX!`;
    if (e.extrasType === "Wide")
      return `Wide ball down the leg side from ${e.bowler}.`;
    if (e.extrasType === "No Ball") return `No Ball! ${e.bowler} oversteps.`;
    return `${e.runs} runs added to the score.`;
  };

  const getBadgeText = (val, extrasType, physicalRuns, isWicket) => {
    if (isWicket)
      return extrasType === "Wide"
        ? "W+WD"
        : extrasType === "No Ball"
          ? "W+NB"
          : "W";
    if (extrasType === "Wide")
      return physicalRuns > 0 ? `WD+${physicalRuns}` : "WD";
    if (extrasType === "No Ball")
      return physicalRuns > 1 ? `NB+${physicalRuns - 1}` : "NB";
    return val;
  };

  const timelineData = useMemo(() => {
    if (!inn || (!inn.timeline && !inn.ballsLog)) return [];
    const rawLogs = inn.timeline || inn.ballsLog || [];
    const processedEvents = [];
    let currentScore = 0,
      currentWickets = 0,
      overRuns = 0,
      overWickets = 0,
      legalBallCount = 0,
      overNumber = 0;

    rawLogs.forEach((ball, originalIndex) => {
      let runs = 0,
        isW = false,
        isLegal = true,
        batter = "Batter",
        bowler = "Bowler",
        extrasType = "",
        dismissalText = "",
        displayVal = "",
        physicalRuns = 0;
      if (typeof ball === "object") {
        runs = ball.runs || 0;
        physicalRuns = ball.physicalRuns || 0;
        isW = ball.isWicket;
        batter = ball.batter || batter;
        bowler = ball.bowler || bowler;
        displayVal = ball.code || (isW ? "W" : runs);
        if (ball.isWide) {
          isLegal = false;
          extrasType = "Wide";
        } else if (ball.isNoBall) {
          isLegal = false;
          extrasType = "No Ball";
        }
        if (isW) {
          const wType = ball.wicketType || "bowled";
          dismissalText =
            wType === "caught"
              ? `Caught ${ball.fielderName || "Fielder"}`
              : wType === "runout"
                ? `Run Out (${ball.whoOut || "Batter"})`
                : wType.toUpperCase();
        }
      } else {
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
        physicalRuns,
        isWicket: isW,
        extrasType,
        dismissalText,
        batter,
        bowler,
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
          bowler,
        });
        overRuns = 0;
        overWickets = 0;
        legalBallCount = 0;
      }
    });
    return processedEvents.reverse().map((event) => ({
      ...event,
      text: aiComments[event.id] || generateFallbackCommentary(event),
      isAI: !!aiComments[event.id],
    }));
  }, [inn, aiComments, activeInningIndex]);

  useEffect(() => {
    if (!inn || !timelineData.length) return;
    const latestEvent = timelineData.find((e) => e.type === "BALL");
    if (latestEvent && !aiComments[latestEvent.id]) {
      setIsTyping(true);
      fetchAICommentary({
        ...latestEvent,
        matchSituation: `${inn.score}/${inn.wickets} in ${inn.over}.${inn.overBallCount}`,
      }).then((text) => {
        if (text) setAiComments((p) => ({ ...p, [latestEvent.id]: text }));
        setIsTyping(false);
      });
    }
  }, [timelineData.length, activeInningIndex]);

  const ruleBasedInsights = getMatchInsights(match, activeInningIndex);

  return (
    <div className="flex flex-col gap-5 w-full max-w-4xl mx-auto">
      {/* 1. INNINGS TABS (Small & Sticky) */}
      <div className="sticky top-0 z-20 bg-[#0F1115] py-2">
        <div className="flex bg-[#1C2128] border border-white/5 rounded-xl p-1 shadow-lg max-w-xs mx-auto">
          {inningsArray.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveInningIndex(idx)}
              className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeInningIndex === idx ? "bg-teal-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}>
              {idx === 0 ? "1st Inn" : "2nd Inn"}
            </button>
          ))}
        </div>
      </div>

      {/* 2. AI INSIGHT (Compact & Self-Contained) */}
      <div
        className={`group relative p-4 rounded-2xl border transition-all duration-500 overflow-visible ${aiInsight ? "bg-indigo-950/20 border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.1)]" : "bg-[#1C2128] border-white/5"}`}>
        {aiInsight && (
          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[8px] font-black px-2 py-1 rounded-md shadow-lg animate-bounce">
            LIVE ANALYSIS
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lg shadow-inner">
            {aiInsight ? "🤖" : "📊"}
          </div>
          <div className="flex-1 min-w-0">
            <h4
              className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${aiInsight ? "text-indigo-400" : "text-gray-500"}`}>
              {aiInsight
                ? "Gemini Strategic Analysis"
                : ruleBasedInsights?.title || "Match Insight"}
            </h4>
            <div className="text-gray-300 text-sm leading-relaxed font-medium line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
              "
              {aiInsight ||
                ruleBasedInsights?.text ||
                "Synchronizing with the field..."}
              "
            </div>
          </div>
        </div>
      </div>

      {/* 3. COMMENTARY FEED (Primary Page Scroll) */}
      <div className="bg-[#1C2128] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-[#161920]/90 p-5 border-b border-white/5 flex justify-between items-center">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>{" "}
            Commentary Feed
          </span>
          {isTyping && (
            <span className="text-[9px] text-teal-500 animate-pulse font-black tracking-widest">
              GEMINI IS ANALYZING...
            </span>
          )}
        </div>

        <div className="divide-y divide-white/5">
          {timelineData.length === 0 ? (
            <div className="p-20 text-center text-gray-600 italic text-sm">
              Match logic initializing...
            </div>
          ) : (
            timelineData.map((event) => {
              if (event.type === "SUMMARY") {
                return (
                  <div
                    key={event.id}
                    className="bg-gradient-to-r from-[#161920] to-[#1C2128] p-5 border-y border-white/5 flex justify-between items-center">
                    <div>
                      <div className="text-[9px] font-black text-teal-500 uppercase tracking-widest mb-1">
                        Over {event.over} Done
                      </div>
                      <div className="text-white font-black text-base">
                        {event.runs} Runs • {event.wickets} Wickets
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-gray-500 uppercase font-black mb-1">
                        Score
                      </div>
                      <div className="text-2xl font-mono font-black text-white">
                        {event.totalScore}/{event.totalWickets}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={event.id}
                  className="p-5 flex gap-5 hover:bg-white/[0.01] transition-colors">
                  <div
                    className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-[11px] border-2 ${
                      event.isWicket
                        ? "bg-red-500/10 border-red-500/40 text-red-500"
                        : event.runs >= 6
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                          : event.runs >= 4
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                            : event.extrasType
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                              : "bg-black/20 border-white/5 text-gray-500"
                    }`}>
                    {getBadgeText(
                      event.val,
                      event.extrasType,
                      event.physicalRuns,
                      event.isWicket,
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-gray-200 text-[11px] uppercase tracking-wider truncate">
                        {event.bowler}{" "}
                        <span className="text-gray-600 mx-1">➜</span>{" "}
                        {event.batter}
                      </span>
                    </div>
                    <p
                      className={`text-sm leading-snug font-medium ${event.isWicket ? "text-red-400/90" : "text-gray-400"}`}>
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
