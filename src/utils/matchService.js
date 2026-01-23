import {
  doc,
  setDoc,
  runTransaction,
  collection,
  getDocs,
  deleteDoc,
  query,
  updateDoc,
  getDoc,
  where,
  addDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";

// Go up one level to find firebase.js
import { db } from "./firebase";

// Import the engine from the same folder
import { calculateMatchStats } from "./scoreEngine";

// ✅ IMPORT SYNC FUNCTIONS
import {
  revertMatchStatsFromGlobal,
  syncMatchStatsToGlobalPlayers,
} from "./statsSync";

/* ---------------------- Helpers ---------------------- */
function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return localDateString(val);
  if (typeof val === "string") {
    if (val.length >= 10 && val.includes("-")) return val.slice(0, 10);
    return val;
  }
  return null;
}

function normalizeStatus(storedStatus, dateStr) {
  const today = localDateString();
  const s = (storedStatus || "").toLowerCase();
  if (s === "finished") return "finished";
  if (dateStr) {
    if (dateStr > today) return "upcoming";
    if (dateStr === today) return s || "in-progress";
    return s || "finished";
  }
  return s || "unknown";
}

function sanitizeForCommit(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value === undefined) return null;
      return value;
    }),
  );
}

/* ---------------------- Public API ---------------------- */

