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
  getDoc, // ✅ Added for fetching tournament config
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";
import AuctionOwnersAdmin from "./AuctionOwnersAdmin";
import MatchScheduler from "./MatchScheduler"; // ✅ Import reused component

// --- 1. GLOBAL PLAYER SEARCH MODAL (FULL ORIGINAL CODE RESTORED) ---
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-white font-bold uppercase tracking-tight">Select Players from Global DB</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>
        <div className="p-4 border-b border-gray-800">
          <input
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
            placeholder="Search name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center py-10 text-cyan-500 animate-pulse">Loading Database...</div>
          ) : (
            filtered.map((p) => {
              const isSel = selected.find((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 transition-all ${
                    isSel ? "bg-cyan-900/30 border border-cyan-500/50" : "hover:bg-gray-800 border border-transparent"
                  }`}>
                  <div className="text-white font-bold text-sm">
                    {p.name}{" "}<span className="text-gray-500 font-normal text-xs ml-2">({p.role})</span>
                  </div>
                  {isSel && <div className="text-cyan-400">✓</div>}
                </div>
              );
            })
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm italic">No available players found.</div>
          )}
        </div>
        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 text-sm font-bold">Cancel</button>
          <button
            onClick={() => onImport(selected)}
            disabled={selected.length === 0}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-50 transition-all">
            Import {selected.length} Players
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 3. MAIN SETUP PANEL ---
export default function AuctionAdminPanel({ tournamentId, onClose }) {
  const [tab, setTab] = useState("pool");
  const [poolFilter, setPoolFilter] = useState("PENDING");

  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]); 
  const [newSlotName, setNewSlotName] = useState(""); 
  
  // ✅ NEW: Tournament Config State
  const [config, setConfig] = useState({
    minSquadSize: 11,
    maxSquadSize: 15,
    minBasePrice: 500,
    bidIncrement: 100
  });

  const [teamsMap, setTeamsMap] = useState({});
  const [showPicker, setShowPicker] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // --- REAL-TIME DATA FETCHING ---
  useEffect(() => {
    // 1. Players
    const pRef = collection(db, "tournaments", tournamentId, "auctionPlayers");
    const qPool = query(pRef, orderBy("name"));
    const unsubPool = onSnapshot(qPool, (snap) => {
      setAuctionPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 2. Teams
    const tRef = collection(db, "tournaments", tournamentId, "teams");
    const unsubTeams = onSnapshot(tRef, (snap) => {
      const tList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(tList);
      const map = {};
      tList.forEach((t) => (map[t.id] = t.name));
      setTeamsMap(map);
    });

    // 3. Auction Slots Sync ✅
    const sRef = collection(db, "tournaments", tournamentId, "auction_slots");
    const qSlots = query(sRef, orderBy("order"));
    const unsubSlots = onSnapshot(qSlots, (snap) => {
      setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Config Fetch ✅
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
  }, [tournamentId]);

  // --- ACTIONS ---

  // ✅ NEW: Update Auction Config Action
  const handleUpdateConfig = async () => {
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
    if (!newSlotName || !tournamentId) return;
    try {
      const slotsColRef = collection(db, "tournaments", tournamentId, "auction_slots");
      await addDoc(slotsColRef, {
        name: newSlotName.trim(),
        order: slots.length + 1,
        status: 'pending',
        createdAt: Date.now()
      });
      setNewSlotName("");
    } catch (e) {
      console.error("Permission Error:", e);
      alert("Error creating slot: " + e.message); 
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm("Delete this slot? Players in this slot will be unassigned.")) return;
    await deleteDoc(doc(db, "tournaments", tournamentId, "auction_slots", slotId));
  };

  const handleAssignToSlot = async (playerId, slotId) => {
    const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
    await updateDoc(ref, { auctionSlotId: slotId });
  };

  const handleImport = async (selectedGlobalPlayers) => {
    const batch = writeBatch(db);
    const colRef = collection(db, "tournaments", tournamentId, "auctionPlayers");
    selectedGlobalPlayers.forEach((p) => {
      const newRef = doc(colRef);
      batch.set(newRef, {
        originalPlayerId: p.id,
        name: p.name,
        role: p.role || "All-Rounder",
        mobile: p.mobile || "",
        photoURL: p.photoURL || "",
        basePrice: 500,
        status: "PENDING",
        soldPrice: 0,
        teamId: null,
        isOwner: false,
        isIcon: false,
        auctionSlotId: null,
        statsSnapshot: {
          runs: p.stats?.runs || 0,
          wickets: p.stats?.wickets || 0,
          matches: p.stats?.matches || 0,
        },
      });
    });
    await batch.commit();
    setShowPicker(false);
  };

  const updateBasePrice = async (playerId, newPrice) => {
    const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
    const price = parseInt(newPrice);
    await updateDoc(ref, { basePrice: isNaN(price) ? 0 : price });
  };

  const toggleIconStatus = async (playerId, currentStatus) => {
    const ref = doc(db, "tournaments", tournamentId, "auctionPlayers", playerId);
    await updateDoc(ref, { isIcon: !currentStatus });
  };

  const deletePlayer = async (playerId) => {
    if (!window.confirm("Remove player? This cannot be undone.")) return;
    await deleteDoc(doc(db, "tournaments", tournamentId, "auctionPlayers", playerId));
  };

  const reAddPlayer = async (playerId) => {
    if (!window.confirm("Reset to PENDING? Refunds purse & updates squad.")) return;
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
    const ref = doc(db, "tournaments", tournamentId, "teams", teamId);
    const purseVal = parseInt(newPurse);
    await updateDoc(ref, { purse: isNaN(purseVal) ? 0 : purseVal });
  };

  const handleReset = async () => {
    if (!window.confirm("⚠ DANGER: DELETE ALL Auction Data & Teams? Cannot be undone.")) return;
    setIsResetting(true);
    try {
      const batchSize = 500;
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

  const navBtnClass = (tId) => `flex-1 min-w-[100px] py-4 text-xs font-black uppercase tracking-wider transition-all duration-200 ${
    tab === tId ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5" : "text-gray-500 hover:text-white"
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
      <GlobalPlayerPicker isOpen={showPicker} onClose={() => setShowPicker(false)} onImport={handleImport} existingIds={auctionPlayers.map((p) => p.originalPlayerId)} />

      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 shadow-xl">
        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tighter italic">
          <span className="bg-cyan-600 p-1 rounded-md">⚙️</span> Auction Setup
        </h2>
        <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all">Close</button>
      </div>

      <div className="flex border-b border-gray-800 bg-gray-900 overflow-x-auto no-scrollbar">
        <button onClick={() => setTab("pool")} className={navBtnClass("pool")}>Players</button>
        <button onClick={() => setTab("slots")} className={navBtnClass("slots")}>Slots</button>
        <button onClick={() => setTab("config")} className={navBtnClass("config")}>Rules ✅</button>
        <button onClick={() => setTab("teams")} className={navBtnClass("teams")}>Wallets</button>
        <button onClick={() => setTab("owners")} className={navBtnClass("owners")}>Owners</button>
        <button onClick={() => setTab("matches")} className={navBtnClass("matches")}>Matches</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full">
        
        {/* --- ✅ TAB: CONFIG / RULES --- */}
        {tab === "config" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
             <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm mb-8 border-b border-gray-800 pb-4">Auction Logic Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase block ml-1">Minimum Players Per Team</label>
                        <input type="number" className="w-full bg-black border border-gray-700 rounded-2xl p-4 text-white focus:border-cyan-500 outline-none transition-all font-bold" 
                               value={config.minSquadSize} onChange={e => setConfig({...config, minSquadSize: e.target.value})} />
                        <p className="text-[10px] text-gray-600 italic px-1">teams must fill this count to finish.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase block ml-1">Maximum Players Per Team</label>
                        <input type="number" className="w-full bg-black border border-gray-700 rounded-2xl p-4 text-white focus:border-cyan-500 outline-none transition-all font-bold" 
                               value={config.maxSquadSize} onChange={e => setConfig({...config, maxSquadSize: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase block ml-1">Base Price Slab (Purse Reserve)</label>
                        <input type="number" className="w-full bg-black border border-gray-700 rounded-2xl p-4 text-white focus:border-cyan-500 outline-none transition-all font-bold" 
                               value={config.minBasePrice} onChange={e => setConfig({...config, minBasePrice: e.target.value})} />
                        <p className="text-[10px] text-gray-600 italic px-1">system blocks bids that risk this reserve.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase block ml-1">Default Bid Increment</label>
                        <input type="number" className="w-full bg-black border border-gray-700 rounded-2xl p-4 text-white focus:border-cyan-500 outline-none transition-all font-bold" 
                               value={config.bidIncrement} onChange={e => setConfig({...config, bidIncrement: e.target.value})} />
                    </div>
                </div>
                <button onClick={handleUpdateConfig} className="mt-12 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-lg transition-all transform active:scale-95">Update Mandatory Rules</button>
             </div>
          </div>
        )}

        {/* --- TAB: AUCTION SLOTS --- */}
        {tab === "slots" && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
                <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Create New Auction Round</h3>
                <div className="flex gap-2">
                    <input className="flex-1 bg-black border border-gray-700 rounded-xl px-4 py-2 text-white outline-none focus:border-orange-500" 
                           placeholder="e.g. Round 1 - Icon Players" 
                           value={newSlotName} 
                           onChange={e => setNewSlotName(e.target.value)} />
                    <button onClick={handleCreateSlot} className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-2 rounded-xl font-bold transition-colors">Add Round</button>
                </div>
             </div>
             <div className="grid gap-3">
                {slots.map(s => (
                    <div key={s.id} className="bg-gray-900 border border-gray-800 p-4 rounded-2xl flex justify-between items-center group hover:border-gray-600 transition-all">
                        <div className="flex items-center">
                           <span className="text-gray-500 font-mono mr-4 text-xs">{s.order}.</span>
                           <span className="text-white font-black tracking-tight">{s.name}</span>
                        </div>
                        <button onClick={() => handleDeleteSlot(s.id)} className="text-gray-600 hover:text-red-500 transition-colors">🗑</button>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* --- TAB: PLAYER POOL --- */}
        {tab === "pool" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
                {["PENDING", "SOLD", "UNSOLD"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPoolFilter(filter)}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all uppercase ${
                      poolFilter === filter ? "bg-gray-700 text-white shadow-xl" : "text-gray-500 hover:text-gray-300"
                    }`}>
                    {filter}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="bg-cyan-900/30 border border-cyan-500/40 text-cyan-400 px-5 py-2 rounded-xl font-black text-xs uppercase hover:bg-cyan-900/50 transition-all active:scale-95">
                + Add Players
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-sm text-gray-400 min-w-[700px]">
                <thead className="bg-gray-950 text-[10px] uppercase font-black text-gray-500 tracking-widest border-b border-gray-800">
                  <tr><th className="p-5">Name</th><th className="p-5">Role</th><th className="p-5">Assign Slot</th><th className="p-5">{poolFilter === "SOLD" ? "Final Price" : "Base Price"}</th><th className="p-5 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {displayList.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="p-5 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {p.isOwner && <span className="text-[8px] bg-purple-900 text-purple-200 px-2 py-0.5 rounded uppercase font-black">Owner</span>}
                          {p.isIcon && <span className="text-[8px] bg-yellow-600/30 text-yellow-400 border border-yellow-600/50 px-2 py-0.5 rounded uppercase font-black">Icon</span>}
                        </div>
                      </td>
                      <td className="p-5 text-xs text-gray-500 font-medium">{p.role}</td>
                      <td className="p-5">
                        <select 
                            className="bg-black border border-gray-700 rounded-lg p-1.5 text-[10px] text-gray-400 focus:border-orange-500 outline-none w-full max-w-[160px] font-bold"
                            value={p.auctionSlotId || ""}
                            onChange={(e) => handleAssignToSlot(p.id, e.target.value)}
                        >
                            <option value="">-- Unassigned --</option>
                            {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="p-5 font-mono">
                        {poolFilter === "SOLD" ? (
                          <span className="text-green-400 font-bold text-base">₹{p.soldPrice?.toLocaleString()}</span>
                        ) : (
                          <div className="flex items-center gap-2 text-xs">
                             <span className="text-gray-600">₹</span>
                             <input type="number" className="bg-black border border-gray-700 rounded-lg px-2 py-1.5 w-24 text-white focus:border-cyan-500 outline-none" 
                                    value={p.basePrice} onChange={(e) => updateBasePrice(p.id, e.target.value)} />
                          </div>
                        )}
                      </td>
                      <td className="p-5 text-right flex justify-end gap-3 items-center">
                        <button onClick={() => toggleIconStatus(p.id, p.isIcon)} className={`text-lg transition-all transform active:scale-125 ${p.isIcon ? "text-yellow-400" : "text-gray-700"}`}>★</button>
                        {(poolFilter === "UNSOLD" || poolFilter === "SOLD") && (
                          <button onClick={() => reAddPlayer(p.id)} className="bg-cyan-900/40 text-cyan-400 hover:bg-cyan-600 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all">↺ Reset</button>
                        )}
                        <button onClick={() => deletePlayer(p.id)} className="text-red-900/60 hover:text-red-500 transition-colors p-2">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayList.length === 0 && <div className="p-20 text-center text-gray-600 italic text-sm">No players found in {poolFilter} list.</div>}
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
                <div key={t.id} className="bg-gray-900 border border-gray-800 p-6 rounded-3xl flex flex-col gap-5 shadow-xl hover:border-gray-600 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-white text-xl tracking-tight uppercase italic">{t.name}</div>
                      <div className="text-[10px] text-gray-500 mt-1 font-bold uppercase tracking-widest">Squad: {t.roster?.length || 0} Members</div>
                    </div>
                    <div className="text-right">
                      <label className="text-[9px] text-gray-600 font-black uppercase block tracking-widest">Remaining</label>
                      <div className={`text-2xl font-mono font-black ${remaining < 1000 ? "text-red-400" : "text-white"}`}>₹{remaining.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-950">
                    <div className={`h-full rounded-full transition-all duration-1000 ${remaining < (config.minSquadSize * config.minBasePrice) ? "bg-red-500" : "bg-cyan-500"}`}
                         style={{ width: `${Math.min(percentUsed, 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Total Purse: <span className="text-cyan-500">₹{purse.toLocaleString()}</span></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 font-black uppercase">Edit</span>
                        <input type="number" className="bg-black border border-gray-700 rounded-xl px-3 py-2 w-28 text-white text-right text-xs focus:border-green-500 outline-none font-bold"
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
        <div className="mt-20 border-t border-red-900/50 pt-10 mb-10">
          <div className="bg-red-950/10 border border-red-900/40 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
            <div className="text-center md:text-left">
              <h4 className="text-red-500 font-black uppercase text-base italic tracking-tighter">Emergency Data Wipe</h4>
              <p className="text-red-400/60 text-[11px] mt-2 max-w-md leading-relaxed">
                This will purge **ALL** tournament metadata including auction rounds, player slot assignments, the live auction room state, and all team squads. This action is irreversible.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-10 rounded-2xl shadow-xl whitespace-nowrap transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs">
              {isResetting ? "Purging Files..." : "⚠ Destroy Auction Data"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}