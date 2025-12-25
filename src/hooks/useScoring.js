// src/hooks/useScoring.js
import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";

/**
 * SCORING HOOK (Transaction Based - Auto Switch)
 * Handles ball-by-ball scoring, auto-switching innings, and match completion.
 */
export function useScoring({ tournamentId, matchId, match }) {
  // --- HELPER: Swap Strike ---
  function swapStrike(s, inningIdx) {
    const inn = s.innings?.[inningIdx];
    if (!inn) return s;
    const t = inn.striker;
    inn.striker = inn.nonStriker;
    inn.nonStriker = t;
    return s;
  }

  // --- HELPER: Register Batting Order ---
  function addToBattingOrder(inn, playerName) {
    if (!inn || !playerName) return;
    if (!inn.battingOrder) inn.battingOrder = [];
    if (!inn.battingOrder.includes(playerName)) {
      inn.battingOrder.push(playerName);
    }
  }

  // --- HELPER: Initialize Second Innings ---
  // Sets up the 2nd innings structure, swaps teams, and resets scores
  function initializeSecondInnings(s) {
    const prevInnings = s.innings[0];
    const nextInnings = s.innings[1] || {};

    // 1. Swap Squads (Batting Team becomes Bowling Team)
    // Fallback to existing lists if available, otherwise swap
    const prevBowl = Array.isArray(prevInnings.bowlersList)
      ? prevInnings.bowlersList
      : [];
    const prevBat = Array.isArray(prevInnings.batsmenList)
      ? prevInnings.batsmenList
      : [];

    nextInnings.batsmenList = [...prevBowl];
    nextInnings.bowlersList = [...prevBat];

    // 2. Set Team Names
    if (s.meta?.teamA && s.meta?.teamB) {
      nextInnings.battingTeam =
        prevInnings.battingTeam === s.meta.teamA ? s.meta.teamB : s.meta.teamA;
      nextInnings.bowlingTeam = prevInnings.battingTeam;
    }

    // 3. Set Openers
    nextInnings.striker = nextInnings.batsmenList[0] || "";
    nextInnings.nonStriker = nextInnings.batsmenList[1] || "";
    nextInnings.currentBowler = nextInnings.bowlersList[0] || "";

    // 4. Setup Lists
    nextInnings.nextBatsmen = (nextInnings.batsmenList || [])
      .slice(2)
      .filter(Boolean);

    nextInnings.battingOrder = [
      nextInnings.striker,
      nextInnings.nonStriker,
    ].filter(Boolean);

    // 5. Initialize Stats
    nextInnings.batsmenStats = Object.fromEntries(
      (nextInnings.batsmenList || []).map((n) => [
        n,
        { runs: 0, balls: 0, fours: 0, sixes: 0 },
      ])
    );
    nextInnings.bowlerStats = Object.fromEntries(
      (nextInnings.bowlersList || []).map((n) => [
        n,
        { balls: 0, runs: 0, wickets: 0 },
      ])
    );

    // 6. Reset Scores
    nextInnings.score = 0;
    nextInnings.wickets = 0;
    nextInnings.over = 0;
    nextInnings.overBallCount = 0;
    nextInnings.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
    nextInnings.ballsLog = [];
    nextInnings.timeline = [];

    // 7. Clear Flags
    nextInnings.awaitingNewBatsman = false;
    nextInnings.awaitingNewBowler = false;
    nextInnings.completed = false;

    // 8. Save
    s.innings[1] = nextInnings;
    s.currentInnings = 1; // SWITCH POINTER

    return s;
  }

  // --- LOGIC: Check Finish / End Innings / Target ---
  function checkFinishAndSetResult(s, idx) {
    s.meta = s.meta || {};
    const inn = s.innings?.[idx];
    if (!inn) return;

    const oversLimit = parseInt(s.meta?.overs || 0);
    const target = s.meta?.target;
    let isInningsEnded = false;

    // --- CASE A: Chasing Team Won (2nd Innings) ---
    if (idx === 1 && target && (inn.score || 0) >= target) {
      inn.completed = true;
      s.meta.matchStatus = "finished";
      const wicketsRemain = Math.max(10 - (inn.wickets || 0), 0);
      s.meta.result = `${inn.battingTeam} won by ${wicketsRemain} wicket${
        wicketsRemain === 1 ? "" : "s"
      }`;
      // Force clear prompts
      inn.awaitingNewBowler = false;
      inn.awaitingNewBatsman = false;
      return;
    }

    // --- CASE B: All Out ---
    const totalPlayers = Array.isArray(inn.batsmenList)
      ? inn.batsmenList.length
      : 11;
    const maxWickets = totalPlayers > 0 ? totalPlayers - 1 : 10;

    if ((inn.wickets || 0) >= maxWickets) {
      isInningsEnded = true;
    }

    // --- CASE C: Overs Limit Reached ---
    // Strict check: Over count meets limit AND ball count is 0 (over just finished)
    if (oversLimit > 0 && inn.over >= oversLimit && inn.overBallCount === 0) {
      isInningsEnded = true;
    }

    // === EXECUTE END OF INNINGS LOGIC ===
    if (isInningsEnded) {
      inn.completed = true;
      inn.awaitingNewBowler = false; // Prevent modal
      inn.awaitingNewBatsman = false;

      // 1st Innings Just Finished -> AUTO START 2nd INNINGS
      if (idx === 0) {
        // Set Target
        s.meta.target = (inn.score || 0) + 1;
        // Initialize Next Innings
        initializeSecondInnings(s);
      } else if (idx === 1) {
        // 2nd Innings Just Finished -> END MATCH
        s.meta.matchStatus = "finished";
        const a = s.innings?.[0]?.score || 0;
        const b = inn.score || 0;

        if (a > b) s.meta.result = `${s.meta.teamA} won by ${a - b} runs`;
        else if (b > a)
          s.meta.result = `${s.meta.teamB} won by ${
            10 - (inn.wickets || 0)
          } wickets`;
        else s.meta.result = "Match tied";
      }
    }
  }

  // --- 1. HANDLE BALL ---
  async function handleBall(code, extraData = {}, extraRuns = 0) {
    if (!tournamentId || !matchId || matchId === "new" || !match) return;
    if (match.meta?.matchStatus === "finished") {
      alert("Match has finished.");
      return;
    }

    try {
      await ballTransaction(tournamentId, matchId, (s) => {
        const idx = s.currentInnings || 0;
        const inn = s.innings?.[idx];

        // Safety checks
        if (!inn) return s;
        if (inn.completed) return s; // Stop if already done
        if (inn.awaitingNewBatsman || inn.awaitingNewBowler) return s;

        // Register Batting Order
        addToBattingOrder(inn, inn.striker);
        addToBattingOrder(inn, inn.nonStriker);

        // Determine runs
        let runs = 0;
        if (["WD", "NB", "B", "LB"].includes(code)) {
          runs = extraRuns || 0;
        } else if (code !== "W") {
          runs = parseInt(code, 10) || 0;
        }

        let ballCounted = false;

        // === WICKET ===
        if (code === "W") {
          inn.awaitingNewBatsman = true;
          inn.wickets = (inn.wickets || 0) + 1;

          const whoOut = extraData.whoOut || inn.striker;
          const wType = extraData.wicketType || "bowled";
          const fielder = extraData.fielderName || "";
          const bowler = inn.currentBowler || "";

          inn.batsmenStats = inn.batsmenStats || {};
          inn.batsmenStats[whoOut] = inn.batsmenStats[whoOut] || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
          };

          if (whoOut === inn.striker) inn.batsmenStats[whoOut].balls += 1;

          inn.batsmenStats[whoOut].wicketType = wType;
          inn.batsmenStats[whoOut].fielder = fielder;
          inn.batsmenStats[whoOut].bowler = bowler;

          // Generate out text
          let outText = `b ${bowler}`;
          if (wType === "caught") outText = `c ${fielder} b ${bowler}`;
          else if (wType === "runout") outText = `run out (${fielder})`;
          else if (wType === "stumped") outText = `st ${fielder} b ${bowler}`;
          else if (wType === "lbw") outText = `lbw b ${bowler}`;
          else if (wType === "hitwicket") outText = `hit wicket b ${bowler}`;
          inn.batsmenStats[whoOut].out = outText;

          inn.bowlerStats = inn.bowlerStats || {};
          inn.bowlerStats[bowler] = inn.bowlerStats[bowler] || {
            balls: 0,
            runs: 0,
            wickets: 0,
          };

          if (wType !== "runout") {
            inn.bowlerStats[bowler].balls += 1;
            inn.bowlerStats[bowler].wickets += 1;
          } else {
            inn.bowlerStats[bowler].balls += 1;
          }

          ballCounted = true;

          inn.fallOfWickets = inn.fallOfWickets || [];
          inn.fallOfWickets.push({
            score: inn.score,
            wicketNo: inn.wickets,
            over: `${inn.over}.${inn.overBallCount + 1}`,
            batsman: whoOut,
            type: wType,
            fielder: fielder,
          });
        }

        // === WIDE / NO BALL ===
        else if (code === "WD" || code === "NB") {
          inn.score = (inn.score || 0) + 1 + runs;
          inn.extras = inn.extras || {
            wides: 0,
            noBalls: 0,
            byes: 0,
            legByes: 0,
          };
          if (code === "WD") inn.extras.wides += 1 + runs;
          if (code === "NB") inn.extras.noBalls += 1 + runs;

          inn.bowlerStats = inn.bowlerStats || {};
          inn.bowlerStats[inn.currentBowler] = inn.bowlerStats[
            inn.currentBowler
          ] || { balls: 0, runs: 0, wickets: 0 };
          inn.bowlerStats[inn.currentBowler].runs += 1 + runs;

          if (code === "NB") {
            inn.batsmenStats = inn.batsmenStats || {};
            inn.batsmenStats[inn.striker] = inn.batsmenStats[inn.striker] || {
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
            };
            inn.batsmenStats[inn.striker].balls += 1;
            inn.batsmenStats[inn.striker].runs += runs;
          }
          if (runs % 2 !== 0) s = swapStrike(s, idx);
        }

        // === BYES / LEG BYES ===
        else if (code === "B" || code === "LB") {
          inn.score = (inn.score || 0) + runs;
          inn.extras = inn.extras || {
            wides: 0,
            noBalls: 0,
            byes: 0,
            legByes: 0,
          };
          if (code === "B") inn.extras.byes += runs;
          if (code === "LB") inn.extras.legByes += runs;

          inn.bowlerStats = inn.bowlerStats || {};
          inn.bowlerStats[inn.currentBowler] = inn.bowlerStats[
            inn.currentBowler
          ] || { balls: 0, runs: 0, wickets: 0 };
          inn.bowlerStats[inn.currentBowler].balls += 1;

          inn.batsmenStats = inn.batsmenStats || {};
          inn.batsmenStats[inn.striker] = inn.batsmenStats[inn.striker] || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
          };
          inn.batsmenStats[inn.striker].balls += 1;

          ballCounted = true;
          if (runs % 2 !== 0) s = swapStrike(s, idx);
        }

        // === REGULAR RUNS ===
        else {
          inn.score = (inn.score || 0) + runs;
          inn.batsmenStats = inn.batsmenStats || {};
          inn.batsmenStats[inn.striker] = inn.batsmenStats[inn.striker] || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
          };
          inn.batsmenStats[inn.striker].runs += runs;
          inn.batsmenStats[inn.striker].balls += 1;
          if (runs === 4) inn.batsmenStats[inn.striker].fours += 1;
          if (runs === 6) inn.batsmenStats[inn.striker].sixes += 1;

          inn.bowlerStats = inn.bowlerStats || {};
          inn.bowlerStats[inn.currentBowler] = inn.bowlerStats[
            inn.currentBowler
          ] || { balls: 0, runs: 0, wickets: 0 };
          inn.bowlerStats[inn.currentBowler].runs += runs;
          inn.bowlerStats[inn.currentBowler].balls += 1;

          ballCounted = true;
          if (runs % 2 !== 0) s = swapStrike(s, idx);
        }

        // === OVER COMPLETION ===
        if (ballCounted) {
          inn.overBallCount = (inn.overBallCount || 0) + 1;
          if (inn.overBallCount === 6) {
            inn.over = (inn.over || 0) + 1;
            inn.overBallCount = 0;
            if (code !== "W") s = swapStrike(s, idx);
            // Default to asking for new bowler
            // (Only triggers if innings doesn't end in next check)
            inn.awaitingNewBowler = true;
          }
        }

        inn.timeline = inn.timeline || [];
        inn.timeline.push(code === "0" ? "•" : code);
        inn.ballsLog = inn.ballsLog || [];
        inn.ballsLog.push(code);

        // --- CHECK FOR INNINGS END / AUTO SWITCH ---
        checkFinishAndSetResult(s, idx);

        return s;
      });
    } catch (e) {
      console.error("Ball Transaction Failed:", e);
      alert("Error saving score: " + e.message);
    }
  }

  // --- WRAPPERS ---
  async function handleExtraBallRuns(extraType, runs) {
    let code = "";
    if (extraType === "wides") code = "WD";
    if (extraType === "noBalls") code = "NB";
    if (extraType === "byes") code = "B";
    if (extraType === "legByes") code = "LB";
    await handleBall(code, {}, runs);
  }

  async function handleNewBatsman(newPlayer) {
    if (!tournamentId || !matchId) return;
    await ballTransaction(tournamentId, matchId, (s) => {
      const idx = s.currentInnings || 0;
      const inn = s.innings?.[idx];
      if (!inn) return s;

      inn.striker = newPlayer;
      const currentNext = inn.nextBatsmen || inn.batsmenList || [];
      inn.nextBatsmen = currentNext.filter((p) => p !== newPlayer);
      inn.awaitingNewBatsman = false;
      addToBattingOrder(inn, newPlayer);
      return s;
    });
  }

  async function handleConfirmBowler(name) {
    if (!tournamentId || !matchId) return;
    await ballTransaction(tournamentId, matchId, (s) => {
      const idx = s.currentInnings || 0;
      const inn = s.innings?.[idx];
      if (!inn) return s;
      inn.bowlerStats = inn.bowlerStats || {};
      if (!inn.bowlerStats[name])
        inn.bowlerStats[name] = { balls: 0, runs: 0, wickets: 0 };
      inn.currentBowler = name;
      inn.awaitingNewBowler = false;
      return s;
    });
  }

  async function handleChangeBowler(name) {
    return handleConfirmBowler(name);
  }

  async function handleStrikeChange(newStriker, newNonStriker) {
    if (!tournamentId || !matchId) return;
    await ballTransaction(tournamentId, matchId, (s) => {
      const idx = s.currentInnings || 0;
      const inn = s.innings?.[idx];
      if (!inn) return s;
      if (newStriker) inn.striker = newStriker;
      if (newNonStriker) inn.nonStriker = newNonStriker;
      return s;
    });
  }

  async function handleUndo() {
    if (!tournamentId || !matchId) return;
    try {
      await undoLast(tournamentId, matchId);
    } catch (e) {
      alert("Undo failed: " + e.message);
    }
  }

  async function handleEndInnings() {
    if (!tournamentId || !matchId) return;
    await ballTransaction(tournamentId, matchId, (s) => {
      // Manual Override to End Innings (e.g., Declaration)
      const idx = s.currentInnings || 0;
      const inn = s.innings?.[idx];
      if (inn) {
        inn.completed = true;
        inn.awaitingNewBowler = false;
        inn.awaitingNewBatsman = false;
        if (idx === 0) {
          s.meta = s.meta || {};
          s.meta.target = (inn.score || 0) + 1;
          initializeSecondInnings(s);
        } else {
          s.meta = s.meta || {};
          s.meta.matchStatus = "finished";
        }
      }
      return s;
    });
  }

  async function handleFinishMatch(reason = "Completed") {
    if (!match) return;
    let winner = "TBD";
    if (match.innings && match.innings[0] && match.innings[1]) {
      if (match.innings[0].score > match.innings[1].score)
        winner = match.meta?.teamA;
      else if (match.innings[1].score > match.innings[0].score)
        winner = match.meta?.teamB;
      else winner = "Tie";
    }
    await finishMatch(tournamentId, matchId, winner, reason);
  }

  async function handleSwitchInnings(idx) {
    await ballTransaction(tournamentId, matchId, (s) => {
      s.currentInnings = idx;
      return s;
    });
  }

  async function handleDeleteMatch() {
    if (window.confirm("Delete match?")) {
      await deleteMatch(tournamentId, matchId);
    }
  }

  function computeResultString(s) {
    return s?.meta?.result || "";
  }

  return {
    handleBall,
    handleExtraBallRuns,
    handleNewBatsman,
    handleConfirmBowler,
    handleChangeBowler,
    handleStrikeChange,
    handleUndo,
    handleEndInnings,
    handleFinishMatch,
    handleSwitchInnings,
    handleDeleteMatch,
    computeResultString,
  };
}
