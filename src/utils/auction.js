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
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

// --- HELPERS ---
export const getNextBidAmount = (currentBid) => {
  if (currentBid < 1000) return currentBid + 100;
  if (currentBid < 5000) return currentBid + 200;
  return currentBid + 500;
};

export const canAffordBid = (team, bidAmount, tournamentConfig) => {
  // 1. Check Config (Default to 10 if missing to fix your specific issue)
  const minSquadSize = parseInt(tournamentConfig?.minSquadSize || 10);
  const minBasePrice = parseInt(tournamentConfig?.minBasePrice || 200);

  // 2. Get Current Roster Count
  // We trust the array if it exists.
  let currentSquadSize = team.roster?.length || 0;

  // SAFETY CHECK:
  // If roster is empty (0) but the team is valid, assume the Owner exists
  // but hasn't loaded into the roster array yet.
  if (currentSquadSize === 0 && (team.isOwner || team.ownerName)) {
    currentSquadSize = 1;
  }

  const purse = parseInt(team.purse || 0);
  const spent = parseInt(team.spent || 0);
  const remainingPurse = purse - spent;

  // 3. Logic: Calculate Slots Needed
  // (Target) - (Current + 1 for the player we are bidding on right now)
  const playersNeededToReachMin = Math.max(
    0,
    minSquadSize - (currentSquadSize + 1)
  );

  const reserveNeeded = playersNeededToReachMin * minBasePrice;

  return remainingPurse - bidAmount >= reserveNeeded;
};

