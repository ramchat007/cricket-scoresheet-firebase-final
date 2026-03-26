import React, { useMemo, useState, useEffect } from "react";
import { getMatchInsights } from "../utils/commentaryHelper";
import { fetchAICommentary } from "../utils/gemini";
import { useTheme } from "../context/ThemeContext";
import { Sparkles, Trophy, Target, MessageSquare, Mic } from "lucide-react";

export default function MatchCommentary({ match }) {
  const { theme } = useTheme();

  if (!match) return null;

  // --- 1. DATA PREP ---
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

  // --- 🧠 CONTEXT LOGIC (Result & Target) ---
  const matchContext = useMemo(() => {
    const inn1 = inningsArray[0];
    const inn2 = inningsArray[1];

    // Status & Result
    const isFinished =
      match.status === "finished" || match.meta?.matchStatus === "finished";
    let resultText = null;

    if (isFinished && inn1 && inn2) {
      if (inn1.score > inn2.score) {
        const diff = inn1.score - inn2.score;
        resultText = `${inn1.battingTeam} won by ${diff} run${diff !== 1 ? "s" : ""}`;
      } else if (inn2.score > inn1.score) {
        const totalWickets = parseInt(match.meta?.totalWickets || 10);
        const diff = Math.max(0, totalWickets - inn2.wickets);
        resultText = `${inn2.battingTeam} won by ${diff} wicket${diff !== 1 ? "s" : ""}`;
      } else {
        resultText = "Match Tied";
      }
    } else if (isFinished) {
      resultText = match.meta?.result || "Match Completed";
    }

    // Target Equation (Only relevant if 2nd Innings exists)
    const isSecondInnings = activeInningIndex === 1;
    const target = inn1?.score !== undefined ? inn1.score + 1 : null;

    let chaseText = null;
    if (isSecondInnings && !isFinished && inn2 && target) {
      const runsNeeded = target - inn2.score;
      const totalOvers = parseInt(match.meta?.overs || 20);
      const ballsBowled = inn2.over * 6 + inn2.overBallCount;
      const ballsRemaining = Math.max(0, totalOvers * 6 - ballsBowled);
      chaseText = `Target: ${target} • Need ${runsNeeded} off ${ballsRemaining}`;
    }

    return { resultText, chaseText, isFinished };
  }, [match, inningsArray, activeInningIndex]);

  // --- HELPERS ---
  const generateFallbackCommentary = (e) => {
    if (e.isWicket)
      return `${e.bowler} strikes! ${e.batter} is out (${e.dismissalText}). ${e.physicalRuns > 0 ? `Batters completed ${e.physicalRuns} run(s).` : ""}`;

    if (e.extrasType === "No Ball") {
      return `No Ball! ${e.bowler} oversteps. ${e.physicalRuns > 0 ? `${e.physicalRuns} run(s) taken off the bat.` : ""}`;
    }

    if (e.extrasType === "Wide") return `Wide ball from ${e.bowler}.`;
    if (e.runs === 4) return `${e.batter} finds the gap perfectly for FOUR!`;
    if (e.runs === 6)
      return `High and handsome! ${e.batter} clears the ropes for SIX!`;

    return `${e.runs} run(s) added to the score.`;
  };

  const getBadgeText = (val, extrasType, physicalRuns, isWicket) => {
    // 1. Handle Wickets first
    if (isWicket) {
      if (extrasType === "Wide")
        return physicalRuns > 0 ? `W+${physicalRuns}WD` : "W+WD";
      if (extrasType === "No Ball")
        return physicalRuns > 0 ? `W+${physicalRuns}NB` : "W+NB";
      return physicalRuns > 0 ? `W+${physicalRuns}` : "W";
    }

    // 2. Handle Wides (Standard: 1 penalty + runs)
    if (extrasType === "Wide") {
      return physicalRuns > 0 ? `${physicalRuns}+WD` : "WD";
    }

    // 3. 🟢 Corrected No Ball logic (Shows physical runs exactly as they are)
    if (extrasType === "No Ball") {
      return physicalRuns > 0 ? `${physicalRuns}+NB` : "NB";
    }

    // 4. Default for normal balls
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

  // ✅ INTELLIGENT INSIGHT DISPLAY
  const displayInsight = useMemo(() => {
    if (aiInsight) {
      return {
        title: "Gemini Strategic Analysis",
        text: aiInsight,
        icon: <Sparkles size={20} />,
        color: lightMode ? "text-indigo-700" : "text-indigo-400",
        border: lightMode ? "border-indigo-200" : "border-indigo-500/30",
        bg: lightMode ? "bg-indigo-50" : "bg-indigo-950/20",
        badge: "LIVE ANALYSIS",
      };
    }

    if (matchContext.isFinished && matchContext.resultText) {
      return {
        title: "Match Conclusion",
        text: matchContext.resultText,
        icon: <Trophy size={20} />,
        color: lightMode ? "text-amber-700" : "text-amber-400",
        border: lightMode ? "border-amber-200" : "border-amber-500/20",
        bg: lightMode ? "bg-amber-50" : "bg-amber-900/10",
        badge: "RESULT",
      };
    }

    return {
      title: ruleBasedInsights?.title || "Match Insight",
      text: ruleBasedInsights?.text || "Synchronizing with the field...",
      icon: <Target size={20} />,
      color: theme.sub,
      border: lightMode ? "border-gray-200" : "border-white/5",
      bg: theme.card,
      badge: null,
    };
  }, [aiInsight, matchContext, ruleBasedInsights, lightMode, theme]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-4xl mx-auto pb-20">
      {/* 1. INNINGS TABS */}
      <div className={`sticky top-0 z-20 py-2 ${theme.bg}`}>
        <div
          className={`flex border rounded-xl p-1 shadow-lg max-w-xs mx-auto ${lightMode ? "bg-gray-100 border-gray-200" : "bg-[#1C2128] border-white/5"}`}>
          {inningsArray.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveInningIndex(idx)}
              className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all 
                ${
                  activeInningIndex === idx
                    ? "bg-teal-600 text-white shadow-lg"
                    : `${theme.sub} hover:text-teal-500`
                }`}>
              {idx === 0 ? "1st Inn" : "2nd Inn"}
            </button>
          ))}
        </div>
      </div>

      {/* ✅ STATUS BANNER */}
      {(matchContext.resultText || matchContext.chaseText) && (
        <div className="flex justify-center -mt-3 mb-1 animate-in slide-in-from-top-2 duration-500">
          {matchContext.resultText ? (
            <div
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md border ${
                lightMode
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}>
              🏆 {matchContext.resultText}
            </div>
          ) : matchContext.chaseText ? (
            <div
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md border ${
                lightMode
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
              }`}>
              🎯 {matchContext.chaseText}
            </div>
          ) : null}
        </div>
      )}

      {/* ✅ 2. UNIFIED INSIGHT BOX */}
      <div
        className={`group relative p-4 rounded-2xl border transition-all duration-500 overflow-visible ${displayInsight.bg} ${displayInsight.border}`}>
        {displayInsight.badge && (
          <div
            className={`absolute -top-2 -right-2 text-[8px] font-black px-2 py-1 rounded-md shadow-lg animate-bounce ${
              displayInsight.color.includes("amber")
                ? "bg-amber-600 text-white"
                : "bg-indigo-600 text-white"
            }`}>
            {displayInsight.badge}
          </div>
        )}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${lightMode ? "bg-white" : "bg-white/5"}`}>
            {displayInsight.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4
              className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${displayInsight.color}`}>
              {displayInsight.title}
            </h4>
            <div
              className={`text-sm leading-relaxed font-medium line-clamp-3 hover:line-clamp-none transition-all cursor-pointer ${theme.text}`}>
              "{displayInsight.text}"
            </div>
          </div>
        </div>
      </div>

      {/* 3. COMMENTARY FEED */}
      <div
        className={`border rounded-3xl overflow-hidden shadow-2xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <div
          className={`p-5 border-b flex justify-between items-center ${
            lightMode
              ? "bg-gray-50 border-gray-200"
              : "bg-[#161920]/90 border-white/5"
          }`}>
          <span
            className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.sub}`}>
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>{" "}
            Commentary Feed
          </span>
          {isTyping && (
            <span className="text-[9px] text-teal-500 animate-pulse font-black tracking-widest flex items-center gap-1">
              <Mic size={10} /> ANALYZING...
            </span>
          )}
        </div>

        <div
          className={`divide-y ${lightMode ? "divide-gray-100" : "divide-white/5"}`}>
          {timelineData.length === 0 ? (
            <div className={`p-20 text-center italic text-sm ${theme.sub}`}>
              Match logic initializing...
            </div>
          ) : (
            timelineData.map((event) => {
              if (event.type === "SUMMARY") {
                return (
                  <div
                    key={event.id}
                    className={`p-5 border-y flex justify-between items-center ${
                      lightMode
                        ? "bg-gradient-to-r from-gray-50 to-white border-gray-200"
                        : "bg-gradient-to-r from-[#161920] to-[#1C2128] border-white/5"
                    }`}>
                    <div>
                      <div className="text-[9px] font-black text-teal-500 uppercase tracking-widest mb-1">
                        Over {event.over} Done
                      </div>
                      <div className={`font-black text-base ${theme.text}`}>
                        {event.runs} Runs • {event.wickets} Wickets
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[9px] uppercase font-black mb-1 ${theme.sub}`}>
                        Score
                      </div>
                      <div
                        className={`text-2xl font-mono font-black ${theme.text}`}>
                        {event.totalScore}/{event.totalWickets}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={event.id}
                  className={`p-5 flex gap-5 transition-colors ${lightMode ? "hover:bg-gray-50" : "hover:bg-white/[0.01]"}`}>
                  <div
                    className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black text-[11px] border-2 ${
                      event.isWicket
                        ? lightMode
                          ? "bg-red-100 border-red-200 text-red-600"
                          : "bg-red-500/10 border-red-500/40 text-red-500"
                        : event.runs >= 6
                          ? lightMode
                            ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                            : "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                          : event.runs >= 4
                            ? lightMode
                              ? "bg-teal-100 border-teal-200 text-teal-700"
                              : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                            : event.extrasType
                              ? lightMode
                                ? "bg-amber-100 border-amber-200 text-amber-700"
                                : "bg-amber-500/10 border-amber-500/40 text-amber-400"
                              : lightMode
                                ? "bg-gray-100 border-gray-200 text-gray-500"
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
                      <span
                        className={`font-black text-[11px] uppercase tracking-wider truncate ${theme.text}`}>
                        {event.bowler}{" "}
                        <span className="text-gray-400 mx-1">➜</span>{" "}
                        {event.batter}
                      </span>
                    </div>
                    <p
                      className={`text-sm leading-snug font-medium ${
                        event.isWicket ? "text-red-500" : theme.sub
                      }`}>
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