export async function getTournament(tournamentId) {
  if (!tournamentId) return null;
  const ref = doc(db, "tournaments", tournamentId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export const subscribeMatch = (tournamentId, matchId, callback) => {
  if (!matchId || matchId === "new") return;
  const ref = doc(db, "tournaments", tournamentId, "matches", matchId);
  return onSnapshot(ref, (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
};

export function subscribeMatchLite(tournamentId, matchId, cb) {
  if (!tournamentId || !matchId) return () => {};
  const ref = doc(db, "tournaments", tournamentId, "matches", matchId);
  let lastHash = null;

  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data();
    const i = data.currentInnings || 0;
    const innings = data.innings?.[i] || {};
    const livePayload = {
      battingTeam: innings.battingTeam,
      score: innings.score || 0,
      wickets: innings.wickets || 0,
      over: innings.over || 0,
      overBallCount: innings.overBallCount || 0,
      striker: innings.striker,
      nonStriker: innings.nonStriker,
      currentBowler: innings.currentBowler,
      status: data.status,
    };
    const hash = JSON.stringify(livePayload);
    if (hash === lastHash) return;
    lastHash = hash;
    cb(livePayload);
  });
}

/* ---------------------- MATCH CREATION ---------------------- */

export async function createMatch(tournamentId, matchId, payload) {
  if (!tournamentId || !matchId)
    throw new Error("createMatch needs tournamentId and matchId");

  const tDoc = doc(db, "tournaments", tournamentId);
  await setDoc(
    tDoc,
    { id: tournamentId, updatedAt: new Date().toISOString() },
    { merge: true },
  );

  const bats = Array.isArray(payload.batsmenList) ? payload.batsmenList : [];
  const bowl = Array.isArray(payload.bowlersList) ? payload.bowlersList : [];

  const innings0 = {
    battingTeam: payload.meta?.teamA || "",
    score: 0,
    wickets: 0,
    over: 0,
    overBallCount: 0,
    ballsLog: [],
    batsmenList: [...bats],
    bowlersList: [...bowl],
    striker: bats[0] || "",
    nonStriker: bats[1] || "",
    nextBatsmen: (bats.slice(2) || []).filter(Boolean),
    currentBowler: bowl[0] || "",
    batsmenStats: Object.fromEntries(
      (bats || [])
        .filter(Boolean)
        .map((n) => [n, { runs: 0, balls: 0, fours: 0, sixes: 0, out: null }]),
    ),
    bowlerStats: Object.fromEntries(
      (bowl || [])
        .filter(Boolean)
        .map((n) => [n, { balls: 0, runs: 0, wickets: 0 }]),
    ),
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    fallOfWickets: [],
    timeline: [],
    awaitingNewBatsman: false,
    awaitingNewBowler: false,
  };

  const innings1 = {
    battingTeam: payload.meta?.teamB || "",
    score: 0,
    wickets: 0,
    over: 0,
    overBallCount: 0,
    ballsLog: [],
    batsmenList: [],
    bowlersList: [],
    striker: "",
    nonStriker: "",
    nextBatsmen: [],
    currentBowler: "",
    batsmenStats: {},
    bowlerStats: {},
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    fallOfWickets: [],
    timeline: [],
    awaitingNewBatsman: false,
    awaitingNewBowler: false,
  };

  const matchDate =
    normalizeDate(payload?.meta?.date) ||
    normalizeDate(payload?.date) ||
    localDateString();
  const desiredStatus =
    payload?.meta?.status ||
    normalizeStatus(undefined, matchDate) ||
    "in-progress";

  const initial = {
    ...payload,
    batsmenList: [...bats],
    bowlersList: [...bowl],
    innings: [innings0, innings1],
    currentInnings: 0,
    undoStack: [],
    status: desiredStatus,
    createdAt: payload?.meta?.createdAt || new Date().toISOString(),
    date: matchDate,
    meta: {
      ...(payload?.meta || {}),
      date: matchDate,
      status: desiredStatus,
    },
  };

  const matchDoc = doc(db, "tournaments", tournamentId, "matches", matchId);
  await setDoc(matchDoc, sanitizeForCommit(initial, "initial"), {
    merge: true,
  });
}

/* ---------------------- SCORING TRANSACTIONS ---------------------- */

export const modifyMatchTimeline = async (
  tournamentId,
  matchId,
  action,
  payload,
) => {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);

  await runTransaction(db, async (transaction) => {
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists()) throw "Match not found";

    const data = matchDoc.data();
    const inningsIdx =
      payload?.inningsIndex !== undefined
        ? payload.inningsIndex
        : data.currentInnings || 0;

    if (!data.innings || !data.innings[inningsIdx]) {
      throw new Error("Innings data not found");
    }

    let inningsData = data.innings[inningsIdx];
    let timeline = Array.isArray(inningsData.timeline)
      ? [...inningsData.timeline]
      : [];

    switch (action) {
      case "ADD_BALL":
        timeline.push(payload.ballData);
        break;
      case "UNDO_LAST":
        if (timeline.length === 0) throw "Nothing to undo";
        timeline.pop();
        break;
      case "EDIT_BALL":
        if (payload.index >= 0 && payload.index < timeline.length) {
          timeline[payload.index] = {
            ...timeline[payload.index],
            ...payload.newBallData,
          };
        }
        break;
      case "DELETE_BALL":
        if (payload.index >= 0 && payload.index < timeline.length) {
          timeline.splice(payload.index, 1);
        }
        break;
      default:
        throw new Error("Invalid Action");
    }

    const matchMeta = {
      teamA: data.meta?.teamA || data.innings[0]?.battingTeam,
      teamB: data.meta?.teamB || data.innings[1]?.battingTeam,
      initialStriker: inningsData.batsmenList?.[0],
      initialNonStriker: inningsData.batsmenList?.[1],
      initialBowler: inningsData.bowlersList?.[0],
    };

    const newStats = calculateMatchStats(timeline, matchMeta);

    data.innings[inningsIdx] = {
      ...data.innings[inningsIdx],
      ...newStats,
      timeline: timeline,
    };

    if (inningsIdx === (data.currentInnings || 0)) {
      data.score = newStats.score;
      data.wickets = newStats.wickets;
      data.over = newStats.over;
      data.overBallCount = newStats.overBallCount;
      data.striker = newStats.striker;
      data.nonStriker = newStats.nonStriker;
      data.currentBowler = newStats.currentBowler;
      data.innings[inningsIdx].awaitingNewBatsman =
        newStats.awaitingNewBatsman || false;
      data.innings[inningsIdx].awaitingNewBowler =
        newStats.awaitingNewBowler || false;
    }

    data.lastUpdate = Date.now();
    const safeData = sanitizeForCommit(data);
    transaction.set(matchRef, safeData);
  });
};

export async function addBallEvent(tournamentId, matchId, event) {
  return modifyMatchTimeline(tournamentId, matchId, "ADD_BALL", {
    ballData: event,
  });
}

export const undoLast = async (tournamentId, matchId) => {
  return modifyMatchTimeline(tournamentId, matchId, "UNDO_LAST");
};

/* ---------------------- Match Management ---------------------- */

/**
 * ✅ FINISH MATCH: Updates Team Stats & Triggers Global Player Sync
 */