export const validateBidRules = (team, player, bidAmount, config) => {
  // Defaults based on your specific config
  const MAX_SQUAD_SIZE = parseInt(config?.maxSquadSize || 11);
  const MAX_ICONS = parseInt(config?.maxIconsPerTeam || 1); // Check your exact config key name
  const MAX_BID_LIMIT = parseInt(config?.maxBidPerPlayer || 3000);

  // 1. Check Max Squad Size
  if ((team.roster?.length || 0) >= MAX_SQUAD_SIZE) {
    return { allowed: false, reason: `Squad is full (Max ${MAX_SQUAD_SIZE}).` };
  }

  // 2. Check Icon Limit
  if (player.isIcon) {
    const currentIcons = team.roster?.filter((p) => p.isIcon).length || 0;
    if (currentIcons >= MAX_ICONS) {
      return { allowed: false, reason: "You already have an Icon player." };
    }
  }

  // 3. Check Max Bid Limit (Hard Cap)
  if (bidAmount > MAX_BID_LIMIT) {
    return {
      allowed: false,
      reason: `Bid ₹${bidAmount} exceeds limit of ₹${MAX_BID_LIMIT}.`,
    };
  }

  // 4. Check Financial Reserve (using your existing helper)
  // We pass 'config' because canAffordBid needs minSquadSize/minBasePrice
  if (!canAffordBid(team, bidAmount, config)) {
    return {
      allowed: false,
      reason: "Insufficient funds (need reserve for min squad).",
    };
  }

  return { allowed: true };
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

// --- INITIALIZATION ---

export async function initializeAuction(tournamentId) {
  const ref = doc(db, "tournaments", tournamentId, "auction", "state");
  await setDoc(ref, {
    status: "PENDING",
    currentBid: 0,
    currentPlayer: null,
    highestBidderId: null,
    highestBidderName: null,
    activeSlotId: null,
    history: [],
    updatedAt: serverTimestamp(),
  });
}

export const createAuctionSlot = async (tournamentId, slotData) => {
  const slotsRef = collection(db, "tournaments", tournamentId, "auction_slots");
  return await addDoc(slotsRef, {
    ...slotData,
    status: "pending",
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

  const slotsRef = collection(db, "tournaments", tournamentId, "auction_slots");
  const slotSnap = await getDocs(slotsRef);
  slotSnap.docs.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();
}

export const startBidding = async (tournamentId, player) => {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");

  // ✅ CRITICAL: We ensure auctionSlotId is passed to the live state
  const playerPayload = {
    id: player.id,
    originalId: player.originalPlayerId || player.originalId || null,
    name: player.name,
    role: player.role || "All-Rounder",
    basePrice: parseInt(player.basePrice || 0),
    isIcon: !!player.isIcon,
    isOwner: !!player.isOwner,
    photoURL: player.photoURL || "",
    auctionSlotId: player.auctionSlotId || null,
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

// --- BIDDING & TRANSACTIONS ---

export async function placeBid(tournamentId, teamId, teamName, amount) {
  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");
  const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);
  const tournamentRef = doc(db, "tournaments", tournamentId);

  try {
    await runTransaction(db, async (tx) => {
      // 1. Get State
      const aucSnap = await tx.get(auctionRef);
      if (!aucSnap.exists()) throw new Error("Auction not initialized");
      const auction = aucSnap.data();

      if (auction.status !== "LIVE") throw new Error("Bidding is closed");

      // 2. Get Team
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists()) throw new Error("Team not found");
      const team = teamSnap.data();

      // 3. Get Config
      const tournSnap = await tx.get(tournamentRef);
      const config = tournSnap.exists() ? tournSnap.data() : {};

      // --- NEW VALIDATION LOGIC START ---
      // We validate against the CURRENT player being auctioned
      const currentPlayer = auction.currentPlayer;
      if (!currentPlayer) throw new Error("No active player found.");

      const validation = validateBidRules(team, currentPlayer, amount, config);
      if (!validation.allowed) {
        throw new Error("⛔ " + validation.reason);
      }
      // --- NEW VALIDATION LOGIC END ---

      // 4. Rule Check: Limit 1 Player Per Slot (Existing Logic)
      if (config.limitOnePlayerPerSlot && auction.activeSlotId) {
        const currentSlotId = String(auction.activeSlotId);
        const alreadyWonInSlot = team.roster?.some(
          (p) => String(p.auctionSlotId) === currentSlotId
        );
        if (alreadyWonInSlot) {
          throw new Error("⛔ You have already bought a player in this slot.");
        }
      }

      // 5. Update Bid
      const currentEntry = {
        bid: auction.currentBid || 0,
        bidderId: auction.highestBidderId || null,
        bidderName: auction.highestBidderName || null,
      };

      const existingHistory = auction.bidHistory || [];
      const updatedHistory = [...existingHistory, currentEntry].slice(-10);

      tx.update(auctionRef, {
        currentBid: amount,
        highestBidderId: teamId,
        highestBidderName: teamName,
        lastBidAt: serverTimestamp(),
        bidHistory: updatedHistory,
      });
    });
  } catch (error) {
    console.error("Bid Failed", error);
    alert(error.message);
  }
}

// ✅ FIXED: Direct Buy - Now saves auctionSlotId to roster
export const directBuyPlayer = async (
  tournamentId,
  teamId,
  teamName,
  player
) => {
  if (
    !window.confirm(
      `⚡ Buy ${player.name} immediately for ₹${player.basePrice}?`
    )
  )
    return;

  const auctionRef = doc(db, "tournaments", tournamentId, "auction", "state");
  const teamRef = doc(db, "tournaments", tournamentId, "teams", teamId);
  const tournamentRef = doc(db, "tournaments", tournamentId); // Added this
  const playerRef = doc(
    db,
    "tournaments",
    tournamentId,
    "auctionPlayers",
    player.id
  );

  try {
    await runTransaction(db, async (tx) => {
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists()) throw new Error("Team missing");
      const team = teamSnap.data();

      // Get Config for Validation
      const tournSnap = await tx.get(tournamentRef);
      const config = tournSnap.exists() ? tournSnap.data() : {};

      const price = Number(player.basePrice) || 0;

      // --- NEW VALIDATION LOGIC ---
      const validation = validateBidRules(team, player, price, config);
      if (!validation.allowed) {
        throw new Error("⛔ " + validation.reason);
      }
      // ----------------------------

      const slotId = player.auctionSlotId || null;

      // 1. Update Player
      tx.update(playerRef, {
        status: "SOLD",
        teamId: teamId,
        soldPrice: price,
        bidHistory: [{ bid: price, bidderName: teamName, type: "DIRECT_BUY" }],
      });

      // 2. Update Team
      tx.update(teamRef, {
        spent: increment(price),
        roster: arrayUnion({
          id: player.id,
          name: player.name,
          role: player.role,
          soldPrice: price,
          photoURL: player.photoURL || "",
          auctionSlotId: slotId,
          isDirectBuy: true,
          isIcon: !!player.isIcon,
        }),
        lockedSlots: slotId ? arrayUnion(slotId) : undefined,
      });

      // 3. Reset Auction
      tx.update(auctionRef, {
        status: "PENDING",
        currentPlayer: null,
        currentBid: 0,
        highestBidderId: null,
        highestBidderName: null,
      });
    });
  } catch (error) {
    console.error("Direct Buy Failed:", error);
    alert("Transaction failed: " + error.message);
  }
};

// ✅ FIXED: Mark Sold - Now saves auctionSlotId to roster
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

    // ✅ Grab Slot ID from the live state
    const currentSlotId = currentPlayer.auctionSlotId || null;

    const rosterItem = {
      id: currentPlayer.id,
      originalId: currentPlayer.originalId,
      name: currentPlayer.name || "Unknown",
      role: currentPlayer.role || "Player",
      soldPrice: finalPrice,
      isIcon: !!currentPlayer.isIcon,
      isOwner: !!currentPlayer.isOwner,
      photoURL: currentPlayer.photoURL || "",

      // ✅ CRITICAL: Save this for the limit rule to work
      auctionSlotId: currentSlotId,

      isDirectBuy: false,
    };

    // Update Team
    tx.update(teamRef, {
      spent: (Number(team.spent) || 0) + finalPrice,
      roster: arrayUnion(rosterItem),
    });

    // Update Player
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
      bidHistory: auction.bidHistory || [],
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
        tx.update(auctionRef, {
          currentBid: auction.currentPlayer?.basePrice || 0,
          highestBidderId: null,
          highestBidderName: null,
          bidHistory: [],
          lastAction: "UNDO_RESET_TO_BASE",
        });
        return;
      }

      const previousState = history[history.length - 1];
      const newHistory = history.slice(0, -1);

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
