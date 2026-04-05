import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  arrayUnion,
  getDocs, // 🟢 IMPORTED getDocs
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import {
  subscribeAuctionState,
  startBidding,
  placeBid,
  markSold,
  markUnsold,
  undoLastBid,
  directBuyPlayer,
} from "../utils/auction";
import AuctionAdminPanel from "./AuctionAdminPanel";
import PlayerAvatar from "./PlayerAvatar";
import { RefreshCw } from "lucide-react";

export default function AuctionDashboard() {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();
  const { theme, lightMode } = useTheme();

  const [auctionState, setAuctionState] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [globalPlayers, setGlobalPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [processing, setProcessing] = useState(false);
  const [customAmounts, setCustomAmounts] = useState({});
  const [teamsMap, setTeamsMap] = useState({});
  const [slots, setSlots] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null);

  const [canEdit, setCanEdit] = useState(false);
  const [filterRole, setFilterRole] = useState("All");
  const [queueTab, setQueueTab] = useState("upcoming");
  const [showAdmin, setShowAdmin] = useState(false);
  const [ruleOverride, setRuleOverride] = useState(false);
  const [biddingMode, setBiddingMode] = useState("online");

  useEffect(() => {
    if (!user || !tournamentConfig) {
      setCanEdit(false);
      return;
    }
    const isOwner =
      (Array.isArray(tournamentConfig.ownerId)
        ? tournamentConfig.ownerId.includes(user.uid)
        : tournamentConfig.ownerId === user.uid) ||
      tournamentConfig.createdBy === user.uid;
    const isAdmin =
      Array.isArray(tournamentConfig.admins) &&
      tournamentConfig.admins.includes(user.uid);
    const isScorer =
      Array.isArray(tournamentConfig.scorers) &&
      tournamentConfig.scorers.includes(user.uid);
    const isSuperAdmin = user.email === "ramchat007@gmail.com";
    setCanEdit(isOwner || isAdmin || isScorer || isSuperAdmin);
  }, [user, tournamentConfig]);

  useEffect(() => {
    getDoc(doc(db, "tournaments", tournamentId)).then((s) =>
      setTournamentConfig(s.data()),
    );
    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);

    const unsubSlots = onSnapshot(
      collection(db, "tournaments", tournamentId, "auction_slots"),
      (snap) => {
        setSlots(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => a.order - b.order),
        );
      },
    );

    const unsubTeams = onSnapshot(
      query(collection(db, "tournaments", tournamentId, "teams")),
      (snapshot) => {
        const teamData = [];
        const mapping = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          teamData.push({ id: doc.id, ...data });
          mapping[doc.id] = data.name;
        });
        setTeams(teamData);
        setTeamsMap(mapping);
      },
    );

    const unsubPlayers = onSnapshot(
      query(collection(db, "tournaments", tournamentId, "auctionPlayers")),
      (snapshot) => {
        setAllPlayers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
    );

    // 🟢 CRITICAL PERFORMANCE FIX:
    // Replaced real-time onSnapshot with a single getDocs call.
    // This stops the page from downloading 11MB of data repeatedly!
    getDocs(collection(db, "players"))
      .then((snapshot) => {
        setGlobalPlayers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      })
      .catch((err) => console.error("Error loading global players:", err));

    return () => {
      unsubState?.();
      unsubTeams?.();
      unsubPlayers?.();
      unsubSlots?.();
      // Removed unsubGlobal because we are no longer listening live to the whole DB
    };
  }, [tournamentId]);

  const activeSlotId = auctionState?.activeSlotId;
  const currentSlotPlayers = allPlayers.filter(
    (p) => p.auctionSlotId === activeSlotId,
  );
  const upcomingInSlot = currentSlotPlayers.filter(
    (p) => p.status === "PENDING",
  );
  const soldPlayers = allPlayers.filter((p) => p.status === "SOLD");
  const unsoldPlayers = allPlayers.filter(
    (p) => p.status === "UNSOLD" || p.status === "UNSOLD_PASSED",
  );

  const startNextInSlot = () => {
    if (!canEdit) return;
    if (upcomingInSlot.length === 0)
      return alert("No players left in this slot!");
    const nextPlayer = [...upcomingInSlot].sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    )[0];
    startBidding(tournamentId, nextPlayer);
  };

  const startRandomInSlot = () => {
    if (!canEdit) return;
    if (upcomingInSlot.length === 0)
      return alert("No players left in this slot!");
    const randomIndex = Math.floor(Math.random() * upcomingInSlot.length);
    const randomPlayer = upcomingInSlot[randomIndex];
    startBidding(tournamentId, randomPlayer);
  };

  const calculateNextBid = (current) => {
    if (tournamentConfig?.bidSlabs?.length > 0) {
      const sortedSlabs = [...tournamentConfig.bidSlabs].sort(
        (a, b) => a.max - b.max,
      );
      const activeSlab = sortedSlabs.find((s) => current < s.max);
      if (activeSlab) return current + activeSlab.inc;
      return current + sortedSlabs[sortedSlabs.length - 1].inc;
    }
    const inc =
      tournamentConfig?.bidIncrement ||
      (current < 1000 ? 100 : current < 5000 ? 200 : 500);
    return current + inc;
  };

  const reverseLastBid = async () => {
    if (
      !window.confirm(
        "⚠️ Undo last bid? The previous bidder will become the leader.",
      )
    )
      return;
    try {
      await undoLastBid(tournamentId);
    } catch (error) {
      console.error("Undo failed:", error);
      alert("Undo failed: " + error.message);
    }
  };

  const toggleAuctionPause = async () => {
    const aucRef = doc(db, "tournaments", tournamentId, "auction", "state");
    const isPaused = auctionState?.status === "PAUSED";
    await updateDoc(aucRef, { status: isPaused ? "LIVE" : "PAUSED" });
  };

  const isLive = auctionState?.status === "LIVE";
  const isPaused = auctionState?.status === "PAUSED";

  const activePlayerId =
    auctionState?.currentPlayer?.id || auctionState?.currentPlayerId;
  const currentPlayer =
    allPlayers.find((p) => p.id === activePlayerId) ||
    auctionState?.currentPlayer;

  const nextBidAmount =
    isLive || isPaused ? calculateNextBid(auctionState.currentBid) : 0;

  const handleOfflineSell = async (targetTeamId, priceString) => {
    if (!currentPlayer || !targetTeamId) {
      return alert("Invalid team selection.");
    }

    const finalPrice = Number(priceString);
    if (!finalPrice || finalPrice < (currentPlayer.basePrice || 0)) {
      return alert("Sold price cannot be empty or less than base price.");
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const teamRef = doc(
          db,
          "tournaments",
          tournamentId,
          "teams",
          targetTeamId,
        );
        const playerRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          currentPlayer.id,
        );
        const stateRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auction",
          "state",
        );

        const teamSnap = await transaction.get(teamRef);
        if (!teamSnap.exists()) throw new Error("Team not found.");

        const teamData = teamSnap.data();
        const availablePurse = (teamData.purse || 0) - (teamData.spent || 0);

        if (!ruleOverride && finalPrice > availablePurse) {
          throw new Error(
            `Team does not have enough purse. They only have ₹${availablePurse} remaining.`,
          );
        }

        transaction.update(teamRef, {
          spent: (teamData.spent || 0) + finalPrice,
          roster: arrayUnion({
            id: currentPlayer.id,
            name: currentPlayer.name,
            role: currentPlayer.role || "Player",
            soldPrice: finalPrice,
            isOwner: false,
            photoURL: currentPlayer.photoURL || "",
          }),
        });

        transaction.update(playerRef, {
          status: "SOLD",
          teamId: targetTeamId,
          soldPrice: finalPrice,
        });

        transaction.update(stateRef, {
          status: "SOLD",
          currentBid: finalPrice,
          currentBidderId: targetTeamId,
          highestBidderId: targetTeamId,
        });
      });

      setCustomAmounts((prev) => ({ ...prev, [targetTeamId]: "" }));
      alert(
        `${currentPlayer.name} successfully sold to ${teamsMap[targetTeamId]} for ₹${finalPrice}!`,
      );
    } catch (error) {
      console.error("Offline sell failed:", error);
      alert(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const borderColor = lightMode ? "border-gray-200" : "border-white/5";
  const inputBgColor = lightMode
    ? "bg-gray-50 border-gray-200 text-gray-900"
    : "bg-[#0F1115] border-white/10 text-slate-200";

  // 1. Add this new state variable
  const [isSyncing, setIsSyncing] = useState(false);

  // 2. Add this function right above your renderStage() function
  const syncGlobalPlayers = async () => {
    setIsSyncing(true);
    try {
      const snapshot = await getDocs(collection(db, "players"));
      setGlobalPlayers(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
      // Optional: A tiny visual confirmation it worked
      setTimeout(() => setIsSyncing(false), 500);
    } catch (err) {
      console.error("Error syncing players:", err);
      alert("Failed to sync players from database.");
      setIsSyncing(false);
    }
  };

  const renderStage = () => {
    if ((!isLive && !isPaused) || !currentPlayer) {
      return (
        <div
          className={`${theme.card} border-2 border-dashed ${borderColor} rounded-3xl p-6 text-center flex flex-col items-center justify-center min-h-[300px] shadow-sm`}
        >
          {canEdit ? (
            <>
              <label
                className={`text-[10px] ${theme.sub} font-black uppercase block mb-2 tracking-widest`}
              >
                Select Auction Slot
              </label>
              <select
                className={`w-full max-w-sm p-4 rounded-xl border outline-none focus:border-teal-500/50 font-bold transition-colors ${inputBgColor} mb-4`}
                value={activeSlotId || ""}
                onChange={(e) =>
                  updateDoc(
                    doc(db, "tournaments", tournamentId, "auction", "state"),
                    { activeSlotId: e.target.value },
                  )
                }
              >
                <option value="">-- Choose Slot --</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <h2
                className={`text-lg font-black ${theme.text} mb-4 uppercase tracking-tight italic`}
              >
                {activeSlotId
                  ? `Slot: ${slots.find((s) => s.id === activeSlotId)?.name}`
                  : "Waiting for selection..."}
              </h2>

              <div className="flex flex-col gap-3 w-full max-w-sm">
                <button
                  onClick={startNextInSlot}
                  disabled={!activeSlotId || upcomingInSlot.length === 0}
                  className="bg-gradient-to-r from-teal-600 to-teal-700 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Start Sequential
                </button>
                <button
                  onClick={startRandomInSlot}
                  disabled={!activeSlotId || upcomingInSlot.length === 0}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span className="text-base">🎲</span> Random Player
                </button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-4 grayscale opacity-50">⏸️</div>
              <h2
                className={`text-xl font-black ${theme.sub} uppercase tracking-widest`}
              >
                Auction Paused
              </h2>
            </div>
          )}
        </div>
      );
    }

    let trueProfile = globalPlayers.find(
      (gp) =>
        String(gp.id) ===
        String(currentPlayer.originalPlayerId || currentPlayer.id),
    );

    if (!trueProfile) {
      const matchingProfiles = globalPlayers.filter(
        (gp) =>
          gp.name?.trim().toLowerCase() ===
          currentPlayer.name?.trim().toLowerCase(),
      );

      trueProfile = matchingProfiles.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      })[0];
    }

    const playerStats =
      trueProfile?.stats || currentPlayer?.statsSnapshot || {};
    const matchesPlayed = parseInt(playerStats.matches || 0);
    const runsScored = parseInt(playerStats.runs || 0);
    const wicketsTaken = parseInt(playerStats.wickets || 0);

    return (
      <div
        className={`${theme.card} border ${borderColor} rounded-[2rem] p-6 relative overflow-hidden shadow-2xl transition-all flex flex-col gap-5`}
      >
        <div
          className={`absolute top-0 left-0 w-full h-2 ${isPaused ? "bg-amber-500" : "bg-gradient-to-r from-teal-400 via-cyan-500 to-indigo-500 animate-pulse"}`}
        ></div>

        <div className="relative z-10 flex flex-col items-center mt-2">
          <div className="relative">
            <PlayerAvatar
              player={currentPlayer}
              playerId={auctionState?.currentPlayerId}
              tournamentId={tournamentId}
              className="w-40 h-40 md:w-48 md:h-48 rounded-[2rem] object-cover shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-4 border-white/10 shrink-0 mb-4"
            />
            {currentPlayer.isIcon && (
              <div className="absolute -top-3 -right-3 bg-amber-500 text-black px-3 py-1 rounded-lg font-black uppercase text-[9px] shadow-xl border-2 border-white/20 rotate-12">
                ★ Icon
              </div>
            )}
          </div>

          <div className="text-center">
            <h1
              className={`text-3xl md:text-4xl font-black ${theme.text} mb-1 tracking-tighter uppercase italic leading-none`}
            >
              {currentPlayer.name}
            </h1>
            <p className="text-teal-500 font-black uppercase tracking-[0.2em] text-xs mb-3">
              {currentPlayer.role}
            </p>
          </div>
        </div>

        <div
          className={`grid grid-cols-3 gap-2 p-3 rounded-2xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-white/5 border-white/5"}`}
        >
          <div className="text-center border-r border-white/10">
            <div
              className={`text-[8px] uppercase font-black ${theme.sub} mb-1`}
            >
              Matches
            </div>
            <div className={`text-lg font-black ${theme.text}`}>
              {matchesPlayed}
            </div>
          </div>
          <div className="text-center border-r border-white/10">
            <div
              className={`text-[8px] uppercase font-black ${theme.sub} mb-1`}
            >
              Runs
            </div>
            <div className={`text-lg font-black ${theme.text}`}>
              {runsScored}
            </div>
          </div>
          <div className="text-center">
            <div
              className={`text-[8px] uppercase font-black ${theme.sub} mb-1`}
            >
              Wickets
            </div>
            <div className={`text-lg font-black ${theme.text}`}>
              {wicketsTaken}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className={`${lightMode ? "bg-gray-100/50" : "bg-white/5"} p-3 rounded-xl border ${borderColor}`}
          >
            <div
              className={`text-[9px] uppercase font-black ${theme.sub} mb-1`}
            >
              Base Price
            </div>
            <div className={`text-lg font-black ${theme.text}`}>
              ₹{currentPlayer.basePrice?.toLocaleString()}
            </div>
          </div>
          <div
            className={`${lightMode ? "bg-teal-50 border-teal-200" : "bg-teal-500/10 border-teal-500/20"} p-3 rounded-xl border`}
          >
            <div className="text-[9px] uppercase font-black text-teal-500 mb-1">
              Current Bid
            </div>
            <div className="text-xl font-black text-teal-500 font-mono leading-none">
              ₹{auctionState.currentBid.toLocaleString()}
            </div>
          </div>
        </div>

        {auctionState.highestBidderName && (
          <div className="animate-in slide-in-from-left duration-300 text-center bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-xl">
            <div
              className={`text-[8px] uppercase font-black ${theme.sub} mb-0.5`}
            >
              Leading Team
            </div>
            <div className="text-xl font-black text-indigo-500 uppercase italic truncate px-2">
              {auctionState.highestBidderName}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex flex-col gap-2 mt-2">
            {biddingMode === "online" ? (
              <button
                onClick={() => markSold(tournamentId)}
                disabled={!auctionState.highestBidderId}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl disabled:opacity-30 transform active:scale-95 transition-all"
              >
                SOLD 🔨
              </button>
            ) : (
              <div
                className={`w-full flex items-center justify-center py-3 rounded-xl border-2 border-dashed ${lightMode ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-indigo-500/30 bg-indigo-900/10 text-indigo-400"}`}
              >
                <span className="font-black text-[9px] uppercase tracking-widest text-center leading-snug">
                  Offline Mode Active <br /> Sell via Team Cards
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => markUnsold(tournamentId, currentPlayer.id)}
                className={`${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200" : "bg-white/5 hover:bg-white/10 text-slate-400 border-white/10"} py-3 rounded-xl font-black text-[9px] uppercase border transition-colors`}
              >
                Unsold
              </button>
              <button
                onClick={toggleAuctionPause}
                className={`${isPaused ? "bg-teal-600 text-white" : lightMode ? "bg-amber-100 text-amber-700" : "bg-amber-500/20 text-amber-500"} py-3 rounded-xl font-black text-[9px] uppercase transition-all`}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            </div>
            {auctionState.highestBidderId && (
              <button
                onClick={reverseLastBid}
                className="w-full py-2.5 rounded-xl font-black text-[9px] uppercase border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all mt-1"
              >
                Undo Last Bid
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBidders = () => {
    return (
      <div className="mb-10 pb-6 border-b border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h3
              className={`${theme.text} font-black text-2xl uppercase tracking-tighter italic`}
            >
              Bidding Console
            </h3>
            <span
              className={`text-xs ${lightMode ? "bg-teal-50 text-teal-600 border-teal-200" : "bg-[#1C2128] text-teal-400 border-teal-500/20"} px-3 py-1 rounded-lg font-black border uppercase not-italic`}
            >
              Smart Rules
            </span>
          </div>

          {canEdit && (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div
                className={`flex rounded-xl p-1 border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-[#0F1115] border-white/5"}`}
              >
                <button
                  onClick={() => setBiddingMode("online")}
                  className={`px-5 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                    biddingMode === "online"
                      ? lightMode
                        ? "bg-white text-teal-600 shadow-sm border border-gray-200"
                        : "bg-[#1C2128] text-teal-400 shadow-sm border border-white/10"
                      : theme.sub + " hover:text-teal-500"
                  }`}
                >
                  Online (Auto)
                </button>
                <button
                  onClick={() => setBiddingMode("offline")}
                  className={`px-5 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                    biddingMode === "offline"
                      ? lightMode
                        ? "bg-white text-indigo-600 shadow-sm border border-gray-200"
                        : "bg-[#1C2128] text-indigo-400 shadow-sm border border-white/10"
                      : theme.sub + " hover:text-indigo-500"
                  }`}
                >
                  Offline (Manual)
                </button>
              </div>

              <button
                onClick={() => setRuleOverride(!ruleOverride)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${
                  ruleOverride
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/20"
                    : lightMode
                      ? "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                      : "bg-white/5 text-slate-500 border-white/10 hover:bg-white/10"
                }`}
              >
                {ruleOverride ? "⚠️ Rule Override: ON" : "Rule Override: OFF"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team) => {
            const minSquadGoal = parseInt(tournamentConfig?.minSquadSize) || 10;
            const maxSquadLimit =
              parseInt(tournamentConfig?.maxSquadSize) || 100;
            const minBasePrice = parseInt(tournamentConfig?.minBasePrice) || 0;
            const maxBidPerPlayer =
              parseInt(tournamentConfig?.maxBidPerPlayer) || 3000;
            const maxIcons = parseInt(tournamentConfig?.maxIconsPerTeam) || 1;

            const totalPurse = parseInt(team?.purse) || 0;
            const totalSpent = parseInt(team?.spent) || 0;
            const remainingPurse = totalPurse - totalSpent;

            const isHighest = auctionState?.highestBidderId === team.id;
            const isNoBidsYet = !auctionState?.highestBidderId;

            let currentSquadSize = (team?.roster || []).length;
            const hasOwnerInRoster = team?.roster?.some((p) => p.isOwner);
            if (!hasOwnerInRoster && (team.isOwner || team.ownerName)) {
              currentSquadSize += 1;
            }

            const playerBasePrice = currentPlayer?.basePrice || 0;
            const currentAuctionBid = auctionState?.currentBid || 0;

            const bidAmountToPlace = isNoBidsYet
              ? currentAuctionBid === playerBasePrice
                ? calculateNextBid(currentAuctionBid)
                : playerBasePrice
              : nextBidAmount || 0;

            const sizeIfWin = isHighest
              ? currentSquadSize
              : currentSquadSize + 1;
            const playersStillNeeded = Math.max(0, minSquadGoal - sizeIfWin);
            const mandatoryReserve = playersStillNeeded * minBasePrice;
            const maxPossibleBid = remainingPurse - mandatoryReserve;

            const isLocked = team.lockedSlots?.includes(
              auctionState.activeSlotId,
            );
            const limitActive = tournamentConfig?.limitOnePlayerPerSlot;
            const currentSlotId = auctionState?.activeSlotId;

            let hasPlayerInSlot = false;
            if (limitActive && currentSlotId && team.roster?.length > 0) {
              const teamPlayerIds = team.roster.map((p) => p.id);
              hasPlayerInSlot = allPlayers.some(
                (p) =>
                  teamPlayerIds.includes(p.id) &&
                  String(p.auctionSlotId) === String(currentSlotId),
              );
            }

            const currentIcons =
              team.roster?.filter((p) => p.isIcon).length || 0;
            const isIconLimitReached =
              currentPlayer?.isIcon && currentIcons >= maxIcons;
            const isBidOverCap = bidAmountToPlace > maxBidPerPlayer;

            let isDisabled = !isLive || isHighest || !currentPlayer;
            let errorReason = "";

            if (!isDisabled && currentPlayer && !ruleOverride) {
              if (currentSquadSize >= maxSquadLimit) {
                isDisabled = true;
                errorReason = "Squad Full";
              } else if (hasPlayerInSlot) {
                isDisabled = true;
                errorReason = "Slot Limit Reached";
              } else if (isIconLimitReached) {
                isDisabled = true;
                errorReason = "Max Icons Reached";
              } else if (isBidOverCap) {
                isDisabled = true;
                errorReason = `Max Bid Limit (₹${maxBidPerPlayer})`;
              } else if (bidAmountToPlace > maxPossibleBid) {
                isDisabled = true;
                errorReason = "Low Budget (Reserve)";
              }
            }

            const canDirectBuy =
              tournamentConfig?.allowDirectBuy &&
              currentPlayer &&
              currentAuctionBid === playerBasePrice &&
              isNoBidsYet;

            return (
              <div
                key={team.id}
                className={`p-6 rounded-[1.5rem] border-2 relative transition-all duration-300 group shadow-md flex flex-col justify-between ${
                  isHighest
                    ? lightMode
                      ? "bg-teal-50 border-teal-500 scale-[1.02] shadow-lg z-10"
                      : "bg-teal-900/20 border-teal-500 scale-[1.02] shadow-xl z-10"
                    : `${theme.card} ${borderColor}`
                } ${isDisabled && !isHighest ? "opacity-60" : ""} 
                ${isLocked ? "opacity-30 grayscale" : ""}`}
              >
                {isHighest && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-teal-500 text-white text-xs md:text-sm px-5 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg z-20">
                    Leading
                  </div>
                )}

                <div>
                  <div className="text-center mb-5 mt-2">
                    <div
                      className={`font-black truncate text-xl uppercase italic mb-1 ${
                        isHighest
                          ? "text-teal-600 dark:text-teal-400"
                          : theme.text
                      }`}
                    >
                      {team.name}
                    </div>

                    <div
                      className={`text-sm mt-1 font-bold uppercase tracking-wider ${
                        errorReason ? "text-red-500" : theme.sub
                      }`}
                    >
                      {errorReason ||
                        `Max Bid: ₹${(maxPossibleBid || 0).toLocaleString()}`}
                    </div>

                    <div
                      className={`mt-5 space-y-2 border-y py-4 ${lightMode ? "border-gray-200" : "border-white/5"}`}
                    >
                      <div className="flex justify-between text-xs uppercase font-bold px-1">
                        <span className={theme.sub}>Total Purse</span>
                        <span className={theme.text}>
                          ₹{totalPurse.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs uppercase font-bold px-1">
                        <span className={theme.sub}>Total Spent</span>
                        <span className="text-red-500">
                          ₹{totalSpent.toLocaleString()}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between text-sm uppercase font-black px-1 pt-2 border-t ${lightMode ? "border-gray-200" : "border-white/5"}`}
                      >
                        <span className={theme.sub}>Balance</span>
                        <span className="text-teal-600 dark:text-teal-400">
                          ₹{remainingPurse.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`text-xs uppercase font-bold tracking-tight mt-4 ${theme.sub}`}
                    >
                      {playersStillNeeded > 0
                        ? `Reserve ₹${(
                            mandatoryReserve || 0
                          ).toLocaleString()} for ${playersStillNeeded} slots`
                        : `Squad Goal Met!`}
                    </div>
                  </div>
                </div>

                {canEdit ? (
                  <div className="mt-auto space-y-3 pt-4">
                    {isLocked ? (
                      <div
                        className={`py-4 px-4 rounded-xl text-xs font-black text-center uppercase tracking-widest border ${lightMode ? "bg-red-50 text-red-600 border-red-200" : "bg-red-900/20 text-red-500 border-red-500/20"}`}
                      >
                        🔒 Slot Locked
                      </div>
                    ) : (
                      <>
                        {biddingMode === "online" ? (
                          <>
                            <button
                              disabled={isDisabled}
                              onClick={() =>
                                placeBid(
                                  tournamentId,
                                  team.id,
                                  team.name,
                                  bidAmountToPlace,
                                )
                              }
                              className={`w-full py-4 md:py-5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                                isHighest
                                  ? "bg-teal-500 text-white shadow-lg"
                                  : isDisabled
                                    ? lightMode
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                      : "bg-[#0F1115] text-slate-600 cursor-not-allowed"
                                    : "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 text-white shadow-lg"
                              }`}
                            >
                              {isHighest
                                ? "Leading"
                                : !currentPlayer
                                  ? "Standby"
                                  : `Bid ₹${(bidAmountToPlace || 0).toLocaleString()}`}
                            </button>

                            {canDirectBuy && !isDisabled && (
                              <button
                                onClick={() =>
                                  directBuyPlayer(
                                    tournamentId,
                                    team.id,
                                    team.name,
                                    currentPlayer,
                                  )
                                }
                                className={`w-full py-3 rounded-xl text-xs font-black uppercase transition-all border ${lightMode ? "bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white border-amber-200" : "bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white border-amber-600/30"}`}
                              >
                                ⚡ Direct Buy (Base)
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {currentPlayer && (
                              <div
                                className={`mt-2 p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}
                              >
                                <div
                                  className={`text-xs uppercase font-black tracking-widest mb-3 text-center ${theme.text}`}
                                >
                                  Manual / Offline Sale
                                </div>
                                <div className="flex flex-col gap-3">
                                  <input
                                    type="number"
                                    placeholder="Enter Final Amount"
                                    value={customAmounts[team.id] || ""}
                                    onChange={(e) =>
                                      setCustomAmounts({
                                        ...customAmounts,
                                        [team.id]: e.target.value,
                                      })
                                    }
                                    className={`w-full p-4 rounded-xl outline-none text-sm font-black text-center ${lightMode ? "bg-white text-indigo-900 border-indigo-200 focus:border-indigo-500" : "bg-[#0F1115] text-indigo-400 border-white/10 focus:border-indigo-500"} border transition-colors`}
                                  />
                                  <button
                                    onClick={() =>
                                      handleOfflineSell(
                                        team.id,
                                        customAmounts[team.id],
                                      )
                                    }
                                    disabled={
                                      processing ||
                                      !currentPlayer ||
                                      auctionState?.status === "SOLD" ||
                                      !customAmounts[team.id] ||
                                      Number(customAmounts[team.id]) <
                                        (currentPlayer?.basePrice || 0)
                                    }
                                    className="w-full bg-teal-500 hover:bg-teal-400 text-white font-black uppercase tracking-widest px-6 py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {processing
                                      ? "Processing Sale..."
                                      : "Sell Player"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center mt-auto pt-6">
                    <span
                      className={`text-sm font-bold uppercase tracking-wider px-6 py-3 rounded-xl border ${
                        isHighest
                          ? "bg-teal-500 text-white border-teal-500"
                          : lightMode
                            ? "bg-gray-100 border-gray-200 text-gray-500"
                            : "bg-[#0F1115] border-white/5 text-slate-600"
                      }`}
                    >
                      {isHighest ? "Leader" : "Waiting"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQueue = () => {
    let displayList = {
      upcoming: upcomingInSlot,
      sold: soldPlayers,
      unsold: unsoldPlayers,
    }[queueTab];
    if (filterRole !== "All")
      displayList = displayList.filter((p) => p.role === filterRole);

    // 🟢 LIMITING TO 24 PLAYERS SO IT DOESN'T LAG THE PAGE
    const cappedList = displayList.slice(0, 24);

    return (
      <div
        className={`${theme.card} border ${borderColor} rounded-[2rem] p-6 mb-8 shadow-sm`}
      >
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div
            className={`flex ${lightMode ? "bg-gray-100" : "bg-[#0F1115] border-white/5"} rounded-xl p-1 border overflow-x-auto no-scrollbar`}
          >
            {["upcoming", "sold", "unsold"].map((t) => (
              <button
                key={t}
                onClick={() => setQueueTab(t)}
                className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  queueTab === t
                    ? lightMode
                      ? "bg-white text-teal-600 shadow-sm border border-gray-200"
                      : "bg-[#1C2128] text-white border border-white/10 shadow-sm"
                    : lightMode
                      ? "text-gray-500 hover:text-gray-800"
                      : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <select
            className={`${inputBgColor} text-sm rounded-xl px-5 py-3 outline-none font-bold`}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option>All</option>
            <option>Batsman</option>
            <option>Bowler</option>
            <option>All-Rounder</option>
            <option>Wicket Keeper</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {cappedList.map((player) => (
            <div
              key={player.id}
              className={`${lightMode ? "bg-white border-gray-200 hover:border-teal-300" : "bg-[#0F1115] border-white/5 hover:border-white/10"} p-4 rounded-xl border flex justify-between items-center group transition-all shadow-sm`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-lg overflow-hidden border flex items-center justify-center font-black text-lg ${lightMode ? "bg-gray-200 text-gray-500 border-gray-300" : "bg-gray-800 text-gray-400 border-gray-700"}`}
                >
                  {/* 🟢 REPLACED HEAVY IMAGE WITH INITIALS */}
                  {player.name ? player.name.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <div
                    className={`font-bold ${theme.text} text-base truncate max-w-[120px]`}
                  >
                    {player.name}
                  </div>
                  <div
                    className={`text-[10px] ${theme.sub} font-bold uppercase tracking-wider`}
                  >
                    {player.role}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm font-mono font-bold ${
                    player.status === "SOLD" ? "text-teal-500" : theme.sub
                  }`}
                >
                  ₹
                  {(player.status === "SOLD"
                    ? player.soldPrice
                    : player.basePrice
                  ).toLocaleString()}
                </div>
                {player.status === "SOLD" && (
                  <div
                    className={`text-[10px] ${theme.sub} truncate max-w-[90px] font-bold uppercase mt-0.5`}
                  >
                    {teamsMap[player.teamId]}
                  </div>
                )}
              </div>
            </div>
          ))}
          {displayList.length > 24 && (
            <div className="col-span-full text-center text-xs font-bold text-gray-500 py-4">
              + {displayList.length - 24} more players hidden to optimize
              performance.
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!auctionState)
    return (
      <div
        className={`min-h-screen flex items-center justify-center animate-pulse font-black text-xl uppercase tracking-widest ${theme.bg} text-teal-500`}
      >
        Connecting...
      </div>
    );

  return (
    <div
      className={`min-h-screen px-4 pb-24 pt-24 font-sans ${theme.bg} ${theme.text}`}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link
            to={`/tournaments/${tournamentId}`}
            className={`${theme.sub} hover:text-teal-500 text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-colors group`}
          >
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>{" "}
            Dashboard
          </Link>

          {canEdit && (
            <div className="flex items-center gap-3">
              {/* 🟢 NEW SYNC BUTTON */}
              <button
                onClick={syncGlobalPlayers}
                disabled={isSyncing}
                className={`${theme.card} ${lightMode ? "hover:bg-indigo-50 border-indigo-200 text-indigo-600" : "hover:bg-indigo-900/20 border-indigo-500/30 text-indigo-400"} px-4 py-3 rounded-xl font-black text-xs border uppercase tracking-widest shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50`}
              >
                <RefreshCw
                  size={14}
                  className={isSyncing ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">
                  {isSyncing ? "Syncing..." : "Sync Data"}
                </span>
              </button>

              {/* Existing Setup Button */}
              <button
                onClick={() => setShowAdmin(true)}
                className={`${theme.card} ${lightMode ? "hover:bg-gray-50 border-gray-200" : "hover:bg-white/5 border-white/10"} px-6 py-3 rounded-xl font-black text-xs text-teal-500 border uppercase tracking-widest shadow-sm transition-colors`}
              >
                ⚙️ Setup
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-[35%] xl:w-[28%] shrink-0 lg:sticky lg:top-24">
            {renderStage()}
          </div>

          <div className="w-full lg:w-[65%] xl:w-[72%]">{renderBidders()}</div>
        </div>

        <div className="mt-8">{renderQueue()}</div>

        {showAdmin && canEdit && (
          <AuctionAdminPanel
            tournamentId={tournamentId}
            onClose={() => setShowAdmin(false)}
          />
        )}
      </div>
    </div>
  );
}
