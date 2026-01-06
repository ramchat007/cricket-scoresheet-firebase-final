import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  subscribeAuctionState,
  subscribeUnsoldPlayers,
  startBidding,
  placeBid,
  markSold,
  markUnsold,
} from "../utils/auction";
import { subscribeTeams } from "../utils/firestore";
import AuctionAdminPanel from "../components/AuctionAdminPanel"; // IMPORT THIS

export default function AuctionDashboard() {
  const { id: tournamentId } = useParams();

  // Data State
  const [auctionState, setAuctionState] = useState(null);
  const [unsoldPlayers, setUnsoldPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  // UI State
  const [filterRole, setFilterRole] = useState("All");
  const [showAdmin, setShowAdmin] = useState(false); // NEW STATE

  // --- 1. Realtime Subscriptions ---
  useEffect(() => {
    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);
    const unsubPlayers = subscribeUnsoldPlayers(tournamentId, setUnsoldPlayers);
    const unsubTeams = subscribeTeams(tournamentId, setTeams);

    return () => {
      unsubState && unsubState();
      unsubPlayers && unsubPlayers();
      unsubTeams && unsubTeams();
    };
  }, [tournamentId]);

  if (!auctionState)
    return (
      <div className="text-white text-center p-10">
        Initializing Auction Room...
      </div>
    );

  const isLive = auctionState.status === "LIVE";
  const currentPlayer = auctionState.currentPlayer;

  const calculateNextBid = (current) => {
    if (current < 1000) return current + 100;
    if (current < 5000) return current + 200;
    return current + 500;
  };

  const nextBidAmount = isLive ? calculateNextBid(auctionState.currentBid) : 0;

  // --- RENDER SECTIONS ---

  // 1. The "Stage" (Active Player Card)
  const renderStage = () => {
    if (!isLive || !currentPlayer) return null;

    return (
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl p-6 mb-8 text-center shadow-[0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-blue-600 animate-pulse"></div>

        <div className="relative z-10">
          <div className="inline-block bg-gray-950/50 rounded-full px-4 py-1 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-4 border border-cyan-900">
            Current Lot
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">
            {currentPlayer.name}
          </h1>
          <p className="text-gray-400 text-lg uppercase tracking-wide mb-6">
            {currentPlayer.role}
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div className="text-xs text-gray-500 uppercase">Current Bid</div>
              <div className="text-3xl font-bold text-green-400 flex items-center justify-center gap-1">
                <span className="text-lg">₹</span>
                {auctionState.currentBid}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl border ${
                auctionState.highestBidderId
                  ? "bg-cyan-900/20 border-cyan-500/50"
                  : "bg-gray-800/50 border-gray-700"
              }`}>
              <div className="text-xs text-gray-500 uppercase">Top Bidder</div>
              <div className="text-xl font-bold text-white truncate">
                {auctionState.highestBidderName || "Waiting..."}
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center border-t border-gray-800 pt-6">
            <button
              onClick={() => markUnsold(tournamentId, currentPlayer.id)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-6 py-3 rounded-lg font-bold transition-all">
              Pass / Unsold
            </button>
            <button
              onClick={() => markSold(tournamentId)}
              disabled={!auctionState.highestBidderId}
              className="bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-lg font-bold shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105">
              🔨 SOLD for {auctionState.currentBid}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 2. The "Queue" (Player Selection)
  const renderQueue = () => {
    if (isLive) return null;

    const filtered = unsoldPlayers.filter(
      (p) => filterRole === "All" || p.role === filterRole
    );

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            Upcoming Players ({filtered.length})
          </h2>
          <div className="flex gap-2">
            {/* NEW: Admin Setup Button */}
            <button
              onClick={() => setShowAdmin(true)}
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold px-4 py-2 rounded-lg border border-gray-700">
              ⚙️ Manage Pool
            </button>
            <select
              className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-1"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}>
              <option>All</option>
              <option>Batsman</option>
              <option>Bowler</option>
              <option>All-Rounder</option>
              <option>Wicket Keeper</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-600 italic">
            No unsold players found. <br />
            <button
              onClick={() => setShowAdmin(true)}
              className="text-cyan-500 underline mt-2">
              Click 'Manage Pool' to add players
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((player) => (
              <div
                key={player.id}
                className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:border-cyan-500 cursor-pointer flex justify-between items-center group transition-all"
                onClick={() => startBidding(tournamentId, player)}>
                <div>
                  <div className="font-bold text-white">{player.name}</div>
                  <div className="text-xs text-gray-400">
                    {player.role} • Base: {player.basePrice}
                  </div>
                </div>
                <button className="bg-cyan-900/30 text-cyan-400 text-xs px-3 py-1 rounded border border-cyan-500/30 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  Start Bid
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 3. The "Bidders" (Team Grid)
  const renderBidders = () => {
    const sortedTeams = [...teams].sort((a, b) => {
      if (a.id === auctionState.highestBidderId) return -1;
      if (b.id === auctionState.highestBidderId) return 1;
      return 0;
    });

    return (
      <div className="mt-8">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <span>🛡️</span> Bidding Console
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedTeams.map((team) => {
            const spent = parseInt(team.spent || 0);
            const purse = parseInt(team.purse || 0);
            const remaining = purse - spent;
            const isHighest = team.id === auctionState.highestBidderId;
            const canAfford = remaining >= nextBidAmount;

            const isDisabled = !isLive || !canAfford || isHighest;

            return (
              <div
                key={team.id}
                className={`relative p-4 rounded-xl border transition-all ${
                  isHighest
                    ? "bg-cyan-900/20 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)] scale-105 z-10"
                    : "bg-gray-900 border-gray-800 opacity-90 hover:opacity-100"
                }`}>
                {isHighest && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-black text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                    Highest Bidder
                  </div>
                )}

                <div className="text-center mb-3">
                  <div className="font-bold text-white text-lg leading-tight mb-1 truncate">
                    {team.name}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    Purse:{" "}
                    <span
                      className={
                        remaining < 1000 ? "text-red-400" : "text-green-400"
                      }>
                      {remaining}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    placeBid(tournamentId, team.id, team.name, nextBidAmount)
                  }
                  disabled={isDisabled}
                  className={`w-full py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all ${
                    isDisabled
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg transform active:scale-95"
                  }`}>
                  {isHighest
                    ? "Winning"
                    : !canAfford
                    ? "No Funds"
                    : `Bid ${nextBidAmount}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="hover:text-cyan-400">
            ← Back to Tournament
          </Link>
        </div>

        {renderStage()}
        {renderQueue()}
        {renderBidders()}

        {/* --- SETUP MODAL --- */}
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
