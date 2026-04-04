import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase"; 
import { Gavel, Wallet, Trophy, Tag, Shield, AlertCircle, Users } from "lucide-react";
import { formatCurrency } from "../../utils/helpers";
import PlayerAvatar from "../PlayerAvatar";

export default function AuctionOverlay() {
  const params = useParams();
  const id = params.id || params.tournamentId;

  const [auctionState, setAuctionState] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null); // 🟢 NEW: To get maxSquadSize
  const [error, setError] = useState(null);

  // 1. Listen to Auction State, Current Player, and Config
  useEffect(() => {
    if (!id) {
      setError("Tournament ID is missing from the URL.");
      return;
    }

    // 🟢 Listen to Tournament Config
    const configRef = doc(db, "tournaments", id);
    const unsubConfig = onSnapshot(configRef, (snap) => {
      if (snap.exists()) setTournamentConfig(snap.data());
    });

    const stateRef = doc(db, "tournaments", id, "auction", "state");
    let unsubPlayer = () => {}; 

    const unsubState = onSnapshot(stateRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAuctionState(data);

        const activeId = data.currentPlayer?.id || data.currentPlayerId;

        if (activeId && typeof activeId === "string") {
          unsubPlayer(); 
          const activePlayerRef = doc(db, "tournaments", id, "auctionPlayers", activeId);
          
          unsubPlayer = onSnapshot(activePlayerRef, (pSnap) => {
            if (pSnap.exists()) {
              setCurrentPlayer({ id: pSnap.id, ...pSnap.data() });
            } else {
              setCurrentPlayer(data.currentPlayer || { name: "Unknown Player" });
            }
          });
        } else {
          setCurrentPlayer(null); 
        }
      } else {
        setError("Auction state not found for this tournament.");
      }
    }, (err) => {
      console.error("Firestore Error:", err);
      setError("Failed to connect to the live auction.");
    });

    // 2. Listen to Teams for Live Purses
    const teamsRef = collection(db, "tournaments", id, "teams");
    const unsubTeams = onSnapshot(teamsRef, (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubState();
      unsubTeams();
      unsubPlayer(); 
      unsubConfig();
    };
  }, [id]);

  // 3. EXTRACT ALL SOLD PLAYERS FOR TICKER
  const soldPlayers = useMemo(() => {
    const allSold = [];
    teams.forEach(team => {
      if (team.roster && Array.isArray(team.roster)) {
        team.roster.forEach(player => {
          if (!player.isOwner) {
            allSold.push({
              name: player.name,
              team: team.name,
              price: player.soldPrice || player.price || 0
            });
          }
        });
      }
    });
    return allSold.sort((a, b) => b.price - a.price);
  }, [teams]);

  // 🟢 SMART SCROLL LOGIC
  const maxSquadSize = tournamentConfig?.maxSquadSize || 15; // Fallback to 15 if not set
  // Because the boxes are larger now (320px), we trigger scrolling if there are more than 5 teams.
  const needsPurseScroll = teams.length > 5;
  const displayTeams = needsPurseScroll ? [...teams, ...teams] : teams;

  // 🟢 ERROR VIEW
  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black font-sans text-white p-8">
         <AlertCircle size={64} className="text-red-500 mb-6" />
         <h1 className="text-3xl font-black uppercase tracking-widest text-red-500 mb-2">Connection Error</h1>
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

  const highestBidder = teams.find(t => t.id === auctionState.currentBidderId);

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent font-sans text-white relative">
      
      <style>
        {`
          @keyframes ticker {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
          .ticker-track {
            display: flex;
            width: max-content; 
            animation: ticker ${Math.max(25, soldPlayers.length * 4)}s linear infinite;
          }

          /* 🟢 BULLETPROOF PURSE SCROLLER */
          @keyframes purseScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); } 
          }
          .purse-marquee {
            display: flex;
            width: max-content;
            will-change: transform;
          }
          .purse-marquee.scrolling {
            animation: purseScroll linear infinite;
          }
        `}
      </style>

      {/* =========================================
          TOP-LEFT: WATERMARK & LIVE INDICATOR
          ========================================= */}
      <div className="absolute top-8 left-8 flex items-center gap-4 z-50">
        <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-2xl border border-white/20">
          <Trophy size={32} className="text-black" />
        </div>
        <div className="flex flex-col drop-shadow-xl bg-black/40 px-4 py-1.5 rounded-xl backdrop-blur-sm border border-white/10">
          <span className="text-2xl font-black uppercase italic tracking-tighter leading-none text-white">
            Cric<span className="text-teal-400">Sync</span>
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-black-400 leading-none">
              Live Broadcast
            </span>
          </div>
        </div>
      </div>

      {/* =========================================
          RIGHT SIDE: FLOATING PLAYER CARD
          ========================================= */}
      <div className="absolute top-8 right-8 w-[440px] bg-black/85 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[-10px_10px_40px_rgba(0,0,0,0.8)] flex flex-col z-40 overflow-hidden">
        <div className={`text-center py-3 font-black uppercase tracking-[0.4em] text-xs transition-colors shrink-0 ${
          auctionState.status === "SOLD" ? "bg-teal-500 text-black" :
          auctionState.status === "UNSOLD" ? "bg-red-500 text-white" :
          "bg-amber-500 text-black animate-pulse"
        }`}>
          {auctionState.status === "ACTIVE" ? "Current Player" : auctionState.status}
        </div>

        {currentPlayer ? (
          <div className="p-8 flex flex-col items-center">
            <PlayerAvatar 
              player={currentPlayer} 
              playerId={auctionState?.currentPlayerId} 
              tournamentId={id} 
              className="w-56 h-56 rounded-3xl object-cover shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-4 border-white/10 mb-6 shrink-0" 
            />
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-center mb-3 drop-shadow-lg leading-tight break-words px-2 w-full text-white">
              {currentPlayer.name}
            </h2>
            <span className="inline-block px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-teal-500/30 bg-teal-500/10 text-teal-400 mb-6">
              {currentPlayer.role || "Player"}
            </span>
            
            <div className="w-full p-6 rounded-2xl border border-white/10 bg-white/5 shadow-inner text-center">
              <p className="text-xs font-black uppercase tracking-widest mb-1 text-gray-400">
                {auctionState.status === "SOLD" ? "Sold For" : "Current Bid"}
              </p>
              <p className={`text-6xl font-mono font-black drop-shadow-md ${auctionState.status === "SOLD" ? "text-teal-400" : "text-amber-400"}`}>
                {formatCurrency(auctionState.currentBid || currentPlayer.basePrice || 0)}
              </p>
              {highestBidder && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center gap-2">
                  <Trophy size={18} className="text-teal-400"/>
                  <p className="text-lg font-bold text-white truncate max-w-[250px]">
                    {highestBidder.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 opacity-40">
            <Gavel size={80} className="mb-6" />
            <p className="font-black text-xl uppercase tracking-widest text-center">Waiting for<br/>Auctioneer</p>
          </div>
        )}
      </div>

      {/* =========================================
          BOTTOM HORIZONTAL BAR: DETAILED TEAM PURSES
          ========================================= */}
      {/* Increased height to fit squad details */}
      <div className="absolute bottom-[64px] left-0 w-full h-[100px] bg-black/85 backdrop-blur-xl border-t border-white/20 z-40 flex items-center px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
        
        {/* Pinned Label */}
        <div className="shrink-0 flex flex-col items-center justify-center border-r border-white/10 pr-5 mr-3 z-20 bg-black/85 h-full">
          <Wallet size={24} className="text-teal-400 mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Purses</span>
        </div>

        {/* 🟢 Container limits width so marquee can scroll inside it */}
        <div className="flex-1 overflow-hidden h-full relative">
          <div 
            className={`h-full flex items-center gap-3 purse-marquee ${needsPurseScroll ? "scrolling" : "justify-center"}`}
            style={{ animationDuration: `${teams.length * 6}s` }} // Slower, dynamic speed based on team count
          >
            {displayTeams.map((team, index) => {
              const remaining = (team.purse || 0) - (team.spent || 0);
              const rosterCount = team.roster?.length || 0;
              const needToBuy = Math.max(0, maxSquadSize - rosterCount);

              return (
                <div 
                  key={`${team.id}-${index}`} 
                  // 🟢 Wider box (320px) to comfortably hold squad data
                  className="shrink-0 w-[320px] h-[76px] bg-white/5 border border-white/10 rounded-xl flex items-center px-4 gap-4 shadow-md"
                >
                  {team.logoUrl ? (
                     <img src={team.logoUrl} className="w-12 h-12 rounded-full object-cover border border-white/20 shrink-0 bg-black/50 shadow-sm" alt="" />
                  ) : (
                     <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-sm"><Shield size={16} className="text-gray-400"/></div>
                  )}
                  
                  <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                    {/* Top Row: Name & Purse */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white truncate pr-2 leading-tight">{team.name}</span>
                      <span className="text-base font-mono font-black text-teal-400 drop-shadow-md leading-none shrink-0">
                        {formatCurrency(remaining)}
                      </span>
                    </div>

                    {/* Bottom Row: Squad Analytics */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/10">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1">
                        <Users size={10} className="text-gray-500"/>
                        Sold: <span className="text-white font-bold">{rosterCount}/{maxSquadSize}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        Need: <span className="text-amber-400 font-black text-xs">{needToBuy}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* =========================================
          BOTTOM TICKER: SOLD PLAYERS
          ========================================= */}
      <div className="absolute bottom-0 left-0 w-full h-[64px] border-t border-white/20 z-50 flex items-center overflow-hidden bg-black/90 backdrop-blur-2xl">
        <div className="absolute left-0 top-0 bottom-0 z-10 px-6 flex items-center justify-center font-black text-sm uppercase tracking-widest shadow-[15px_0_20px_rgba(0,0,0,0.9)] bg-gray-900 text-teal-400 border-r border-white/20">
          <Tag size={18} className="mr-3" /> Sold Players
        </div>

        {soldPlayers.length > 0 ? (
          <div className="ticker-track pl-[250px] gap-16 items-center h-full">
            {soldPlayers.map((player, idx) => (
              <div key={idx} className="flex items-center gap-3 shrink-0">
                <span className="font-black text-xl uppercase tracking-wider text-white">
                  {player.name}
                </span>
                <span className="text-sm font-bold uppercase text-gray-400">
                  ({player.team})
                </span>
                <span className="text-teal-400 font-mono font-black text-xl ml-2 drop-shadow-md">
                  {formatCurrency(player.price)}
                </span>
                <span className="w-2 h-2 rounded-full bg-gray-500/50 ml-12"></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full flex items-center h-full pl-[250px]">
            <span className="font-bold text-sm uppercase tracking-widest text-gray-500 italic">No players sold yet. Awaiting first bid...</span>
          </div>
        )}
      </div>

    </div>
  );
}