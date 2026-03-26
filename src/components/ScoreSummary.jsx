import React, { useMemo, useState, useEffect } from "react";
// ✅ FIRESTORE IMPORTS
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../utils/firebase";
// ✅ THEME IMPORT
import { useTheme } from "../context/ThemeContext";
import { Users, Activity, Target } from "lucide-react";

export default function ScoreSummary({ match }) {
  const { theme } = useTheme();
  const [liveViewers, setLiveViewers] = useState(1);

  // ✅ 3. LIVE VIEWERS (FIRESTORE VERSION)
  useEffect(() => {
    if (!match?.id) return;

    const tournamentId = match.meta?.tournament || match.tournamentId;
    if (!tournamentId) return;

    let viewerDocId = null;
    let unsubscribe = () => {};

    const trackViewer = async () => {
      try {
        const viewersRef = collection(
          db,
          "tournaments",
          tournamentId,
          "matches",
          match.id,
          "viewers",
        );

        // A. Add myself
        const docRef = await addDoc(viewersRef, {
          timestamp: serverTimestamp(),
          type: "scorecard",
          userAgent: navigator.userAgent,
        });
        viewerDocId = docRef.id;

        // B. Listen to count
        unsubscribe = onSnapshot(viewersRef, (snapshot) => {
          setLiveViewers(snapshot.size || 1);
        });
      } catch (err) {
        console.warn("Viewer tracking disabled:", err.message);
      }
    };

    trackViewer();

    return () => {
      unsubscribe();
      if (viewerDocId) {
        const docToDelete = doc(
          db,
          "tournaments",
          tournamentId,
          "matches",
          match.id,
          "viewers",
          viewerDocId,
        );
        deleteDoc(docToDelete).catch((e) => {});
      }
    };
  }, [match?.id, match?.meta?.tournament, match?.tournamentId]);

  const formatLiveCount = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : n);

  if (!match)
    return (
      <div
        className={`border rounded-2xl p-8 text-center animate-pulse shadow-xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <div className={`text-lg font-bold tracking-widest ${theme.sub}`}>
          LOADING MATCH DATA...
        </div>
      </div>
    );

  // --- 1. DATA EXTRACTION ---
  const inningsList = Array.isArray(match.innings)
    ? match.innings
    : [match.innings?.[0], match.innings?.[1]].filter(Boolean);

  const status =
    match.meta?.matchStatus || match.status || match.meta?.status || "upcoming";
  const currentInningIndex =
    typeof match.currentInnings === "number" ? match.currentInnings : 0;
  const currentInning = inningsList[currentInningIndex];

  const { battingFirstTeam, battingSecondTeam, inn1, inn2 } = useMemo(() => {
    const firstInn = inningsList[0];
    const secondInn = inningsList[1];

    if (firstInn?.battingTeam) {
      const first = firstInn.battingTeam;
      const second =
        secondInn?.battingTeam ||
        (first === match.meta?.teamA ? match.meta?.teamB : match.meta?.teamA);
      return {
        battingFirstTeam: first,
        battingSecondTeam: second,
        inn1: firstInn,
        inn2: secondInn,
      };
    }
    return {
      battingFirstTeam: match.meta?.teamA,
      battingSecondTeam: match.meta?.teamB,
      inn1: null,
      inn2: null,
    };
  }, [match, inningsList]);

  const totalOvers = parseInt(match.meta?.overs || 20);

  // --- 2. RESULT TEXT ---
  const resultText = useMemo(() => {
    if (status !== "finished") return null;
    if (inn1 && inn2) {
      if (inn1.score > inn2.score) {
        const diff = inn1.score - inn2.score;
        return `${inn1.battingTeam} won by ${diff} run${diff !== 1 ? "s" : ""}`;
      } else if (inn2.score > inn1.score) {
        const totalWickets = parseInt(match.meta?.totalWickets || 10);
        const diff = Math.max(0, totalWickets - inn2.wickets);
        return `${inn2.battingTeam} won by ${diff} wicket${diff !== 1 ? "s" : ""}`;
      } else if (inn1.score === inn2.score) {
        return "Match Tied";
      }
    }
    return (
      match.meta?.result ||
      match.result?.text ||
      match.winner ||
      "Match Completed"
    );
  }, [status, inn1, inn2, match]);

  // --- 3. HELPERS ---
  const cleanName = (p) => {
    if (!p) return "";
    if (typeof p === "object") return p.name || p.playerName || "Unknown";
    return String(p).trim();
  };

  const strikerName = cleanName(currentInning?.striker) || "Striker";
  const nonStrikerName = cleanName(currentInning?.nonStriker) || "Non-Striker";
  const bowlerName = cleanName(currentInning?.currentBowler) || "Bowler";

  // --- 4. TARGET ---
  const isSecondInnings =
    currentInningIndex === 1 || (inn2 && status === "finished");
  const targetScore = match.meta?.target || (inn1 ? inn1.score + 1 : 0);

  // --- 5. PARTNERSHIP ---
  const partnership = useMemo(() => {
    if (!currentInning) return null;
    const timeline = currentInning.timeline || currentInning.ballsLog || [];
    let runs = 0;
    let balls = 0;

    for (let i = timeline.length - 1; i >= 0; i--) {
      const ball = timeline[i];
      if (typeof ball === "object" ? ball.isWicket : String(ball).includes("W"))
        break;

      let runVal = 0;
      let isLegal = true;

      if (typeof ball === "object") {
        runVal = ball.runs || 0;
        if (ball.isWide) isLegal = false;
      } else {
        const s = String(ball);
        if (s.includes("WD")) isLegal = false;
        runVal = parseInt(s) || 0;
        if (s.includes("WD") || s.includes("NB")) {
          const extra = parseInt(s.replace(/\D/g, "")) || 0;
          runVal = 1 + extra;
        }
      }
      runs += runVal;
      if (isLegal) balls++;
    }
    return { runs, balls };
  }, [currentInning]);

  const recentTimeline = useMemo(() => {
    if (!currentInning) return [];
    const timeline = currentInning.timeline || currentInning.ballsLog || [];
    return timeline.slice(-12);
  }, [currentInning]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      {/* 1. SCOREBOARD HEADER */}
      <div
        className={`border rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all ${
          lightMode
            ? "bg-gradient-to-b from-white to-gray-50 border-gray-200"
            : "bg-gradient-to-b from-[#1C2128] to-[#161920] border-white/10"
        }`}>
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span
            className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border shadow-sm flex items-center gap-2 ${
              status === "finished"
                ? lightMode
                  ? "bg-teal-50 text-teal-600 border-teal-200"
                  : "bg-teal-900/30 text-teal-400 border-teal-500/30"
                : lightMode
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-red-900/30 text-red-400 border-red-500/30 animate-pulse"
            }`}>
            {status !== "finished" && <Users size={12} />}
            {formatLiveCount(liveViewers)}{" "}
            {status === "finished" ? "FINISHED" : "LIVE"}
          </span>
        </div>

        <div className="flex justify-between items-center mt-6">
          {/* Team A */}
          <div className="text-left w-5/12">
            <div
              className={`text-base md:text-lg font-bold mb-1 truncate leading-tight ${lightMode ? "text-gray-500" : "text-slate-300"}`}>
              {battingFirstTeam}
            </div>
            {inn1 ? (
              <div
                className={`font-mono font-black text-3xl md:text-4xl leading-none tracking-tighter ${theme.text}`}>
                {inn1.score}/{inn1.wickets}
                <span
                  className={`text-sm md:text-base font-sans font-medium ml-2 block md:inline ${theme.sub}`}>
                  ({inn1.over}.{inn1.overBallCount} / {totalOvers} ov)
                </span>
              </div>
            ) : (
              <div className={`text-sm font-bold italic ${theme.sub}`}>
                Yet to bat
              </div>
            )}
          </div>

          <div
            className={`font-black text-xl italic opacity-20 select-none ${theme.text}`}>
            VS
          </div>

          {/* Team B */}
          <div className="text-right w-5/12">
            <div
              className={`text-base md:text-lg font-bold mb-1 truncate leading-tight ${lightMode ? "text-gray-500" : "text-slate-300"}`}>
              {battingSecondTeam}{" "}
              {currentInningIndex === 1 && status !== "finished" && "●"}
            </div>
            {inn2 ? (
              <div
                className={`font-mono font-black text-3xl md:text-4xl leading-none tracking-tighter ${theme.text}`}>
                {inn2.score}/{inn2.wickets}
                <span
                  className={`text-sm md:text-base font-sans font-medium ml-2 block md:inline ${theme.sub}`}>
                  ({inn2.over}.{inn2.overBallCount} / {totalOvers} ov)
                </span>
              </div>
            ) : (
              <div className={`text-sm font-bold italic ${theme.sub}`}>
                Yet to bat
              </div>
            )}
          </div>
        </div>

        {/* Match Result */}
        {resultText && (
          <div
            className={`mt-6 text-center border-t pt-4 ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <span
              className={`text-lg md:text-xl font-black uppercase tracking-wider drop-shadow-md animate-in zoom-in duration-500 ${lightMode ? "text-teal-600" : "text-teal-400"}`}>
              🏆 {resultText}
            </span>
            {isSecondInnings && status === "finished" && (
              <div className={`text-xs mt-1 uppercase font-bold ${theme.sub}`}>
                Target was {targetScore}
              </div>
            )}
          </div>
        )}

        {/* Chase Target */}
        {status !== "finished" && isSecondInnings && inn2 && (
          <div
            className={`mt-6 rounded-xl p-3 text-center border ${
              lightMode
                ? "bg-indigo-50 border-indigo-100"
                : "bg-indigo-900/20 border-indigo-500/20"
            }`}>
            <div
              className={`text-[12px] uppercase font-bold tracking-widest mb-1 ${lightMode ? "text-indigo-600" : "text-indigo-300"}`}>
              Target: <span className={theme.text}>{targetScore}</span>
            </div>
            {(() => {
              const ballsBowled = inn2.over * 6 + inn2.overBallCount;
              const ballsRemaining = Math.max(0, totalOvers * 6 - ballsBowled);
              const remainingRuns = Math.max(0, targetScore - inn2.score);
              const rrr =
                ballsRemaining > 0
                  ? (remainingRuns / (ballsRemaining / 6)).toFixed(2)
                  : "0.00";
              return (
                <>
                  <div className={`text-sm ${theme.sub}`}>
                    Need{" "}
                    <span className={`font-bold text-lg ${theme.text}`}>
                      {remainingRuns}
                    </span>{" "}
                    runs off{" "}
                    <span className={`font-bold text-lg ${theme.text}`}>
                      {ballsRemaining}
                    </span>{" "}
                    balls
                  </div>
                  <div
                    className={`text-[11px] mt-1 font-mono ${lightMode ? "text-indigo-600" : "text-indigo-300"}`}>
                    Required RR:{" "}
                    <span className={`font-bold ${theme.text}`}>{rrr}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* 2. ON THE CREASE */}
      {status !== "finished" && currentInning && (
        <div
          className={`border rounded-2xl p-5 shadow-lg ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
          <div className="grid grid-cols-2 gap-3 pb-3">
            {/* Striker */}
            <div
              className={`p-4 rounded-xl border relative overflow-hidden group shadow-md ${
                lightMode
                  ? "bg-white border-teal-200"
                  : "bg-[#0F1115] border-teal-500/30"
              }`}>
              <div
                className={`absolute top-0 right-0 text-[11px] font-bold px-2 py-1 rounded-bl-lg ${
                  lightMode
                    ? "bg-teal-100 text-teal-700"
                    : "bg-teal-600/20 text-teal-400"
                }`}>
                STRIKER
              </div>
              <div className={`font-bold text-lg truncate pr-2 ${theme.text}`}>
                {strikerName}
              </div>
              <div
                className={`text-2xl font-mono font-bold mt-1 ${lightMode ? "text-teal-600" : "text-teal-400"}`}>
                {currentInning.batsmenStats?.[strikerName]?.runs || 0}
                <span
                  className={`text-sm ml-1.5 font-sans font-medium ${theme.sub}`}>
                  ({currentInning.batsmenStats?.[strikerName]?.balls || 0})
                </span>
              </div>
            </div>

            {/* Non-Striker */}
            <div
              className={`p-4 rounded-xl border shadow-inner ${
                lightMode
                  ? "bg-gray-50 border-gray-200"
                  : "bg-[#0F1115] border-white/5"
              }`}>
              <div className={`font-bold text-lg truncate ${theme.sub}`}>
                {nonStrikerName}
              </div>
              <div
                className={`text-2xl font-mono font-bold mt-1 ${theme.text}`}>
                {currentInning.batsmenStats?.[nonStrikerName]?.runs || 0}
                <span
                  className={`text-sm ml-1.5 font-sans font-medium ${theme.sub}`}>
                  ({currentInning.batsmenStats?.[nonStrikerName]?.balls || 0})
                </span>
              </div>
            </div>
          </div>

          <div
            className={`flex justify-between items-center mb-4 border-b pb-3 ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <div
              className={`text-[12px] uppercase font-black tracking-widest ${theme.sub}`}>
              Current Partnership
            </div>
            {partnership && (
              <div
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  lightMode
                    ? "bg-teal-50 text-teal-700 border-teal-200"
                    : "bg-teal-900/20 text-teal-400 border-teal-500/20"
                }`}>
                <span className={`text-base mr-1 ${theme.text}`}>
                  {partnership.runs}
                </span>
                <span className={theme.sub}>({partnership.balls})</span>
              </div>
            )}
          </div>

          {/* RECENT BALLS */}
          {recentTimeline.length > 0 && (
            <div className="mb-5">
              <div
                className={`text-[10px] uppercase font-bold mb-2 pl-1 ${theme.sub}`}>
                Recent Balls
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 h-12">
                {recentTimeline.map((ball, i, arr) => {
                  if (!ball || typeof ball !== "object") return null;
                  const showDivider =
                    i > 0 &&
                    ball.over !== undefined &&
                    arr[i - 1]?.over !== undefined &&
                    ball.over !== arr[i - 1].over;

                  let val = ball.runs;
                  // Default colors (Dot ball)
                  let colorClass = lightMode
                    ? "bg-gray-100 text-gray-500 border-gray-200"
                    : "bg-slate-800 text-slate-400 border-white/5";

                  if (ball.isWicket) {
                    val = "W";
                    colorClass = lightMode
                      ? "bg-red-100 text-red-600 border-red-200 font-black"
                      : "bg-red-900/40 text-red-400 border-red-500/30 font-black";
                  } else if (ball.runs === 4) {
                    colorClass = lightMode
                      ? "bg-teal-100 text-teal-700 border-teal-200 font-black"
                      : "bg-teal-900/40 text-teal-400 border-teal-500/30 font-black";
                  } else if (ball.runs === 6) {
                    colorClass = lightMode
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200 font-black"
                      : "bg-indigo-900/40 text-indigo-400 border-indigo-500/30 font-black";
                  } else if (ball.isWide) {
                    val = "WD";
                    colorClass = lightMode
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-amber-900/40 text-amber-400 border-amber-500/30";
                  } else if (ball.isNoBall) {
                    val = "NB";
                    colorClass = lightMode
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-amber-900/40 text-amber-400 border-amber-500/30";
                  } else if (ball.runs > 0) {
                    colorClass = lightMode
                      ? "bg-white text-gray-900 border-gray-300"
                      : "bg-slate-700 text-slate-200 border-white/10";
                  }

                  return (
                    <React.Fragment key={i}>
                      {showDivider && (
                        <div
                          className={`w-[2px] h-5 rounded-full mx-0.5 flex-shrink-0 opacity-50 ${lightMode ? "bg-gray-300" : "bg-slate-600"}`}></div>
                      )}
                      <div
                        className={`w-9 h-9 rounded-full flex flex-shrink-0 items-center justify-center text-xs border ${colorClass} transition-all shadow-sm`}>
                        {val}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bowler Card */}
          <div
            className={`mt-3 p-4 rounded-xl border flex justify-between items-center ${
              lightMode
                ? "bg-gray-50 border-gray-200"
                : "bg-[#161920] border-white/5"
            }`}>
            <div>
              <div
                className={`text-[11px] uppercase font-bold mb-1 tracking-wider ${theme.sub}`}>
                Bowling
              </div>
              <div className={`font-bold text-lg ${theme.text}`}>
                {bowlerName}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`font-mono font-black text-2xl leading-none ${theme.text}`}>
                {currentInning.bowlerStats?.[bowlerName]?.wickets || 0}
                <span className={`mx-1 ${theme.sub}`}>-</span>
                {currentInning.bowlerStats?.[bowlerName]?.runs || 0}
              </div>
              <div className={`text-[12px] font-medium mt-1 ${theme.sub}`}>
                {currentInning.bowlerStats?.[bowlerName]?.balls
                  ? `${Math.floor(currentInning.bowlerStats[bowlerName].balls / 6)}.${currentInning.bowlerStats[bowlerName].balls % 6}`
                  : "0.0"}{" "}
                overs
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. KEY STATS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Run Rate",
            value:
              currentInning &&
              currentInning.overBallCount + currentInning.over * 6 > 0
                ? (
                    currentInning.score /
                    ((currentInning.over * 6 + currentInning.overBallCount) / 6)
                  ).toFixed(2)
                : "0.00",
            color: theme.text,
          },
          {
            label: "Extras",
            value:
              (currentInning?.extras?.wides || 0) +
              (currentInning?.extras?.noBalls || 0) +
              (currentInning?.extras?.byes || 0) +
              (currentInning?.extras?.legByes || 0),
            color: lightMode ? "text-amber-600" : "text-amber-400",
          },
          {
            label: "Fours",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.fours || 0),
              0,
            ),
            color: lightMode ? "text-emerald-600" : "text-emerald-400",
          },
          {
            label: "Sixes",
            value: Object.values(currentInning?.batsmenStats || {}).reduce(
              (acc, p) => acc + (p.sixes || 0),
              0,
            ),
            color: lightMode ? "text-indigo-600" : "text-indigo-400",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`border p-4 rounded-2xl text-center shadow-sm ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <div
              className={`text-[11px] uppercase font-black tracking-widest mb-1 ${theme.sub}`}>
              {stat.label}
            </div>
            <div className={`${stat.color} font-mono font-black text-2xl`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
