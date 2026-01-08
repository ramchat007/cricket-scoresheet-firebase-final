import {
  doc,
  onSnapshot,
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
} from "firebase/firestore";
import { db } from "./firebase";

/* ---------------------- Helpers ---------------------- */
function isReactFiberLike(obj) {
  if (!obj || typeof obj !== "object") return false;
  return (
    Object.prototype.hasOwnProperty.call(obj, "memoizedProps") &&
    Object.prototype.hasOwnProperty.call(obj, "tag")
  );
}
function isDomNodeLike(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (typeof obj.nodeType === "number" && typeof obj.nodeName === "string")
    return true;
  if (typeof obj.tagName === "string" && (obj.style || obj.className))
    return true;
  return false;
}
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
function sanitizeForCommit(value, path = "root", seen = new WeakSet()) {
  if (value === null) return null;
  if (value === undefined) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    if (Number.isNaN(value)) return null;
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (t === "function" || t === "symbol" || t === "bigint") {
    console.warn(
      `sanitizeForCommit: skipping non-serializable (${t}) at ${path}`
    );
    return undefined;
  }
  if (isDomNodeLike(value)) return undefined;
  if (isReactFiberLike(value)) return undefined;
  if (seen.has(value)) return undefined;
  if (t === "object") seen.add(value);
  if (Array.isArray(value)) {
    const out = [];
    for (let i = 0; i < value.length; i++) {
      const child = sanitizeForCommit(value[i], `${path}[${i}]`, seen);
      if (child !== undefined) out.push(child);
    }
    return out;
  }
  if (t === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const child = sanitizeForCommit(v, `${path}.${k}`, seen);
      if (child !== undefined) out[k] = child;
    }
    return out;
  }
  return undefined;
}

/* ---------------------- Public API ---------------------- */

