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

export default function AuctionDashboard() {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();

  // 🟢 Natively extract theme
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";

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
    return () => {
      unsubState?.();
      unsubTeams?.();
      unsubPlayers?.();
      unsubSlots?.();
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

  const renderStage = () => {
    if ((!isLive && !isPaused) || !currentPlayer) {
      return (
        <div
          className={`${cardBg} border-2 border-dashed border-current/20 rounded-[3rem] p-8 mb-8 text-center flex flex-col items-center justify-center min-h-[350px] shadow-sm`}>
          {canEdit ? (
            <>
              <div className="flex gap-4 mb-6 w-full max-w-md">
                <div className="flex-1 text-left">
                  <label
                    className={`text-[10px] ${textSub} font-black uppercase block mb-2 tracking-widest`}>
                    Select Auction Slot
                  </label>
                  <select
                    className={`w-full p-4 rounded-xl border outline-none focus:border-teal-500/50 font-bold transition-colors bg-current/5 border-current/10 focus:bg-current/10 text-inherit`}
                    value={activeSlotId || ""}
                    onChange={(e) =>
                      updateDoc(
                        doc(
                          db,
                          "tournaments",
                          tournamentId,
                          "auction",
                          "state",
                        ),
                        { activeSlotId: e.target.value },
                      )
                    }>
                    <option value="" className="text-black">
                      -- Choose Slot --
                    </option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id} className="text-black">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <h2
                className={`text-xl font-black ${textMain} mb-4 uppercase tracking-tight italic`}>
                {activeSlotId
                  ? `Slot: ${slots.find((s) => s.id === activeSlotId)?.name}`
                  : "Waiting for selection..."}
              </h2>

              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                <button
                  onClick={startNextInSlot}
                  disabled={!activeSlotId || upcomingInSlot.length === 0}
                  className={`bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-teal-500"} text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all shadow-lg flex-1`}>
                  Start Sequential
                </button>
                <button
                  onClick={startRandomInSlot}
                  disabled={!activeSlotId || upcomingInSlot.length === 0}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 flex-1">
                  <span className="text-base">🎲</span> Random Player
                </button>
              </div>
              {activeSlotId && upcomingInSlot.length > 0 && (
                <div
                  className={`mt-4 text-[10px] uppercase font-bold tracking-widest ${textSub}`}>
                  {upcomingInSlot.length} Players Remaining in Slot
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-4 grayscale opacity-50">⏸️</div>
              <h2
                className={`text-xl font-black ${textSub} uppercase tracking-widest`}>
                Auction Paused
              </h2>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={`${cardBg} border border-current/10 rounded-[3rem] p-8 mb-8 text-center relative overflow-hidden shadow-xl`}>
        <div
          className={`absolute top-0 left-0 w-full h-1.5 ${
            isPaused
              ? "bg-amber-500"
              : "bg-gradient-to-r from-teal-500 to-indigo-500 animate-pulse"
          }`}></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-10">
          <PlayerAvatar
            player={currentPlayer}
            playerId={auctionState?.currentPlayerId}
            tournamentId={tournamentId}
            className="w-48 h-48 rounded-3xl object-cover shadow-2xl border-4 border-white/10 shrink-0 bg-current/5"
          />
          <div className="flex-1 text-left md:text-center">
            <div className="flex justify-center items-center gap-3 mb-3">
              <div
                className={`bg-teal-500/10 text-teal-500 border-teal-500/20 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm`}>
                {slots.find((s) => s.id === activeSlotId)?.name ||
                  "Current Round"}
              </div>
              {isPaused && (
                <div className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg animate-pulse">
                  Paused
                </div>
              )}
            </div>
            <h1
              className={`text-4xl md:text-5xl font-black ${textMain} mb-2 tracking-tighter uppercase italic`}>
              {currentPlayer.name}
            </h1>
            <p
              className={`${textSub} uppercase mb-8 font-black tracking-widest text-xs flex items-center justify-center gap-2`}>
              {currentPlayer.role} • Base: ₹{currentPlayer.basePrice}{" "}
              {currentPlayer.isIcon && (
                <span className="text-amber-500 ml-1">★ Icon</span>
              )}
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
              <div
                className={`bg-current/5 border-current/10 p-5 rounded-2xl border min-w-[180px] text-center shadow-sm`}>
                <div
                  className={`text-[9px] ${textSub} uppercase font-black tracking-widest mb-1`}>
                  Current Bid
                </div>
                <div className="text-4xl font-mono font-bold text-teal-500">
                  ₹{auctionState.currentBid.toLocaleString()}
                </div>
              </div>
              <div
                className={`bg-current/5 border-current/10 p-5 rounded-2xl border min-w-[180px] text-center shadow-sm`}>
                <div
                  className={`text-[9px] ${textSub} uppercase font-black tracking-widest mb-1`}>
                  Leading Team
                </div>
                <div className={`text-xl font-bold ${textMain} truncate`}>
                  {auctionState.highestBidderName || "No Bids Yet"}
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() => markUnsold(tournamentId, currentPlayer.id)}
                  className={`bg-current/5 hover:bg-current/10 text-inherit opacity-70 hover:opacity-100 border-current/10 px-8 py-4 rounded-xl font-black text-xs uppercase border transition-colors`}>
                  Pass
                </button>
                <button
                  onClick={toggleAuctionPause}
                  className={`${
                    isPaused
                      ? "bg-teal-600 text-white border-transparent"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                  } px-6 py-4 rounded-xl font-black text-xs uppercase border transition-all`}>
                  {isPaused ? "▶ Resume" : "⏸ Pause"}
                </button>
                {auctionState.highestBidderId && (
                  <button
                    onClick={reverseLastBid}
                    className={`bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 px-6 py-4 rounded-xl font-black text-xs uppercase border transition-colors`}>
                    Undo Bid
                  </button>
                )}
                <button
                  onClick={() => markSold(tournamentId)}
                  disabled={!auctionState.highestBidderId}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase shadow-xl disabled:opacity-30 transform active:scale-95 transition-all">
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
      <div
        className={`${cardBg} border border-current/10 rounded-[3rem] p-6 mb-8 shadow-sm`}>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div
            className={`flex bg-black/20 border-white/5 rounded-xl p-1 border overflow-x-auto no-scrollbar`}>
            {["upcoming", "sold", "unsold"].map((t) => (
              <button
                key={t}
                onClick={() => setQueueTab(t)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  queueTab === t
                    ? `bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-teal-500"} text-white shadow-sm border border-transparent`
                    : `${textSub} hover:${textMain} border border-transparent`
                }`}>
                {t}
              </button>
            ))}
          </div>
          <select
            className={`bg-current/5 border-current/10 text-inherit text-xs rounded-xl px-4 py-2.5 outline-none font-bold cursor-pointer`}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}>
            <option className="text-black">All</option>
            <option className="text-black">Batsman</option>
            <option className="text-black">Bowler</option>
            <option className="text-black">All-Rounder</option>
            <option className="text-black">Wicket Keeper</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {displayList.map((player) => (
            <div
              key={player.id}
              className={`bg-current/5 border-current/10 hover:bg-current/10 hover:border-teal-500/50 p-3 rounded-xl border flex justify-between items-center group transition-all shadow-sm`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg overflow-hidden border bg-current/5 border-current/10`}>
                  <PlayerAvatar
                    player={player}
                    tournamentId={tournamentId}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <div
                    className={`font-bold ${textMain} text-sm truncate max-w-[120px]`}>
                    {player.name}
                  </div>
                  <div
                    className={`text-[9px] ${textSub} font-bold uppercase tracking-wider`}>
                    {player.role}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-mono font-bold ${
                    player.status === "SOLD" ? "text-teal-500" : textSub
                  }`}>
                  ₹
                  {(player.status === "SOLD"
                    ? player.soldPrice
                    : player.basePrice
                  ).toLocaleString()}
                </div>
                {player.status === "SOLD" && (
                  <div
                    className={`text-[9px] ${textSub} truncate max-w-[80px] font-bold uppercase mt-0.5`}>
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
          <h3
            className={`${textMain} font-black text-xl uppercase tracking-tighter italic`}>
            Bidding Console{" "}
            <span
              className={`text-xs bg-teal-500/10 text-teal-500 border-teal-500/20 px-3 py-1 rounded-lg font-black border uppercase not-italic ml-2`}>
              Smart Rules Active
            </span>
          </h3>
          {canEdit && (
            <button
              onClick={() => setRuleOverride(!ruleOverride)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${
                ruleOverride
                  ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/20"
                  : "bg-current/5 text-inherit opacity-60 hover:opacity-100 border-current/10 hover:bg-current/10"
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
                className={`p-6 rounded-3xl border-2 relative transition-all duration-300 group shadow-sm ${
                  isHighest
                    ? "bg-teal-500/20 border-teal-500 scale-[1.02] shadow-lg shadow-teal-500/10"
                    : `${cardBg} border-current/10`
                } ${isDisabled && !isHighest ? "opacity-50 grayscale" : ""} 
                ${isLocked ? "opacity-30 grayscale" : ""}`}>
                {isHighest && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-teal-500 text-white text-xs px-4 py-1 rounded-full font-black uppercase tracking-widest shadow-lg z-20">
                    Leading
                  </div>
                )}

                <div className="text-center mb-4 mt-2">
                  <div
                    className={`font-black truncate text-base uppercase italic mb-1 ${
                      isHighest ? "text-teal-500" : textMain
                    }`}>
                    {team.name}
                  </div>

                  <div
                    className={`text-xs mt-1 font-bold uppercase tracking-wider ${
                      errorReason ? "text-red-500" : textSub
                    }`}>
                    {errorReason ||
                      `Max Bid: ₹${(maxPossibleBid || 0).toLocaleString()}`}
                  </div>

                  <div
                    className={`mt-4 space-y-1.5 border-y py-3 border-current/10`}>
                    <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                      <span className={textSub}>Total Purse</span>
                      <span className={textMain}>
                        ₹{totalPurse.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] uppercase font-bold px-1">
                      <span className={textSub}>Total Spent</span>
                      <span className="text-red-500">
                        ₹{totalSpent.toLocaleString()}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between text-[11px] uppercase font-black px-1 pt-1 border-t border-current/10`}>
                      <span className={textSub}>Balance</span>
                      <span className="text-teal-500">
                        ₹{remainingPurse.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`text-[10px] uppercase font-bold tracking-tight mt-3 ${textSub}`}>
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
                      <div
                        className={`py-3 px-4 rounded-xl text-[10px] font-black text-center uppercase tracking-widest border bg-red-500/10 text-red-500 border-red-500/20`}>
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
                              bidAmountToPlace,
                            )
                          }
                          className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            isHighest
                              ? "bg-teal-500 text-white shadow-lg"
                              : isDisabled
                                ? "bg-current/5 text-inherit opacity-40 cursor-not-allowed border border-current/10"
                                : `bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-teal-500"} text-white shadow-lg hover:scale-105 active:scale-95`
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
                                currentPlayer,
                              )
                            }
                            className={`w-full py-2 rounded-xl text-[9px] font-black uppercase transition-all border bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border-amber-500/30`}>
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
                          ? "bg-teal-500 text-white border-teal-500"
                          : "bg-current/10 border-current/10 text-inherit opacity-60"
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
      <div
        className={`min-h-screen flex items-center justify-center animate-pulse font-black text-xl uppercase tracking-widest bg-transparent text-teal-500`}>
        Connecting...
      </div>
    );

  return (
    <div
      className={`min-h-screen px-4 pb-24 pt-24 font-sans bg-transparent ${textMain}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            to={`/tournaments/${tournamentId}`}
            className={`${textSub} hover:${textMain} text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors group`}>
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>{" "}
            Dashboard
          </Link>
          {canEdit && (
            <button
              onClick={() => setShowAdmin(true)}
              className={`${cardBg} hover:bg-current/10 px-5 py-3 rounded-xl font-black text-xs text-teal-500 border-current/10 uppercase tracking-widest shadow-sm transition-colors`}>
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
