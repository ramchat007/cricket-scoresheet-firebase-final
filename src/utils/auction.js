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
  arrayUnion,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// --- HELPERS ---
export const getNextBidAmount = (currentBid) => {
  if (currentBid < 1000) return currentBid + 100;
  if (currentBid < 5000) return currentBid + 200;
  return currentBid + 500;
};

/**
 * MANDATORY RULE: Purse Reserve (Section 1 & 5)
 * Checks if a team can afford the bid while ensuring they can still afford
 * enough players to reach the MIN_SQUAD_SIZE at the MIN_BASE_PRICE.
 */
export const canAffordBid = (team, bidAmount, tournamentConfig) => {
  const minSquadSize = parseInt(tournamentConfig?.minSquadSize || 11);
  const minBasePrice = parseInt(tournamentConfig?.minBasePrice || 100);

  const currentSquadSize = team.roster?.length || 0;
  const purse = parseInt(team.purse || 0);
  const spent = parseInt(team.spent || 0);
  const remainingPurse = purse - spent;

  const playersNeededToReachMin = Math.max(
    0,
    minSquadSize - (currentSquadSize + 1)
  );
  const reserveNeeded = playersNeededToReachMin * minBasePrice;

  return remainingPurse - bidAmount >= reserveNeeded;
};

// --- SUBSCRIPTIONS ---

export function subscribeAuctionState(tournamentId, callback) {
  const ref = doc(db, "tournaments", tournamentId, "auction", "state");
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

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

// --- INITIALIZATION & SLOTS ---

export async function initializeAuction(tournamentId) {
  const ref = doc(db, "tournaments", tournamentId, "auction", "state");
  await setDoc(ref, {
    status: "PENDING",
    currentBid: 0,
    currentPlayer: null,
    highestBidderId: null,
    highestBidderName: null,
    activeSlotId: null, // ✅ NEW: Track the round being auctioned
    history: [],
    updatedAt: serverTimestamp(),
  });
}

export const createAuctionSlot = async (tournamentId, slotData) => {
  const slotsRef = collection(db, "tournaments", tournamentId, "auction_slots");
  return await addDoc(slotsRef, {
    ...slotData,
    status: "pending", // pending, live, completed
    createdAt: Date.now(),
  });
};

export const assignPlayerToSlot = async (tournamentId, playerId, slotId) => {
  const playerRef = doc(
    db,
    "tournaments",
    tournamentId,
    "auctionPlayers",
    playerId
  );
  return await updateDoc(playerRef, { auctionSlotId: slotId });
};

// --- ACTIONS ---

export async function requeuePlayer(tournamentId, playerId) {
  const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
  await updateDoc(ref, { status: "UNSOLD" });
}

export async function resetAuction(tournamentId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "tournaments", tournamentId, "auction", "state"));
  const playersRef = collection(
    db,
    "tournaments",
    tournamentId,
    "auctionPlayers"
  );
  const playerSnap = await getDocs(playersRef);
  playerSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // ✅ Also clear rounds/slots on reset
  const slotsRef = collection(db, "tournaments", tournamentId, "auction_slots");
  const slotSnap = await getDocs(slotsRef);
  slotSnap.docs.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();
}

export const startBidding = async (tournamentId, player) => {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  const playerPayload = {
    id: player.id,
    originalId: player.originalPlayerId || player.originalId || null,
    name: player.name,
    role: player.role || "All-Rounder",
    basePrice: parseInt(player.basePrice || 0),
    isIcon: !!player.isIcon,
    isOwner: !!player.isOwner,
    photoURL: player.photoURL || "",
    auctionSlotId: player.auctionSlotId || null, // ✅ Sync slot data
  };

  const updateData = {
    status: "LIVE",
    currentBid: playerPayload.basePrice,
    highestBidderId: null,
    highestBidderName: null,
    currentPlayer: playerPayload,
    bidHistory: [],
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(auctionRef, updateData);
  } catch (error) {
    await setDoc(auctionRef, updateData);
  }
};

