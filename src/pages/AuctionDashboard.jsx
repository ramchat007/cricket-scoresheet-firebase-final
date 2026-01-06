import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  subscribeAuctionState,
  startBidding,
  placeBid,
  markSold,
  markUnsold,
  initializeAuction,
} from "../utils/auction";
import AuctionAdminPanel from "../components/AuctionAdminPanel";

export default function AuctionDashboard() {
  const { id: tournamentId } = useParams();

  // --- Data State ---
  const [auctionState, setAuctionState] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]); // Master List
  const [teamsMap, setTeamsMap] = useState({}); // To lookup Team Name by ID
  const [teams, setTeams] = useState([]); // Array for Bidding Grid

  // --- UI State ---
  const [filterRole, setFilterRole] = useState("All");
  const [queueTab, setQueueTab] = useState("upcoming"); // "upcoming" | "sold" | "unsold"
  const [showAdmin, setShowAdmin] = useState(false);

  // --- Realtime Subscriptions ---
  useEffect(() => {
    // 1. Subscribe to Auction State
    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);

    // 2. Subscribe to Teams (Only to map IDs to Names and for the Bid Grid)
    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    const qTeams = query(teamsRef);

    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      const teamData = [];
      const mapping = {};

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const t = { id: doc.id, ...data };
        teamData.push(t);
        mapping[doc.id] = data.name; // Create Lookup Map { id: "Team Name" }
      });

      setTeams(teamData);
      setTeamsMap(mapping);
    });

    // 3. Subscribe to ALL Auction Players (The Single Source of Truth)
    const playersRef = collection(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers"
    );
    // Fetch EVERYTHING. We will filter in client to avoid complex indexes
    const qPlayers = query(playersRef); // optional: orderBy('name')

    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      const players = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort alphabetically
      players.sort((a, b) => a.name.localeCompare(b.name));
      setAllPlayers(players);
    });

    return () => {
      unsubState && unsubState();
      unsubTeams && unsubTeams();
      unsubPlayers && unsubPlayers();
    };
  }, [tournamentId]);

  // --- Derived Lists (Client Side Filtering) ---

  // 1. Upcoming
  const upcomingPlayers = allPlayers.filter((p) => p.status === "PENDING");

  // 2. Sold (Includes Owners if they are marked as SOLD in DB)
  const soldPlayers = allPlayers.filter((p) => p.status === "SOLD");

  // 3. Unsold
  const unsoldPlayers = allPlayers.filter(
    (p) => p.status === "UNSOLD" || p.status === "UNSOLD_PASSED"
  );

  // --- Loading State ---
  if (!auctionState) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center max-w-md shadow-2xl">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Auction Room Not Ready</h2>
          <button
            onClick={() => initializeAuction(tournamentId)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg mt-4">
            🚀 Initialize Auction
          </button>
        </div>
      </div>
    );
  }

  // --- Auction Logic Helpers ---
  const isLive = auctionState.status === "LIVE";
  const currentPlayer = auctionState.currentPlayer;

  const calculateNextBid = (current) => {
    if (current < 1000) return current + 100;
    if (current < 5000) return current + 200;
    return current + 500;
  };
  const nextBidAmount = isLive ? calculateNextBid(auctionState.currentBid) : 0;

  // --- RENDER SECTIONS ---

  // 1. Active Stage
  const renderStage = () => {
    if (!isLive || !currentPlayer) return null;

    return (
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl p-6 mb-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-blue-600 animate-pulse"></div>
        <div className="relative z-10">
          <div className="inline-block bg-cyan-900/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-4 px-3 py-1 rounded">
            Current Lot
          </div>
          <h1 className="text-4xl font-black text-white mb-2">
            {currentPlayer.name}
          </h1>
          <p className="text-gray-400 text-lg uppercase mb-6">
            {currentPlayer.role}
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase">Current Bid</div>
              <div className="text-3xl font-bold text-green-400">
                ₹{auctionState.currentBid}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase">Holder</div>
              <div className="text-xl font-bold text-white">
                {auctionState.highestBidderName || "Waiting..."}
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => markUnsold(tournamentId, currentPlayer.id)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-3 rounded-lg font-bold">
              Pass
            </button>
            <button
              onClick={() => markSold(tournamentId)} // This function must now update auctionPlayers doc to status='SOLD'
              disabled={!auctionState.highestBidderId}
              className="bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-lg font-bold disabled:opacity-50">
              SOLD
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 2. The List (Upcoming / Sold / Unsold)
  const renderQueue = () => {
    // Select the correct list based on state
    let displayList = [];
    if (queueTab === "upcoming") displayList = upcomingPlayers;
    if (queueTab === "sold") displayList = soldPlayers;
    if (queueTab === "unsold") displayList = unsoldPlayers;

    // Apply Role Filter
    if (filterRole !== "All") {
      displayList = displayList.filter((p) => p.role === filterRole);
    }

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto">
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button
                onClick={() => setQueueTab("upcoming")}
                className={`px-4 py-1.5 rounded-md text-sm font-bold ${
                  queueTab === "upcoming"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400"
                }`}>
                Upcoming ({upcomingPlayers.length})
              </button>
              <button
                onClick={() => setQueueTab("sold")}
                className={`px-4 py-1.5 rounded-md text-sm font-bold ${
                  queueTab === "sold"
                    ? "bg-green-900/50 text-green-400"
                    : "text-gray-400"
                }`}>
                Sold ({soldPlayers.length})
              </button>
              <button
                onClick={() => setQueueTab("unsold")}
                className={`px-4 py-1.5 rounded-md text-sm font-bold ${
                  queueTab === "unsold"
                    ? "bg-red-900/50 text-red-400"
                    : "text-gray-400"
                }`}>
                Unsold ({unsoldPlayers.length})
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAdmin(true)}
              className="bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded">
              ⚙️
            </button>
            <select
              className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-1"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}>
              <option>All</option>
              <option>Batsman</option>
              <option>Bowler</option>
              <option>All-Rounder</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {displayList.length === 0 ? (
          <div className="text-center py-10 text-gray-600 italic">
            No players in this list.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {displayList.map((player) => {
              // --- CARD: SOLD ---
              if (queueTab === "sold") {
                const teamName = teamsMap[player.teamId] || "Unknown Team";
                return (
                  <div
                    key={player.id}
                    className="bg-gray-800/60 p-3 rounded border border-gray-700/50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-gray-200">
                        {player.name}
                      </div>
                      <div className="text-xs text-gray-500">{player.role}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-green-400 font-bold">
                        ₹{player.soldPrice || 0}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {teamName}
                      </div>
                    </div>
                  </div>
                );
              }

              // --- CARD: UPCOMING / UNSOLD ---
              return (
                <div
                  key={player.id}
                  onClick={() =>
                    queueTab === "upcoming" &&
                    startBidding(tournamentId, player)
                  }
                  className={`p-3 rounded border flex justify-between items-center transition-all ${
                    queueTab === "upcoming"
                      ? "bg-gray-800 border-gray-700 hover:border-cyan-500 cursor-pointer group"
                      : "bg-gray-900/50 border-gray-800 opacity-75"
                  }`}>
                  <div>
                    <div className="font-bold text-white">
                      {player.name}
                      {player.isOwner && (
                        <span className="ml-2 text-[10px] bg-purple-900 text-purple-300 px-1 rounded">
                          OWNER
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {player.role} • Base: ₹{player.basePrice}
                    </div>
                  </div>
                  {queueTab === "upcoming" && (
                    <button className="bg-cyan-900/30 text-cyan-400 text-[10px] px-2 py-1 rounded border border-cyan-500/30 group-hover:bg-cyan-600 group-hover:text-white">
                      BID
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 3. Bidding Console (Teams)
  const renderBidders = () => {
    // Sort teams: Highest bidder first, then alphabetical
    const sortedTeams = [...teams].sort((a, b) => {
      if (a.id === auctionState.highestBidderId) return -1;
      if (b.id === auctionState.highestBidderId) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="mt-8 pb-20">
        <h3 className="text-white font-bold text-lg mb-4">Bidding Console</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sortedTeams.map((team) => {
            const spent = parseInt(team.spent) || 0;
            const purse = parseInt(team.purse) || 0;
            const remaining = purse - spent;
            const isHighest = team.id === auctionState.highestBidderId;
            const canAfford = remaining >= nextBidAmount;
            const isDisabled = !isLive || !canAfford || isHighest;

            return (
              <div
                key={team.id}
                className={`p-4 rounded-xl border relative ${
                  isHighest
                    ? "bg-cyan-900/20 border-cyan-500"
                    : "bg-gray-900 border-gray-800"
                }`}>
                {isHighest && (
                  <div className="absolute -top-2 left-4 bg-cyan-500 text-black text-[10px] px-2 rounded font-bold">
                    HIGHEST
                  </div>
                )}
                <div className="text-center mb-3">
                  <div className="font-bold text-white truncate">
                    {team.name}
                  </div>
                  <div
                    className={`text-xs ${
                      remaining < 1000 ? "text-red-400" : "text-green-400"
                    }`}>
                    ₹{remaining}
                  </div>
                </div>
                <button
                  disabled={isDisabled}
                  onClick={() =>
                    placeBid(tournamentId, team.id, team.name, nextBidAmount)
                  }
                  className={`w-full py-2 rounded text-xs font-bold uppercase ${
                    isDisabled
                      ? "bg-gray-800 text-gray-600"
                      : "bg-green-600 text-white shadow-lg active:scale-95"
                  }`}>
                  {isHighest ? "Winning" : `Bid ${nextBidAmount}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-6xl mx-auto">
        <Link
          to={`/tournaments/${tournamentId}`}
          className="text-gray-500 hover:text-white mb-6 block">
          ← Back
        </Link>
        {renderStage()}
        {renderQueue()}
        {renderBidders()}
        {showAdmin && (
          <AuctionAdminPanel
            tournamentId={tournamentId}
            onClose={() => setShowAdmin(false)}
          />
        )}
      </div>
    </div>
  );
}
