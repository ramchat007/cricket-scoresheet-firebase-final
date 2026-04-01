import React from "react";
import { MapPin, Trophy, Calendar } from "lucide-react";

export default function MatchIntroSlab({ match }) {
  if (!match) return null;

  const teamA = match.meta?.teamA || "Team A";
  const teamB = match.meta?.teamB || "Team B";
  const tournamentName = match.meta?.tournamentName || "Live Tournament";
  const matchTitle = match.meta?.matchTitle || "Match 1";
  const venue = match.meta?.venue || match.meta?.ground || "Live Stadium";

  const tossWinner = match.toss?.winner || match.meta?.toss?.winner;
  const tossDecision = match.toss?.decision || match.meta?.toss?.decision;

  return (
    <>
      <style>
        {`
          @keyframes slideUpIntro {
            0% { transform: translateY(150%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .anim-intro { animation: slideUpIntro 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        `}
      </style>

      <div className="absolute bottom-36 left-8 flex flex-col font-sans anim-intro drop-shadow-2xl z-40">
        {/* Tournament Badge */}
        <div className="bg-amber-400 text-slate-900 font-black uppercase tracking-widest text-xs px-4 py-1.5 rounded-t-lg self-start flex items-center gap-2 shadow-[0_-5px_20px_rgba(251,191,36,0.3)]">
          <Trophy size={14} strokeWidth={3} /> {tournamentName}
        </div>

        {/* Main Slab */}
        <div className="bg-slate-900/95 border-2 border-white/10 p-6 rounded-b-xl rounded-tr-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col gap-4 min-w-[500px]">
          {/* Match Title & Venue */}
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div className="flex items-center gap-2 text-cyan-400 font-black uppercase tracking-widest text-sm drop-shadow-md">
              <Calendar size={16} /> {matchTitle}
            </div>
            <div className="flex items-center gap-2 text-white/60 font-bold uppercase tracking-wider text-xs">
              <MapPin size={14} /> {venue}
            </div>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between gap-8 py-2">
            <h1 className="text-4xl font-black text-white uppercase tracking-tight truncate max-w-[300px] drop-shadow-lg">
              {teamA}
            </h1>
            <span className="text-white/30 font-black italic text-2xl">VS</span>
            <h1 className="text-4xl font-black text-white uppercase tracking-tight truncate max-w-[300px] drop-shadow-lg">
              {teamB}
            </h1>
          </div>

          {/* Toss Result */}
          {tossWinner && (
            <div className="mt-2 bg-gradient-to-r from-amber-500/10 to-transparent border-l-4 border-amber-400 rounded-r-lg p-3">
              <span className="text-amber-400 font-black uppercase tracking-widest text-sm drop-shadow-md">
                Toss: {tossWinner} elected to {tossDecision}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
