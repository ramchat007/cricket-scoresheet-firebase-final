import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth"; 
import {
  subscribeAuctionState,
  startBidding,
  placeBid,
  markSold,
  markUnsold,
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

  // Access Control State
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  const [filterRole, setFilterRole] = useState("All");
  const [queueTab, setQueueTab] = useState("upcoming");
  const [showAdmin, setShowAdmin] = useState(false);

  // --- 1. CHECK PERMISSIONS ---
  useEffect(() => {
    if (!user || !tournamentConfig) {
      setHasAdminAccess(false);
      return;
    }
    const isOwner = tournamentConfig.ownerId === user.uid || tournamentConfig.createdBy === user.uid;
    const isAdmin = Array.isArray(tournamentConfig.admins) && tournamentConfig.admins.includes(user.uid);
    setHasAdminAccess(isOwner || isAdmin);
  }, [user, tournamentConfig]);

  useEffect(() => {
    // Fetch Tournament Config
    getDoc(doc(db, "tournaments", tournamentId)).then(s => setTournamentConfig(s.data()));

    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);

    const unsubSlots = onSnapshot(collection(db, "tournaments", tournamentId, "auction_slots"), (snap) => {
        setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.order - b.order));
    });

    const unsubTeams = onSnapshot(query(collection(db, "tournaments", tournamentId, "teams")), (snapshot) => {
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

    const unsubPlayers = onSnapshot(query(collection(db, "tournaments", tournamentId, "auctionPlayers")), (snapshot) => {
      const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllPlayers(players);
    });

    return () => {
      unsubState?.(); unsubTeams?.(); unsubPlayers?.(); unsubSlots?.();
    };
  }, [tournamentId]);

  // --- Logic for Dynamic Slots ---
  const activeSlotId = auctionState?.activeSlotId;
  const currentSlotPlayers = allPlayers.filter(p => p.auctionSlotId === activeSlotId);
  const upcomingInSlot = currentSlotPlayers.filter(p => p.status === "PENDING");
  
  const soldPlayers = allPlayers.filter((p) => p.status === "SOLD");
  const unsoldPlayers = allPlayers.filter((p) => p.status === "UNSOLD" || p.status === "UNSOLD_PASSED");

  const startNextInSlot = () => {
    if (!hasAdminAccess) return;
    if (upcomingInSlot.length === 0) return alert("No players left in this slot!");
    const nextPlayer = upcomingInSlot.sort((a,b) => (a.order || 0) - (b.order || 0))[0];
    startBidding(tournamentId, nextPlayer);
  };

  const calculateNextBid = (current) => {
    const inc = tournamentConfig?.bidIncrement || (current < 1000 ? 100 : current < 5000 ? 200 : 500);
    return current + inc;
  };

  const isLive = auctionState?.status === "LIVE";
  const currentPlayer = auctionState?.currentPlayer;
  const nextBidAmount = isLive ? calculateNextBid(auctionState.currentBid) : 0;

  // --- SUB-RENDER: STAGE ---
  const renderStage = () => {
    if (!isLive || !currentPlayer) {
      return (
        <div className="bg-[#1C2128]/50 border-2 border-dashed border-white/5 rounded-[2rem] p-8 mb-8 text-center flex flex-col items-center justify-center min-h-[350px]">
          {hasAdminAccess ? (
            <>
              <div className="flex gap-4 mb-6 w-full max-w-md">
                <div className="flex-1 text-left">
                    <label className="text-[10px] text-slate-500 font-black uppercase block mb-2 tracking-widest">Select Auction Slot</label>
                    <select 
                        className="w-full bg-[#0F1115] text-slate-200 p-4 rounded-xl border border-white/10 outline-none focus:border-teal-500/50 font-bold"
                        value={activeSlotId || ""}
                        onChange={(e) => updateDoc(doc(db, "tournaments", tournamentId, "auction", "state"), { activeSlotId: e.target.value })}
                    >
                        <option value="">-- Choose Slot --</option>
                        {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
              </div>
              
              <h2 className="text-xl font-black text-slate-300 mb-2 uppercase tracking-tight italic">
                {activeSlotId ? `Slot: ${slots.find(s => s.id === activeSlotId)?.name}` : "Waiting for slot selection..."}
              </h2>
              <p className="text-slate-500 mb-8 text-sm font-medium">
                {upcomingInSlot.length} players pending in this round.
              </p>
              <button
                onClick={startNextInSlot}
                disabled={!activeSlotId || upcomingInSlot.length === 0}
                className="bg-gradient-to-r from-teal-600 to-teal-700 text-white font-black uppercase tracking-widest text-sm py-4 px-10 rounded-xl disabled:opacity-20 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-teal-900/20"
              >
                Start Next Player
              </button>
            </>
          ) : (
            <div className="text-center">
                <div className="text-4xl mb-4 grayscale opacity-50">⏸️</div>
                <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">Auction Paused</h2>
                <p className="text-slate-600 mt-2 text-sm">Waiting for admin to start the next round.</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-8 mb-8 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 to-indigo-500 animate-pulse"></div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-10">
          <div className="relative">
             <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-indigo-500/20 rounded-full blur-xl transform scale-110"></div>
             <img
                src={currentPlayer.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                alt={currentPlayer.name}
                className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-[#0F1115] shadow-2xl relative z-10 bg-black"
             />
          </div>
          
          <div className="flex-1 text-left md:text-center">
            <div className="inline-block bg-[#0F1115] text-teal-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-4 py-1.5 rounded-full border border-teal-500/20 shadow-lg shadow-teal-900/20">
              {slots.find(s => s.id === activeSlotId)?.name || "Current Round"}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-100 mb-2 tracking-tighter uppercase italic">{currentPlayer.name}</h1>
            <p className="text-slate-500 uppercase mb-8 font-black tracking-widest text-xs flex items-center justify-center gap-2">
                {currentPlayer.role} 
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span> 
                Base: ₹{currentPlayer.basePrice}
            </p>
            
            <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
                <div className="bg-[#0F1115] p-5 rounded-2xl border border-white/5 min-w-[180px] text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Current Bid</div>
                    <div className="text-4xl font-mono font-bold text-teal-400">₹{auctionState.currentBid.toLocaleString()}</div>
                </div>
                <div className="bg-[#0F1115] p-5 rounded-2xl border border-white/5 min-w-[180px] text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Leading Team</div>
                    <div className="text-xl font-bold text-slate-200 max-w-[200px] truncate mx-auto">{auctionState.highestBidderName || "No Bids Yet"}</div>
                </div>
            </div>

            {hasAdminAccess && (
                <div className="flex gap-4 justify-center">
                <button onClick={() => markUnsold(tournamentId, currentPlayer.id)} className="bg-[#0F1115] hover:bg-white/5 text-slate-400 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest border border-white/10 transition-colors">Pass / Unsold</button>
                <button onClick={() => markSold(tournamentId)} disabled={!auctionState.highestBidderId} className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-12 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-900/30 disabled:opacity-20 transform active:scale-95 transition-all">SOLD 🔨</button>
                </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- SUB-RENDER: PLAYER QUEUE ---
  const renderQueue = () => {
    let displayList = [];
    if (queueTab === "upcoming") displayList = upcomingInSlot;
    if (queueTab === "sold") displayList = soldPlayers;
    if (queueTab === "unsold") displayList = unsoldPlayers;

    if (filterRole !== "All") {
      displayList = displayList.filter((p) => p.role === filterRole);
    }

    return (
      <div className="bg-[#1C2128] border border-white/5 rounded-[2rem] p-6 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex bg-[#0F1115] rounded-xl p-1 border border-white/5 overflow-x-auto no-scrollbar">
            <button onClick={() => setQueueTab("upcoming")} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${queueTab === "upcoming" ? "bg-[#1C2128] text-white shadow-md border border-white/10" : "text-slate-500 hover:text-slate-300"}`}>Upcoming</button>
            <button onClick={() => setQueueTab("sold")} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${queueTab === "sold" ? "bg-teal-900/20 text-teal-400 border border-teal-500/20" : "text-slate-500 hover:text-slate-300"}`}>Sold</button>
            <button onClick={() => setQueueTab("unsold")} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${queueTab === "unsold" ? "bg-red-900/20 text-red-400 border border-red-500/20" : "text-slate-500 hover:text-slate-300"}`}>Unsold</button>
          </div>
          <select className="bg-[#0F1115] text-slate-300 text-xs border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-teal-500/50 font-bold" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option>All</option><option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>Wicket Keeper</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {displayList.map((player) => (
            <div key={player.id} className="bg-[#0F1115] p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/10 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#161920] overflow-hidden border border-white/5">
                   <img src={player.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"} alt="" className="object-cover w-full h-full" />
                </div>
                <div>
                  <div className="font-bold text-slate-200 text-sm truncate max-w-[120px]">{player.name}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{player.role}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-mono font-bold ${player.status === 'SOLD' ? 'text-teal-400' : 'text-slate-400'}`}>₹{(player.status === 'SOLD' ? player.soldPrice : player.basePrice).toLocaleString()}</div>
                {player.status === 'SOLD' && <div className="text-[9px] text-slate-600 truncate max-w-[80px] font-bold uppercase mt-0.5">{teamsMap[player.teamId]}</div>}
              </div>
            </div>
          ))}
          {displayList.length === 0 && <div className="col-span-3 text-center py-16 text-slate-600 italic text-sm">No players found in this list.</div>}
        </div>
      </div>
    );
  };

  // --- SUB-RENDER: BIDDING CONSOLE ---
  const renderBidders = () => {
    return (
      <div className="mt-8 pb-20">
        <h3 className="text-slate-100 font-black text-lg mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
            Bidding Console
            <span className="text-[9px] bg-[#1C2128] text-teal-500 px-3 py-1 rounded-lg font-black border border-teal-500/20 uppercase not-italic tracking-widest">Smart Rules Active</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {teams.map((team) => {
            const minSquad = parseInt(tournamentConfig?.minSquadSize || 11);
            const minBase = parseInt(tournamentConfig?.minBasePrice || 100);
            const currentSquad = team.roster?.length || 0;
            const remainingPurse = (parseInt(team.purse || 0)) - (parseInt(team.spent || 0));

            // Mandatory Purse Reserve Rule
            const playersNeeded = Math.max(0, minSquad - (currentSquad + (isLive && auctionState.highestBidderId === team.id ? 0 : 1)));
            const reserveRequired = playersNeeded * minBase;
            const maxAllowedBid = remainingPurse - reserveRequired;

            const isHighest = team.id === auctionState?.highestBidderId;
            const canAfford = maxAllowedBid >= nextBidAmount;
            const isDisabled = !isLive || !canAfford || isHighest || (currentSquad >= (tournamentConfig?.maxSquadSize || 15));

            // Only Admin/Owner can place bids on behalf of teams in this view
            const interactable = hasAdminAccess && !isDisabled;

            return (
              <div key={team.id} className={`p-5 rounded-2xl border relative transition-all duration-300 group ${isHighest ? "bg-teal-900/10 border-teal-500 shadow-xl shadow-teal-900/20" : "bg-[#1C2128] border-white/5 hover:border-white/10"}`}>
                {isHighest && <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-teal-500 text-black text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg">Leading</div>}
                <div className="text-center mb-4 mt-2">
                  <div className="font-black text-slate-100 truncate text-sm uppercase tracking-tight italic">{team.name}</div>
                  <div className="text-[9px] text-slate-500 mt-1 font-bold uppercase tracking-wider">Limit: ₹{Math.max(0, maxAllowedBid).toLocaleString()}</div>
                  <div className={`text-xs font-mono font-bold mt-1 ${remainingPurse < reserveRequired ? "text-red-400" : "text-teal-400"}`}>₹{remainingPurse.toLocaleString()}</div>
                </div>
                
                {/* Bid Button - Only enabled for Admins */}
                {hasAdminAccess ? (
                    <button
                    disabled={!interactable}
                    onClick={() => placeBid(tournamentId, team.id, team.name, nextBidAmount)}
                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                        !interactable 
                        ? "bg-[#0F1115] text-slate-600 cursor-not-allowed border border-white/5" 
                        : "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white shadow-lg shadow-teal-900/20"
                    }`}
                    >
                    {isHighest ? "Highest Bidder" : `Bid ₹${nextBidAmount.toLocaleString()}`}
                    </button>
                ) : (
                    <div className="text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${isHighest ? "bg-teal-500/10 border-teal-500/20 text-teal-400" : "bg-[#0F1115] border-white/5 text-slate-600"}`}>
                            {isHighest ? "Current Leader" : "Waiting"}
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

  if (!auctionState) return (
    <div className="min-h-screen bg-[#0F1115] flex items-center justify-center">
        <div className="text-teal-500 animate-pulse font-black text-xl tracking-widest uppercase">Connecting to Auction...</div>
    </div>
  );

  return (
    // ✅ ADDED padding-top (pt-24) to account for fixed header
    <div className="min-h-screen bg-[#0F1115] px-4 pb-24 pt-24 font-sans text-slate-200">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <Link to={`/tournaments/${tournamentId}`} className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors group">
               <span className="group-hover:-translate-x-1 transition-transform">←</span> Dashboard
            </Link>
            
            {/* 🔒 Protected Admin Button */}
            {hasAdminAccess && (
                <button 
                    onClick={() => setShowAdmin(true)} 
                    className="bg-[#1C2128] hover:bg-white/5 px-5 py-3 rounded-xl font-black text-xs text-teal-400 border border-teal-500/20 hover:border-teal-500/40 transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-teal-900/10"
                >
                    ⚙️ Admin Setup
                </button>
            )}
        </div>
        
        {renderStage()}
        {renderQueue()}
        {renderBidders()}

        {/* 🔒 Protected Admin Panel (Double Check inside component too) */}
        {showAdmin && hasAdminAccess && (
          <AuctionAdminPanel
            tournamentId={tournamentId}
            onClose={() => setShowAdmin(false)}
          />
        )}
      </div>
    </div>
  );
}