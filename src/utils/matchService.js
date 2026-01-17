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
  arrayUnion,
  arrayRemove,
  addDoc,
  orderBy,
  or,
  onSnapshot,
} from "firebase/firestore";

// Go up one level to find firebase.js
import { db } from "./firebase";

// Import the engine from the same folder
import { calculateMatchStats } from "./scoreEngine";
import { revertMatchStatsFromGlobal } from "./statsSync";

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
      if (value === undefined) return null; // Convert undefined to null
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

/**
 * THE UNIVERSAL MODIFY FUNCTION
 * Recalculates stats from timeline using scoreEngine.
 * Now includes state-locking and awaiting flag recovery.
 */
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

    // 1. EXECUTE ACTION
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

    // 2. RECALCULATE (Self-Healing)
    const matchMeta = {
      teamA: data.meta?.teamA || data.innings[0]?.battingTeam,
      teamB: data.meta?.teamB || data.innings[1]?.battingTeam,
      initialStriker: inningsData.batsmenList?.[0],
      initialNonStriker: inningsData.batsmenList?.[1],
      initialBowler: inningsData.bowlersList?.[0],
    };

    // Recalculate stats using history. High-end logic ensures strike rotation is valid.
    const newStats = calculateMatchStats(timeline, matchMeta);

    // 3. UPDATE DB STRUCTURE
    data.innings[inningsIdx] = {
      ...data.innings[inningsIdx],
      ...newStats,
      timeline: timeline,
    };

    // Update root level summaries if active innings
    if (inningsIdx === (data.currentInnings || 0)) {
      data.score = newStats.score;
      data.wickets = newStats.wickets;
      data.over = newStats.over;
      data.overBallCount = newStats.overBallCount;
      data.striker = newStats.striker;
      data.nonStriker = newStats.nonStriker;
      data.currentBowler = newStats.currentBowler;

      // ✅ Force reset/update awaiting flags based on new timeline reality
      data.innings[inningsIdx].awaitingNewBatsman =
        newStats.awaitingNewBatsman || false;
      data.innings[inningsIdx].awaitingNewBowler =
        newStats.awaitingNewBowler || false;
    }

    // 4. COMMIT with Sync Timestamp
    data.lastUpdate = Date.now();
    const safeData = sanitizeForCommit(data);
    transaction.set(matchRef, safeData);
  });
};

/**
 * ✅ EXPORTED: Add Ball Event
 */
export async function addBallEvent(tournamentId, matchId, event) {
  return modifyMatchTimeline(tournamentId, matchId, "ADD_BALL", {
    ballData: event,
  });
}

/**
 * ✅ EXPORTED: Undo Last Event
 */
export const undoLast = async (tournamentId, matchId) => {
  return modifyMatchTimeline(tournamentId, matchId, "UNDO_LAST");
};

/* ---------------------- Match Management ---------------------- */

export const finishMatch = async (tournamentId, matchId, winner, reason) => {
  const ref = doc(db, "tournaments", tournamentId, "matches", matchId);
  await updateDoc(ref, {
    "meta.matchStatus": "finished",
    "meta.status": "finished",
    "meta.result": `${winner} won (${reason})`,
    "meta.winner": winner,
    status: "finished",
    winner: winner,
    lastUpdate: Date.now(),
  });
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

/**
 * 🛠️ UPDATED: updateMatch
 * Ensures every manual update triggers a fresh sync in the UI.
 */
export const updateMatch = async (tournamentId, matchId, data) => {
  const finalUpdate = {
    ...data,
    lastUpdate: Date.now(),
  };
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
