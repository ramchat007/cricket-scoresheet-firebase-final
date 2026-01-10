import React, { useState, useEffect } from "react";
import {
  collection,
  updateDoc,
  doc,
  writeBatch,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  runTransaction,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";
import { useAuth } from "../hooks/useAuth"; // ✅ Added Auth Hook
import AuctionOwnersAdmin from "./AuctionOwnersAdmin";
import MatchScheduler from "./MatchScheduler";

// --- 1. GLOBAL PLAYER SEARCH MODAL ---
const GlobalPlayerPicker = ({ isOpen, onClose, onImport, existingIds }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listGlobalPlayers().then((data) => {
        const available = data.filter((p) => !existingIds.includes(p.id));
        setPlayers(available);
        setLoading(false);
      });
    } else {
      setSelected([]);
      setSearch("");
    }
  }, [isOpen, existingIds]);

  const toggleSelect = (p) => {
    if (selected.find((s) => s.id === p.id)) {
      setSelected((prev) => prev.filter((x) => x.id !== p.id));
    } else {
      setSelected((prev) => [...prev, p]);
    }
  };

  if (!isOpen) return null;

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F1115]/95 p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#1C2128] border border-white/10 w-full max-w-lg rounded-3xl flex flex-col max-h-[80vh] shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1C2128]">
          <div>
             <h3 className="text-slate-100 font-black uppercase tracking-tight text-lg italic">Global Database</h3>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select players to import</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
        <div className="p-4 border-b border-white/5 bg-[#161920]">
          <input
            className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:border-teal-500/50 outline-none transition-all font-bold placeholder:text-slate-600"
            placeholder="Search name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          {loading ? (
            <div className="text-center py-10 text-teal-500 animate-pulse font-black text-xs uppercase tracking-widest">Loading Database...</div>
          ) : (
            filtered.map((p) => {
              const isSel = selected.find((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    isSel ? "bg-teal-500/10 border-teal-500/50" : "bg-[#0F1115] border-white/5 hover:border-white/20"
                  }`}>
                  <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isSel ? 'bg-teal-500 text-black' : 'bg-white/5 text-slate-500'}`}>
                        {p.name.charAt(0)}
                     </div>
                     <div>
                        <div className={`text-sm font-bold ${isSel ? 'text-teal-400' : 'text-slate-200'}`}>{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{p.role}</div>
                     </div>
                  </div>
                  {isSel && <div className="text-teal-400 font-black text-lg">✓</div>}
                </div>
              );
            })
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-sm italic">No available players found.</div>
          )}
        </div>
        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-[#161920] rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-3 text-slate-500 text-xs font-black uppercase tracking-widest border border-transparent hover:border-white/10 rounded-xl transition-all">Cancel</button>
          <button
            onClick={() => onImport(selected)}
            disabled={selected.length === 0}
            className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-20 transition-all shadow-lg shadow-teal-900/20 active:scale-95">
            Import {selected.length} Players
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 3. MAIN SETUP PANEL ---
export default function AuctionAdminPanel({ tournamentId, onClose }) {
  const { user } = useAuth(); // ✅ Hook for current user
  
  const [tab, setTab] = useState("pool");
  const [poolFilter, setPoolFilter] = useState("PENDING");

  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]); 
  const [newSlotName, setNewSlotName] = useState(""); 
  const [config, setConfig] = useState({
    minSquadSize: 11, maxSquadSize: 15, minBasePrice: 500, bidIncrement: 100
  });

  const [showPicker, setShowPicker] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // ✅ NEW: Access Control State
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // --- 1. VERIFY PERMISSIONS ---
  useEffect(() => {
    async function checkPermission() {
      if (!user) {
        setHasAccess(false);
        setCheckingAccess(false);
        return;
      }
      try {
        const docRef = doc(db, "tournaments", tournamentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Check Owner OR Admin list
          const isOwner = data.ownerId === user.uid || data.createdBy === user.uid;
          const isAdmin = Array.isArray(data.admins) && data.admins.includes(user.uid);
          
          if (isOwner || isAdmin) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        }
      } catch (e) {
        console.error("Access check failed", e);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    }
    checkPermission();
  }, [user, tournamentId]);

  // --- 2. REAL-TIME DATA FETCHING (Only if Access Granted) ---
  useEffect(() => {
    if (!hasAccess) return; // 🔒 Stop listening if no access

    const pRef = collection(db, "tournaments", tournamentId, "auctionPlayers");
    const qPool = query(pRef, orderBy("name"));
    const unsubPool = onSnapshot(qPool, (snap) => {
      setAuctionPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const tRef = collection(db, "tournaments", tournamentId, "teams");
    const unsubTeams = onSnapshot(tRef, (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const sRef = collection(db, "tournaments", tournamentId, "auction_slots");
    const qSlots = query(sRef, orderBy("order"));
    const unsubSlots = onSnapshot(qSlots, (snap) => {
      setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, "tournaments", tournamentId));
      if (snap.exists()) setConfig(snap.data());
    };
    fetchConfig();

    return () => {
      unsubPool();
      unsubTeams();
      unsubSlots();
    };
  }, [tournamentId, hasAccess]);

  // --- ACTIONS ---
  const handleUpdateConfig = async () => {
    if(!hasAccess) return;
    try {
      await updateDoc(doc(db, "tournaments", tournamentId), {
        minSquadSize: Number(config.minSquadSize),
        maxSquadSize: Number(config.maxSquadSize),
        minBasePrice: Number(config.minBasePrice),
        bidIncrement: Number(config.bidIncrement)
      });
      alert("Configuration updated successfully!");
    } catch (e) {
      alert("Error updating rules: " + e.message);
    }
  };

  const handleCreateSlot = async () => {
    if (!newSlotName || !tournamentId || !hasAccess) return;
    try {
      const slotsColRef = collection(db, "tournaments", tournamentId, "auction_slots");
      await addDoc(slotsColRef, { name: newSlotName.trim(), order: slots.length + 1, status: 'pending', createdAt: Date.now() });
      setNewSlotName("");
    } catch (e) { alert("Error creating slot: " + e.message); }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!hasAccess) return;
    if (!window.confirm("Delete this slot?")) return;
    await deleteDoc(doc(db, "tournaments", tournamentId, "auction_slots", slotId));
  };

  const handleAssignToSlot = async (playerId, slotId) => {
    if (!hasAccess) return;
    const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
    await updateDoc(ref, { auctionSlotId: slotId });
  };

  const handleImport = async (selectedGlobalPlayers) => {
    if (!hasAccess) return;
    const batch = writeBatch(db);
    const colRef = collection(db, "tournaments", tournamentId, "auctionPlayers");
    selectedGlobalPlayers.forEach((p) => {
      const newRef = doc(colRef);
      batch.set(newRef, {
        originalPlayerId: p.id, name: p.name, role: p.role || "All-Rounder",
        mobile: p.mobile || "", photoURL: p.photoURL || "", basePrice: 500,
        status: "PENDING", soldPrice: 0, teamId: null, isOwner: false, isIcon: false, auctionSlotId: null,
        statsSnapshot: { runs: p.stats?.runs || 0, wickets: p.stats?.wickets || 0, matches: p.stats?.matches || 0 },
      });
    });
    await batch.commit();
    setShowPicker(false);
  };

  const updateBasePrice = async (playerId, newPrice) => {
    if (!hasAccess) return;
    const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
    const price = parseInt(newPrice);
    await updateDoc(ref, { basePrice: isNaN(price) ? 0 : price });
  };

  const toggleIconStatus = async (playerId, currentStatus) => {
    if (!hasAccess) return;
    const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
    await updateDoc(ref, { isIcon: !currentStatus });
  };

  const deletePlayer = async (playerId) => {
    if (!hasAccess) return;
    if (!window.confirm("Remove player?")) return;
    await deleteDoc(doc(db, "tournaments", tournamentId, "auctionPlayers", playerId));
  };

  const reAddPlayer = async (playerId) => {
    if (!hasAccess) return;
    if (!window.confirm("Reset to PENDING?")) return;
    try {
      await runTransaction(db, async (transaction) => {
        const playerRef = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
        const playerSnap = await transaction.get(playerRef);
        if (!playerSnap.exists()) throw new Error("Player not found!");
        const playerData = playerSnap.data();

        if (playerData.status === "SOLD" && playerData.teamId) {
          const teamRef = doc(db, "tournaments", tournamentId, "teams", playerData.teamId);
          const teamSnap = await transaction.get(teamRef);
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            const currentSpent = Number(teamData.spent) || 0;
            const refundAmount = Number(playerData.soldPrice) || 0;
            const newSpent = Math.max(0, currentSpent - refundAmount);
            const currentRoster = Array.isArray(teamData.roster) ? teamData.roster : [];
            const newRoster = currentRoster.filter((p) => p.id !== playerId);
            transaction.update(teamRef, { spent: newSpent, roster: newRoster });
          }
        }
        transaction.update(playerRef, { status: "PENDING", soldPrice: 0, teamId: null });
      });
    } catch (e) { alert("Failed to reset player: " + e.message); }
  };

  const updateTeamPurse = async (teamId, newPurse) => {
    if (!hasAccess) return;
    const ref = doc(db, "tournaments", tournamentId, "teams", teamId);
    const purseVal = parseInt(newPurse);
    await updateDoc(ref, { purse: isNaN(purseVal) ? 0 : purseVal });
  };

  const handleReset = async () => {
    if (!hasAccess) return;
    if (!window.confirm("⚠ DANGER: DELETE ALL Auction Data & Teams? Cannot be undone.")) return;
    setIsResetting(true);
    try {
      let batch = writeBatch(db);
      let opCount = 0;
      const poolSnap = await getDocs(collection(db, "tournaments", tournamentId, "auctionPlayers"));
      poolSnap.docs.forEach((doc) => { batch.delete(doc.ref); opCount++; });
      const sSnap = await getDocs(collection(db, "tournaments", tournamentId, "auction_slots"));
      sSnap.docs.forEach((doc) => { batch.delete(doc.ref); opCount++; });
      batch.delete(doc(db, "tournaments", tournamentId, "auction", "state"));
      const teamSnap = await getDocs(collection(db, "tournaments", tournamentId, "teams"));
      teamSnap.docs.forEach((doc) => { batch.delete(doc.ref); opCount++; });
      const matchSnap = await getDocs(collection(db, "tournaments", tournamentId, "matches"));
      matchSnap.docs.forEach((doc) => { batch.delete(doc.ref); opCount++; });
      await batch.commit();
      onClose();
      window.location.reload();
    } catch (e) { alert("Error: " + e.message); } finally { setIsResetting(false); }
  };

  const displayList = auctionPlayers.filter((p) => {
    if (poolFilter === "SOLD") return p.status === "SOLD";
    if (poolFilter === "UNSOLD") return p.status === "UNSOLD" || p.status === "UNSOLD_PASSED";
    return p.status === "PENDING";
  });

  const navBtnClass = (tId) => `flex-1 min-w-[90px] py-4 text-[10px] font-black uppercase tracking-wider transition-all duration-200 border-b-2 ${
    tab === tId ? "text-teal-400 border-teal-400 bg-teal-500/5" : "text-slate-500 border-transparent hover:text-white"
  }`;

  // --- ACCESS DENIED UI ---
  if (checkingAccess) return <div className="fixed inset-0 z-50 bg-[#0F1115] flex items-center justify-center text-teal-500 font-bold animate-pulse">Verifying Access...</div>;
  
  if (!hasAccess) return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/95 backdrop-blur-xl flex items-center justify-center p-6">
       <div className="bg-[#1C2128] border border-red-500/20 p-8 rounded-3xl text-center max-w-sm w-full shadow-2xl">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-slate-100 font-black uppercase tracking-wider mb-2">Access Denied</h2>
          <p className="text-slate-500 text-xs font-medium mb-6 leading-relaxed">
             You do not have permission to access the Auction Admin settings for this tournament.
          </p>
          <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all uppercase text-xs tracking-widest">Close Panel</button>
       </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#0F1115] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
        <GlobalPlayerPicker isOpen={showPicker} onClose={() => setShowPicker(false)} onImport={handleImport} existingIds={auctionPlayers.map((p) => p.originalPlayerId)} />

      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#1C2128] shadow-xl">
        <h2 className="text-lg font-black text-slate-100 flex items-center gap-3 uppercase tracking-tighter italic">
          <span className="bg-teal-600 p-1.5 rounded-lg text-sm">⚙️</span> Auction Setup
        </h2>
        <button onClick={onClose} className="bg-white/5 hover:bg-white/10 text-slate-300 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">Close</button>
      </div>

      <div className="flex border-b border-white/5 bg-[#161920] overflow-x-auto no-scrollbar">
        <button onClick={() => setTab("pool")} className={navBtnClass("pool")}>Players</button>
        <button onClick={() => setTab("slots")} className={navBtnClass("slots")}>Slots</button>
        <button onClick={() => setTab("config")} className={navBtnClass("config")}>Rules</button>
        <button onClick={() => setTab("teams")} className={navBtnClass("teams")}>Wallets</button>
        <button onClick={() => setTab("owners")} className={navBtnClass("owners")}>Owners</button>
        <button onClick={() => setTab("matches")} className={navBtnClass("matches")}>Matches</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* --- TAB: CONFIG / RULES --- */}
        {tab === "config" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
             <div className="bg-[#1C2128] border border-white/5 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                <h3 className="text-slate-100 font-black uppercase tracking-widest text-xs mb-8 border-b border-white/5 pb-4">Auction Logic Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                        { label: "Minimum Players Per Team", val: config.minSquadSize, key: "minSquadSize", hint: "Teams must fill this count to finish." },
                        { label: "Maximum Players Per Team", val: config.maxSquadSize, key: "maxSquadSize" },
                        { label: "Base Price Slab", val: config.minBasePrice, key: "minBasePrice", hint: "System blocks bids limiting reserve." },
                        { label: "Default Bid Increment", val: config.bidIncrement, key: "bidIncrement" }
                    ].map((item, idx) => (
                        <div key={idx} className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase block ml-1 tracking-widest">{item.label}</label>
                            <input type="number" 
                                className="w-full bg-[#0F1115] border border-white/10 rounded-xl p-4 text-slate-200 focus:border-teal-500/50 outline-none transition-all font-bold" 
                                value={item.val} 
                                onChange={e => setConfig({...config, [item.key]: e.target.value})} 
                            />
                            {item.hint && <p className="text-[10px] text-slate-600 italic px-1">{item.hint}</p>}
                        </div>
                    ))}
                </div>
                <button onClick={handleUpdateConfig} className="mt-12 w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-black uppercase tracking-widest py-5 rounded-xl shadow-lg transition-all transform active:scale-[0.99] text-xs">Update Mandatory Rules</button>
             </div>
          </div>
        )}

        {/* --- TAB: AUCTION SLOTS --- */}
        {tab === "slots" && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="bg-[#1C2128] border border-white/5 p-6 rounded-[2rem] shadow-lg">
                <h3 className="text-slate-300 font-black mb-4 uppercase text-xs tracking-widest">Create New Auction Round</h3>
                <div className="flex gap-3">
                    <input className="flex-1 bg-[#0F1115] border border-white/10 rounded-xl px-5 py-3 text-slate-200 outline-none focus:border-orange-500/50 font-bold placeholder:text-slate-600" 
                           placeholder="e.g. Round 1 - Icon Players" 
                           value={newSlotName} 
                           onChange={e => setNewSlotName(e.target.value)} />
                    <button onClick={handleCreateSlot} className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-2 rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-lg shadow-orange-900/20">Add Round</button>
                </div>
             </div>
             <div className="grid gap-3">
                {slots.map(s => (
                    <div key={s.id} className="bg-[#1C2128] border border-white/5 p-4 rounded-xl flex justify-between items-center group hover:border-white/10 transition-all">
                        <div className="flex items-center">
                           <span className="text-slate-600 font-mono mr-4 text-xs font-bold">{s.order}.</span>
                           <span className="text-slate-200 font-bold text-sm tracking-tight">{s.name}</span>
                        </div>
                        <button onClick={() => handleDeleteSlot(s.id)} className="text-slate-600 hover:text-red-500 transition-colors p-2 bg-[#0F1115] rounded-lg">🗑</button>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* --- TAB: PLAYER POOL --- */}
        {tab === "pool" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center gap-4">
              <div className="flex bg-[#161920] rounded-xl p-1 border border-white/5 overflow-x-auto no-scrollbar">
                {["PENDING", "SOLD", "UNSOLD"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPoolFilter(filter)}
                    className={`px-5 py-2.5 rounded-lg text-[10px] font-black transition-all uppercase whitespace-nowrap ${
                      poolFilter === filter ? "bg-[#0F1115] text-white shadow-md border border-white/10" : "text-slate-500 hover:text-slate-300"
                    }`}>
                    {filter}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="bg-teal-900/10 border border-teal-500/20 text-teal-400 px-6 py-3 rounded-xl font-black text-xs uppercase hover:bg-teal-900/20 hover:border-teal-500/40 transition-all active:scale-95 whitespace-nowrap">
                + Add Players
              </button>
            </div>

            <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-sm text-slate-400 min-w-[800px]">
                <thead className="bg-[#0F1115] text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] border-b border-white/5">
                  <tr><th className="p-5">Name</th><th className="p-5">Role</th><th className="p-5">Assign Slot</th><th className="p-5">{poolFilter === "SOLD" ? "Final Price" : "Base Price"}</th><th className="p-5 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayList.map((p) => (
                    <tr key={p.id} className="hover:bg-[#0F1115]/50 transition-colors group">
                      <td className="p-5 font-bold text-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {p.isOwner && <span className="text-[8px] bg-purple-900/40 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded uppercase font-black tracking-wider">Owner</span>}
                          {p.isIcon && <span className="text-[8px] bg-amber-900/30 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded uppercase font-black tracking-wider">Icon</span>}
                        </div>
                      </td>
                      <td className="p-5 text-xs text-slate-500 font-bold uppercase tracking-wider">{p.role}</td>
                      <td className="p-5">
                        <select 
                            className="bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 focus:border-orange-500/50 outline-none w-full max-w-[160px] font-bold cursor-pointer"
                            value={p.auctionSlotId || ""}
                            onChange={(e) => handleAssignToSlot(p.id, e.target.value)}
                        >
                            <option value="">-- Unassigned --</option>
                            {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="p-5 font-mono">
                        {poolFilter === "SOLD" ? (
                          <span className="text-green-400 font-bold text-sm">₹{p.soldPrice?.toLocaleString()}</span>
                        ) : (
                          <div className="flex items-center gap-2 text-xs">
                             <span className="text-slate-600">₹</span>
                             <input type="number" className="bg-[#0F1115] border border-white/10 rounded-lg px-2 py-1.5 w-24 text-slate-200 focus:border-teal-500/50 outline-none font-bold" 
                                    value={p.basePrice} onChange={(e) => updateBasePrice(p.id, e.target.value)} />
                          </div>
                        )}
                      </td>
                      <td className="p-5 text-right flex justify-end gap-3 items-center">
                        <button onClick={() => toggleIconStatus(p.id, p.isIcon)} className={`text-lg transition-all transform active:scale-110 hover:scale-110 ${p.isIcon ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-slate-700 hover:text-slate-500"}`}>★</button>
                        {(poolFilter === "UNSOLD" || poolFilter === "SOLD") && (
                          <button onClick={() => reAddPlayer(p.id)} className="bg-teal-900/20 text-teal-400 border border-teal-500/20 hover:bg-teal-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all tracking-widest">↺ Reset</button>
                        )}
                        <button onClick={() => deletePlayer(p.id)} className="text-slate-700 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-900/10">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayList.length === 0 && <div className="p-20 text-center text-slate-600 italic text-sm font-medium">No players found in {poolFilter} list.</div>}
            </div>
          </div>
        )}

        {/* --- TAB: TEAM WALLETS --- */}
        {tab === "teams" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {teams.map((t) => {
              const purse = Number(t.purse) || 0;
              const spent = Number(t.spent) || 0;
              const remaining = purse - spent;
              const percentUsed = purse > 0 ? (spent / purse) * 100 : 0;
              return (
                <div key={t.id} className="bg-[#1C2128] border border-white/5 p-6 rounded-[2rem] flex flex-col gap-5 shadow-xl hover:border-white/10 transition-all group">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-slate-100 text-xl tracking-tighter uppercase italic group-hover:text-teal-400 transition-colors">{t.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1 font-black uppercase tracking-[0.2em]">Squad: {t.roster?.length || 0} Members</div>
                    </div>
                    <div className="text-right">
                      <label className="text-[9px] text-slate-600 font-black uppercase block tracking-widest mb-1">Remaining</label>
                      <div className={`text-2xl font-mono font-black ${remaining < 1000 ? "text-red-400" : "text-white"}`}>₹{remaining.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-[#0F1115] rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full rounded-full transition-all duration-1000 ${remaining < (config.minSquadSize * config.minBasePrice) ? "bg-red-500" : "bg-teal-500"}`}
                         style={{ width: `${Math.min(percentUsed, 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Total Purse: <span className="text-teal-500">₹{purse.toLocaleString()}</span></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Edit</span>
                        <input type="number" className="bg-[#0F1115] border border-white/10 rounded-lg px-3 py-1.5 w-24 text-slate-200 text-right text-xs focus:border-teal-500/50 outline-none font-bold"
                               value={t.purse || 0} onChange={(e) => updateTeamPurse(t.id, e.target.value)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- TAB: OWNERS --- */}
        {tab === "owners" && (
          <div className="animate-in fade-in duration-300"><AuctionOwnersAdmin tournamentId={tournamentId} /></div>
        )}

        {/* --- TAB: MATCHES --- */}
        {tab === "matches" && (
          <div className="animate-in fade-in duration-300"><MatchScheduler tournamentId={tournamentId} teams={teams} /></div>
        )}

        {/* --- DANGER ZONE --- */}
        <div className="mt-20 border-t border-red-500/10 pt-10 mb-10">
          <div className="bg-red-900/5 border border-red-500/20 rounded-[2rem] p-8 flex flex-col md:flex-row justify-between items-center gap-8 shadow-inner">
            <div className="text-center md:text-left">
              <h4 className="text-red-500 font-black uppercase text-xs italic tracking-widest mb-2 flex items-center justify-center md:justify-start gap-2">
                  <span>⚠</span> Emergency Data Wipe
              </h4>
              <p className="text-red-400/50 text-[11px] max-w-md leading-relaxed font-medium">
                This will purge <strong className="text-red-400">ALL</strong> tournament metadata. This action is irreversible.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-8 rounded-xl shadow-xl whitespace-nowrap transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px] border border-red-400/20">
              {isResetting ? "Purging Files..." : "Destroy Auction Data"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}