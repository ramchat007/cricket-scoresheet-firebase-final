import {
  doc,
  runTransaction,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  setDoc,
  orderBy,
  onSnapshot,
  deleteDoc,
  writeBatch,
  getDocs,
  arrayUnion, // ✅ Added for safe roster updates
} from "firebase/firestore";
import { db } from "./firebase";

// --- HELPERS ---
const getNextBidAmount = (currentBid) => {
  if (currentBid < 1000) return currentBid + 100;
  if (currentBid < 5000) return currentBid + 200;
  return currentBid + 500;
};

// --- SUBSCRIPTIONS ---

// 1. Listen to the "Room State"
export function subscribeAuctionState(tournamentId, callback) {
  const ref = doc(db, "tournaments", tournamentId, "auction", "state");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// 2. Listen to Available Players (Only Unsold)
export function subscribeUnsoldPlayers(tournamentId, callback) {
  const q = query(
    collection(db, "tournaments", tournamentId, "auctionPlayers"),
    where("status", "==", "UNSOLD"),
    orderBy("name")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribePassedPlayers(tournamentId, callback) {
  const q = query(
    collection(db, "tournaments", tournamentId, "auctionPlayers"),
    where("status", "==", "UNSOLD_PASSED"),
    orderBy("name")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// 2. Action: Move player back to "UNSOLD" (The Queue)
export async function requeuePlayer(tournamentId, playerId) {
  const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
  await updateDoc(ref, { status: "UNSOLD" });
}

// --- INITIALIZATION ---
export async function initializeAuction(tournamentId) {
  const ref = doc(db, "tournaments", tournamentId, "auction", "state");
  await setDoc(ref, {
    status: "PENDING",
    currentBid: 0,
    currentPlayer: null,
    highestBidderId: null,
    highestBidderName: null, // Fixed typo from history
    history: [], // Keep history array if needed
    updatedAt: serverTimestamp(),
  });
}

// --- NEW: RESET / DELETE AUCTION ---
export async function resetAuction(tournamentId) {
  const batch = writeBatch(db);

  // 1. Delete the "State" document
  const stateRef = doc(db, "tournaments", tournamentId, "auction", "state");
  batch.delete(stateRef);

  // 2. Delete all players in the 'auctionPlayers' pool
  const playersRef = collection(
    db,
    "tournaments",
    tournamentId,
    "auctionPlayers"
  );
  const playerSnap = await getDocs(playersRef);
  playerSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // 3. (Optional) Reset Team Purses? - Usually handled in Admin Panel logic

  await batch.commit();
}

// --- ACTIONS ---

// 1. ADMIN: Bring a player to the "Bidding Table"
export const startBidding = async (tournamentId, player) => {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  // ✅ CRITICAL: Preserve Original ID & Photo for Sync
  const playerPayload = {
    id: player.id,
    originalId: player.originalPlayerId || player.originalId || null, // Global ID link
    name: player.name,
    role: player.role || "All-Rounder",
    basePrice: parseInt(player.basePrice || 0),
    isIcon: !!player.isIcon,
    isOwner: !!player.isOwner,
    photoURL: player.photoURL || "", // Ensure photo passes through
  };

  try {
    await updateDoc(auctionRef, {
      status: "LIVE",
      currentBid: playerPayload.basePrice,
      highestBidderId: null,
      highestBidderName: null,
      currentPlayer: playerPayload,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Fallback if doc doesn't exist
    await setDoc(auctionRef, {
      status: "LIVE",
      currentBid: playerPayload.basePrice,
      highestBidderId: null,
      highestBidderName: null,
      currentPlayer: playerPayload,
      updatedAt: new Date().toISOString(),
    });
  }
};

// 2. TEAM: Place a Bid (Transaction Safe)
export async function placeBid(tournamentId, teamId, teamName, amount) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  try {
    await runTransaction(db, async (tx) => {
      const aucSnap = await tx.get(auctionRef);
      if (!aucSnap.exists()) throw new Error("Auction not initialized");

      const auction = aucSnap.data();

      // Validation
      if (auction.status !== "LIVE") throw new Error("Bidding is closed");
      if (amount <= auction.currentBid) throw new Error("Bid must be higher");

      // Note: Purse check is usually done client-side or needs team read here.
      // Assuming UI prevents invalid bids for simplicity/speed in transaction.

      // Update Auction State
      tx.update(auctionRef, {
        currentBid: amount,
        highestBidderId: teamId,
        highestBidderName: teamName,
        lastBidAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Bid Failed", error);
    alert(error.message);
  }
}

// 3. ADMIN: Sold! (Close the round)
export const markSold = async (tournamentId) => {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  await runTransaction(db, async (tx) => {
    // A. Get Auction State
    const aucSnap = await tx.get(auctionRef);
    if (!aucSnap.exists()) throw new Error("Auction state missing");

    const auction = aucSnap.data();
    const { currentPlayer, highestBidderId, currentBid } = auction;

    if (!highestBidderId)
      throw new Error("No bidder found. Use Mark Unsold instead.");
    if (!currentPlayer) throw new Error("No current player active.");

    // B. Get Team Data
    const teamRef = doc(
      db,
      "tournaments",
      tournamentId,
      "teams",
      highestBidderId
    );
    const teamSnap = await tx.get(teamRef);
    if (!teamSnap.exists()) throw new Error("Winning team not found");

    const team = teamSnap.data();

    // Safety checks for numbers
    const currentSpent = Number(team.spent) || 0;
    const finalPrice = Number(currentBid) || 0;

    // ✅ CRITICAL: Construct Full Roster Object for Sync
    const rosterItem = {
      id: currentPlayer.id, // Tournament Player ID
      originalId: currentPlayer.originalId, // Global ID (Vital for Stats Sync)
      name: currentPlayer.name || "Unknown",
      role: currentPlayer.role || "Player",
      soldPrice: finalPrice,
      isIcon: !!currentPlayer.isIcon,
      isOwner: !!currentPlayer.isOwner,
      photoURL: currentPlayer.photoURL || "",
    };

    // C. Update Team (Wallet + Roster)
    tx.update(teamRef, {
      spent: currentSpent + finalPrice,
      roster: arrayUnion(rosterItem),
      players: arrayUnion(currentPlayer.name), // Keep legacy array for compatibility
    });

    // D. Update Player in Auction Pool
    const playerRef = doc(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
      currentPlayer.id
    );
    tx.update(playerRef, {
      status: "SOLD",
      teamId: highestBidderId,
      soldPrice: finalPrice,
    });

    // E. Reset Auction State
    tx.update(auctionRef, {
      status: "PENDING",
      currentPlayer: null,
      currentBid: 0,
      highestBidderId: null,
      highestBidderName: null,
    });
  });
};

// 4. ADMIN: Pass / Unsold
export async function markUnsold(tournamentId, playerId) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");
  const playerRef = doc(
    db,
    "tournaments",
    tournamentId,
    "auctionPlayers",
    playerId
  );

  await runTransaction(db, async (transaction) => {
    transaction.update(playerRef, { status: "UNSOLD_PASSED" });

    transaction.update(auctionRef, {
      status: "PENDING",
      currentPlayer: null,
      currentBid: 0,
      highestBidderId: null,
      highestBidderName: null,
    });
  });
}