export const finishMatch = async (tournamentId, matchId, winner, reason) => {
  if (!tournamentId || !matchId) throw new Error("Missing IDs");

  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  const teamsColRef = collection(db, "tournaments", tournamentId, "teams");

  // 1. Transaction: Update Match Status & Team Stats (Points Table)
  await runTransaction(db, async (transaction) => {
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists()) throw "Match does not exist!";
    const match = matchDoc.data();

    if (match.status === "finished") throw "Match is already finished!";

    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const t1Name = inn1.battingTeam;
    const t2Name = inn2.battingTeam;

    const q1 = query(teamsColRef, where("name", "==", t1Name));
    const q2 = query(teamsColRef, where("name", "==", t2Name));
    const [t1Snap, t2Snap] = await Promise.all([getDocs(q1), getDocs(q2)]);

    if (t1Snap.empty || t2Snap.empty) {
      console.warn("Teams not found, updating status only.");
      transaction.update(matchRef, {
        status: "finished",
        "meta.matchStatus": "finished",
        winner,
        "meta.result": `${winner} won (${reason})`,
      });
      return; // Exit transaction
    }

    const t1Doc = t1Snap.docs[0];
    const t2Doc = t2Snap.docs[0];
    const t1Data = t1Doc.data();
    const t2Data = t2Doc.data();

    // Helper: Calculate Team Stats Update
    const calculateNewStats = (
      currentData,
      isWinner,
      isTie,
      runsFor,
      ballsFor,
      runsAgainst,
      ballsAgainst,
    ) => {
      const stats = currentData.stats || {
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
        nrr: 0,
        totalRuns: 0,
        totalBalls: 0,
        totalRunsConceded: 0,
        totalBallsBowled: 0,
      };
      const history = currentData.history || [];

      stats.played = (stats.played || 0) + 1;
      let resultChar = "L";
      if (isWinner) {
        stats.won = (stats.won || 0) + 1;
        stats.points = (stats.points || 0) + 2;
        resultChar = "W";
      } else if (isTie) {
        stats.tied = (stats.tied || 0) + 1;
        stats.points = (stats.points || 0) + 1;
        resultChar = "T";
      } else {
        stats.lost = (stats.lost || 0) + 1;
      }

      history.push({
        result: resultChar,
        matchId: matchId,
        tournamentId: tournamentId,
        opponent: currentData.name === t1Name ? t2Name : t1Name,
        date: new Date().toISOString(),
      });

      stats.totalRuns = (stats.totalRuns || 0) + runsFor;
      stats.totalBalls = (stats.totalBalls || 0) + ballsFor;
      stats.totalRunsConceded = (stats.totalRunsConceded || 0) + runsAgainst;
      stats.totalBallsBowled = (stats.totalBallsBowled || 0) + ballsAgainst;

      const rf =
        stats.totalBalls > 0 ? (stats.totalRuns / stats.totalBalls) * 6 : 0;
      const ra =
        stats.totalBallsBowled > 0
          ? (stats.totalRunsConceded / stats.totalBallsBowled) * 6
          : 0;
      stats.nrr = (rf - ra).toFixed(3);

      return { stats, history };
    };

    // Calculate NRR inputs
    const totalOvers = parseInt(match.meta?.overs || 20);
    const totalBallsQuota = totalOvers * 6;
    const t1BallsFaced =
      inn1.wickets >= 10 || inn1.isAllOut
        ? totalBallsQuota
        : inn1.over * 6 + inn1.overBallCount;
    const t2BallsFaced =
      inn2.wickets >= 10 || inn2.isAllOut
        ? totalBallsQuota
        : inn2.over * 6 + inn2.overBallCount;

    const isTie = winner === "Tie" || winner === "TIE";

    const t1Updates = calculateNewStats(
      t1Data,
      winner === t1Name,
      isTie,
      inn1.score,
      t1BallsFaced,
      inn2.score,
      t2BallsFaced,
    );
    const t2Updates = calculateNewStats(
      t2Data,
      winner === t2Name,
      isTie,
      inn2.score,
      t2BallsFaced,
      inn1.score,
      t1BallsFaced,
    );

    transaction.update(t1Doc.ref, {
      stats: t1Updates.stats,
      history: t1Updates.history,
    });
    transaction.update(t2Doc.ref, {
      stats: t2Updates.stats,
      history: t2Updates.history,
    });

    transaction.update(matchRef, {
      "meta.matchStatus": "finished",
      "meta.status": "finished",
      "meta.result": `${winner} won (${reason})`,
      "meta.winner": winner,
      status: "finished",
      winner: winner,
      lastUpdate: Date.now(),
    });
  });

  // 2. Post-Transaction: Trigger Global Player Sync
  try {
    const snap = await getDoc(matchRef);
    if (snap.exists()) {
      console.log("🔄 Triggering Global Player Stats Sync...");
      await syncMatchStatsToGlobalPlayers(tournamentId, matchId, snap.data());
    }
  } catch (e) {
    console.error("⚠️ Match finished, but Global Stats Sync failed:", e);
  }
};

