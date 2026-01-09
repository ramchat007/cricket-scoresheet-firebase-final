import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  subscribeAuctionState,
  startBidding,
  placeBid,
  markSold,
  markUnsold,
} from "../utils/auction";
import AuctionAdminPanel from "../components/AuctionAdminPanel";

export default function AuctionDashboard() {
  const { id: tournamentId } = useParams();

  const [auctionState, setAuctionState] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [teamsMap, setTeamsMap] = useState({});
  const [teams, setTeams] = useState([]);

  const [filterRole, setFilterRole] = useState("All");
  const [queueTab, setQueueTab] = useState("upcoming");
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);

    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    const qTeams = query(teamsRef);
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      const teamData = [];
      const mapping = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        teamData.push({ id: doc.id, ...data });
        mapping[doc.id] = data.name;
      });
      setTeams(teamData);
      setTeamsMap(mapping);
    });

    const playersRef = collection(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers"
    );
    const qPlayers = query(playersRef);
    const unsubPlayers = onSnapshot(qPlayers, (snapshot) => {
      const players = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      players.sort((a, b) => a.name.localeCompare(b.name));
      setAllPlayers(players);
    });

    return () => {
      unsubState && unsubState();
      unsubTeams && unsubTeams();
      unsubPlayers && unsubPlayers();
    };
  }, [tournamentId]);

  const upcomingPlayers = allPlayers.filter((p) => p.status === "PENDING");
  const soldPlayers = allPlayers.filter((p) => p.status === "SOLD");
  const unsoldPlayers = allPlayers.filter(
    (p) => p.status === "UNSOLD" || p.status === "UNSOLD_PASSED"
  );

  const pickRandomPlayer = () => {
    if (upcomingPlayers.length === 0) return alert("No players left in pool!");
    const randomIndex = Math.floor(Math.random() * upcomingPlayers.length);
    const randomPlayer = upcomingPlayers[randomIndex];
    startBidding(tournamentId, randomPlayer);
  };

  if (!auctionState) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center max-w-md shadow-2xl">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Auction Room Not Ready</h2>
          <p className="text-gray-400 mb-4">
            Please initialize auction from Tournament Details page.
          </p>
          <Link
            to={`/tournaments/${tournamentId}`}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg mt-4 inline-block text-center">
            🔗 Go to Tournament
          </Link>
        </div>
      </div>
    );
  }

  const isLive = auctionState.status === "LIVE";
  const currentPlayer = auctionState.currentPlayer;
  const calculateNextBid = (current) => {
    if (current < 1000) return current + 100;
    if (current < 5000) return current + 200;
    return current + 500;
  };
  const nextBidAmount = isLive ? calculateNextBid(auctionState.currentBid) : 0;

  const renderStage = () => {
    if (!isLive || !currentPlayer) {
      return (
        <div className="bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-2xl p-12 mb-8 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="text-6xl mb-4 opacity-50">🎲</div>
          <h2 className="text-2xl font-bold text-gray-400 mb-2">
            Waiting for next player...
          </h2>
          <p className="text-gray-500 mb-6 text-sm">
            {upcomingPlayers.length} players remaining in the pool.
          </p>
          <button
            onClick={pickRandomPlayer}
            disabled={upcomingPlayers.length === 0}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xl py-4 px-10 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            Pick Random Player
          </button>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl p-6 mb-8 text-center relative overflow-hidden shadow-2xl shadow-cyan-900/20">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600 animate-pulse"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <img
              src={
                currentPlayer.photoURL ||
                "https://cdn-icons-png.flaticon.com/512/847/847969.png"
              }
              alt={currentPlayer.name}
              className="relative w-64 h-64 md:w-96 md:h-96 rounded-full object-cover border-8 border-gray-800 shadow-2xl bg-gray-700"
              onError={(e) => {
                e.target.src =
                  "https://cdn-icons-png.flaticon.com/512/847/847969.png";
              }}
            />
            {currentPlayer.isIcon && (
              <div className="absolute bottom-0 right-4 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full border-2 border-gray-900 shadow-lg">
                ★ ICON
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="inline-block bg-cyan-900/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded border border-cyan-500/20">
              Current Lot
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2 leading-tight">
              {currentPlayer.name}
            </h1>
            <p className="text-gray-400 text-lg uppercase mb-6 font-medium tracking-wide">
              {currentPlayer.role} •{" "}
              <span className="text-gray-500">
                Base: ₹{currentPlayer.basePrice}
              </span>
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-12 mb-8 bg-gray-950/30 p-4 rounded-xl border border-white/5">
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                  Current Bid
                </div>
                <div className="text-4xl font-mono font-bold text-green-400">
                  ₹{auctionState.currentBid.toLocaleString()}
                </div>
              </div>
              <div className="hidden sm:block w-px bg-gray-700/50"></div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                  Winning Team
                </div>
                <div className="text-2xl font-bold text-white max-w-[200px] truncate">
                  {auctionState.highestBidderName || "Waiting for bid..."}
                </div>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => markUnsold(tournamentId, currentPlayer.id)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-8 py-3 rounded-lg font-bold border border-gray-700 transition-colors">
                Pass / Unsold
              </button>
              <button
                onClick={() => markSold(tournamentId)}
                disabled={!auctionState.highestBidderId}
                className="bg-green-600 hover:bg-green-500 text-white px-12 py-3 rounded-lg font-bold shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95">
                SOLD 🔨
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQueue = () => {
    let displayList = [];
    if (queueTab === "upcoming") displayList = upcomingPlayers;
    if (queueTab === "sold") displayList = soldPlayers;
    if (queueTab === "unsold") displayList = unsoldPlayers;
    if (filterRole !== "All")
      displayList = displayList.filter((p) => p.role === filterRole);

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
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

        {displayList.length === 0 ? (
          <div className="text-center py-10 text-gray-600 italic">
            No players in this list.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {displayList.map((player) => {
              if (queueTab === "sold") {
                const teamName = teamsMap[player.teamId] || "Unknown Team";
                return (
                  <div
                    key={player.id}
                    className="bg-gray-800/60 p-3 rounded border border-gray-700/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          player.photoURL ||
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                        }
                        className="w-8 h-8 rounded-full bg-gray-700 object-cover"
                        alt=""
                        onError={(e) =>
                          (e.target.src =
                            "https://cdn-icons-png.flaticon.com/512/847/847969.png")
                        }
                      />
                      <div>
                        <div className="font-bold text-gray-200">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {player.role}
                        </div>
                      </div>
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

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded border flex justify-between items-center transition-all ${
                    queueTab === "upcoming"
                      ? "bg-gray-800 border-gray-700 group"
                      : "bg-gray-900/50 border-gray-800 opacity-75"
                  }`}>
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        player.photoURL ||
                        "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                      }
                      className="w-8 h-8 rounded-full bg-gray-700 object-cover"
                      alt=""
                      onError={(e) =>
                        (e.target.src =
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png")
                      }
                    />
                    <div>
                      <div className="font-bold text-white">
                        {player.name}
                        {player.isOwner && (
                          <span className="ml-2 text-[10px] bg-purple-900 text-purple-300 px-1 rounded">
                            OWNER
                          </span>
                        )}
                        {player.isIcon && (
                          <span className="ml-2 text-[10px] bg-yellow-900 text-yellow-300 px-1 rounded">
                            ★
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.role} • Base: ₹{player.basePrice}
                      </div>
                    </div>
                  </div>
                  {queueTab === "upcoming" && (
                    <button
                      onClick={() => startBidding(tournamentId, player)}
                      className="bg-gray-700 hover:bg-cyan-600 text-gray-300 hover:text-white text-[10px] px-2 py-1 rounded transition-colors"
                      title="Force start this player">
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

  const renderBidders = () => {
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
                className={`p-4 rounded-xl border relative transition-all duration-300 ${
                  isHighest
                    ? "bg-cyan-900/20 border-cyan-500 transform scale-105 shadow-lg shadow-cyan-900/20"
                    : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }`}>
                {isHighest && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-cyan-500 text-black text-[10px] px-3 py-0.5 rounded-full font-bold shadow-sm">
                    HIGHEST BIDDER
                  </div>
                )}
                <div className="text-center mb-3 mt-1">
                  <div className="font-bold text-white truncate text-sm md:text-base">
                    {team.name}
                  </div>
                  <div
                    className={`text-xs font-mono mt-1 ${
                      remaining < 1000 ? "text-red-400" : "text-green-400"
                    }`}>
                    Purse: ₹{remaining.toLocaleString()}
                  </div>
                </div>
                <button
                  disabled={isDisabled}
                  onClick={() =>
                    placeBid(tournamentId, team.id, team.name, nextBidAmount)
                  }
                  className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    isDisabled
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed border border-transparent"
                      : "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 border border-green-500/50"
                  }`}>
                  {isHighest ? "Leading..." : `Bid ₹${nextBidAmount}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link
          to={`/tournaments/${tournamentId}`}
          className="text-gray-500 hover:text-white mb-6 block text-sm font-bold flex items-center gap-1">
          <span>←</span> Back to Tournament
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
