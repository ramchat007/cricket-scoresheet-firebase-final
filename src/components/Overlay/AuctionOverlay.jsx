import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { Gavel, Trophy, AlertCircle } from "lucide-react";
import { formatCurrency } from "../../utils/helpers";
import PlayerAvatar from "../PlayerAvatar";

export default function AuctionOverlay() {
  const params = useParams();
  const id = params.id || params.tournamentId;

  const [auctionState, setAuctionState] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState(null);

  // 1. Listen to Auction State, Current Player, and Teams (only for bidder name)
  useEffect(() => {
    if (!id) {
      setError("Tournament ID is missing from the URL.");
      return;
    }

    const stateRef = doc(db, "tournaments", id, "auction", "state");
    let unsubPlayer = () => {};

    const unsubState = onSnapshot(
      stateRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAuctionState(data);

          const activeId = data.currentPlayer?.id || data.currentPlayerId;

          if (activeId && typeof activeId === "string") {
            unsubPlayer();
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
                setCurrentPlayer(
                  data.currentPlayer || { name: "Unknown Player" },
                );
              }
            });
          } else {
            setCurrentPlayer(null);
          }
        } else {
          setError("Auction state not found for this tournament.");
        }
      },
      (err) => {
        console.error("Firestore Error:", err);
        setError("Failed to connect to the live auction.");
      },
    );

    // We only need teams to get the name of the highest bidder
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

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black font-sans text-white p-8">
        <AlertCircle size={64} className="text-red-500 mb-6" />
        <h1 className="text-3xl font-black uppercase tracking-widest text-red-500 mb-2">
          Connection Error
        </h1>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  if (!auctionState) {
    return (
      <div className="w-screen h-screen flex items-center justify-center font-black text-white text-3xl tracking-widest animate-pulse bg-transparent">
        <span className="bg-black/60 px-8 py-4 rounded-2xl backdrop-blur-md border border-white/10">
          LOADING LIVE AUCTION...
        </span>
      </div>
    );
  }

  const highestBidder = teams.find(
    (t) => t.id === auctionState.currentBidderId,
  );

  return (
    <>
      {/* 🟢 FORCE OBS TRANSPARENCY - Zero heavy animations to prevent lag */}
      <style>
        {`
          html, body, #root {
            background-color: transparent !important;
            background: transparent !important;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
        `}
      </style>

      {/* COMPACT SIDEBAR LAYOUT */}
      <div className="w-screen h-screen overflow-hidden bg-transparent font-sans text-white relative">
        {/* =========================================
            RIGHT SIDE: FLOATING COMPACT PLAYER CARD
            ========================================= */}
        <div className="absolute top-12 right-12 w-[420px] bg-black/85 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[-10px_10px_40px_rgba(0,0,0,0.8)] flex flex-col z-40 overflow-hidden">
          {/* Status Banner */}
          <div
            className={`text-center py-3 font-black uppercase tracking-[0.4em] text-xs transition-colors shrink-0 ${
              auctionState.status === "SOLD"
                ? "bg-teal-500 text-black"
                : auctionState.status === "UNSOLD"
                  ? "bg-red-500 text-white"
                  : "bg-amber-500 text-black animate-pulse"
            }`}
          >
            {auctionState.status === "ACTIVE"
              ? "Current Player"
              : auctionState.status}
          </div>

          {currentPlayer ? (
            <div className="p-8 flex flex-col items-center">
              {/* Profile Image */}
              <div className="relative shrink-0 mb-6">
                <PlayerAvatar
                  player={currentPlayer}
                  playerId={auctionState?.currentPlayerId}
                  tournamentId={id}
                  className="w-56 h-56 rounded-3xl object-cover shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-4 border-white/10 bg-black/50"
                />
                {currentPlayer.isIcon && (
                  <div className="absolute -top-3 -right-3 bg-amber-500 text-black px-4 py-1.5 rounded-xl font-black uppercase text-xs shadow-2xl border-2 border-black rotate-6">
                    ★ Icon
                  </div>
                )}
              </div>

              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-center mb-3 drop-shadow-lg leading-tight break-words px-2 w-full text-white">
                {currentPlayer.name}
              </h2>

              <span className="inline-block px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-teal-500/30 bg-teal-500/10 text-teal-400 mb-6">
                {currentPlayer.role || "Player"}
              </span>

              {/* Compact Prices Container */}
              <div className="w-full p-6 rounded-2xl border border-white/10 bg-white/5 shadow-inner text-center">
                <p className="text-xs font-black uppercase tracking-widest mb-1 text-gray-400">
                  {auctionState.status === "SOLD" ? "Sold For" : "Current Bid"}
                </p>
                <p
                  className={`text-6xl font-mono font-black drop-shadow-md ${auctionState.status === "SOLD" ? "text-teal-400" : "text-amber-400"}`}
                >
                  {formatCurrency(
                    auctionState.currentBid || currentPlayer.basePrice || 0,
                  )}
                </p>

                {/* Leading Team */}
                {highestBidder && (
                  <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-center gap-3 animate-in fade-in duration-300">
                    <Trophy size={20} className="text-teal-400" />
                    <div className="flex flex-col text-left overflow-hidden">
                      <span className="text-[9px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-1">
                        {auctionState.status === "SOLD"
                          ? "Bought By"
                          : "Leading"}
                      </span>
                      <p className="text-lg font-black text-white truncate max-w-[200px] leading-none">
                        {highestBidder.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 opacity-40">
              <Gavel size={80} className="mb-6" />
              <p className="font-black text-xl uppercase tracking-widest text-center leading-relaxed">
                Waiting for <br /> Auctioneer
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