// Get Single Tournament
export async function getTournament(tournamentId) {
  if (!tournamentId) return null;
  const ref = doc(db, "tournaments", tournamentId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// List Tournaments where User is OWNER or SCORER (Editable)
export async function listMyEditableTournaments(userId) {
  if (!userId) return [];
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const isGlobalAdmin = userSnap.exists() && userSnap.data().isAdmin === true;

    if (isGlobalAdmin) {
      return await listTournaments();
    }

    const q = query(
      collection(db, "tournaments"),
      or(
        where("ownerId", "==", userId),
        where("scorers", "array-contains", userId),
        where("viewers", "array-contains", userId)
      )
    );
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("listMyEditableTournaments error:", e);
    return [];
  }
}

export const subscribeMatch = (tournamentId, matchId, callback) => {
  if (!matchId || matchId === "new") return;
  const ref = doc(db, "tournaments", tournamentId, "matches", matchId);
  return onSnapshot(ref, (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
};

// OPTIMIZED Lightweight Subscription
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

export async function createMatch(tournamentId, matchId, payload) {
  if (!tournamentId || !matchId)
    throw new Error("createMatch needs tournamentId and matchId");

  const tDoc = doc(db, "tournaments", tournamentId);
  await setDoc(
    tDoc,
    { id: tournamentId, updatedAt: new Date().toISOString() },
    { merge: true }
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
        .map((n) => [n, { runs: 0, balls: 0, fours: 0, sixes: 0, out: null }])
    ),
    bowlerStats: Object.fromEntries(
      (bowl || [])
        .filter(Boolean)
        .map((n) => [n, { balls: 0, runs: 0, wickets: 0 }])
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
    undoStack: [], // Use undoStack instead of history
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

export async function listTournaments() {
  const colRef = collection(db, "tournaments");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchAllMatches(tournamentId) {
  const colRef = collection(db, "tournaments", tournamentId, "matches");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((docSnap) => {
    const data = docSnap.data();
    const date = normalizeDate(data.date || data.meta?.date || data.createdAt);
    const stored = data.status || data.meta?.status;
    const status = normalizeStatus(stored, date);

    return {
      id: docSnap.id,
      meta: data.meta || {},
      status,
      createdAt: data.meta?.createdAt || data.createdAt || null,
      date,
    };
  });
}

export async function listMatches(tournamentId) {
  if (!tournamentId) return [];
  try {
    return await fetchAllMatches(tournamentId);
  } catch (e) {
    console.error("listMatches error:", e);
    return [];
  }
}

/* ---------------------- transactions ---------------------- */

/**
 * ✅ OPTIMIZED: Lite Transaction
 * Stops saving full match snapshots. Only saves essential state for undo.
 */
export const ballTransaction = async (tournamentId, matchId, updateFn) => {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);

  try {
    await runTransaction(db, async (transaction) => {
      const matchDoc = await transaction.get(matchRef);
      if (!matchDoc.exists()) throw "Match does not exist!";

      const currentState = matchDoc.data();

      // 1. Create a "Lite" Snapshot for Undo
      const currentInningsIndex = currentState.currentInnings || 0;
      const currentInningsData =
        currentState.innings?.[currentInningsIndex] || {};

      // 🔥 CRITICAL FIX: JSON.parse(JSON.stringify(...)) creates a DEEP COPY.
      // This ensures the snapshot is frozen in time and won't include the new ball.
      const liteSnapshot = JSON.parse(
        JSON.stringify({
          score: currentInningsData.score || 0,
          wickets: currentInningsData.wickets || 0,
          over: currentInningsData.over || 0,
          overBallCount: currentInningsData.overBallCount || 0,
          striker: currentInningsData.striker || "",
          nonStriker: currentInningsData.nonStriker || "",
          currentBowler: currentInningsData.currentBowler || "",
          batsmenStats: currentInningsData.batsmenStats || {},
          bowlerStats: currentInningsData.bowlerStats || {},
          extras: currentInningsData.extras || {},
          ballsLog: currentInningsData.ballsLog || [],
          timeline: currentInningsData.timeline || [],
        })
      );

      // 2. Run the Scoring Logic (This mutates currentState)
      let newState = updateFn(currentState);

      // 3. Attach Snapshot to Stack
      let undoStack = newState.undoStack || [];
      undoStack.push(liteSnapshot);

      // Limit stack size
      if (undoStack.length > 6) {
        undoStack = undoStack.slice(undoStack.length - 6);
      }
      newState.undoStack = undoStack;

      // 4. Sanitize & Commit
      transaction.set(matchRef, sanitizeForCommit(newState));
    });
  } catch (e) {
    console.error("Transaction Error:", e);
    throw e;
  }
};

/**
 * ✅ OPTIMIZED: Undo Last Ball
 * Restores state from the 'undoStack'.
 */
export const undoLast = async (tournamentId, matchId) => {
  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);

  try {
    await runTransaction(db, async (transaction) => {
      const matchDoc = await transaction.get(matchRef);
      if (!matchDoc.exists()) throw "Match not found";

      const data = matchDoc.data();
      const undoStack = data.undoStack || [];

      if (undoStack.length === 0) {
        throw new Error("Nothing to undo (Limit reached)");
      }

      // 1. Pop the last saved Lite state
      // We clone it to detach from the reference
      const previousLiteState = JSON.parse(JSON.stringify(undoStack.pop()));

      // 2. Restore it into the current innings
      const idx = data.currentInnings || 0;

      // Merge restored stats into the current innings object
      // We keep existing names/arrays but overwrite the scores/stats
      data.innings[idx] = {
        ...data.innings[idx],
        ...previousLiteState,
      };

      // 3. Update the stack in the main object
      data.undoStack = undoStack;

      // 4. SANITIZE & COMMIT
      // Using sanitizeForCommit is crucial to prevent "failed-precondition" due to bad data
      const cleanData = sanitizeForCommit(data);

      transaction.set(matchRef, cleanData);
    });
    console.log("Undo successful");
  } catch (e) {
    console.error("Undo Transaction Failed:", e);
    // If transaction fails (contention), we can try a simple update as fallback
    // (Optional, but usually safer to just let the user retry)
    throw new Error("Undo failed. Please try again.");
  }
};

export const finishMatch = async (tournamentId, matchId, winner, reason) => {
  const ref = doc(db, "tournaments", tournamentId, "matches", matchId);
  await updateDoc(ref, {
    "meta.matchStatus": "finished",
    "meta.status": "finished", // Legacy support
    "meta.result": `${winner} won (${reason})`,
    "meta.winner": winner,
    status: "finished", // Root level support
    winner: winner,
  });
};

export const deleteMatch = async (tournamentId, matchId) => {
  await deleteDoc(doc(db, "tournaments", tournamentId, "matches", matchId));
};

export const updateMatch = async (tournamentId, matchId, data) => {
  await updateDoc(
    doc(db, "tournaments", tournamentId, "matches", matchId),
    data
  );
};

export async function listTeams(tournamentId) {
  if (!tournamentId) return [];
  try {
    const colRef = collection(db, "tournaments", tournamentId, "teams");
    const snaps = await getDocs(colRef);
    return snaps.docs.map((d) => d.id);
  } catch (err) {
    console.error("listTeams error:", err);
    return [];
  }
}

/* ---------------------- Teams (global collection) ---------------------- */

export async function addTeam(
  tournamentId,
  teamName,
  playersArray,
  extraData = {}
) {
  try {
    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    const docRef = await addDoc(teamsRef, {
      name: teamName,
      players: playersArray,
      ...extraData,
      createdAt: new Date().toISOString(),
    });
    return docRef; // ✅ Return doc ref so we can get ID
  } catch (error) {
    console.error("Error adding team:", error);
    throw error;
  }
}

export async function updateTeam(
  tournamentId,
  teamId,
  playersArray,
  extraData = {}
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

export const listAllTeams = async () => {
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
};

export const addPlayerToTeam = async (teamId, playerName) => {
  const teamRef = doc(db, "teams", teamId);
  await updateDoc(teamRef, {
    players: arrayUnion(playerName),
  });
};

export const removePlayerFromTeam = async (teamId, playerName) => {
  const teamRef = doc(db, "teams", teamId);
  await updateDoc(teamRef, {
    players: arrayRemove(playerName),
  });
};

export async function listMatchesForTeam(selectedTeam) {
  const matches = [];
  try {
    const tournamentsSnap = await getDocs(collection(db, "tournaments"));

    for (const t of tournamentsSnap.docs) {
      const tournamentId = t.id;
      const tournamentData = t.data();
      const tournamentName = tournamentData?.name || tournamentId;

      const matchesSnap = await getDocs(
        collection(db, "tournaments", tournamentId, "matches")
      );

      for (const m of matchesSnap.docs) {
        const matchData = m.data();
        if (matchData.meta) {
          const { teamA, teamB } = matchData.meta;
          const teams = [teamA, teamB].filter(Boolean);

          if (teams.includes(selectedTeam)) {
            matches.push({
              id: m.id,
              tournamentId,
              tournamentName,
              teams,
              displayName: `${tournamentName} — ${teams.join(" vs ")}`,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Error fetching matches:", e);
  }

  return matches;
}

/* ---------------------- Tournament helpers & subscriptions ---------------------- */

export async function addTournament(tournamentId, meta = {}, ownerId = null) {
  if (!tournamentId) throw new Error("Tournament ID is required");

  const ref = doc(db, "tournaments", tournamentId);
  const snap = await getDoc(ref);
  const exists = snap.exists();

  const payload = {
    id: tournamentId,
    name: meta.name || tournamentId,
    location: meta.location || "",
    format: meta.format || null,
    organizer: meta.organizer || "",
    startDate: normalizeDate(meta.startDate) || localDateString(),
    createdAt: meta.createdAt || new Date().toISOString(),
    status: meta.status || "upcoming",
    ...meta,
  };

  if (!exists && ownerId) {
    payload.ownerId = ownerId;
    payload.scorers = [ownerId];
    payload.viewers = [];
  }

  await setDoc(ref, payload, { merge: true });
}

export async function listTournamentDetails() {
  const colRef = collection(db, "tournaments");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ---------- Unified, normalized match lists ---------- */

export async function listUpcomingMatches(tournamentId) {
  if (!tournamentId) return [];
  try {
    const all = await fetchAllMatches(tournamentId);
    return all.filter((m) => m.status === "upcoming");
  } catch (e) {
    console.error("listUpcomingMatches error:", e);
    return [];
  }
}
export async function getMatch(tournamentId, matchId) {
  if (!tournamentId || !matchId) {
    throw new Error("Both Tournament ID and Match ID are required");
  }

  const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  const snap = await getDoc(matchRef);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  } else {
    throw new Error("Match not found");
  }
}

export async function listMatchesForTournament(tournamentId) {
  if (!tournamentId) throw new Error("Tournament ID is required");
  const matchesColRef = collection(db, "tournaments", tournamentId, "matches");

  const snaps = await getDocs(matchesColRef);

  return snaps.docs.map((docSnap) => {
    const data = docSnap.data();
    const date = data.date || data.meta?.date || data.createdAt;

    return {
      id: docSnap.id,
      ...data,
      date: date,
    };
  });
}

export async function listOngoingMatches(tournamentId) {
  if (!tournamentId) return [];
  try {
    const all = await fetchAllMatches(tournamentId);
    return all.filter((m) => m.status === "in-progress");
  } catch (e) {
    console.error("listOngoingMatches error:", e);
    return [];
  }
}

export async function listFinishedMatches(tournamentId) {
  if (!tournamentId) return [];
  try {
    const all = await fetchAllMatches(tournamentId);
    return all.filter((m) => m.status === "finished");
  } catch (e) {
    console.error("listFinishedMatches error:", e);
    return [];
  }
}

/* ---------------------- Real-time subscriptions ---------------------- */

export function subscribeTournaments(callback) {
  const colRef = collection(db, "tournaments");
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export function subscribeAllTeams(callback) {
  const colRef = collection(db, "teams");
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export function subscribeTeams(tournamentId, callback) {
  if (!tournamentId) {
    return () => {};
  }
  const colRef = collection(db, "tournaments", tournamentId, "teams");
  return onSnapshot(colRef, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export function subscribeMatches(tournamentId, callback) {
  if (!tournamentId) return () => {};
  const colRef = collection(db, "tournaments", tournamentId, "matches");
  return onSnapshot(colRef, (snapshot) => {
    const matches = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(matches);
  });
}

export async function addBallEvent(tournamentId, matchId, event) {
  return ballTransaction(tournamentId, matchId, (match) => {
    const nextTimeline = Array.isArray(match.timeline)
      ? [...match.timeline]
      : [];
    nextTimeline.push({
      ...event,
      createdAt: new Date().toISOString(),
    });
    match.timeline = nextTimeline;
    return match;
  });
}

export async function createMatchAuto(tournamentId, payload = {}) {
  if (!tournamentId) throw new Error("createMatchAuto needs tournamentId");
  const newDocRef = doc(collection(db, "tournaments", tournamentId, "matches"));
  const newId = newDocRef.id;
  await createMatch(tournamentId, newId, payload);
  return newId;
}

// ---------------------- RBAC & ACCESS MANAGEMENT ----------------------

export const createTournament = async (data, userId) => {
  if (!userId) throw new Error("User must be logged in");

  const docRef = await addDoc(collection(db, "tournaments"), {
    ...data,
    ownerId: userId,
    scorers: [userId],
    viewers: [],
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const findUserByEmail = async (email) => {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
};

export const addScorerToTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    scorers: arrayUnion(userId),
  });
};

export const removeScorerFromTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    scorers: arrayRemove(userId),
  });
};

export const addViewerToTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    viewers: arrayUnion(userId),
  });
};

export const removeViewerFromTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    viewers: arrayRemove(userId),
  });
};

// ✅ EXPORTED: List Tournament Teams
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

// 1. Create a new Global Player
export async function createGlobalPlayer(playerData) {
  try {
    const playersRef = collection(db, "players");
    const docRef = await addDoc(playersRef, {
      ...playerData,
      createdAt: new Date().toISOString(),
      stats: {
        matches: 0,
        runs: 0,
        wickets: 0,
        catches: 0,
        stumpings: 0,
        highestScore: 0,
        bestBowling: "0/0",
      },
    });
    return docRef.id;
  } catch (e) {
    console.error("Error creating player:", e);
    throw e;
  }
}

// 2. List all Global Players
export async function listGlobalPlayers() {
  try {
    const playersRef = collection(db, "players");
    const q = query(playersRef, orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error("Error listing players:", e);
    return [];
  }
}

export async function updateGlobalPlayer(playerId, updateData) {
  try {
    const playerRef = doc(db, "players", playerId);
    await updateDoc(playerRef, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error updating player:", e);
    throw e;
  }
}

export async function deleteGlobalPlayer(playerId) {
  try {
    const ref = doc(db, "players", playerId);
    await deleteDoc(ref);
  } catch (e) {
    console.error("Error deleting player:", e);
    throw e;
  }
}

/* ---------------------- Auction & Owner Management ---------------------- */

// 1. Register Owner as a SOLD player (for stats tracking)
export async function registerOwnerAsPlayer(tournamentId, teamId, ownerData) {
  // ownerData: { name, role, playerId (global) }
  try {
    const ref = collection(db, "tournaments", tournamentId, "auctionPlayers");
    await addDoc(ref, {
      name: ownerData.name,
      role: ownerData.role,
      status: "SOLD",
      teamId: teamId,
      soldPrice: 0, // Owners typically cost 0 in budget
      isOwner: true,
      playerId: ownerData.playerId, // Link to global player ID
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error registering owner as player:", e);
    throw e;
  }
}

// 2. Generic helper to add a player to the Auction Pool
export async function addAuctionPlayer(tournamentId, playerData) {
  try {
    const ref = collection(db, "tournaments", tournamentId, "auctionPlayers");
    const docRef = await addDoc(ref, {
      ...playerData,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding auction player:", e);
    throw e;
  }
}