export async function placeBid(tournamentId, teamId, teamName, amount) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");
  const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);

  try {
    await runTransaction(db, async (tx) => {
      // 1. Get Auction State
      const aucSnap = await tx.get(auctionRef);
      if (!aucSnap.exists()) throw new Error("Auction not initialized");
      const auction = aucSnap.data();

      if (auction.status !== "LIVE") throw new Error("Bidding is closed");
      
      // ✅ VALIDATION LOGIC
      // If there is NO highestBidderId, this is the opening bid.
      // We check if amount is at least basePrice.
      // If there IS a bidder, amount must be higher than currentBid.
      if (!auction.highestBidderId) {
         if (amount < (auction.currentPlayer?.basePrice || 0)) {
           throw new Error("Opening bid must be at least Base Price");
         }
      } else if (amount <= (auction.currentBid || 0)) {
        throw new Error("Bid must be higher");
      }

      // 2. Get Team State to verify balance
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists()) throw new Error("Team not found");
      const team = teamSnap.data();

      const currentSpent = team.spent || 0;
      const purseLimit = team.purse || 0;

      if (purseLimit - currentSpent < amount) {
        throw new Error(`Team only has ₹${purseLimit - currentSpent} remaining.`);
      }

      // 3. CAPTURE PREVIOUS STATE FOR UNDO logic
      // We only store the snapshot of the auction before this bid happened.
      const currentEntry = {
        bid: auction.currentBid || 0,
        bidderId: auction.highestBidderId || null,
        bidderName: auction.highestBidderName || null,
      };

      // Keep only the last 10 bids to keep the document size small
      const existingHistory = auction.bidHistory || [];
      const updatedHistory = [...existingHistory, currentEntry].slice(-10);

      // 4. Update Bid
      tx.update(auctionRef, {
        currentBid: amount,
        highestBidderId: teamId,
        highestBidderName: teamName,
        lastBidAt: serverTimestamp(),
        bidHistory: updatedHistory, // ✅ Save history here
      });
    });
  } catch (error) {
    console.error("Bid Failed", error);
    alert(error.message);
  }
}

export const markSold = async (tournamentId) => {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  await runTransaction(db, async (tx) => {
    const aucSnap = await tx.get(auctionRef);
    if (!aucSnap.exists()) throw new Error("Auction state missing");

    const auction = aucSnap.data();
    const { currentPlayer, highestBidderId, currentBid } = auction;

    if (!highestBidderId) throw new Error("No bidder found.");
    if (!currentPlayer) throw new Error("No current player active.");

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
    const finalPrice = Number(currentBid) || 0;

    const rosterItem = {
      id: currentPlayer.id,
      originalId: currentPlayer.originalId,
      name: currentPlayer.name || "Unknown",
      role: currentPlayer.role || "Player",
      soldPrice: finalPrice,
      isIcon: !!currentPlayer.isIcon,
      isOwner: !!currentPlayer.isOwner,
      photoURL: currentPlayer.photoURL || "",
    };

    // Update Team (Wallet + Roster)
    tx.update(teamRef, {
      spent: (Number(team.spent) || 0) + finalPrice,
      roster: arrayUnion(rosterItem),
      players: arrayUnion(currentPlayer.name),
    });

    // Update Player Status
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

    // Reset State
    tx.update(auctionRef, {
      status: "PENDING",
      currentPlayer: null,
      currentBid: 0,
      highestBidderId: null,
      highestBidderName: null,
    });
  });
};

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

/**
 * TRANSACTION-SAFE BIDDING (Consolidated with existing placeBid logic)
 */
export const placeSafeBid = async (
  tournamentId,
  matchId,
  teamId,
  teamName,
  amount
) => {
  return await placeBid(tournamentId, teamId, teamName, amount);
};

export async function undoLastBid(tournamentId) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  try {
    await runTransaction(db, async (tx) => {
      const aucSnap = await tx.get(auctionRef);
      if (!aucSnap.exists()) throw new Error("Auction state missing");

      const auction = aucSnap.data();
      const history = auction.bidHistory || [];

      if (history.length === 0) {
        // If no history, we revert to the starting state (Base Price, No Bidder)
        tx.update(auctionRef, {
          currentBid: auction.currentPlayer?.basePrice || 0,
          highestBidderId: null,
          highestBidderName: null,
          bidHistory: [],
          lastAction: "UNDO_RESET_TO_BASE",
        });
        return;
      }

      // 1. Get the last state from the history stack
      const previousState = history[history.length - 1];

      // 2. Remove that entry from the history array
      const newHistory = history.slice(0, -1);

      // 3. Revert the main state to the previous values
      tx.update(auctionRef, {
        currentBid: previousState.bid,
        highestBidderId: previousState.bidderId,
        highestBidderName: previousState.bidderName,
        bidHistory: newHistory,
        lastAction: "UNDO_PERFORMED",
      });
    });
  } catch (error) {
    console.error("Undo failed", error);
    alert("Could not undo: " + error.message);
  }
}