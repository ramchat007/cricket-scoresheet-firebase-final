import {
  doc,
  runTransaction,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
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

// --- ACTIONS ---

// 1. ADMIN: Bring a player to the "Bidding Table"
export async function startBidding(tournamentId, player) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");
  await updateDoc(auctionRef, {
    status: "LIVE",
    currentPlayer: {
      id: player.id,
      name: player.name,
      role: player.role,
      basePrice: parseInt(player.basePrice || 0),
      originalId: player.originalPlayerId || player.id,
    },
    currentBid: parseInt(player.basePrice || 0),
    highestBidderId: null, // Reset bidder
    highestBidderName: null,
    history: [],
  });
}

// 2. TEAM: Place a Bid (Transaction Safe)
export async function placeBid(tournamentId, teamId, teamName, amount) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");
  const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);

  try {
    await runTransaction(db, async (tx) => {
      const aucSnap = await tx.get(auctionRef);
      const teamSnap = await tx.get(teamRef);

      if (!aucSnap.exists()) throw "Auction not initialized";

      const auction = aucSnap.data();
      const team = teamSnap.data();
      const availablePurse =
        (parseInt(team.purse) || 0) - (parseInt(team.spent) || 0);

      // Validation
      if (auction.status !== "LIVE") throw "Bidding is closed";
      if (amount <= auction.currentBid) throw "Bid must be higher than current";
      if (amount > availablePurse)
        throw `Insufficient purse! Bal: ${availablePurse}`;

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
    alert(error); // Simple feedback
  }
}

// 3. ADMIN: Sold! (Close the round)
export async function markSold(tournamentId) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  await runTransaction(db, async (tx) => {
    const aucSnap = await tx.get(auctionRef);
    const auction = aucSnap.data();

    if (!auction.highestBidderId) throw "No bidder found. Mark Unsold instead.";

    const playerRef = doc(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
      auction.currentPlayer.id
    );
    const teamRef = doc(
      db,
      "tournaments",
      tournamentId,
      "teams",
      auction.highestBidderId
    );
    const teamSnap = await tx.get(teamRef);
    const team = teamSnap.data();

    // 1. Update Player Status
    tx.update(playerRef, {
      status: "SOLD",
      soldPrice: auction.currentBid,
      teamId: auction.highestBidderId,
    });

    // 2. Deduct Money from Team & Add to Roster
    const newSpent = (team.spent || 0) + auction.currentBid;
    const newPlayerEntry = {
      id: auction.currentPlayer.originalId,
      name: auction.currentPlayer.name,
      role: auction.currentPlayer.role,
      price: auction.currentBid,
      isAuction: true,
    };

    tx.update(teamRef, {
      spent: newSpent,
      // Add to 'roster' (Used by Match Scorecard) AND 'players' (Legacy)
      roster: [...(team.roster || []), newPlayerEntry],
      players: [...(team.players || []), auction.currentPlayer.name],
    });

    // 3. Reset Room
    tx.update(auctionRef, {
      status: "PENDING",
      currentPlayer: null,
      currentBid: 0,
      highestBidderId: null,
      highestBidderName: null,
    });
  });
}

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

  await updateDoc(playerRef, { status: "UNSOLD_PASSED" });
  await updateDoc(auctionRef, {
    status: "PENDING",
    currentPlayer: null,
    currentBid: 0,
    highestBidderId: null,
  });
}
