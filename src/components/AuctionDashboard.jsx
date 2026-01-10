import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
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

  const [auctionState, setAuctionState] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamsMap, setTeamsMap] = useState({});
  const [slots, setSlots] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null);

  const [filterRole, setFilterRole] = useState("All");
  const [queueTab, setQueueTab] = useState("upcoming");
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    // Fetch Tournament Config for Rules (Squad limits/Purse reserve)
    getDoc(doc(db, "tournaments", tournamentId)).then(s => setTournamentConfig(s.data()));

    const unsubState = subscribeAuctionState(tournamentId, setAuctionState);

    // Sync Dynamic Slots
    const unsubSlots = onSnapshot(collection(db, "tournaments", tournamentId, "auction_slots"), (snap) => {
        setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.order - b.order));
    });

    // Sync Teams
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

    // Sync Auction Players
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

  // Logic to move sequentially in slot (Quality Rule 4)
  const startNextInSlot = () => {
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
        <div className="bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-2xl p-8 mb-8 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="flex gap-4 mb-6 w-full max-w-md">
            <div className="flex-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Select Auction Slot</label>
                <select 
                    className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-700 outline-none"
                    value={activeSlotId || ""}
                    onChange={(e) => updateDoc(doc(db, "tournaments", tournamentId, "auction", "state"), { activeSlotId: e.target.value })}
                >
                    <option value="">-- Choose Slot --</option>
                    {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-gray-400 mb-2">
            {activeSlotId ? `Slot: ${slots.find(s => s.id === activeSlotId)?.name}` : "Waiting for slot selection..."}
          </h2>
          <p className="text-gray-500 mb-6 text-sm">
            {upcomingInSlot.length} players pending in this round.
          </p>
          <button
            onClick={startNextInSlot}
            disabled={!activeSlotId || upcomingInSlot.length === 0}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-lg py-3 px-10 rounded-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
          >
            Start Next Player
          </button>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl p-6 mb-8 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600 animate-pulse"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8">
          <img
            src={currentPlayer.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
            alt={currentPlayer.name}
            className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-gray-800 shadow-2xl bg-gray-700"
          />
          <div className="flex-1">
            <div className="inline-block bg-cyan-900/30 text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-2 px-3 py-1 rounded border border-cyan-500/20">
              {slots.find(s => s.id === activeSlotId)?.name || "Current Round"}
            </div>
            <h1 className="text-4xl font-black text-white mb-2">{currentPlayer.name}</h1>
            <p className="text-gray-400 uppercase mb-6 font-bold">{currentPlayer.role} • Base: ₹{currentPlayer.basePrice}</p>
            
            <div className="flex justify-center gap-8 mb-8 bg-gray-950/30 p-4 rounded-xl border border-white/5">
                <div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Current Bid</div>
                    <div className="text-4xl font-mono font-bold text-green-400">₹{auctionState.currentBid.toLocaleString()}</div>
                </div>
                <div className="w-px bg-gray-700"></div>
                <div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Leading Team</div>
                    <div className="text-2xl font-bold text-white max-w-[200px] truncate">{auctionState.highestBidderName || "No Bids Yet"}</div>
                </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={() => markUnsold(tournamentId, currentPlayer.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-3 rounded-lg font-bold border border-gray-700 transition-colors">Pass / Unsold</button>
              <button onClick={() => markSold(tournamentId)} disabled={!auctionState.highestBidderId} className="bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-lg font-bold shadow-lg disabled:opacity-50 transform active:scale-95 transition-all">SOLD 🔨</button>
            </div>
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button onClick={() => setQueueTab("upcoming")} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${queueTab === "upcoming" ? "bg-gray-700 text-white" : "text-gray-400"}`}>Upcoming</button>
            <button onClick={() => setQueueTab("sold")} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${queueTab === "sold" ? "bg-green-600/20 text-green-500" : "text-gray-400"}`}>Sold</button>
            <button onClick={() => setQueueTab("unsold")} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${queueTab === "unsold" ? "bg-red-600/20 text-red-500" : "text-gray-400"}`}>Unsold</button>
          </div>
          <select className="bg-gray-800 text-white text-xs border border-gray-700 rounded px-3 py-1 outline-none focus:border-cyan-500" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option>All</option><option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>Wicket Keeper</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {displayList.map((player) => (
            <div key={player.id} className="bg-gray-800/60 p-3 rounded border border-gray-700 flex justify-between items-center group hover:border-gray-500 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600">
                   <img src={player.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"} alt="" className="object-cover w-full h-full" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm truncate max-w-[120px]">{player.name}</div>
                  <div className="text-[10px] text-gray-500 uppercase">{player.role}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-cyan-500">₹{(player.status === 'SOLD' ? player.soldPrice : player.basePrice).toLocaleString()}</div>
                {player.status === 'SOLD' && <div className="text-[9px] text-gray-500 truncate max-w-[80px]">{teamsMap[player.teamId]}</div>}
              </div>
            </div>
          ))}
          {displayList.length === 0 && <div className="col-span-3 text-center py-10 text-gray-600 italic">No players found in this list.</div>}
        </div>
      </div>
    );
  };

  // --- SUB-RENDER: BIDDING CONSOLE ---
  const renderBidders = () => {
    return (
      <div className="mt-8 pb-20">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            Bidding Hub 
            <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono border border-gray-700 uppercase">Constraint Rules Enabled</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {teams.map((team) => {
            const minSquad = parseInt(tournamentConfig?.minSquadSize || 11);
            const minBase = parseInt(tournamentConfig?.minBasePrice || 100);
            const currentSquad = team.roster?.length || 0;
            const remainingPurse = (parseInt(team.purse || 0)) - (parseInt(team.spent || 0));

            // Section 1 & 5: Mandatory Purse Reserve Rule
            const playersNeeded = Math.max(0, minSquad - (currentSquad + (isLive && auctionState.highestBidderId === team.id ? 0 : 1)));
            const reserveRequired = playersNeeded * minBase;
            const maxAllowedBid = remainingPurse - reserveRequired;

            const isHighest = team.id === auctionState?.highestBidderId;
            const canAfford = maxAllowedBid >= nextBidAmount;
            const isDisabled = !isLive || !canAfford || isHighest || (currentSquad >= (tournamentConfig?.maxSquadSize || 15));

            return (
              <div key={team.id} className={`p-4 rounded-xl border relative transition-all duration-300 ${isHighest ? "bg-cyan-900/20 border-cyan-500 scale-105 shadow-lg shadow-cyan-900/20" : "bg-gray-900 border-gray-800 hover:border-gray-700"}`}>
                {isHighest && <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-cyan-500 text-black text-[10px] px-3 py-0.5 rounded-full font-black shadow-sm">LEADING</div>}
                <div className="text-center mb-3">
                  <div className="font-bold text-white truncate text-sm">{team.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Safe Bid Limit: ₹{Math.max(0, maxAllowedBid).toLocaleString()}</div>
                  <div className={`text-xs font-mono mt-0.5 ${remainingPurse < reserveRequired ? "text-red-500" : "text-green-400"}`}>Purse: ₹{remainingPurse.toLocaleString()}</div>
                </div>
                <button
                  disabled={isDisabled}
                  onClick={() => placeBid(tournamentId, team.id, team.name, nextBidAmount)}
                  className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${isDisabled ? "bg-gray-800 text-gray-600 cursor-not-allowed border border-transparent" : "bg-green-600 hover:bg-green-500 text-white shadow-lg border border-green-500/50"}`}
                >
                  {isHighest ? "Leading..." : `Bid ₹${nextBidAmount.toLocaleString()}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!auctionState) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-500 animate-pulse font-black text-xl tracking-tighter uppercase">Initializing Auction Room...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-4 font-sans text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <Link to={`/tournaments/${tournamentId}`} className="text-gray-500 hover:text-white text-sm font-bold flex items-center gap-1 transition-colors">
                <span>←</span> Dashboard
            </Link>
            <button 
                onClick={() => setShowAdmin(true)} 
                className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-bold text-sm text-cyan-400 border border-gray-700 transition-all active:scale-95"
            >
                ⚙️ Admin Setup
            </button>
        </div>
        
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