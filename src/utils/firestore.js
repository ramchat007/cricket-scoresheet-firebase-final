// src/utils/firestore.js
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
  or, // ✅ Required for RBAC queries
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

// ✅ NEW: Get Single Tournament (for permission checking in details page)
export async function getTournament(tournamentId) {
  if (!tournamentId) return null;
  const ref = doc(db, "tournaments", tournamentId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ✅ NEW: List Tournaments where User is OWNER or SCORER (Editable)
export async function listMyEditableTournaments(userId) {
  if (!userId) return [];
  try {
    // 1. Check if user is Global Admin
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const isGlobalAdmin = userSnap.exists() && userSnap.data().isAdmin === true;

    // 2. If Admin, return EVERYTHING
    if (isGlobalAdmin) {
      return await listTournaments(); // Reuse your existing "list all" function
    }

    // 3. Otherwise, return only assigned tournaments (Standard User)
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
export function subscribeMatch(tournamentId, matchId, cb) {
  if (!tournamentId || !matchId) {
    throw new Error("subscribeMatch requires tournamentId and matchId");
  }
  const dRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  return onSnapshot(dRef, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    try {
      const data = snap.data();
      const safe = JSON.parse(JSON.stringify(data));
      cb(safe);
    } catch (e) {
      console.warn("subscribeMatch: failed to JSON-clone snapshot", e);
      cb(snap.data());
    }
  });
}

export async function createMatch(tournamentId, matchId, payload) {
  if (!tournamentId || !matchId)
    throw new Error("createMatch needs tournamentId and matchId");

  // Ensure tournament doc exists / update timestamp
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

  // Match date
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
    history: [],
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

// Global list (For public view or fallback)
export async function listTournaments() {
  const colRef = collection(db, "tournaments");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Internal: fetch and normalize all matches for a tournament */
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

export const deleteMatch = async (tournamentId, matchId) => {
  try {
    const matchRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    await deleteDoc(matchRef);
    console.log("Match deleted:", matchId);
  } catch (error) {
    console.error("Error deleting match:", error);
    throw error;
  }
};

/* ---------------------- transactions ---------------------- */

export async function ballTransaction(tournamentId, matchId, handler) {
  if (!tournamentId || !matchId)
    throw new Error("ballTransaction needs tournamentId and matchId");

  const dRef = doc(db, "tournaments", tournamentId, "matches", matchId);

  const maxRetries = 5;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dRef);
        if (!snap.exists()) {
          throw new Error(
            `Match not found at path tournaments/${tournamentId}/matches/${matchId}`
          );
        }

        const current = snap.data();
        let working;
        try {
          working = JSON.parse(JSON.stringify(current));
        } catch (e) {
          console.warn("ballTransaction: JSON clone failed", e);
          working = current;
        }

        const next = handler(working) || working;

        const prevSnapshot = sanitizeForCommit(current, "prev");
        if (prevSnapshot && typeof prevSnapshot === "object") {
          delete prevSnapshot.history;
        }

        const hist = Array.isArray(current.history) ? current.history : [];

        const cleanedNext = sanitizeForCommit(next, "next");
        if (!cleanedNext || typeof cleanedNext !== "object") {
          throw new Error("Sanitizer produced invalid document");
        }

        cleanedNext.history = [...hist, prevSnapshot].slice(-200);

        tx.set(dRef, cleanedNext);
      });

      return;
    } catch (err) {
      attempts++;
      console.error("ballTransaction attempt", attempts, "error:", err);
      if (attempts >= maxRetries) throw err;
    }
  }
}

export async function undoLast(tournamentId, matchId) {
  if (!tournamentId || !matchId)
    throw new Error("undoLast needs tournamentId and matchId");
  const dRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dRef);
    if (!snap.exists()) throw new Error("Match not found");
    const data = snap.data();
    const hist = Array.isArray(data.history) ? data.history : [];
    if (hist.length === 0) throw new Error("No history to undo");
    const prev = hist[hist.length - 1];
    prev.history = hist.slice(0, -1);
    tx.set(dRef, prev);
  });
}

