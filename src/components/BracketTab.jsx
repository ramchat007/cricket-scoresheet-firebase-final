import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Trophy, Shield } from "lucide-react";

export default function BracketTab({ 
  tournament, 
  liveMatches = [], 
  upcomingMatches = [], 
  finishedMatches = [], 
  teams = [], 
  tournamentId 
}) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

  // 🟢 COMBINE THE MATCHES FOR EASY SEARCHING
  // This guarantees we are using the exact same filtered data as MatchesTab
  const matches = useMemo(() => {
    return [...liveMatches, ...upcomingMatches, ...finishedMatches];
  }, [liveMatches, upcomingMatches, finishedMatches]);

  // --- 1. MERGE BLUEPRINT WITH LIVE DATA & AUTO-ADVANCE ---
  const treeData = useMemo(() => {
    if (!tournament?.bracketLayout?.rounds) return [];

    return tournament.bracketLayout.rounds.map((round) => {
      const roundMatches = tournament.bracketLayout.matches.filter(
        (m) => m.roundId === round.id
      );

      const mappedMatches = roundMatches.map((bm) => {
        // Find the actual live match in the combined database
        const liveMatch = matches.find(
          (m) => m.id === `BRACKET-${bm.id}` || m.meta?.bracketMatchId === bm.id
        );

        // 🧠 THE MAGIC RESOLVER: Automatically advances winners!
        const resolveTeam = (slot) => {
          if (slot.type === "team" && slot.team) return slot.team.name;
          
          if (slot.type === "link" && slot.sourceMatchId) {
            // Find the match they are waiting for
            const sourceMatch = matches.find(
              (m) => m.id === `BRACKET-${slot.sourceMatchId}` || m.meta?.bracketMatchId === slot.sourceMatchId
            );
            
            const isSourceFinished = ["finished", "completed"].includes(sourceMatch?.status?.toLowerCase());
            
            // If the match is over, extract the actual winner!
            if (isSourceFinished) {
              if (sourceMatch.winner) return sourceMatch.winner;
              
              // Fallback: Calculate from innings if winner string isn't explicitly saved
              if (sourceMatch.innings && sourceMatch.innings.length >= 2) {
                const i1 = sourceMatch.innings[0];
                const i2 = sourceMatch.innings[1];
                if (i1.score > i2.score) return i1.battingTeam;
                if (i2.score > i1.score) return i2.battingTeam;
              }
            }
            // If not finished, return the placeholder
            return `Winner of ${slot.sourceMatchId}`;
          }
          return "TBA";
        };

        // Resolve Team Names dynamically
        const resolvedTeamA = resolveTeam(bm.slotA);
        const resolvedTeamB = resolveTeam(bm.slotB);

        // Extract Live Scores
        const getScore = (teamName) => {
          if (!liveMatch?.innings) return "";
          const inn = liveMatch.innings.find((i) => i?.battingTeam?.trim() === teamName?.trim());
          if (!inn) return "";
          return `${inn.score}/${inn.wickets} (${inn.over}.${inn.overBallCount})`;
        };

        // Resolve Logos (Now that names auto-advance, we need to grab the right logo)
        const getLogo = (teamName) => {
          if (teamName.startsWith("Winner of") || teamName === "TBA") return null;
          const found = teams.find((t) => t.name?.trim().toLowerCase() === teamName?.trim().toLowerCase());
          return found?.logoUrl || found?.logo || found?.image || null;
        };

        return {
          id: bm.id,
          title: bm.title,
          teamA: resolvedTeamA,
          teamB: resolvedTeamB,
          logoA: getLogo(resolvedTeamA),
          logoB: getLogo(resolvedTeamB),
          scoreA: getScore(resolvedTeamA),
          scoreB: getScore(resolvedTeamB),
          winner: liveMatch?.winner,
          status: liveMatch?.status || "upcoming",
          liveMatchId: liveMatch?.id,
          isPlaceholderA: resolvedTeamA.startsWith("Winner of") || resolvedTeamA === "TBA",
          isPlaceholderB: resolvedTeamB.startsWith("Winner of") || resolvedTeamB === "TBA",
        };
      });

      return { title: round.name, matches: mappedMatches };
    });
  }, [tournament, matches, teams]);

  if (treeData.length === 0) {
    return (
      <div className={`p-12 text-center italic text-sm ${theme.sub}`}>
        The bracket has not been set up yet.
      </div>
    );
  }

  // --- 2. RENDER THE TREE ---
  return (
    <div className={`w-full overflow-x-auto custom-scrollbar border rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-500 ${lightMode ? "bg-gray-50/50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
      
      <div className="flex min-w-max p-4 md:p-8 gap-8 md:gap-12">
        {treeData.map((round, roundIndex) => (
          <div key={roundIndex} className="flex flex-col relative w-48 md:w-56 shrink-0">
            
            <h3 className={`text-center font-black uppercase tracking-widest text-[10px] md:text-xs mb-6 ${lightMode ? "text-indigo-600" : "text-indigo-400"}`}>
              {round.title}
              {roundIndex === treeData.length - 1 && (
                <Trophy size={14} className="inline-block ml-1.5 mb-0.5 text-amber-500" />
              )}
            </h3>

            <div className="flex flex-col justify-around flex-1 gap-4">
              {round.matches.map((match) => {
                const isFinished = match.status === "finished";
                const isLive = ["live", "in-progress", "ongoing"].includes(match.status);
                
                return (
                  <div key={match.id} className="relative flex flex-col justify-center">
                    
                    <div className={`absolute top-1/2 -right-4 md:-right-6 w-4 md:w-6 h-px ${lightMode ? "bg-gray-300" : "bg-gray-700"} z-0 bracket-connector`} />
                    
                    <div
                      onClick={() => match.liveMatchId && navigate(`/tournaments/${tournamentId}/scorecard/${match.liveMatchId}`)}
                      className={`relative z-10 border rounded-lg overflow-hidden shadow-md transition-transform hover:scale-105 cursor-pointer ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/10"}`}
                    >
                      {/* Header */}
                      <div className={`px-2 md:px-3 py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest border-b flex justify-between ${lightMode ? "bg-gray-50 border-gray-200 text-gray-500" : "bg-black/20 border-white/5 text-gray-400"}`}>
                        <span>{match.title}</span>
                        {isLive ? (
                          <span className="text-red-500 animate-pulse">Live</span>
                        ) : (
                          <span className={isFinished ? "text-teal-500" : "text-amber-500"}>
                            {isFinished ? "Final" : "Upcoming"}
                          </span>
                        )}
                      </div>

                      {/* Team A */}
                      <div className={`px-2 md:px-3 py-2 flex justify-between items-center border-b border-dashed ${lightMode ? "border-gray-200" : "border-white/5"} ${match.winner === match.teamA && isFinished ? (lightMode ? "bg-teal-50" : "bg-teal-900/20") : ""}`}>
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          {match.logoA ? (
                            <img src={match.logoA} alt={match.teamA} className="w-3 h-3 object-contain shrink-0" />
                          ) : (
                            <Shield size={10} className={match.winner === match.teamA ? "text-teal-500" : "text-gray-400 opacity-50"} />
                          )}
                          <span className={`text-[10px] md:text-xs truncate ${match.isPlaceholderA ? "italic opacity-50 font-medium" : "font-bold"} ${match.winner === match.teamA ? (lightMode ? "text-teal-700" : "text-teal-400") : theme.text}`}>
                            {match.teamA}
                          </span>
                        </div>
                        <span className={`text-[9px] md:text-[10px] font-black font-mono shrink-0 ${theme.text}`}>{match.scoreA}</span>
                      </div>

                      {/* Team B */}
                      <div className={`px-2 md:px-3 py-2 flex justify-between items-center ${match.winner === match.teamB && isFinished ? (lightMode ? "bg-teal-50" : "bg-teal-900/20") : ""}`}>
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          {match.logoB ? (
                            <img src={match.logoB} alt={match.teamB} className="w-3 h-3 object-contain shrink-0" />
                          ) : (
                            <Shield size={10} className={match.winner === match.teamB ? "text-teal-500" : "text-gray-400 opacity-50"} />
                          )}
                          <span className={`text-[10px] md:text-xs truncate ${match.isPlaceholderB ? "italic opacity-50 font-medium" : "font-bold"} ${match.winner === match.teamB ? (lightMode ? "text-teal-700" : "text-teal-400") : theme.text}`}>
                            {match.teamB}
                          </span>
                        </div>
                        <span className={`text-[9px] md:text-[10px] font-black font-mono shrink-0 ${theme.text}`}>{match.scoreB}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .flex-col:last-child .bracket-connector { display: none; }
      `}} />
    </div>
  );
}