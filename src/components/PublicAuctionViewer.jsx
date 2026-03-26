import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useTheme } from "../context/ThemeContext";
import { Gavel, Wallet, Trophy, Tag, Shield } from "lucide-react";
import { formatCurrency } from "../utils/helpers";
import PlayerAvatar from "./PlayerAvatar";

export default function PublicAuctionViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [auctionState, setAuctionState] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [teams, setTeams] = useState([]);

  // 1. Listen to Auction State & Current Player
  useEffect(() => {
    const stateRef = doc(db, "tournaments", id, "auction", "state");
    let unsubPlayer = () => {};

    const unsubState = onSnapshot(stateRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAuctionState(data);

        // 🟢 CRITICAL FIX: Safely grab the ID whether it's stored directly or inside the player object
        const activeId = data.currentPlayer?.id || data.currentPlayerId;

        if (activeId) {
          unsubPlayer();
          // Fetch the fully intact player doc from the auctionPlayers list
          const activePlayerRef = doc(
            db,
            "tournaments",
            id,
            "auctionPlayers",
            activeId,
          );

          unsubPlayer = onSnapshot(activePlayerRef, (pSnap) => {
            if (pSnap.exists()) {
              setCurrentPlayer({ id: pSnap.id, ...pSnap.data() });
            } else {
              // Fallback if doc is missing
              setCurrentPlayer(
                data.currentPlayer || { name: "Unknown Player" },
              );
            }
          });
        } else {
          setCurrentPlayer(null);
        }
      }
    });

    // 2. Listen to Teams (to show live purses and extract sold players)
    const teamsRef = collection(db, "tournaments", id, "teams");
    const unsubTeams = onSnapshot(teamsRef, (snap) => {
      setTeams(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubState();
      unsubTeams();
      unsubPlayer();
    };
  }, [id]);

  // 🟢 3. EXTRACT ALL SOLD PLAYERS FOR TICKER
  const soldPlayers = useMemo(() => {
    const allSold = [];
    teams.forEach((team) => {
      if (team.roster && Array.isArray(team.roster)) {
        team.roster.forEach((player) => {
          if (!player.isOwner) {
            allSold.push({
              name: player.name,
              team: team.name,
              price: player.soldPrice || player.price || 0,
            });
          }
        });
      }
    });
    return allSold.sort((a, b) => b.price - a.price);
  }, [teams]);

  if (!auctionState) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center font-black tracking-widest animate-pulse ${theme.bg} ${theme.text}`}>
        LOADING LIVE AUCTION...
      </div>
    );
  }

  const highestBidder = teams.find(
    (t) => t.id === auctionState.currentBidderId,
  );

  return (
    <div
      className={`min-h-screen pb-20 font-sans overflow-x-hidden ${theme.bg} ${theme.text}`}>
      {/* 🟢 FIXED CSS FOR THE TICKER ANIMATION */}
      <style>
        {`
          @keyframes ticker {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
          .ticker-track {
            display: flex;
            width: max-content; /* FORCES SINGLE LINE */
            animation: ticker ${Math.max(25, soldPlayers.length * 4)}s linear infinite;
          }
          .ticker-track:hover {
            animation-play-state: paused;
          }
        `}
      </style>

      {/* HEADER */}
      <div
        className={`p-4 md:p-8 border-b pb-4 mb-8 flex justify-between items-center ${lightMode ? "border-gray-200" : "border-white/10"}`}>
        <h1 className="text-2xl font-black uppercase italic flex items-center gap-3">
          <span className="bg-red-500 text-white p-2 rounded-xl animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            <Gavel size={24} />
          </span>
          Live Auction
        </h1>
        <button
          onClick={() => navigate(`/tournaments/${id}`)}
          className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg border transition-all active:scale-95 ${lightMode ? "bg-white border-gray-200 text-gray-600 hover:bg-gray-50" : "bg-black/20 border-white/10 text-slate-300 hover:bg-white/5"}`}>
          Back to Dashboard
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT/TOP: CURRENT PLAYER ON THE BLOCK */}
        <div className="lg:col-span-2">
          <div
            className={`rounded-[2rem] border overflow-hidden shadow-2xl relative ${theme.card}`}>
            <div
              className={`text-center py-2 font-black uppercase tracking-[0.3em] text-xs transition-colors ${
                auctionState.status === "SOLD"
                  ? "bg-teal-500 text-black"
                  : auctionState.status === "UNSOLD"
                    ? "bg-red-500 text-white"
                    : "bg-amber-500 text-black"
              }`}>
              {auctionState.status === "ACTIVE"
                ? "Current Player on Block"
                : auctionState.status}
            </div>

            {currentPlayer ? (
              <div className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
                {/* 🟢 FIXED IMAGE RENDERER */}
                <PlayerAvatar
                  player={currentPlayer}
                  playerId={
                    auctionState?.currentPlayerId
                  } /* 🟢 ADD THIS LINE */
                  tournamentId={id}
                  className="w-48 h-48 rounded-3xl object-cover shadow-2xl border-4 border-white/10 shrink-0"
                />
                <div className="text-center md:text-left w-full">
                  <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter mb-2">
                    {currentPlayer.name}
                  </h2>
                  <span
                    className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border mb-6 ${theme.sub}`}>
                    {currentPlayer.role || "Player"}
                  </span>

                  <div
                    className={`p-6 rounded-2xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme.sub}`}>
                      {auctionState.status === "SOLD"
                        ? "Sold For"
                        : "Current Bid"}
                    </p>
                    <p
                      className={`text-5xl font-mono font-black ${auctionState.status === "SOLD" ? "text-teal-500" : "text-amber-500"}`}>
                      {formatCurrency(
                        auctionState.currentBid || currentPlayer.basePrice || 0,
                      )}
                    </p>
                    {highestBidder && (
                      <p
                        className={`text-sm font-bold mt-2 flex items-center justify-center md:justify-start gap-2 ${theme.text}`}>
                        <Trophy size={14} className="text-teal-500" />
                        {highestBidder.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-32 text-center">
                <Gavel
                  size={64}
                  className={`mx-auto mb-4 opacity-20 ${theme.text}`}
                />
                <p
                  className={`font-bold uppercase tracking-widest ${theme.sub}`}>
                  Waiting for auctioneer...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT/BOTTOM: LIVE TEAM PURSES */}
        <div
          className={`rounded-[2rem] border p-6 shadow-xl flex flex-col max-h-[600px] ${theme.card}`}>
          <h3
            className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${theme.text}`}>
            <Wallet size={16} className="text-teal-500" /> Live Team Purses
          </h3>

          <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2">
            {teams.map((team) => {
              const remaining = (team.purse || 0) - (team.spent || 0);
              return (
                <div
                  key={team.id}
                  className={`p-4 rounded-xl border flex justify-between items-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                  <div className="flex items-center gap-3">
                    {/* Team Logo Fallback */}
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        className="w-8 h-8 rounded-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <Shield size={14} />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm truncate max-w-[120px]">
                        {team.name}
                      </h4>
                      <p
                        className={`text-[9px] uppercase font-bold tracking-widest mt-0.5 ${theme.sub}`}>
                        {team.roster?.length || 0} Players
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-black text-teal-500">
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🟢 FIXED: SOLD PLAYERS TICKER */}
      {soldPlayers.length > 0 && (
        <div
          className={`fixed bottom-0 left-0 w-full h-12 border-t z-50 flex items-center overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.3)] ${lightMode ? "bg-white border-gray-200" : "bg-[#0F1115] border-white/10"}`}>
          {/* Ticker Label Overlay (Pinned to Left) */}
          <div
            className={`absolute left-0 top-0 bottom-0 z-10 px-4 flex items-center justify-center font-black text-[10px] uppercase tracking-widest shadow-[10px_0_15px_rgba(0,0,0,0.8)] ${lightMode ? "bg-gray-100 text-teal-600 border-r border-gray-300" : "bg-[#161920] text-teal-500 border-r border-white/10 shadow-[#0F1115]"}`}>
            <Tag size={12} className="mr-2" /> Sold Players
          </div>

          {/* 🟢 The Scrolling Content (Forced Single Line) */}
          <div className="ticker-track pl-[150px] gap-12">
            {soldPlayers.map((player, idx) => (
              <div key={idx} className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-black text-sm uppercase tracking-wider ${theme.text}`}>
                  {player.name}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase ${theme.sub}`}>
                  ({player.team})
                </span>
                <span className="text-teal-500 font-mono font-black ml-1">
                  {formatCurrency(player.price)}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500/50 ml-10"></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