export async function finishMatch(
  tournamentId,
  matchId,
  winner,
  reason = "Completed"
) {
  if (!tournamentId || !matchId)
    throw new Error("finishMatch needs tournamentId and matchId");

  const dRef = doc(db, "tournaments", tournamentId, "matches", matchId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dRef);
    if (!snap.exists()) throw new Error("Match not found");

    tx.update(dRef, {
      winner: winner || "TBD",
      resultReason: reason,
      status: "finished",
      finishedAt: new Date().toISOString(),
    });
  });
}

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

export async function addTeam(tournamentId, teamName, playersArray, extraData = {}) {
  try {
    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    // We use a generated ID, but store the name inside
    await addDoc(teamsRef, {
      name: teamName,
      players: playersArray, // Array of Strings (Legacy/Simple)
      ...extraData,          // Contains { roster: [{id, name...}] } (New)
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error adding team:", error);
    throw error;
  }
}

// 2. UPDATE TEAM
export async function updateTeam(tournamentId, teamId, playersArray, extraData = {}) {
  try {
    const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);
    await updateDoc(teamRef, {
      players: playersArray,
      ...extraData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error updating team:", error);
    throw error;
  }
}

// 3. DELETE TEAM
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
  // Check if exists so we don't overwrite permissions if just updating meta
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

  // ✅ CRITICAL: Assign Owner Permissions if this is a new tournament
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

  // Path: tournaments/{tournamentId}/matches/{matchId}
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

    // Normalize data (helper logic you had earlier)
    const date = data.date || data.meta?.date || data.createdAt;

    return {
      id: docSnap.id,
      ...data, // Spread all data so we don't lose innings/stats
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

/**
 * Create a new match with an auto-generated Firestore ID.
 * Returns the new matchId (string).
 */
export async function createMatchAuto(tournamentId, payload = {}) {
  if (!tournamentId) throw new Error("createMatchAuto needs tournamentId");

  // create a new DocumentReference under tournaments/{tournamentId}/matches/{autoId}
  const newDocRef = doc(collection(db, "tournaments", tournamentId, "matches"));
  const newId = newDocRef.id;

  // Reuse your existing createMatch initializer (keeps behavior consistent)
  await createMatch(tournamentId, newId, payload);

  return newId;
}

// ---------------------- RBAC & ACCESS MANAGEMENT ----------------------

// 1. UPDATE Create Tournament to save Owner ID & Default Access Lists
export const createTournament = async (data, userId) => {
  if (!userId) throw new Error("User must be logged in");

  const docRef = await addDoc(collection(db, "tournaments"), {
    ...data,
    ownerId: userId, // The Creator
    scorers: [userId], // Owner is automatically a scorer
    viewers: [], // Empty viewers list initially
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// 2. Find a user ID by their Email (for assigning scorers/viewers)
export const findUserByEmail = async (email) => {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  // Return the first match (uid is the doc ID in 'users' collection)
  return snapshot.docs[0].id;
};

// 3. Add a Scorer to a Tournament
export const addScorerToTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    scorers: arrayUnion(userId),
  });
};

// 4. Remove a Scorer
export const removeScorerFromTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    scorers: arrayRemove(userId),
  });
};

// 5. Add a Viewer (Read-Only) to a Tournament
export const addViewerToTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    viewers: arrayUnion(userId),
  });
};

// 6. Remove a Viewer
export const removeViewerFromTournament = async (tournamentId, userId) => {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, {
    viewers: arrayRemove(userId),
  });
};
// ---------------------- End of RBAC & ACCESS MANAGEMENT ----------------------

export const listTournamentTeams = async (tournamentId) => {
  if (!tournamentId) return [];
  try {
    // Assuming you store teams in a sub-collection: tournaments/{id}/teams
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
      stats: { // Initialize empty stats
        matches: 0,
        runs: 0,
        wickets: 0,
        catches: 0,
        stumpings: 0,
        highestScore: 0,
        bestBowling: "0/0"
      }
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
    const q = query(playersRef, orderBy("name")); // Sort by name alphabetically
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error updating player:", e);
    throw e;
  }
}