// src/components/ScoreInput.jsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { updateMatch } from "../utils/firestore"; // Use centralized firestore
import MatchCorrectionModal from "./MatchCorrectionModal.jsx";

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
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // --- HELPER: Safely get player name ---
  const getPlayerName = (player) => {
    if (!player) return "";
    if (typeof player === "object") {
      return player.name || player.playerName || player.label || "Unknown";
    }
    return String(player).trim();
  };

  // -- Memoized Data --
  const inningIndex = match?.currentInnings || 0;
  const m = match?.innings?.[inningIndex] || {};
  const tournamentId = match?.meta?.tournament || match?.tournamentId;

  // --- SAFETY CHECK: MAX OVERS ---
  const MAX_OVERS = match?.meta?.overs ? parseInt(match.meta.overs) : 50;
  const isInningsLimitReached = m.over >= MAX_OVERS;

  // --- FINISH MATCH VALIDATION ---
  const isCurrentInningsDone = m.completed;
  const isMatchFinished = match?.meta?.matchStatus === "finished";
  const isLastInnings =
    match?.currentInnings === (match?.innings?.length || 2) - 1;

  const canFinishMatch =
    isMatchFinished || (inningIndex === 1 && isCurrentInningsDone);

  // --- LOGIC: FORCE RESUME ---
  const handleForceResume = async () => {
    if (!window.confirm("Force Unlock? This clears all waiting flags.")) return;
    try {
      const idx = match.currentInnings || 0;
      await updateMatch(tournamentId, match.id, {
        [`innings.${idx}.awaitingNewBatsman`]: false,
        [`innings.${idx}.awaitingNewBowler`]: false,
        [`innings.${idx}.completed`]: false,
      });
    } catch (e) {
      alert("Failed to unlock: " + e.message);
    }
  };

  const handleResumeMatch = async () => {
    if (
      !window.confirm(
        "Unlock match? This will remove winner status and resume play."
      )
    )
      return;

    const idx = match.currentInnings || 0;

    try {
      await updateMatch(tournamentId, match.id, {
        "meta.matchStatus": "ongoing",
        status: "ongoing",
        "meta.result": null,
        winner: null,
        "meta.winner": null,
        [`innings.${idx}.completed`]: false,
      });
    } catch (e) {
      alert("Failed to resume match: " + e.message);
    }
  };

  // --- VALIDATION: Setup Completeness ---
  const hasStriker = Boolean(m.striker);
  const hasNonStriker = Boolean(m.nonStriker);
  const hasBowler = Boolean(m.currentBowler);
  const isSetupComplete = hasStriker && hasNonStriker && hasBowler;

  // --- 🛠️ SUPER-ROBUST SQUAD MERGER ---
  const { currentBattingSquad, currentBowlingSquad } = useMemo(() => {
    const norm = (str) => (str ? String(str).trim().toLowerCase() : "");
    const teamAName = norm(match?.meta?.teamA);
    const teamBName = norm(match?.meta?.teamB);
    const currentBattingName = norm(m.battingTeam);

    const batSet = new Map();
    const bowlSet = new Map();

    const addPlayers = (list, targetSet) => {
      if (!Array.isArray(list)) return;
      list.forEach((p) => {
        const name = getPlayerName(p);
        if (name && !targetSet.has(name)) targetSet.set(name, p);
      });
    };

    // 1. Determine which squad is which
    let isTeamABatting = false;

    if (currentBattingName && teamAName && currentBattingName === teamAName) {
      isTeamABatting = true;
    } else if (
      currentBattingName &&
      teamBName &&
      currentBattingName === teamBName
    ) {
      isTeamABatting = false;
    } else {
      // Fallback based on innings index
      isTeamABatting = inningIndex === 0;
    }

    // 2. Merge Lists based on determination
    // Team A
    const squadA = match?.teamASquad || [];
    // Team B
    const squadB = match?.teamBSquad || [];

    // Innings Lists (Backup)
    const innBatList = m.batsmenList || [];
    const innBowlList = m.bowlersList || [];

    if (isTeamABatting) {
      // Batting: Team A Squad + Innings Bat List
      addPlayers(squadA, batSet);
      addPlayers(innBatList, batSet);

      // Bowling: Team B Squad + Innings Bowl List
      addPlayers(squadB, bowlSet);
      addPlayers(innBowlList, bowlSet);
    } else {
      // Batting: Team B Squad + Innings Bat List
      addPlayers(squadB, batSet);
      addPlayers(innBatList, batSet);

      // Bowling: Team A Squad + Innings Bowl List
      addPlayers(squadA, bowlSet);
      addPlayers(innBowlList, bowlSet);
    }

    return {
      currentBattingSquad: Array.from(batSet.values()),
      currentBowlingSquad: Array.from(bowlSet.values()),
    };
  }, [match, m.battingTeam, inningIndex, m.batsmenList, m.bowlersList]);

  // --- HELPER: Out Players ---
  const outPlayersSet = useMemo(() => {
    const outSet = new Set();
    if (m.batsmenStats) {
      Object.keys(m.batsmenStats).forEach((name) => {
        const p = m.batsmenStats[name];
        if (p.out || p.wicketType) outSet.add(getPlayerName(name));
      });
    }
    if (m.fallOfWickets) {
      m.fallOfWickets.forEach((w) => {
        if (w.batsman) outSet.add(getPlayerName(w.batsman));
      });
    }
    return outSet;
  }, [m.batsmenStats, m.fallOfWickets]);

  // --- 🎯 BATTING OPTIONS (Dropdowns) ---
  const battingOptions = useMemo(() => {
    const set = new Set();
    // 1. Always include current guys
    if (m.striker) set.add(getPlayerName(m.striker));
    if (m.nonStriker) set.add(getPlayerName(m.nonStriker));

    // 2. Add Squad Members
    currentBattingSquad.forEach((n) => {
      const pName = getPlayerName(n);
      if (pName && !outPlayersSet.has(pName)) {
        set.add(pName);
      }
    });

    // 3. Fallback: Add players from Stats Keys
    if (m.batsmenStats) {
      Object.keys(m.batsmenStats).forEach((name) => {
        const pName = getPlayerName(name);
        if (pName && !outPlayersSet.has(pName)) {
          set.add(pName);
        }
      });
    }

    return Array.from(set).sort();
  }, [m, currentBattingSquad, outPlayersSet]);

  // --- 🎯 NEXT BATSMAN LIST ---
  const nextBatsmenList = useMemo(() => {
    const options = new Set();

    // 1. From Squad
    currentBattingSquad.forEach((p) => {
      const name = getPlayerName(p);
      if (
        name &&
        !outPlayersSet.has(name) &&
        name !== getPlayerName(m.striker) &&
        name !== getPlayerName(m.nonStriker)
      ) {
        options.add(name);
      }
    });

    // 2. From Stats Keys (Fallback)
    if (m.batsmenStats) {
      Object.keys(m.batsmenStats).forEach((name) => {
        const pName = getPlayerName(name);
        if (
          pName &&
          !outPlayersSet.has(pName) &&
          pName !== getPlayerName(m.striker) &&
          pName !== getPlayerName(m.nonStriker)
        ) {
          options.add(pName);
        }
      });
    }

    return Array.from(options).sort();
  }, [m, currentBattingSquad, outPlayersSet]);

  // --- FIELDING TEAM ---
  const fieldingTeamPlayers = useMemo(() => {
    const bowlerSet = new Set();

    // 1. From Squad
    currentBowlingSquad.forEach((p) => bowlerSet.add(getPlayerName(p)));

    // 2. From Stats (Fallback)
    if (m.bowlerStats) {
      Object.keys(m.bowlerStats).forEach((name) =>
        bowlerSet.add(getPlayerName(name))
      );
    }

    return Array.from(bowlerSet)
      .filter((n) => n)
      .sort();
  }, [currentBowlingSquad, m.bowlerStats]);

  // --- STATS ---
  const calculatedExtras = useMemo(() => {
    const stats = { wd: 0, nb: 0, b: 0, lb: 0 };
    const history = m.timeline || m.ballsLog || [];
    history.forEach((ball) => {
      if (typeof ball === "object") {
        if (ball.isWide) stats.wd += ball.runs || 1;
        else if (ball.isNoBall) stats.nb += 1;
        else if (ball.isBye) stats.b += ball.runs;
        else if (ball.isLegBye) stats.lb += ball.runs;
        return;
      }
    });
    return stats;
  }, [m.timeline, m.ballsLog]);

  const totalExtras =
    calculatedExtras.wd +
    calculatedExtras.nb +
    calculatedExtras.b +
    calculatedExtras.lb;

  const lastOverBalls = useMemo(() => {
    const history = m.timeline || m.ballsLog || [];
    if (history.length === 0) return [];
    let legalCount = 0;
    const lastBalls = [];
    for (let i = history.length - 1; i >= 0 && legalCount < 6; i--) {
      const ball = history[i];
      let displayValue = "";
      if (typeof ball === "object") {
        if (ball.isWicket) displayValue = "W";
        else displayValue = String(ball.runs);
        if (ball.isWide) displayValue = "wd";
        else if (ball.isNoBall) displayValue = "nb";
        lastBalls.unshift(displayValue);
        if (!ball.isWide && !ball.isNoBall) legalCount++;
      }
    }
    return lastBalls;
  }, [m.timeline, m.ballsLog]);

  if (!user || !match) return null;

  // --- Start Match Logic ---
  if (!match.meta?.toss || !match.meta?.toss?.winner) {
    const handleStartMatch = async () => {
      if (!tossWinner) return alert("Select Toss Winner");
      const tid = match.meta?.tournament || match.id;
      const mid = match.id;
      if (!mid) {
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
          timeline: [],
        };
        const matchRef = doc(db, "tournaments", tournamentId, "matches", mid);
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">🪙 Match Toss</h3>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-dashed border-gray-700 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Who won?</label>
            <select
              className="bg-gray-900 border border-gray-700 text-white rounded p-2 w-full"
              value={tossWinner}
              onChange={(e) => setTossWinner(e.target.value)}>
              <option value="">-- Select Team --</option>
              <option value={match.meta?.teamA}>{match.meta?.teamA}</option>
              <option value={match.meta?.teamB}>{match.meta?.teamB}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Decision</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTossDecision("Bat")}
                className={`flex-1 py-2 rounded font-bold ${
                  tossDecision === "Bat"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700"
                }`}>
                Bat
              </button>
              <button
                onClick={() => setTossDecision("Bowl")}
                className={`flex-1 py-2 rounded font-bold ${
                  tossDecision === "Bowl"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700"
                }`}>
                Bowl
              </button>
            </div>
          </div>
          <button
            onClick={handleStartMatch}
            disabled={startLoading || !tossWinner}
            className="w-full py-3 bg-green-600 text-white font-bold rounded mt-4">
            Start Match
          </button>
        </div>
      </div>
    );
  }

  // --- SCORING STATUS CHECKS ---
  const statusChecks = {
    isFinished: match.meta?.status === "finished",
    isCompleted: m.completed,
    awaitingBowler: Boolean(m.awaitingNewBowler),
    awaitingBatsman: Boolean(m.awaitingNewBatsman),
    setupIncomplete: !isSetupComplete,
  };

  const disableBallEntry = Object.values(statusChecks).some(Boolean);

  // --- Handlers ---
  const handleStrikerChange = (newStriker) => {
    if (newStriker === getPlayerName(m.nonStriker)) return alert("Same Player");
    onStrikeChange?.(newStriker, getPlayerName(m.nonStriker));
  };
  const handleNonStrikerChange = (newNonStriker) => {
    if (newNonStriker === getPlayerName(m.striker)) return alert("Same Player");
    onStrikeChange?.(getPlayerName(m.striker), newNonStriker);
  };
  const handleBallClick = (val) => {
    if (!isSetupComplete) {
      alert("Please select Striker, Non-Striker, and Bowler first!");
      return;
    }
    onBall(val);
  };
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
      whoOut:
        whoOut === "striker"
          ? getPlayerName(m.striker)
          : getPlayerName(m.nonStriker),
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

  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-base focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all";
  const inputErrorClass =
    "w-full bg-gray-800 text-white border-2 border-red-500 rounded-lg px-3 py-2 text-base shadow-sm shadow-red-900";
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

      {/* --- DIAGNOSTIC STATUS BAR --- */}
      {disableBallEntry && !isMatchFinished && (
        <div className="bg-yellow-900/30 border border-yellow-600/30 rounded p-2 text-center">
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">
            {statusChecks.awaitingBatsman
              ? "Waiting for Batsman"
              : statusChecks.awaitingBowler
              ? "Waiting for Bowler"
              : statusChecks.setupIncomplete
              ? "Setup Incomplete"
              : statusChecks.isCompleted
              ? "Innings Completed"
              : "Scoring Locked"}
          </span>
          <button
            onClick={handleForceResume}
            className="ml-3 text-[10px] bg-yellow-700 hover:bg-yellow-600 text-white px-2 py-0.5 rounded uppercase">
            Force Unlock
          </button>
        </div>
      )}

      {/* Batsmen Controls */}
      <div className="grid grid-cols-1 gap-3 bg-gray-800/40 p-3 rounded-lg border border-gray-700">
        <div className="flex gap-2">
          <div className="flex-1">
            <label
              className={`text-sm ${
                !hasStriker ? "text-red-400 font-bold" : "text-gray-400"
              }`}>
              Striker *
            </label>
            <select
              className={!hasStriker ? inputErrorClass : inputClass}
              value={getPlayerName(m.striker) || ""}
              onChange={(e) => handleStrikerChange(e.target.value)}>
              <option value="">Select</option>
              {battingOptions.map((n) => (
                <option
                  key={n}
                  value={n}
                  disabled={n === getPlayerName(m.nonStriker)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label
              className={`text-sm ${
                !hasNonStriker ? "text-red-400 font-bold" : "text-gray-400"
              }`}>
              Non-Striker *
            </label>
            <select
              className={!hasNonStriker ? inputErrorClass : inputClass}
              value={getPlayerName(m.nonStriker) || ""}
              onChange={(e) => handleNonStrikerChange(e.target.value)}>
              <option value="">Select</option>
              {battingOptions.map((n) => (
                <option
                  key={n}
                  value={n}
                  disabled={n === getPlayerName(m.striker)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() =>
            onStrikeChange?.(
              getPlayerName(m.nonStriker),
              getPlayerName(m.striker)
            )
          }
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
            <span
              className={`text-sm ${
                !hasBowler ? "text-red-400 font-bold" : "text-gray-400"
              }`}>
              Bowler: *
            </span>
            <select
              className={`${
                !hasBowler ? inputErrorClass : inputClass
              } py-1 text-sm w-auto max-w-[150px]`}
              value={getPlayerName(m.currentBowler) || ""}
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
              <option value="striker">
                Striker ({getPlayerName(m.striker)})
              </option>
              <option value="nonStriker">
                Non-Striker ({getPlayerName(m.nonStriker)})
              </option>
            </select>
          )}
          <button
            className="w-full mt-2 bg-red-600 text-white font-bold py-3 rounded"
            onClick={confirmWicket}>
            CONFIRM
          </button>
        </div>
      ) : (
        /* Buttons Grid */
        <>
          <div className="grid grid-cols-4 gap-2">
            {MAIN_BUTTONS.map((k) => (
              <button
                key={k}
                onClick={() => handleBallClick(k)}
                disabled={disableBallEntry}
                className="h-14 w-full rounded-lg bg-gray-800 hover:bg-cyan-600 border border-gray-700 text-white text-xl font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 touch-manipulation">
                {k}
              </button>
            ))}
            <button
              onClick={handleWicketClick}
              disabled={disableBallEntry}
              className="h-14 w-full rounded-lg bg-red-900/40 hover:bg-red-600 border border-red-500 text-white text-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 touch-manipulation">
              OUT
            </button>
          </div>

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
                  className="flex-1 min-w-[3rem] py-3 bg-gray-700 hover:bg-yellow-600 text-white text-sm font-bold rounded border border-gray-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">
                  +{r}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* OVERLAYS (Batsman/Bowler) */}
      {m.awaitingNewBatsman && (
        <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col justify-center items-center p-6 animate-in fade-in">
          {nextBatsmenList.length === 0 ? (
            <div className="text-center">
              <div className="text-5xl mb-4">🏏</div>
              <h6 className="text-red-500 font-black mb-2 text-3xl uppercase tracking-widest">
                All Out!
              </h6>
              <p className="text-gray-400 mb-8 text-sm max-w-xs mx-auto">
                No more batsmen available.
              </p>
              <button
                className="w-full bg-red-600 hover:bg-red-500 text-white py-4 px-8 rounded-xl font-bold shadow-lg text-lg flex items-center justify-center gap-3 transition-all hover:scale-105"
                onClick={onEndInnings}>
                <span>🛑</span> End Innings
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

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
              <option
                key={b}
                value={b}
                disabled={b === getPlayerName(m.currentBowler)}>
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
            className={`col-span-2 py-3 text-sm font-bold text-white rounded shadow-lg transition-all ${
              !canFinishMatch
                ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                : "bg-green-600 hover:bg-green-500"
            }`}
            onClick={() => onFinishMatch("Completed")}>
            {isMatchFinished ? "✅ MATCH FINISHED" : "🏆 FINISH MATCH"}
          </button>
        )}

        {/* ✅ RESUME BUTTON: Appears if match is finished */}
        {isMatchFinished && (
          <button
            onClick={handleResumeMatch}
            className="col-span-2 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded shadow-lg animate-pulse">
            🔓 UNLOCK / RESUME MATCH
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

      {/* Logs & Corrections */}
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
        <button
          onClick={() => setShowCorrectionModal(true)}
          className="bg-gray-700 text-gray-300 px-4 py-2 rounded text-sm font-bold w-full mt-2">
          🛠 Fix/Audit
        </button>
        {showCorrectionModal && (
          <MatchCorrectionModal
            match={match}
            tournamentId={tournamentId}
            onClose={() => setShowCorrectionModal(false)}
          />
        )}
      </div>
    </div>
  );
}
