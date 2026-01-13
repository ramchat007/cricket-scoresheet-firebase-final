import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
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

export default function AuctionDashboard() {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();

  const [auctionState, setAuctionState] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamsMap, setTeamsMap] = useState({});
  const [slots, setSlots] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null);

  const [canEdit, setCanEdit] = useState(false);
  const [filterRole, setFilterRole] = useState("All");
  const [queueTab, setQueueTab] = useState("upcoming");
  const [showAdmin, setShowAdmin] = useState(false);
  const [ruleOverride, setRuleOverride] = useState(false);

  useEffect(() => {
    if (!user || !tournamentConfig) {
      setCanEdit(false);
      return;
    }
    const isOwner =
      tournamentConfig.ownerId === user.uid ||
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
      setTournamentConfig(s.data())
    );
    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);
    const unsubSlots = onSnapshot(
      collection(db, "tournaments", tournamentId, "auction_slots"),
      (snap) => {
        setSlots(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => a.order - b.order)
        );
      }
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
      }
    );
    const unsubPlayers = onSnapshot(
      query(collection(db, "tournaments", tournamentId, "auctionPlayers")),
      (snapshot) => {
        setAllPlayers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      }
    );
    return () => {
      unsubState?.();
      unsubTeams?.();
      unsubPlayers?.();
      unsubSlots?.();
    };
  }, [tournamentId]);

  const activeSlotId = auctionState?.activeSlotId;
  const currentSlotPlayers = allPlayers.filter(
    (p) => p.auctionSlotId === activeSlotId
  );
  const upcomingInSlot = currentSlotPlayers.filter(
    (p) => p.status === "PENDING"
  );
  const soldPlayers = allPlayers.filter((p) => p.status === "SOLD");
  const unsoldPlayers = allPlayers.filter(
    (p) => p.status === "UNSOLD" || p.status === "UNSOLD_PASSED"
  );

  const startNextInSlot = () => {
    if (!canEdit) return;
    if (upcomingInSlot.length === 0)
      return alert("No players left in this slot!");
    const nextPlayer = [...upcomingInSlot].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    )[0];
    startBidding(tournamentId, nextPlayer);
  };

  const calculateNextBid = (current) => {
    if (tournamentConfig?.bidSlabs?.length > 0) {
      const sortedSlabs = [...tournamentConfig.bidSlabs].sort(
        (a, b) => a.max - b.max
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
        "⚠️ Undo last bid? The previous bidder will become the leader."
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
  const currentPlayer = auctionState?.currentPlayer;
  const nextBidAmount =
    isLive || isPaused ? calculateNextBid(auctionState.currentBid) : 0;

  const renderStage = () => {
    if ((!isLive && !isPaused) || !currentPlayer) {
      return (
        <div className="bg-[#1C2128]/50 border-2 border-dashed border-white/5 rounded-[2rem] p-8 mb-8 text-center flex flex-col items-center justify-center min-h-[350px]">
          {canEdit ? (
            <>
              <div className="flex gap-4 mb-6 w-full max-w-md">
                <div className="flex-1 text-left">
                  <label className="text-[10px] text-slate-500 font-black uppercase block mb-2 tracking-widest">
                    Select Auction Slot
                  </label>
                  <select
                    className="w-full bg-[#0F1115] text-slate-200 p-4 rounded-xl border border-white/10 outline-none focus:border-teal-500/50 font-bold"
                    value={activeSlotId || ""}
                    onChange={(e) =>
                      updateDoc(
                        doc(
                          db,
                          "tournaments",
                          tournamentId,
                          "auction",
                          "state"
                        ),
                        { activeSlotId: e.target.value }
                      )
                    }>
                    <option value="">-- Choose Slot --</option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <h2 className="text-xl font-black text-slate-300 mb-2 uppercase tracking-tight italic">
                {activeSlotId
                  ? `Slot: ${slots.find((s) => s.id === activeSlotId)?.name}`
                  : "Waiting for selection..."}
              </h2>
              <button
                onClick={startNextInSlot}
                disabled={!activeSlotId || upcomingInSlot.length === 0}
                className="bg-gradient-to-r from-teal-600 to-teal-700 text-white font-black uppercase tracking-widest text-sm py-4 px-10 rounded-xl disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-lg">
                Start Next Player
              </button>
            </>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-4 grayscale opacity-50">⏸️</div>
              <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">
                Auction Paused
              </h2>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-8 mb-8 text-center relative overflow-hidden shadow-2xl">
        <div
          className={`absolute top-0 left-0 w-full h-1.5 ${
            isPaused
              ? "bg-amber-500"
              : "bg-gradient-to-r from-teal-500 to-indigo-500 animate-pulse"
          }`}></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-10">
          <img
            src={
              currentPlayer.photoURL ||
              "https://cdn-icons-png.flaticon.com/512/847/847969.png"
            }
            alt={currentPlayer.name}
            className={`w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-[#0F1115] shadow-2xl relative z-10 bg-black ${
              isPaused ? "grayscale" : ""
            }`}
          />
          <div className="flex-1 text-left md:text-center">
            <div className="flex justify-center items-center gap-3 mb-3">
              <div className="bg-[#0F1115] text-teal-400 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-teal-500/20 shadow-lg">
                {slots.find((s) => s.id === activeSlotId)?.name ||
                  "Current Round"}
              </div>
              {isPaused && (
                <div className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg animate-pulse">
                  Paused
                </div>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-100 mb-2 tracking-tighter uppercase italic">
              {currentPlayer.name}
            </h1>
            <p className="text-slate-500 uppercase mb-8 font-black tracking-widest text-xs flex items-center justify-center gap-2">
              {currentPlayer.role} • Base: ₹{currentPlayer.basePrice}{" "}
              {currentPlayer.isIcon && (
                <span className="text-amber-400 ml-1">★ Icon</span>
              )}
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
              <div className="bg-[#0F1115] p-5 rounded-2xl border border-white/5 min-w-[180px] text-center">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">
                  Current Bid
                </div>
                <div className="text-4xl font-mono font-bold text-teal-400">
                  ₹{auctionState.currentBid.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#0F1115] p-5 rounded-2xl border border-white/5 min-w-[180px] text-center">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">
                  Leading Team
                </div>
                <div className="text-xl font-bold text-slate-200 truncate">
                  {auctionState.highestBidderName || "No Bids Yet"}
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() => markUnsold(tournamentId, currentPlayer.id)}
                  className="bg-[#0F1115] hover:bg-white/5 text-slate-400 px-8 py-4 rounded-xl font-black text-xs uppercase border border-white/10">
                  Pass
                </button>
                <button
                  onClick={toggleAuctionPause}
                  className={`${
                    isPaused
                      ? "bg-teal-600 text-white"
                      : "bg-amber-600/20 text-amber-500 border-amber-500/20"
                  } px-6 py-4 rounded-xl font-black text-xs uppercase border transition-all`}>
                  {isPaused ? "▶ Resume" : "⏸ Pause"}
                </button>
                {auctionState.highestBidderId && (
                  <button
                    onClick={reverseLastBid}
                    className="bg-red-900/20 text-red-400 px-6 py-4 rounded-xl font-black text-xs uppercase border border-red-500/20">
                    Undo Bid
                  </button>
                )}
                <button
                  onClick={() => markSold(tournamentId)}
                  disabled={!auctionState.highestBidderId}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase shadow-xl disabled:opacity-20 transform active:scale-95 transition-all">
                  SOLD 🔨
                </button>
              </div>
            )}
          </div>
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
    return (
      <div className="bg-[#1C2128] border border-white/5 rounded-[2rem] p-6 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex bg-[#0F1115] rounded-xl p-1 border border-white/5 overflow-x-auto no-scrollbar">
            {["upcoming", "sold", "unsold"].map((t) => (
              <button
                key={t}
                onClick={() => setQueueTab(t)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  queueTab === t
                    ? "bg-[#1C2128] text-white border border-white/10"
                    : "text-slate-500 hover:text-slate-300"
                }`}>
                {t}
              </button>
            ))}
          </div>
          <select
            className="bg-[#0F1115] text-slate-300 text-xs border border-white/10 rounded-xl px-4 py-2.5 outline-none font-bold"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}>
            <option>All</option>
            <option>Batsman</option>
            <option>Bowler</option>
            <option>All-Rounder</option>
            <option>Wicket Keeper</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {displayList.map((player) => (
            <div
              key={player.id}
              className="bg-[#0F1115] p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#161920] overflow-hidden border border-white/5">
                  <img
                    src={
                      player.photoURL ||
                      "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                    }
                    alt=""
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <div className="font-bold text-slate-200 text-sm truncate max-w-[120px]">
                    {player.name}
                  </div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    {player.role}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-mono font-bold ${
                    player.status === "SOLD"
                      ? "text-teal-400"
                      : "text-slate-400"
                  }`}>
                  ₹
                  {(player.status === "SOLD"
                    ? player.soldPrice
                    : player.basePrice
                  ).toLocaleString()}
                </div>
                {player.status === "SOLD" && (
                  <div className="text-[9px] text-slate-600 truncate max-w-[80px] font-bold uppercase mt-0.5">
                    {teamsMap[player.teamId]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBidders = () => {
    return (
      <div className="mt-8 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-slate-100 font-black text-xl uppercase tracking-tighter italic">
            Bidding Console{" "}
            <span className="text-xs bg-[#1C2128] text-teal-500 px-3 py-1 rounded-lg font-black border border-teal-500/20 uppercase not-italic">
              Smart Rules Active
            </span>
          </h3>
          {canEdit && (
            <button
              onClick={() => setRuleOverride(!ruleOverride)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${
                ruleOverride
                  ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/20"
                  : "bg-white/5 text-slate-500 border-white/10"
              }`}>
              {ruleOverride ? "⚠️ Rule Override: ON" : "Rule Override: OFF"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {teams.map((team) => {
            // --- CONFIGURATION ---
            const minSquadGoal = parseInt(tournamentConfig?.minSquadSize) || 10;
            const maxSquadLimit =
              parseInt(tournamentConfig?.maxSquadSize) || 100;
            const minBasePrice =
              parseInt(tournamentConfig?.minBasePrice) || 100;
            const maxBidPerPlayer =
              parseInt(tournamentConfig?.maxBidPerPlayer) || 3000;
            const maxIcons = parseInt(tournamentConfig?.maxIconsPerTeam) || 1;

            // --- FINANCIALS ---
            const totalPurse = parseInt(team?.purse) || 0;
            const totalSpent = parseInt(team?.spent) || 0;
            const remainingPurse = totalPurse - totalSpent;

            const isHighest = auctionState?.highestBidderId === team.id;
            const isNoBidsYet = !auctionState?.highestBidderId;

            // --- ROSTER SIZE LOGIC ---
            // Fix: Add +1 if Owner exists but is missing from DB roster array
            let currentSquadSize = (team?.roster || []).length;
            const hasOwnerInRoster = team?.roster?.some((p) => p.isOwner);
            if (!hasOwnerInRoster && (team.isOwner || team.ownerName)) {
              currentSquadSize += 1;
            }

            // --- BIDDING MATH ---
            const playerBasePrice = currentPlayer?.basePrice || 0;
            const currentAuctionBid = auctionState?.currentBid || 0;

            const bidAmountToPlace = isNoBidsYet
              ? currentAuctionBid === playerBasePrice
                ? calculateNextBid(currentAuctionBid)
                : playerBasePrice
              : nextBidAmount || 0;

            // --- RESERVE LOGIC ---
            const sizeIfWin = isHighest
              ? currentSquadSize
              : currentSquadSize + 1;
            const playersStillNeeded = Math.max(0, minSquadGoal - sizeIfWin);
            const mandatoryReserve = playersStillNeeded * minBasePrice;
            const maxPossibleBid = remainingPurse - mandatoryReserve;

            // --- RULE CHECKS ---

            // 1. Locked Slot Check
            const isLocked = team.lockedSlots?.includes(
              auctionState.activeSlotId
            );

            // 2. Limit One Per Slot Check (ROBUST FIX)
            // We look up the player in 'allPlayers' to ensure we get the auctionSlotId
            const limitActive = tournamentConfig?.limitOnePlayerPerSlot;
            const currentSlotId = auctionState?.activeSlotId;

            let hasPlayerInSlot = false;
            if (limitActive && currentSlotId && team.roster?.length > 0) {
              // Get IDs of players this team has bought
              const teamPlayerIds = team.roster.map((p) => p.id);
              // Check against the Master List (allPlayers) which definitely has the slot info
              hasPlayerInSlot = allPlayers.some(
                (p) =>
                  teamPlayerIds.includes(p.id) &&
                  String(p.auctionSlotId) === String(currentSlotId)
              );
            }

            // 3. Icon Limit Check
            const currentIcons =
              team.roster?.filter((p) => p.isIcon).length || 0;
            const isIconLimitReached =
              currentPlayer?.isIcon && currentIcons >= maxIcons;

            // 4. Max Bid Cap Check
            const isBidOverCap = bidAmountToPlace > maxBidPerPlayer;

            // --- VALIDATION DECISION ---
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

            // Direct Buy Logic
            const canDirectBuy =
              tournamentConfig?.allowDirectBuy &&
              currentPlayer &&
              currentAuctionBid === playerBasePrice &&
              isNoBidsYet;

            return (
              <div
                key={team.id}
                className={`p-6 rounded-2xl border-2 relative transition-all duration-300 group ${
                  isHighest
                    ? "bg-teal-900/20 border-teal-500 shadow-lg scale-[1.02]"
                    : "bg-[#1C2128] border-white/5"
                } ${isDisabled && !isHighest ? "opacity-50 grayscale" : ""} 
                ${isLocked ? "opacity-30 grayscale" : ""}`}>
                {isHighest && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-teal-500 text-black text-xs px-4 py-1 rounded-full font-black uppercase tracking-widest shadow-lg z-20">
                    Leading
                  </div>
                )}

                <div className="text-center mb-4 mt-2">
                  <div
                    className={`font-black truncate text-base uppercase italic mb-1 ${
                      isHighest ? "text-teal-400" : "text-slate-100"
                    }`}>
                    {team.name}
                  </div>

                  <div
                    className={`text-xs mt-1 font-bold uppercase tracking-wider ${
                      errorReason ? "text-red-400" : "text-slate-400"
                    }`}>
                    {errorReason ||
                      `Max Bid: ₹${(maxPossibleBid || 0).toLocaleString()}`}
                  </div>

                  <div className="mt-4 space-y-1.5 border-y border-white/5 py-3">
                    <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                      <span className="text-slate-500">Total Purse</span>
                      <span className="text-slate-300">
                        ₹{totalPurse.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                      <span className="text-slate-500">Total Spent</span>
                      <span className="text-red-400">
                        ₹{totalSpent.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] uppercase font-black px-1 pt-1 border-t border-white/5">
                      <span className="text-slate-400">Balance</span>
                      <span className="text-teal-400">
                        ₹{remainingPurse.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mt-3">
                    {playersStillNeeded > 0
                      ? `Reserve ₹${(
                          mandatoryReserve || 0
                        ).toLocaleString()} for ${playersStillNeeded} slots`
                      : `Squad Goal Met!`}
                  </div>
                </div>

                {canEdit ? (
                  <div className="mt-4 space-y-2">
                    {isLocked ? (
                      <div className="py-3 px-4 bg-red-900/20 border border-red-500/20 rounded-xl text-[10px] text-red-500 font-black text-center uppercase tracking-widest">
                        🔒 Slot Locked
                      </div>
                    ) : (
                      <>
                        <button
                          disabled={isDisabled}
                          onClick={() =>
                            placeBid(
                              tournamentId,
                              team.id,
                              team.name,
                              bidAmountToPlace
                            )
                          }
                          className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            isHighest
                              ? "bg-teal-500 text-black shadow-lg"
                              : isDisabled
                              ? "bg-[#0F1115] text-slate-600 cursor-not-allowed"
                              : "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 text-white shadow-lg"
                          }`}>
                          {isHighest
                            ? "Leading"
                            : !currentPlayer
                            ? "Standby"
                            : `Bid ₹${(
                                bidAmountToPlace || 0
                              ).toLocaleString()}`}
                        </button>

                        {canDirectBuy && !isDisabled && (
                          <button
                            onClick={() =>
                              directBuyPlayer(
                                tournamentId,
                                team.id,
                                team.name,
                                currentPlayer
                              )
                            }
                            className="w-full py-2 bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white border border-amber-600/30 rounded-xl text-[9px] font-black uppercase transition-all">
                            ⚡ Direct Buy (Base)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border ${
                        isHighest
                          ? "bg-teal-500 text-black border-teal-500"
                          : "bg-[#0F1115] border-white/5 text-slate-600"
                      }`}>
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

  if (!auctionState)
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-teal-500 animate-pulse font-black text-xl uppercase tracking-widest">
        Connecting...
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0F1115] px-4 pb-24 pt-24 font-sans text-slate-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors group">
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>{" "}
            Dashboard
          </Link>
          {canEdit && (
            <button
              onClick={() => setShowAdmin(true)}
              className="bg-[#1C2128] hover:bg-white/5 px-5 py-3 rounded-xl font-black text-xs text-teal-400 border border-teal-500/20 uppercase tracking-widest shadow-lg shadow-teal-900/10">
              ⚙️ Admin Setup
            </button>
          )}
        </div>
        {renderStage()}
        {renderQueue()}
        {renderBidders()}
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
