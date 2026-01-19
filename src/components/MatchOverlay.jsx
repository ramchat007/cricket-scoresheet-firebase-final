import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase";

export default function MatchOverlay() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- REAL-TIME SYNC ---
  useEffect(() => {
    if (!tournamentId || !matchId) return;
    const unsub = onSnapshot(doc(db, "tournaments", tournamentId, "matches", matchId), (doc) => {
      if (doc.exists()) {
        setMatch(doc.data());
      }
      setLoading(false);
    });
    return () => unsub();
  }, [tournamentId, matchId]);

  if (loading) return null;
  if (!match) return null;

  const inn = match.innings?.[match.currentInnings || 0] || {};
  const target = match.meta?.target;

  // Stats Calculations
  const oversDisplay = `${inn.over}.${inn.overBallCount}`;
  const totalBalls = (inn.over * 6) + inn.overBallCount;
  const crr = totalBalls > 0 ? (inn.score / (totalBalls / 6)).toFixed(2) : "0.00";
  const bowlerName = inn.currentBowler || "Bowler";
  const bStats = inn.bowlerStats?.[bowlerName] || { runs: 0, wickets: 0 };

  return (
    // 🎥 CONTAINER: Fixed Bottom, Full Width, Transparent Background
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end bg-transparent pb-4 px-4 sm:px-8">
      
      {/* 🟢 COMPACT SCORING STRIP */}
      <div className="flex items-center bg-[#0F1115] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-full max-w-[1920px] mx-auto h-16 sm:h-20 animate-in slide-in-from-bottom-10 duration-700">
        
        {/* 1. MATCH STATUS & TEAMS (Left Anchor) */}
        <div className="w-48 sm:w-64 bg-[#161920] h-full flex flex-col justify-center px-4 border-r border-white/10 relative">
           {/* Live Indicator */}
           <div className="absolute top-2 right-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-[8px] font-black text-red-500 uppercase tracking-wider">LIVE</span>
           </div>
           
           {/* Teams */}
           <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-tight mb-0.5 truncate">
             {match.meta?.teamA} vs {match.meta?.teamB}
           </div>
           
           {/* Big Score */}
           <div className="flex items-baseline gap-2">
             <span className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter">
               {inn.score}/{inn.wickets}
             </span>
             <span className="text-sm sm:text-base font-mono font-bold text-teal-400">
               {oversDisplay}
             </span>
           </div>
        </div>

        {/* 2. PLAYERS STRIP (Middle - Flexible) */}
        <div className="flex-1 flex items-center justify-between px-4 sm:px-8 bg-gradient-to-r from-black to-[#161920]">
           
           {/* Batsmen */}
           <div className="flex items-center gap-6 sm:gap-10">
              {/* Striker */}
              <div className="flex items-center gap-2">
                 <span className="text-teal-400 text-lg">🏏</span>
                 <div>
                    <div className="text-xs sm:text-sm font-bold text-white leading-tight truncate max-w-[100px] sm:max-w-[150px]">
                       {inn.striker || "Striker"} *
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                       {inn.batsmenStats?.[inn.striker]?.runs || 0} <span className="opacity-60">({inn.batsmenStats?.[inn.striker]?.balls || 0})</span>
                    </div>
                 </div>
              </div>

              {/* Non-Striker */}
              <div className="flex items-center gap-2 opacity-70">
                 <div>
                    <div className="text-xs sm:text-sm font-bold text-white leading-tight truncate max-w-[100px] sm:max-w-[150px]">
                       {inn.nonStriker || "Non-Striker"}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                       {inn.batsmenStats?.[inn.nonStriker]?.runs || 0} <span className="opacity-60">({inn.batsmenStats?.[inn.nonStriker]?.balls || 0})</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Bowler (Right Aligned in Middle Section) */}
           <div className="flex items-center gap-2 border-l border-white/10 pl-6">
              <div className="text-right">
                 <div className="text-xs sm:text-sm font-bold text-white leading-tight truncate max-w-[100px]">
                    {bowlerName}
                 </div>
                 <div className="text-[10px] font-mono text-teal-400">
                    {bStats.wickets}-{bStats.runs} <span className="text-slate-500">({bStats.overs || 0})</span>
                 </div>
              </div>
              <span className="text-teal-500 text-lg">🥎</span>
           </div>
        </div>

        {/* 3. SITUATION BLOCK (Right - Colored) */}
        <div className="w-32 sm:w-40 h-full flex flex-col justify-center items-center bg-teal-900/20 border-l border-teal-500/30">
           {target ? (
             <>
               <div className="text-[9px] font-black text-teal-400 uppercase tracking-widest mb-0.5">Target {target}</div>
               <div className="text-xl sm:text-2xl font-black text-white">
                 Need {Math.max(0, target - inn.score)}
               </div>
             </>
           ) : (
             <>
               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Run Rate</div>
               <div className="text-xl sm:text-2xl font-black text-white">
                 {crr}
               </div>
             </>
           )}
        </div>

      </div>
    </div>
  );
}