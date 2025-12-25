// src/components/ScoreInput.jsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

const RUN_BUTTONS = ["0", "1", "2", "3", "4", "5", "6"];
const MAIN_BUTTONS = ["0", "1", "2", "3", "4", "5", "6"];

export default function ScoreInput({
  match,
  onBall,
  onNewBatsman,
  onChangeBowler,
  onUndo,
  onEndInnings,
  onStrikeChange,
  onExtraBallRuns,
  onConfirmBowler,
  onFinishMatch,
  onDeleteMatch,
}) {
  const { user } = useAuth();

  // -- State Hooks --
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("Bat");
  const [startLoading, setStartLoading] = useState(false);

  const [isWicketMenuOpen, setIsWicketMenuOpen] = useState(false);
  const [wicketType, setWicketType] = useState("bowled");
  const [fielderName, setFielderName] = useState("");
  const [whoOut, setWhoOut] = useState("striker");
  const [incoming, setIncoming] = useState("");
  const [newBowler, setNewBowler] = useState("");
  const [extraType, setExtraType] = useState("wides");

  // -- Memoized Data --
  const inningIndex = match?.currentInnings || 0;
  const m = match?.innings?.[inningIndex] || {};

  // --- SAFETY CHECK: MAX OVERS ---
  // If undefined, default to 50. If 0 (test match?), handle accordingly.
  const MAX_OVERS = match?.meta?.overs ? parseInt(match.meta.overs) : 50;
  const isInningsLimitReached = m.over >= MAX_OVERS;

  // --- FINISH MATCH BUTTON VALIDATION ---
  // Button enabled ONLY if: Match already finished OR (Innings 1 done AND Innings 2 done)
  const isFirstInningsDone = match.innings?.[0]?.completed;
  const isCurrentInningsDone = m.completed;
  const isMatchFinished = match.meta?.matchStatus === "finished";

  // Note: Since we auto-switch to 2nd innings, 'm' usually refers to 2nd innings here.
  // We check if we are in 2nd innings and it's done.
  const canFinishMatch =
    isMatchFinished || (inningIndex === 1 && isCurrentInningsDone);

  const battingOptions = useMemo(() => {
    const set = new Set();
    if (m.striker) set.add(m.striker);
    if (m.nonStriker) set.add(m.nonStriker);
    (m.nextBatsmen || []).forEach((n) => set.add(n));
    (m.batsmenList || []).forEach((n) => {
      const isOut =
        m.batsmenStats && m.batsmenStats[n] && m.batsmenStats[n].out;
      if (!isOut) set.add(n);
    });
    return Array.from(set).filter((name) => {
      const stats = m.batsmenStats && m.batsmenStats[name];
      return !(stats && stats.out);
    });
  }, [m]);

  const nextBatsmenList = useMemo(
    () =>
      (m.nextBatsmen || m.batsmenList || []).filter((n) => {
        if (m.batsmenStats?.[n]?.out) return false;
        if (n === m.striker || n === m.nonStriker) return false;
        return true;
      }),
    [m]
  );

  const fieldingTeamPlayers = useMemo(() => m.bowlersList || [], [m]);

  const calculatedExtras = useMemo(() => {
    const stats = { wd: 0, nb: 0, b: 0, lb: 0 };
    if (m.ballsLog) {
      m.ballsLog.forEach((log) => {
        const lowerLog = log.toLowerCase();
        let runs = 1;
        if (log.includes("+")) runs = parseInt(log.split("+")[1]) || 1;
        if (lowerLog.includes("wd") || lowerLog.includes("wide"))
          stats.wd += runs;
        else if (lowerLog.includes("nb") || lowerLog.includes("no"))
          stats.nb += 1;
        else if (lowerLog.includes("lb") || lowerLog.includes("leg"))
          stats.lb += runs;
        else if (
          (lowerLog.includes("b") || lowerLog.includes("bye")) &&
          !lowerLog.includes("lb")
        )
          stats.b += runs;
      });
    }
    return stats;
  }, [m.ballsLog]);

  const totalExtras =
    calculatedExtras.wd +
    calculatedExtras.nb +
    calculatedExtras.b +
    calculatedExtras.lb;

  const lastOverBalls = useMemo(() => {
    if (!m.ballsLog || m.ballsLog.length === 0) return [];
    let legalCount = 0;
    const lastBalls = [];
    for (let i = m.ballsLog.length - 1; i >= 0 && legalCount < 6; i--) {
      const ball = m.ballsLog[i];
      lastBalls.unshift(ball);
      const bLower = ball.toLowerCase();
      if (
        !bLower.startsWith("wd") &&
        !bLower.startsWith("wide") &&
        !bLower.startsWith("nb") &&
        !bLower.startsWith("no")
      ) {
        legalCount++;
      }
    }
    return lastBalls;
  }, [m.ballsLog]);

  if (!user || !match) return null;

  // --- Start Match Logic ---
  if (!match.meta?.toss || !match.meta?.toss?.winner) {
    const handleStartMatch = async () => {
      if (!tossWinner) return alert("Select Toss Winner");

      const tournamentId = match.meta?.tournament;
      const matchId = match.id;

      if (!tournamentId || !matchId) {
        console.error("Missing IDs", { tournamentId, matchId });
        alert("System Error: Missing Match ID. Please refresh.");
        return;
      }

      setStartLoading(true);
      try {
        const teamA = match.meta.teamA;
        const teamB = match.meta.teamB;
        const squadA = match.teamASquad || [];
        const squadB = match.teamBSquad || [];

        const isTeamABatting =
          (tossWinner === teamA && tossDecision === "Bat") ||
          (tossWinner === teamB && tossDecision === "Bowl");
        const battingTeamName = isTeamABatting ? teamA : teamB;
        const bowlingTeamName = isTeamABatting ? teamB : teamA;
        const battingSquad = isTeamABatting ? squadA : squadB;
        const bowlingSquad = isTeamABatting ? squadB : squadA;

        const initialInnings = {
          battingTeam: battingTeamName,
          bowlingTeam: bowlingTeamName,
          batsmenList: battingSquad,
          bowlersList: bowlingSquad,
          score: 0,
          wickets: 0,
          over: 0,
          overBallCount: 0,
          currentBowler: null,
          striker: null,
          nonStriker: null,
          batsmenStats: {},
          bowlerStats: {},
          ballsLog: [],
        };

        const matchRef = doc(
          db,
          "tournaments",
          tournamentId,
          "matches",
          matchId
        );
        await updateDoc(matchRef, {
          "meta.toss": { winner: tossWinner, decision: tossDecision },
          "meta.status": "ongoing",
          status: "ongoing",
          innings: [initialInnings],
          currentInnings: 0,
        });
      } catch (err) {
        console.error(err);
        alert("Error starting match: " + err.message);
      } finally {
        setStartLoading(false);
      }
    };

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center space-y-6 shadow-xl">
        <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          <span>🪙</span> Match Toss
        </h3>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-dashed border-gray-700">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1 font-bold uppercase">
                Who won the toss?
              </label>
              <select
                className="bg-gray-900 border border-gray-700 text-white rounded p-3 w-full text-base"
                value={tossWinner}
                onChange={(e) => setTossWinner(e.target.value)}>
                <option value="">-- Select Team --</option>
                <option value={match.meta?.teamA}>{match.meta?.teamA}</option>
                <option value={match.meta?.teamB}>{match.meta?.teamB}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1 font-bold uppercase">
                Decision
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTossDecision("Bat")}
                  className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                    tossDecision === "Bat"
                      ? "bg-cyan-600 text-white shadow-lg"
                      : "bg-gray-700 text-gray-400"
                  }`}>
                  Bat 🏏
                </button>
                <button
                  onClick={() => setTossDecision("Bowl")}
                  className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                    tossDecision === "Bowl"
                      ? "bg-green-600 text-white shadow-lg"
                      : "bg-gray-700 text-gray-400"
                  }`}>
                  Bowl 🥎
                </button>
              </div>
            </div>
            <button
              onClick={handleStartMatch}
              disabled={startLoading || !tossWinner}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-lg uppercase tracking-widest mt-4">
              {startLoading ? "Starting..." : "Start Match 🚀"}
            </button>
          </div>
        </div>
        {onDeleteMatch && (
          <button
            onClick={() => {
              if (window.confirm("Delete Match?")) onDeleteMatch();
            }}
            className="text-red-500 text-sm hover:underline pt-2">
            Delete Match
          </button>
        )}
      </div>
    );
  }

  // --- Scoring Logic ---
  const disableBallEntry =
    Boolean(m.awaitingNewBowler) ||
    Boolean(m.awaitingNewBatsman) ||
    match.meta?.status === "finished" ||
    isWicketMenuOpen;

  const isLastInnings = match.currentInnings === match.innings.length - 1;

  const showFielderInput = ["caught", "runout", "stumped"].includes(wicketType);
  const showWhoOutInput = wicketType === "runout";

  const handleStrikerChange = (newStriker) => {
    if (newStriker === m.nonStriker) return alert("Same Player");
    onStrikeChange?.(newStriker, m.nonStriker);
  };
  const handleNonStrikerChange = (newNonStriker) => {
    if (newNonStriker === m.striker) return alert("Same Player");
    onStrikeChange?.(m.striker, newNonStriker);
  };
  const handleBallClick = (val) => onBall(val);
  const handleExtra = (r) => {
    const runs = parseInt(r, 10);
    if (!isNaN(runs)) onExtraBallRuns(extraType, runs);
  };
  const handleWicketClick = () => {
    setIsWicketMenuOpen(true);
    setWicketType("bowled");
    setWhoOut("striker");
  };
  const confirmWicket = () => {
    if (["caught", "runout", "stumped"].includes(wicketType) && !fielderName)
      return alert("Select Fielder");
    onBall("W", {
      isWicket: true,
      wicketType,
      fielderName,
      whoOut: whoOut === "striker" ? m.striker : m.nonStriker,
    });
    setIsWicketMenuOpen(false);
    setFielderName("");
  };
  const handleConfirmNewBowler = () => {
    if (newBowler) {
      onConfirmBowler(newBowler);
      setNewBowler("");
    }
  };
  const cancelWicket = () => setIsWicketMenuOpen(false);

  // Styles (Updated for Mobile)
  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all";
  const optionClass = "bg-gray-800 text-white";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 opacity-80"></div>

      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🎮</span> Scoring
        </h2>
        <span className="text-sm font-bold text-white bg-cyan-700 px-3 py-1 rounded-full shadow-sm max-w-[150px] truncate">
          {m.battingTeam}
        </span>
      </div>

      {/* Batsmen Controls */}
      <div className="grid grid-cols-1 gap-3 bg-gray-800/40 p-3 rounded-lg border border-gray-700">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm text-gray-400">Striker</label>
            <select
              className={inputClass}
              value={m.striker || ""}
              onChange={(e) => handleStrikerChange(e.target.value)}>
              <option value="">Select</option>
              {battingOptions.map((n) => (
                <option key={n} value={n} disabled={n === m.nonStriker}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-400">Non-Striker</label>
            <select
              className={inputClass}
              value={m.nonStriker || ""}
              onChange={(e) => handleNonStrikerChange(e.target.value)}>
              <option value="">Select</option>
              {battingOptions.map((n) => (
                <option key={n} value={n} disabled={n === m.striker}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => onStrikeChange?.(m.nonStriker, m.striker)}
          disabled={!m.striker}
          className="w-full py-3 text-sm uppercase font-bold text-cyan-400 border border-cyan-900 rounded hover:bg-cyan-900/20 active:bg-cyan-900/40 transition-colors">
          ⇄ Swap Ends
        </button>

        <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
          <div>
            <span className="text-sm text-gray-400">Over:</span>{" "}
            <span className="ml-2 text-xl font-mono text-white font-bold">
              {m.over}.{m.overBallCount}
            </span>
          </div>
          <div className="text-right flex items-center gap-2">
            <span className="text-sm text-gray-400">Bowler:</span>
            {/* <span className="text-white font-bold">{m.currentBowler || "None"}</span> */}
            <select
              className={`${inputClass} py-1 text-sm w-auto`}
              value={m.currentBowler || ""}
              onChange={(e) => onChangeBowler?.(e.target.value)}>
              <option className={optionClass} value="">
                Select
              </option>
              {fieldingTeamPlayers.map((b) => (
                <option className={optionClass} key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Wicket Modal */}
      {isWicketMenuOpen ? (
        <div className="bg-red-950/30 border-2 border-red-500/50 rounded-xl p-4 animate-in zoom-in-95">
          <div className="flex justify-between mb-4">
            <h5 className="text-red-400 font-bold">WICKET</h5>
            <button onClick={() => setIsWicketMenuOpen(false)}>✕</button>
          </div>
          <select
            className={inputClass}
            value={wicketType}
            onChange={(e) => setWicketType(e.target.value)}>
            <option value="bowled">Bowled</option>
            <option value="caught">Caught</option>
            <option value="lbw">LBW</option>
            <option value="runout">Run Out</option>
          </select>
          {["caught", "runout"].includes(wicketType) && (
            <select
              className={`${inputClass} mt-2`}
              value={fielderName}
              onChange={(e) => setFielderName(e.target.value)}>
              <option value="">Select Fielder</option>
              {fieldingTeamPlayers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {wicketType === "runout" && (
            <select
              className={`${inputClass} mt-2`}
              value={whoOut}
              onChange={(e) => setWhoOut(e.target.value)}>
              <option value="striker">Striker ({m.striker})</option>
              <option value="nonStriker">Non-Striker ({m.nonStriker})</option>
            </select>
          )}
          <button
            className="w-full mt-2 bg-red-600 text-white font-bold py-3 rounded"
            onClick={confirmWicket}>
            CONFIRM
          </button>
        </div>
      ) : (
        /* Buttons Grid - Optimized for Mobile */
        <>
          <div className="grid grid-cols-4 gap-2">
            {MAIN_BUTTONS.map((k) => (
              <button
                key={k}
                onClick={() => handleBallClick(k)}
                disabled={disableBallEntry}
                className="h-14 w-full rounded-lg bg-gray-800 hover:bg-cyan-600 border border-gray-700 text-white text-xl font-bold transition-all disabled:opacity-30 active:scale-95 touch-manipulation">
                {k}
              </button>
            ))}
            <button
              onClick={handleWicketClick}
              disabled={disableBallEntry}
              className="h-14 w-full rounded-lg bg-red-900/40 hover:bg-red-600 border border-red-500 text-white text-xl font-bold disabled:opacity-30 active:scale-95 touch-manipulation">
              OUT
            </button>
          </div>

          {/* Extras - Vertically Stacked to save width */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
            <div className="mb-2">
              <select
                className={`${inputClass} text-sm py-2 h-10`}
                value={extraType}
                onChange={(e) => setExtraType(e.target.value)}>
                <option value="wides">Wide</option>
                <option value="noBalls">No Ball</option>
                <option value="byes">Bye</option>
                <option value="legByes">Leg Bye</option>
              </select>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {RUN_BUTTONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleExtra(r)}
                  disabled={disableBallEntry}
                  className="flex-1 min-w-[3rem] py-3 bg-gray-700 hover:bg-yellow-600 text-white text-sm font-bold rounded border border-gray-600 active:scale-95">
                  +{r}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* OVERLAY: New Batsman Required */}
      {m.awaitingNewBatsman && (
        <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col justify-center items-center p-6 animate-in fade-in">
          <h6 className="text-cyan-400 font-bold mb-4 text-xl">
            New Batsman Required
          </h6>
          <select
            className={`${inputClass} h-14 text-lg mb-4`}
            value={incoming}
            onChange={(e) => setIncoming(e.target.value)}>
            <option value="">Select Batsman</option>
            {nextBatsmenList.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            className="w-full bg-cyan-600 text-white py-4 rounded font-bold shadow-lg text-lg"
            onClick={() => {
              if (incoming) onNewBatsman(incoming);
            }}>
            CONFIRM
          </button>
        </div>
      )}

      {/* OVERLAY: New Bowler Required */}
      {/* GUARD: Only show if innings not over */}
      {m.awaitingNewBowler && !isInningsLimitReached && (
        <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col justify-center items-center p-6 animate-in fade-in">
          <h6 className="text-yellow-400 font-bold mb-4 text-xl">
            Select Next Bowler
          </h6>
          <select
            className={`${inputClass} h-14 text-lg mb-4`}
            value={newBowler}
            onChange={(e) => setNewBowler(e.target.value)}>
            <option value="">Select Bowler</option>
            {fieldingTeamPlayers.map((b) => (
              <option key={b} value={b} disabled={b === m.currentBowler}>
                {b}
              </option>
            ))}
          </select>
          <button
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-4 rounded font-bold shadow-lg text-lg"
            onClick={handleConfirmNewBowler}>
            CONFIRM BOWLER
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-gray-800">
        <button
          className="py-3 text-sm font-bold text-gray-400 bg-gray-800 rounded active:bg-gray-700"
          onClick={onUndo}>
          ↩ Undo
        </button>
        <button
          className="py-3 text-sm font-bold text-red-400 bg-gray-800 border border-red-900/50 rounded active:bg-red-900/20"
          onClick={onEndInnings}>
          🛑 End Innings
        </button>

        {isLastInnings && (
          <button
            disabled={!canFinishMatch}
            className={`col-span-2 py-3 text-sm font-bold text-white rounded shadow-lg transition-all
              ${
                !canFinishMatch
                  ? "bg-gray-700 text-gray-500 border border-gray-600 cursor-not-allowed opacity-60"
                  : "bg-green-600 hover:bg-green-500"
              }`}
            onClick={() => onFinishMatch("Completed")}>
            {isMatchFinished ? "✅ MATCH FINISHED" : "🏆 FINISH MATCH"}
          </button>
        )}

        {onDeleteMatch && (
          <button
            className="col-span-2 text-[10px] text-red-900 hover:text-red-500 py-2"
            onClick={() => {
              if (window.confirm("Delete?")) onDeleteMatch();
            }}>
            Delete Match
          </button>
        )}
      </div>

      {/* Logs */}
      <div className="bg-black/40 -mx-5 -mb-5 mt-2 p-4 text-sm font-mono border-t border-gray-800">
        <div className="flex justify-between items-end text-gray-400 mb-2 border-b border-gray-800 pb-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest mb-1">
              Total Extras
            </div>
            <span className="text-xl text-white font-bold">{totalExtras}</span>
          </div>
          <div className="text-right text-[10px] space-x-2">
            <span>
              Wd: <b className="text-white">{calculatedExtras.wd}</b>
            </span>
            <span>
              Nb: <b className="text-white">{calculatedExtras.nb}</b>
            </span>
            <span>
              B: <b className="text-white">{calculatedExtras.b}</b>
            </span>
            <span>
              Lb: <b className="text-white">{calculatedExtras.lb}</b>
            </span>
          </div>
        </div>
        <div>
          <span className="text-gray-500 block mb-1 uppercase tracking-widest text-[10px]">
            Recent Balls:
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {lastOverBalls.length === 0 ? (
              <span className="text-gray-600 italic">No balls yet</span>
            ) : (
              lastOverBalls.map((b, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded text-white font-bold shadow-sm whitespace-nowrap ${
                    b.toLowerCase().includes("w") &&
                    !b.toLowerCase().includes("wd")
                      ? "bg-red-600"
                      : b === "4"
                      ? "bg-green-600"
                      : b === "6"
                      ? "bg-purple-600"
                      : b.toLowerCase().includes("wd") ||
                        b.toLowerCase().includes("nb")
                      ? "bg-yellow-600"
                      : "bg-gray-700"
                  }`}>
                  {b}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
