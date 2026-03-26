import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Trophy, Shield, Download, MapPin, Clock } from "lucide-react";
import { toPng } from "html-to-image";

export default function BracketTab({
  tournament,
  liveMatches = [],
  upcomingMatches = [],
  finishedMatches = [],
  teams = [],
  tournamentId,
}) {
  const navigate = useNavigate();

  // 🟢 Extract theme natively
  const { theme } = useTheme();

  const containerRef = useRef(null);
  const matchRefs = useRef({});
  const [lines, setLines] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const matches = useMemo(() => {
    return [...liveMatches, ...upcomingMatches, ...finishedMatches];
  }, [liveMatches, upcomingMatches, finishedMatches]);

  // --- 1. MERGE BLUEPRINT WITH LIVE DATA ---
  const treeData = useMemo(() => {
    if (
      !tournament?.bracketLayout ||
      !tournament?.bracketLayout?.rounds ||
      !tournament?.bracketLayout?.matches
    )
      return [];

    return tournament.bracketLayout.rounds.map((round) => {
      const roundMatches = tournament.bracketLayout.matches.filter(
        (m) => m.roundId === round.id,
      );

      const mappedMatches = roundMatches.map((bm) => {
        const liveMatch = matches.find(
          (m) =>
            m.id === `BRACKET-${bm.id}` || m.meta?.bracketMatchId === bm.id,
        );

        const resolveTeam = (slot) => {
          if (slot.type === "team" && slot.team) return slot.team.name;
          if (slot.type === "link" && slot.sourceMatchId) {
            const sourceMatch = matches.find(
              (m) =>
                m.id === `BRACKET-${slot.sourceMatchId}` ||
                m.meta?.bracketMatchId === slot.sourceMatchId,
            );
            const isSourceFinished = ["finished", "completed"].includes(
              sourceMatch?.status?.toLowerCase(),
            );

            if (isSourceFinished) {
              if (sourceMatch.winner) return sourceMatch.winner;
              if (sourceMatch.innings && sourceMatch.innings.length >= 2) {
                const i1 = sourceMatch.innings[0];
                const i2 = sourceMatch.innings[1];
                if (i1.score > i2.score) return i1.battingTeam;
                if (i2.score > i1.score) return i2.battingTeam;
              }
            }
            return `Winner of ${slot.sourceMatchId}`;
          }
          if (slot.type === "bye") return "BYE";
          return "TBA";
        };

        const resolvedTeamA = resolveTeam(bm.slotA);
        const resolvedTeamB = resolveTeam(bm.slotB);

        const getScore = (teamName) => {
          if (!liveMatch?.innings) return "";
          const inn = liveMatch.innings.find(
            (i) => i?.battingTeam?.trim() === teamName?.trim(),
          );
          if (!inn) return "";
          return `${inn.score}/${inn.wickets} (${inn.over}.${inn.overBallCount})`;
        };

        const getLogo = (teamName) => {
          if (
            !teamName ||
            teamName.startsWith("Winner of") ||
            teamName === "TBA" ||
            teamName === "BYE"
          )
            return null;
          const found = teams.find(
            (t) =>
              t.name?.trim().toLowerCase() === teamName?.trim().toLowerCase(),
          );
          return found?.logoUrl || found?.logo || found?.image || null;
        };

        const rawTime = liveMatch?.time || bm.settings?.time || "";
        let displayTime = "";

        if (rawTime && rawTime !== "TBA") {
          try {
            if (rawTime.includes(":")) {
              const [h, m] = rawTime.split(":");
              const tObj = new Date();
              tObj.setHours(parseInt(h), parseInt(m), 0);
              displayTime = tObj.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });
            } else {
              displayTime = rawTime;
            }
          } catch (e) {
            console.error("Time Parse Error:", e);
            displayTime = rawTime;
          }
        }

        return {
          id: bm.id,
          title: bm.title,
          venue: liveMatch?.venue || bm.settings?.venue || "TBA",
          teamA: resolvedTeamA,
          teamB: resolvedTeamB,
          logoA: getLogo(resolvedTeamA),
          logoB: getLogo(resolvedTeamB),
          scoreA: getScore(resolvedTeamA),
          scoreB: getScore(resolvedTeamB),
          winner: liveMatch?.winner,
          status: liveMatch?.status || "upcoming",
          liveMatchId: liveMatch?.id,
          displayTime: displayTime || "TBA",
          rawSlotA: bm.slotA,
          rawSlotB: bm.slotB,
        };
      });

      return { title: round.name, matches: mappedMatches };
    });
  }, [tournament, matches, teams]);

  // --- 2. SMART SVG LINE DRAWING ---
  const drawLines = useCallback(() => {
    if (!containerRef.current || treeData.length === 0) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines = [];

    treeData.forEach((round) => {
      round.matches.forEach((match) => {
        const checkAndDraw = (slot, isSlotA) => {
          if (slot?.type === "link" && slot.sourceMatchId) {
            const sourceEl = matchRefs.current[slot.sourceMatchId];
            const targetEl = matchRefs.current[match.id];
            if (sourceEl && targetEl) {
              const sRect = sourceEl.getBoundingClientRect();
              const tRect = targetEl.getBoundingClientRect();
              const x1 = sRect.right - containerRect.left;
              const y1 = sRect.top + sRect.height / 2 - containerRect.top;
              const x2 = tRect.left - containerRect.left;
              const y2 =
                tRect.top +
                tRect.height * (isSlotA ? 0.35 : 0.75) -
                containerRect.top;
              const sourceMatchData = matches.find(
                (m) => m.id === `BRACKET-${slot.sourceMatchId}`,
              );
              const isFinished = ["finished", "completed"].includes(
                sourceMatchData?.status?.toLowerCase(),
              );
              newLines.push({
                id: `${slot.sourceMatchId}-${match.id}-${isSlotA ? "A" : "B"}`,
                x1,
                y1,
                x2,
                y2,
                isFinished,
              });
            }
          }
        };
        checkAndDraw(match.rawSlotA, true);
        checkAndDraw(match.rawSlotB, false);
      });
    });
    setLines(newLines);
  }, [treeData, matches]);

  useEffect(() => {
    const observer = new ResizeObserver(() => drawLines());
    if (containerRef.current) observer.observe(containerRef.current);
    const timer = setTimeout(drawLines, 500);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [drawLines, treeData]);

  // --- 3. SCREENSHOT ---
  const handleDownloadBracket = async () => {
    const captureArea = document.getElementById("bracket-capture-area");
    if (!captureArea) return;
    try {
      setIsCapturing(true);
      const dataUrl = await toPng(captureArea, {
        pixelRatio: 2,
        backgroundColor: "#0a0d14", // 🟢 Locked to solid dark for perfect exports
        width: captureArea.scrollWidth,
        height: captureArea.scrollHeight,
        style: {
          transform: "scale(1)",
        },
      });
      const link = document.createElement("a");
      link.download = `${(tournament?.name || "Tournament").replace(/\s+/g, "_")}_Bracket.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      alert("Failed to capture image.");
    } finally {
      setIsCapturing(false);
    }
  };

  if (treeData.length === 0) {
    return (
      <div
        className={`p-12 text-center italic text-sm ${theme?.sub || "text-gray-400"}`}>
        The bracket has not been set up yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleDownloadBracket}
          disabled={isCapturing}
          // 🟢 Uses dynamic theme gradient
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-emerald-600"} text-white shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90`}>
          <Download size={14} />{" "}
          {isCapturing ? "Capturing..." : "Download Bracket"}
        </button>
      </div>

      <div
        // 🟢 Outer container uses standard glassmorphism
        className={`w-full overflow-x-auto custom-scrollbar border rounded-[2rem] shadow-2xl relative ${theme?.card || "bg-black/60"} border-current/10`}>
        <div
          id="bracket-capture-area"
          // 🟢 Inner container forced to Dark Mode for consistent legibility in exported PNGs
          className={`relative inline-block w-max p-8 md:p-12 pr-12 md:pr-24 bg-[#0a0d14] text-white`}>
          {/* Background Glows for visual appeal in export */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>

          {/* Header */}
          <div className="mb-12 text-center relative z-10">
            <Trophy
              size={36}
              className={`mx-auto mb-4 text-teal-400 drop-shadow-md`}
            />
            <h2
              className={`text-3xl font-black uppercase tracking-tight text-white drop-shadow-md`}>
              {tournament?.name ||
                tournament?.tournamentName ||
                "Tournament Bracket"}
            </h2>
          </div>

          <div ref={containerRef} className="flex gap-16 relative z-10">
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {lines.map((line) => (
                <path
                  key={line.id}
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + 40} ${line.y1}, ${line.x2 - 40} ${line.y2}, ${line.x2} ${line.y2}`}
                  fill="none"
                  strokeWidth={line.isFinished ? "3" : "2"}
                  // 🟢 Locked stroke colors tailored for dark backgrounds
                  stroke={line.isFinished ? "#2dd4bf" : "#334155"}
                  strokeDasharray={line.isFinished ? "0" : "4"}
                />
              ))}
            </svg>

            {treeData.map((round, roundIndex) => (
              <div
                key={roundIndex}
                className="flex flex-col w-64 shrink-0 z-10">
                <h3
                  className={`h-8 text-center font-black uppercase tracking-widest text-xs text-teal-400 mb-4`}>
                  {round.title}
                </h3>
                <div className="flex flex-col justify-around flex-1">
                  {round.matches.map((match) => {
                    const isFinished = match.status === "finished";
                    const isLive = ["live", "ongoing"].includes(match.status);
                    return (
                      <div
                        key={match.id}
                        className="flex flex-col justify-center px-2 py-4">
                        <div
                          ref={(el) => (matchRefs.current[match.id] = el)}
                          onClick={() =>
                            match.liveMatchId &&
                            navigate(
                              `/tournaments/${tournamentId}/scorecard/${match.liveMatchId}`,
                            )
                          }
                          // 🟢 Standardized Match Card Dark Theme
                          className={`relative border rounded-xl overflow-hidden shadow-xl bg-[#161920]/90 backdrop-blur-sm border-white/10 cursor-pointer hover:border-teal-500/50 hover:shadow-teal-500/10 transition-all`}>
                          {/* Match Header */}
                          <div
                            className={`px-3 py-2 text-[9px] font-black uppercase border-b flex justify-between items-center bg-black/40 border-white/5 text-gray-400`}>
                            <div className="flex items-center gap-2 truncate">
                              <span className="bg-teal-500/20 border border-teal-500/30 text-teal-400 px-1.5 py-0.5 rounded text-[8px] tracking-widest">
                                {match.id}
                              </span>
                              <span className="truncate">{match.title}</span>
                            </div>
                            {isLive && (
                              <span className="text-red-500 animate-pulse ml-1 tracking-widest">
                                Live
                              </span>
                            )}
                          </div>

                          {/* Teams */}
                          {[
                            {
                              name: match.teamA,
                              logo: match.logoA,
                              score: match.scoreA,
                            },
                            {
                              name: match.teamB,
                              logo: match.logoB,
                              score: match.scoreB,
                            },
                          ].map((t, i) => (
                            <div
                              key={i}
                              className={`px-3 py-2.5 flex justify-between items-center ${i === 0 ? "border-b border-dashed border-white/10" : ""} ${match.winner === t.name && isFinished ? "bg-teal-500/10" : ""}`}>
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                {t.logo ? (
                                  <img
                                    src={t.logo}
                                    className="w-5 h-5 object-contain"
                                    alt=""
                                    crossOrigin="anonymous"
                                  />
                                ) : (
                                  <Shield size={12} className="opacity-30" />
                                )}
                                <span
                                  className={`text-[11px] truncate font-bold ${match.winner === t.name ? "text-teal-400" : "text-white"}`}>
                                  {t.name}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-mono font-black ${match.winner === t.name ? "text-teal-400" : "text-gray-400"}`}>
                                {t.score}
                              </span>
                            </div>
                          ))}

                          {/* Match Venue/Time Footer */}
                          <div
                            className={`px-3 py-1.5 flex items-center justify-between gap-2 text-[8px] font-bold tracking-wider bg-black/40 text-gray-500`}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin
                                size={10}
                                className="text-teal-500 shrink-0"
                              />
                              <span className="truncate">{match.venue}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Clock size={10} className="text-teal-500" />
                              <span>{match.displayTime || "TBA"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