export const deleteMatch = async (tournamentId, matchId) => {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  try {
    const snap = await getDoc(matchRef);
    if (snap.exists()) {
      const matchData = snap.data();
      if (
        matchData.status === "finished" ||
        matchData.meta?.matchStatus === "finished"
      ) {
        await revertMatchStatsFromGlobal(matchData);
      }
    }
    await deleteDoc(matchRef);
  } catch (error) {
    console.error("Error deleting match:", error);
    throw error;
  }
};

export const updateMatch = async (tournamentId, matchId, data) => {
  const finalUpdate = { ...data, lastUpdate: Date.now() };
  await updateDoc(
    doc(db, "tournaments", tournamentId, "matches", matchId),
    sanitizeForCommit(finalUpdate),
  );
};

export async function listMatches(tournamentId) {
  if (!tournamentId) return [];
  try {
    const colRef = collection(db, "tournaments", tournamentId, "matches");
    const snaps = await getDocs(colRef);
    return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createMatchAuto(tournamentId, payload = {}) {
  if (!tournamentId) throw new Error("createMatchAuto needs tournamentId");
  const newDocRef = doc(collection(db, "tournaments", tournamentId, "matches"));
  const newId = newDocRef.id;
  await createMatch(tournamentId, newId, payload);
  return newId;
}

/* ---------------------- Recalculate Tool ---------------------- */

/**
 * 🔄 RECALCULATE TOURNAMENT STATS (Sync Button Tool)
 */
export const recalculateTournamentStats = async (tournamentId) => {
  if (!tournamentId) throw new Error("Tournament ID required");
  console.log(`🔄 Starting Sync for Tournament: ${tournamentId}`);

  // 1. Fetch Tournament Settings & Collections
  const tournamentRef = doc(db, "tournaments", tournamentId);
  const teamsRef = collection(db, "tournaments", tournamentId, "teams");
  const matchesRef = collection(db, "tournaments", tournamentId, "matches");

  const [tournamentSnap, teamsSnap, matchesSnap] = await Promise.all([
    getDoc(tournamentRef),
    getDocs(teamsRef),
    getDocs(matchesRef),
  ]);

  // 2. Determine Rule Set
  // Options: 'COMPULSORY_CHASE', 'SHARED_POINTS', 'SUPER_OVER'
  // Defaulting to 'COMPULSORY_CHASE' as requested
  const tournamentData = tournamentSnap.exists() ? tournamentSnap.data() : {};
  const tieRule = tournamentData.rules?.tieRule || "COMPULSORY_CHASE";

  console.log(`📜 Applied Tie Rule: ${tieRule}`);

  const teamDataMap = {};
  teamsSnap.forEach((doc) => {
    const name = (doc.data().name || "").trim();
    if (!name) return;
    teamDataMap[name] = {
      id: doc.id,
      docRef: doc.ref,
      stats: {
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
        nrr: 0,
        totalRuns: 0,
        totalBalls: 0,
        totalRunsConceded: 0,
        totalBallsBowled: 0,
      },
      history: [],
    };
  });

  let processedCount = 0;
  matchesSnap.forEach((doc) => {
    const match = doc.data();

    // Only process finished matches
    if (match.status !== "finished" && match.meta?.matchStatus !== "finished")
      return;

    const inn1 = match.innings?.[0];
    const inn2 = match.innings?.[1];
    if (!inn1 || !inn2) return;

    const t1Name = (inn1.battingTeam || "").trim(); // Defending Team
    const t2Name = (inn2.battingTeam || "").trim(); // Chasing Team
    const s1 = teamDataMap[t1Name];
    const s2 = teamDataMap[t2Name];

    if (!s1 || !s2) return;

    processedCount++;
    s1.stats.played++;
    s2.stats.played++;

    // --- 🏆 WINNER DETERMINATION ---
    let winnerName = null;

    if (inn1.score > inn2.score) {
      winnerName = t1Name;
    } else if (inn2.score > inn1.score) {
      winnerName = t2Name;
    } else {
      // === SCORES ARE TIED ===
      const dbWinner = (
        match.winner ||
        match.meta?.result?.winner ||
        ""
      ).trim();

      // If a manual winner is set in DB (e.g., from Super Over input), respect it ALWAYS
      if (dbWinner === t1Name || dbWinner === t2Name) {
        winnerName = dbWinner;
      } else {
        // Apply Tournament Rule
        if (tieRule === "COMPULSORY_CHASE") {
          // Defending team (Innings 1) wins
          winnerName = t1Name;
        } else if (tieRule === "SHARED_POINTS") {
          // No winner, points split
          winnerName = "TIE";
        } else {
          // Default fallback (e.g. SUPER_OVER logic not yet handled manually)
          winnerName = "TIE";
        }
      }
    }

    const date = match.date || match.meta?.date || new Date().toISOString();

    // 3. Update Stats based on Winner
    if (winnerName === t1Name) {
      s1.stats.won++;
      s1.stats.points += 2;
      s1.history.push({ result: "W", matchId: doc.id, date, tournamentId });
      s2.stats.lost++;
      s2.history.push({ result: "L", matchId: doc.id, date, tournamentId });
    } else if (winnerName === t2Name) {
      s2.stats.won++;
      s2.stats.points += 2;
      s2.history.push({ result: "W", matchId: doc.id, date, tournamentId });
      s1.stats.lost++;
      s1.history.push({ result: "L", matchId: doc.id, date, tournamentId });
    } else {
      // DRAW / TIE / SHARED POINTS
      s1.stats.tied++;
      s1.stats.points += 1;
      s1.history.push({ result: "T", matchId: doc.id, date, tournamentId });
      s2.stats.tied++;
      s2.stats.points += 1;
      s2.history.push({ result: "T", matchId: doc.id, date, tournamentId });
    }

    // 4. Calculate NRR Inputs (Standard for all rules)
    const totalOvers = parseInt(match.meta?.overs || 20);
    const getBalls = (w, ao, o, b) =>
      w >= 10 || ao ? totalOvers * 6 : parseInt(o || 0) * 6 + parseInt(b || 0);

    const t1Balls = getBalls(
      inn1.wickets,
      inn1.isAllOut,
      inn1.over,
      inn1.overBallCount,
    );
    const t2Balls = getBalls(
      inn2.wickets,
      inn2.isAllOut,
      inn2.over,
      inn2.overBallCount,
    );

    s1.stats.totalRuns += inn1.score;
    s1.stats.totalBalls += t1Balls;
    s1.stats.totalRunsConceded += inn2.score;
    s1.stats.totalBallsBowled += t2Balls;

    s2.stats.totalRuns += inn2.score;
    s2.stats.totalBalls += t2Balls;
    s2.stats.totalRunsConceded += inn1.score;
    s2.stats.totalBallsBowled += t1Balls;
  });

  // 5. Commit Updates
  const batch = writeBatch(db);
  Object.values(teamDataMap).forEach((team) => {
    const s = team.stats;
    const rf = s.totalBalls > 0 ? (s.totalRuns / s.totalBalls) * 6 : 0;
    const ra =
      s.totalBallsBowled > 0
        ? (s.totalRunsConceded / s.totalBallsBowled) * 6
        : 0;
    s.nrr = (rf - ra).toFixed(3);
    batch.update(team.docRef, { stats: s, history: team.history });
  });

  await batch.commit();
  console.log(`✅ Synced ${processedCount} matches using rule: ${tieRule}`);
};

/* ---------------------- Teams & Players ---------------------- */

export async function listAllTeams() {
  const teams = [];
  try {
    const teamsSnap = await getDocs(collection(db, "teams"));
    teamsSnap.forEach((docSnap) => {
      teams.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (e) {
    console.error("Error fetching teams from 'teams' collection:", e);
  }
  return teams;
}

export async function addTeam(
  tournamentId,
  teamName,
  playersArray,
  extraData = {},
) {
  try {
    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    const docRef = await addDoc(teamsRef, {
      name: teamName,
      players: playersArray,
      ...extraData,
      createdAt: new Date().toISOString(),
    });
    return docRef;
  } catch (error) {
    console.error("Error adding team:", error);
    throw error;
  }
}

export async function updateTeam(
  tournamentId,
  teamId,
  playersArray,
  extraData = {},
) {
  try {
    const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);
    await updateDoc(teamRef, {
      players: playersArray,
      ...extraData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating team:", error);
    throw error;
  }
}

export async function deleteTeam(tournamentId, teamId) {
  try {
    const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);
    await deleteDoc(teamRef);
  } catch (error) {
    console.error("Error deleting team:", error);
    throw error;
  }
}

export const listTournamentTeams = async (tournamentId) => {
  if (!tournamentId) return [];
  try {
    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    const snapshot = await getDocs(teamsRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching tournament teams:", error);
    return [];
  }
};

export async function listTournamentDetails() {
  const colRef = collection(db, "tournaments");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeTournaments(callback) {
  const colRef = collection(db, "tournaments");
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}
