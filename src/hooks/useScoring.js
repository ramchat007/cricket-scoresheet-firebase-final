// src/hooks/useScoring.js
import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
} from "../utils/firestore.js";
import { syncMatchStatsToGlobalPlayers } from "../utils/statsSync";

// Helper: Normalize keys for robust lookup
const norm = (k) => String(k || "").trim().toLowerCase();

/**
 * 🧠 SELF-HEALING SCORING ENGINE (Robust)
 */
function recalculateInningsState(inn) {
  if (!inn) return inn;

  // 1. Reset Totals
  inn.score = 0;
  inn.wickets = 0;
  inn.over = 0;
  inn.overBallCount = 0;
  inn.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  inn.fallOfWickets = [];

  // 2. Initialize/Clear Stats Containers
  inn.batsmenStats = inn.batsmenStats || {};
  inn.bowlerStats = inn.bowlerStats || {};

  Object.values(inn.batsmenStats).forEach((p) => {
    p.runs = 0; p.balls = 0; p.fours = 0; p.sixes = 0;
    p.out = null; p.wicketType = null; p.bowler = null;
  });
  Object.values(inn.bowlerStats).forEach((b) => {
    b.runs = 0; b.balls = 0; b.wickets = 0;
  });

  // 4. Replay History
  const history = inn.timeline || inn.ballsLog || [];

  history.forEach((ball) => {
    let runVal = 0;
    let isW = false, isWD = false, isNB = false, isB = false, isLB = false;
    let batterName = inn.striker;
    let bowlerName = inn.currentBowler;
    let whoOutName = inn.striker;

    if (typeof ball === "object") {
      runVal = ball.runs || 0;
      isW = ball.isWicket;
      isWD = ball.isWide;
      isNB = ball.isNoBall;
      isB = ball.isBye;
      isLB = ball.isLegBye;
      if (ball.batter) batterName = ball.batter;
      if (ball.bowler) bowlerName = ball.bowler;
      if (ball.whoOut) whoOutName = ball.whoOut;
      else whoOutName = batterName;
    } else {
      // Legacy string support
      const code = String(ball);
      if (code === "W") isW = true;
      else if (code.includes("WD")) { isWD = true; runVal = 1 + (parseInt(code.replace("WD", "")) || 0); }
      else if (code.includes("NB")) { isNB = true; runVal = 1 + (parseInt(code.replace("NB", "")) || 0); }
      else runVal = parseInt(code) || 0;
    }

    // Init Stats
    if (batterName && !inn.batsmenStats[batterName]) inn.batsmenStats[batterName] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
    if (bowlerName && !inn.bowlerStats[bowlerName]) inn.bowlerStats[bowlerName] = { runs: 0, balls: 0, wickets: 0 };

    // Update Team Score
    inn.score += runVal;

    // Extras Logic
    if (isWD) inn.extras.wides += runVal;
    else if (isNB) inn.extras.noBalls += 1;
    else if (isB) inn.extras.byes += runVal;
    else if (isLB) inn.extras.legByes += runVal;

    // Batsman Credits
    if (batterName && inn.batsmenStats[batterName]) {
      const p = inn.batsmenStats[batterName];
      if (!isWD) p.balls += 1;
      if (!isWD && !isB && !isLB) {
        const batRuns = isNB ? Math.max(0, runVal - 1) : runVal;
        p.runs += batRuns;
        if (batRuns === 4) p.fours += 1;
        if (batRuns === 6) p.sixes += 1;
      }
    }

    // Bowler Credits
    if (bowlerName && inn.bowlerStats[bowlerName]) {
      const b = inn.bowlerStats[bowlerName];
      if (!isB && !isLB) b.runs += runVal;
      if (!isWD && !isNB) b.balls += 1;
      
      // Bowler gets wicket ONLY if it's NOT runout/retired
      const wType = (typeof ball === "object" ? ball.wicketType : "bowled") || "bowled";
      if (isW && !["runout", "retiredhurt", "retiredout"].includes(wType)) {
        b.wickets += 1;
      }
    }

    // Over Counter
    if (!isWD && !isNB) {
      inn.overBallCount += 1;
      if (inn.overBallCount === 6) {
        inn.over += 1;
        inn.overBallCount = 0;
      }
    }

    // Wicket Logic
    if (isW) {
      const wType = (typeof ball === "object" ? ball.wicketType : "bowled") || "bowled";
      
      // RETIRED HURT does NOT add to team wickets count
      if (wType !== "retiredhurt") {
        inn.wickets += 1;
        inn.fallOfWickets.push({ score: inn.score, wicketNo: inn.wickets, over: `${inn.over}.${inn.overBallCount}`, batsman: whoOutName });
      }

      const pOut = inn.batsmenStats[whoOutName];
      if (pOut) {
        const fielder = (typeof ball === "object" ? ball.fielderName : "") || "";
        let outText = `b ${bowlerName}`;
        
        if (wType === "caught") outText = `c ${fielder} b ${bowlerName}`;
        else if (wType === "runout") outText = `run out (${fielder})`;
        else if (wType === "stumped") outText = `st ${fielder} b ${bowlerName}`;
        else if (wType === "lbw") outText = `lbw b ${bowlerName}`;
        else if (wType === "hitwicket") outText = `hit wicket b ${bowlerName}`;
        else if (wType === "retiredhurt") outText = "retired hurt";
        else if (wType === "retiredout") outText = "retired out";

        pOut.out = outText;
        pOut.wicketType = wType;
        // Do not assign bowler for runout/retired
        if (!["runout", "retiredhurt", "retiredout"].includes(wType)) {
             pOut.bowler = bowlerName;
        }
      }
    }
  });

  return inn;
}

