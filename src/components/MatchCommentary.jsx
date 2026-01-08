// // src/components/MatchCommentary.jsx
// import React, { useMemo } from "react";
// import {
//   generateCommentary,
//   getMatchInsights,
// } from "../utils/commentaryHelper";

// export default function MatchCommentary({ match }) {
//   if (!match) return null;

//   const currentIdx = match.currentInnings || 0;
//   const inn = match.innings?.[currentIdx];

//   // 1. Generate Timeline Data
//   const commentaryList = useMemo(() => {
//     if (!inn || !inn.ballsLog) return [];

//     // We reverse a copy of the array so newest balls are at top
//     // Note: timeline array is better if you have it populated with objects
//     // Falling back to ballsLog + stats if timeline is simple strings
//     const logs = [...(inn.timeline || inn.ballsLog || [])].reverse();

//     return logs.map((ball, index) => {
//       // In a real app, you'd store who faced the ball in the timeline object.
//       // For now, we use generic names if string, or specific if object.
//       const batter = typeof ball === "object" ? ball.batter : "Batter";
//       const bowler = typeof ball === "object" ? ball.bowler : "Bowler";

//       return {
//         id: index,
//         val:
//           typeof ball === "object" ? (ball.isWicket ? "W" : ball.runs) : ball,
//         text: generateCommentary(ball, batter, bowler),
//       };
//     });
//   }, [inn]);

//   // 2. Get Insights
//   const insights = getMatchInsights(match);

//   return (
//     <div className="flex flex-col gap-4 h-full">
//       {/* --- AI INSIGHTS CARD --- */}
//       {insights && (
//         <div
//           className={`p-4 rounded-xl border shadow-lg animate-in slide-in-from-top-4
//           ${
//             insights.type === "chase"
//               ? "bg-indigo-900/30 border-indigo-500/50"
//               : insights.type === "success"
//               ? "bg-green-900/30 border-green-500/50"
//               : "bg-gray-800 border-gray-700"
//           }`}>
//           <div className="flex items-center gap-2 mb-1">
//             <span className="text-xl">
//               {insights.type === "chase" ? "🎯" : "📊"}
//             </span>
//             <h4 className="font-bold text-white uppercase text-xs tracking-widest">
//               {insights.title || "Match Insight"}
//             </h4>
//           </div>
//           <div className="text-white font-mono text-sm md:text-base font-bold">
//             {insights.text}
//           </div>
//           {insights.subText && (
//             <div className="text-cyan-400 text-xs mt-2 italic border-l-2 border-cyan-500 pl-2">
//               {insights.subText}
//             </div>
//           )}
//         </div>
//       )}

//       {/* --- SCROLLING COMMENTARY --- */}
//       <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-1 min-h-[300px]">
//         <div className="bg-gray-950/50 p-3 border-b border-gray-800 flex justify-between items-center">
//           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
//             Ball by Ball
//           </span>
//           <span className="text-[10px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded animate-pulse">
//             ● LIVE
//           </span>
//         </div>

//         <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
//           {commentaryList.length === 0 ? (
//             <div className="p-8 text-center text-gray-600 italic text-sm">
//               Waiting for the first ball...
//             </div>
//           ) : (
//             commentaryList.map((c, i) => (
//               <div
//                 key={i}
//                 className="p-4 flex gap-4 hover:bg-white/5 transition-colors">
//                 <div className="flex flex-col items-center gap-1">
//                   <div
//                     className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg
//                      ${
//                        c.val === "W"
//                          ? "bg-red-600 text-white"
//                          : c.val == 4
//                          ? "bg-green-600 text-white"
//                          : c.val == 6
//                          ? "bg-purple-600 text-white"
//                          : "bg-gray-800 text-gray-300 border border-gray-700"
//                      }`}>
//                     {c.val}
//                   </div>
//                 </div>
//                 <div className="flex-1">
//                   <p className="text-gray-300 text-sm leading-relaxed">
//                     {c.text}
//                   </p>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
// Above is manual commentary generation using predefined phrases.

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

  // 1. Generate Base Timeline (Standard Data)
  const timelineData = useMemo(() => {
    if (!inn || !inn.ballsLog) return [];

    // Reverse to show newest first
    const rawLogs = [...(inn.timeline || inn.ballsLog || [])].reverse();

    return rawLogs.map((ball, index) => {
      // Reverse index logic to match original array index
      const realIndex = rawLogs.length - 1 - index;

      const batter = typeof ball === "object" ? ball.batter : "Batter";
      const bowler = typeof ball === "object" ? ball.bowler : "Bowler";

      // Prepare data for AI
      const ballData =
        typeof ball === "object"
          ? ball
          : {
              runs: parseInt(ball) || 0,
              isWicket: ball === "W",
              batter,
              bowler,
            };

      return {
        id: realIndex, // Unique ID based on position
        val:
          typeof ball === "object" ? (ball.isWicket ? "W" : ball.runs) : ball,
        // Use AI text if available, otherwise fallback to Rule-Based
        text: aiComments[realIndex] || generateCommentary(ball, batter, bowler),
        isAI: !!aiComments[realIndex], // Flag to show "✨" icon
        raw: ballData,
      };
    });
  }, [inn, aiComments]);

  // 2. EFFECT: Fetch AI Commentary for the NEWEST Ball Only
  // (We don't want to burn 100 API calls for history every time)
  useEffect(() => {
    if (!inn || !inn.timeline || inn.timeline.length === 0) return;

    const latestIndex = inn.timeline.length - 1;
    const latestBall = inn.timeline[latestIndex];

    // Only fetch if we haven't already fetched for this specific ball index
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

      // Also update Strategy Insights periodically (every 6 balls)
      if (latestIndex % 6 === 0) {
        fetchMatchAnalysis(match, inn).then((analysis) => {
          if (analysis) setAiInsight(analysis);
        });
      }
    }
  }, [inn?.timeline?.length]); // Only trigger when timeline length changes (new ball)

  // 3. Fallback Insights (Rule Based)
  const ruleBasedInsights = getMatchInsights(match);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* --- INSIGHTS CARD --- */}
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
            timelineData.map((c) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