/**
 * MAIN SCORING HOOK
 */
export function useScoring({ tournamentId, matchId, match }) {
  
  const getSafeInnings = (s) => {
    const idx = s.currentInnings || 0;
    return s.innings?.[idx] || null;
  };

  async function handleBall(code, extraData = {}, physicalRuns = 0) {
    if (!tournamentId || !matchId || !match) return;
    try {
      await ballTransaction(tournamentId, matchId, (s) => {
        const inn = getSafeInnings(s);
        if (!inn || inn.completed) return s;

        const isWD = code === "WD" || extraData.isWide;
        const isNB = code === "NB" || extraData.isNoBall;
        const isB = code === "B" || extraData.isBye;
        const isLB = code === "LB" || extraData.isLegBye;

        let displayCode = code;
        if (isWD) displayCode = `1wd${physicalRuns > 0 ? '+' + physicalRuns : ''}`;
        if (isNB) displayCode = `1nb${physicalRuns > 0 ? '+' + physicalRuns : ''}`;
        if (extraData.isWicket && extraData.wicketType === 'retiredhurt') displayCode = "Ret.H";
        if (extraData.isWicket && extraData.wicketType === 'retiredout') displayCode = "Ret.O";

        // Logic: 1 penalty + runs (for WD/NB), otherwise just runs
        const totalRuns = (isWD || isNB) ? (1 + physicalRuns) : (parseInt(code) || physicalRuns || 0);

        const newBall = {
          id: Date.now(),
          code: displayCode,
          runs: totalRuns,
          physicalRuns: physicalRuns,
          isWicket: code === "W" || extraData.isWicket,
          isWide: isWD, isNoBall: isNB, isBye: isB, isLegBye: isLB,
          batter: inn.striker, bowler: inn.currentBowler, ...extraData
        };

        inn.timeline = inn.timeline || [];
        inn.timeline.push(newBall);
        
        recalculateInningsState(inn);

        // Strike Swap (Odd runs)
        let shouldSwap = (physicalRuns || (code !== "W" && parseInt(code))) % 2 !== 0;
        
        // Over End Swap
        const isLegal = !isWD && !isNB;
        if (isLegal && inn.overBallCount === 0 && inn.over > 0) {
            shouldSwap = !shouldSwap;
            inn.awaitingNewBowler = true;
        }

        if (shouldSwap) { const t = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = t; }
        if (newBall.isWicket) inn.awaitingNewBatsman = true;

        checkFinishAndSetResult(s, s.currentInnings || 0);
        return s;
      });
    } catch (e) { console.error(e); }
  }

  function checkFinishAndSetResult(s, idx) {
    const inn = s.innings?.[idx];
    const target = s.meta?.target;
    const teamSize = inn.batsmenList?.length || 11;
    const maxWickets = Math.max(1, teamSize - 1);
    const maxOvers = parseInt(s.meta?.overs || 20);

    if (idx === 1 && target && inn.score >= target) {
      inn.completed = true; s.meta.matchStatus = "finished";
      s.meta.result = `${inn.battingTeam} won by ${teamSize - inn.wickets} wickets`;
      return;
    }

    if (inn.wickets >= maxWickets || inn.over >= maxOvers || inn.completed) {
      inn.completed = true;
      if (idx === 0) { s.meta.target = inn.score + 1; initializeSecondInnings(s); }
      else {
        s.meta.matchStatus = "finished";
        const diff = (s.innings[0].score || 0) - inn.score;
        s.meta.result = diff > 0 ? `${s.meta.teamA} won by ${diff} runs` : diff === 0 ? "Match Tied" : `${s.meta.teamB} won`;
      }
    }
  }

  // --- Handlers ---
  function initializeSecondInnings(s) {
    const prev = s.innings[0];
    const nextBat = prev.bowlingTeam; const nextBowl = prev.battingTeam;
    const batSquad = (nextBat === s.meta.teamA) ? s.teamASquad : s.teamBSquad;
    const bowlSquad = (nextBowl === s.meta.teamA) ? s.teamASquad : s.teamBSquad;
    s.innings[1] = { 
        battingTeam: nextBat, bowlingTeam: nextBowl, batsmenList: batSquad || [], bowlersList: bowlSquad || [],
        score:0, wickets:0, over:0, overBallCount:0, extras:{wides:0,noBalls:0,byes:0,legByes:0},
        striker: batSquad?.[0]?.name, nonStriker: batSquad?.[1]?.name, currentBowler: bowlSquad?.[0]?.name,
        batsmenStats: {}, bowlerStats: {}, timeline: [], fallOfWickets: []
    };
    s.currentInnings = 1; s.innings[1].awaitingNewBowler = true;
    return s;
  }

  return {
    handleBall,
    handleExtraBallRuns: (type, runs) => handleBall(type === 'wides' ? 'WD' : 'NB', { isWide: type==='wides', isNoBall: type==='noBalls' }, runs),
    handleUndo: () => undoLast(tournamentId, matchId),
    handleNewBatsman: (p) => ballTransaction(tournamentId, matchId, s => { s.innings[s.currentInnings].striker = p; s.innings[s.currentInnings].awaitingNewBatsman = false; return s; }),
    handleConfirmBowler: (p) => ballTransaction(tournamentId, matchId, s => { s.innings[s.currentInnings].currentBowler = p; s.innings[s.currentInnings].awaitingNewBowler = false; return s; }),
    handleChangeBowler: (p) => ballTransaction(tournamentId, matchId, s => { s.innings[s.currentInnings].currentBowler = p; s.innings[s.currentInnings].awaitingNewBowler = false; return s; }),
    handleStrikeChange: (s, ns) => ballTransaction(tournamentId, matchId, st => { st.innings[st.currentInnings].striker = s; st.innings[st.currentInnings].nonStriker = ns; return st; }),
    handleEndInnings: () => ballTransaction(tournamentId, matchId, s => { s.innings[s.currentInnings].completed = true; checkFinishAndSetResult(s, s.currentInnings); return s; }),
    handleFinishMatch: async (r) => { await finishMatch(tournamentId, matchId, match.meta?.teamA, r); await syncMatchStatsToGlobalPlayers(tournamentId, matchId, match); },
    handleDeleteMatch: () => deleteMatch(tournamentId, matchId),
  };
}