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
  setDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";
import MatchScheduler from "./MatchScheduler";

// --- 1. SUB-COMPONENT FOR TEAM CARD ---
const TeamCard = ({
  t,
  globalUsers,
  tournamentId,
  maxSquadSize,
  onUpdateOwner,
}) => {
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(t.name);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    await updateDoc(doc(db, "tournaments", tournamentId, "teams", t.id), {
      name: tempName.trim(),
    });
    setIsEditingName(false);
  };

  return (
    <div className="bg-[#1C2128] p-6 rounded-[2.5rem] shadow-xl border border-white/5 flex flex-col md:flex-row gap-8 transition-all hover:border-teal-500/20">
      <div className="flex-1 space-y-4">
        <div>
          <div className="text-[8px] text-teal-500 uppercase font-black tracking-[0.2em] mb-1">
            Active Team
          </div>

          {/* TEAM NAME EDIT LOGIC */}
          <div className="flex items-center gap-3 mb-6">
            {isEditingName ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  className="bg-[#0F1115] border border-teal-500/30 rounded-xl px-4 py-2 text-white font-black uppercase italic outline-none w-full"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="bg-teal-600 p-2 rounded-lg text-[10px]">
                  ✓
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setTempName(t.name);
                  }}
                  className="bg-white/5 p-2 rounded-lg text-[10px]">
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group/name">
                <div className="font-black text-white text-xl uppercase italic leading-none">
                  {t.name}
                </div>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="opacity-0 group-hover/name:opacity-100 text-slate-500 hover:text-teal-400 transition-all text-xs">
                  ✎
                </button>
              </div>
            )}
          </div>

          <div className="bg-[#0F1115] p-5 rounded-[2rem] border border-white/5 relative">
            <div className="flex justify-between items-start mb-3">
              <label className="text-[9px] text-slate-500 uppercase font-black">
                Team Owner
              </label>
              <button
                onClick={() => setIsEditingOwner(!isEditingOwner)}
                className={`p-2 rounded-lg transition-all ${
                  isEditingOwner
                    ? "bg-teal-600 text-white"
                    : "bg-white/5 text-slate-400 hover:text-teal-400"
                }`}>
                {isEditingOwner ? "✕" : "✎"}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-600/20 border border-teal-500/20 flex items-center justify-center text-xs font-black text-teal-400">
                {(t.ownerName || "U").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-100 truncate">
                  {t.ownerName || "No Owner Assigned"}
                </div>
                <div className="text-[8px] text-slate-600 font-mono truncate uppercase">
                  {t.ownerId || "Not Linked"}
                </div>
              </div>
            </div>
            {isEditingOwner && (
              <div className="mt-5 pt-5 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                <select
                  className="w-full bg-[#1C2128] border border-teal-500/30 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-teal-500 shadow-lg"
                  value={t.ownerId || ""}
                  onChange={(e) => {
                    onUpdateOwner(t.id, e.target.value);
                    setIsEditingOwner(false);
                  }}>
                  <option value="">-- Change Owner --</option>
                  {globalUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0F1115] p-5 rounded-[2rem] border border-white/5 shadow-inner">
            <div className="text-[8px] text-slate-500 uppercase font-black mb-1">
              Squad Size
            </div>
            <div className="text-2xl font-black text-white italic">
              {t.roster?.length || 0}{" "}
              <span className="text-xs text-slate-600 ml-1 not-italic">
                / {maxSquadSize}
              </span>
            </div>
          </div>
          <div className="bg-[#0F1115] p-5 rounded-[2rem] border border-white/5 shadow-inner">
            <div className="text-[8px] text-slate-500 uppercase font-black mb-1">
              Current Spent
            </div>
            <div className="text-xl font-black text-red-500">
              ₹{(t.spent || 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="mt-4 bg-[#0F1115] p-6 rounded-[2rem] border border-white/5 border-l-4 border-l-green-500 relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">
              Available Balance
            </div>
            <div className="text-xl font-black text-green-400 font-mono tracking-tighter">
              ₹{((t.purse || 0) - (t.spent || 0)).toLocaleString()}
            </div>
          </div>
          <div className="pt-4 border-t border-white/5">
            <label className="text-[8px] text-slate-600 uppercase font-black block mb-2">
              Modify Total Purse (₹)
            </label>
            <input
              type="number"
              className="w-full bg-transparent text-white font-mono font-black text-base outline-none focus:text-teal-400 border-b border-transparent focus:border-teal-500/30 pb-1"
              value={t.purse || 0}
              onChange={(e) =>
                updateDoc(doc(db, "tournaments", tournamentId, "teams", t.id), {
                  purse: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 2. SUB-COMPONENT FOR PLAYER ROW ---
const PlayerRow = ({
  p,
  teams,
  teamsMap,
  poolFilter,
  onAssign,
  onUpdatePrice,
  onToggleIcon,
  onDelete,
  onReset,
  slots,
  tournamentId,
}) => {
  const [tempTeam, setTempTeam] = useState("");
  const [tempPrice, setTempPrice] = useState(p.basePrice || 100);

  return (
    <tr className="hover:bg-[#0F1115]/50 transition-colors group">
      <td className="p-5 font-bold text-slate-200 whitespace-nowrap">
        <div>
          {p.name}
          <div className="text-[9px] text-slate-500 uppercase mt-1">
            {p.role}
          </div>
        </div>
      </td>
      <td className="p-5">
        {p.status !== "SOLD" ? (
          <div className="flex items-center gap-2">
            <select
              className="bg-[#0F1115] border border-teal-500/20 rounded-lg p-2 text-[10px] text-slate-300 outline-none w-32 font-bold"
              value={tempTeam}
              onChange={(e) => setTempTeam(e.target.value)}>
              <option value="">Select Team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="bg-[#0F1115] border border-teal-500/20 rounded-lg p-2 text-[10px] text-teal-400 w-20 outline-none font-bold"
              value={tempPrice}
              onChange={(e) => setTempPrice(e.target.value)}
            />
            <button
              onClick={() => onAssign(p.id, tempTeam, tempPrice)}
              className="bg-teal-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase">
              Assign
            </button>
          </div>
        ) : (
          <span className="text-[9px] text-teal-500 font-bold uppercase">
            Sold to {teamsMap[p.teamId]}
          </span>
        )}
      </td>
      <td className="p-5">
        <select
          className="bg-[#0F1115] border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 outline-none w-full max-w-[160px] font-bold cursor-pointer"
          value={p.auctionSlotId || ""}
          onChange={(e) =>
            updateDoc(
              doc(db, "tournaments", tournamentId, "auctionPlayers", p.id),
              { auctionSlotId: e.target.value }
            )
          }>
          <option value="">-- Unassigned --</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-5 font-mono">
        {poolFilter === "SOLD" ? (
          <span className="text-green-400 font-bold text-sm">
            ₹{p.soldPrice?.toLocaleString()}
          </span>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600">₹</span>
            <input
              type="number"
              className="bg-[#0F1115] border border-white/10 rounded-lg px-2 py-1.5 w-24 text-slate-200 outline-none font-bold"
              value={p.basePrice}
              onChange={(e) => onUpdatePrice(p.id, e.target.value)}
            />
          </div>
        )}
      </td>
      <td className="p-5 text-right flex justify-end gap-3 items-center">
        {/* Calls the prop passed from Parent */}
        <button
          onClick={onToggleIcon}
          className={`text-lg transition-all ${
            p.isIcon ? "text-amber-400" : "text-slate-700"
          }`}>
          ★
        </button>
        {(poolFilter === "UNSOLD" || poolFilter === "SOLD") && (
          <button
            onClick={() => onReset(p.id)}
            className="bg-teal-900/20 text-teal-400 border border-teal-500/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">
            ↺ Reset
          </button>
        )}
        <button
          onClick={() => onDelete(p.id)}
          className="text-slate-700 hover:text-red-500 transition-colors p-2">
          🗑
        </button>
      </td>
    </tr>
  );
};

// --- GLOBAL PLAYER PICKER MODAL ---
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0F1115]/95 p-4 backdrop-blur-md">
      <div className="bg-[#1C2128] border border-white/10 w-full max-w-lg rounded-3xl flex flex-col max-h-[80vh] shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1C2128]">
          <h3 className="text-slate-100 font-black uppercase tracking-tight text-lg italic">
            Global Database
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-slate-400">
            ✕
          </button>
        </div>
        <div className="p-4 bg-[#161920]">
          <input
            className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-slate-200 outline-none"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-teal-500 animate-pulse">
              Loading...
            </div>
          ) : (
            filtered.map((p) => {
              const isSel = selected.find((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border ${
                    isSel
                      ? "bg-teal-500/10 border-teal-500/50"
                      : "bg-[#0F1115] border-white/5"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                        isSel
                          ? "bg-teal-500 text-black"
                          : "bg-white/5 text-slate-500"
                      }`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-200">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">
                        {p.role}
                      </div>
                    </div>
                  </div>
                  {isSel && <div className="text-teal-400 font-black">✓</div>}
                </div>
              );
            })
          )}
        </div>
        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-500 text-xs font-black uppercase">
            Cancel
          </button>
          <button
            onClick={() => onImport(selected)}
            disabled={selected.length === 0}
            className="bg-teal-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg disabled:opacity-20">
            Import {selected.length} Players
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 3. MAIN SETUP PANEL ---
export default function AuctionAdminPanel({ tournamentId, onClose }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("pool");
  const [poolFilter, setPoolFilter] = useState("PENDING");
  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [newSlotName, setNewSlotName] = useState("");
  const [globalUsers, setGlobalUsers] = useState([]);

  const systemDefaults = {
    minSquadSize: 11,
    maxSquadSize: 15,
    minBasePrice: 100,
    bidIncrement: 100,
    maxBidPerPlayer: 0,
    maxIconsPerTeam: 2,
    bidSlabs: [],
    allowDirectBuy: false,
  };

  const [config, setConfig] = useState(systemDefaults);
  const [showPicker, setShowPicker] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    async function checkPermission() {
      if (!user) return setHasAccess(false), setCheckingAccess(false);
      const docSnap = await getDoc(doc(db, "tournaments", tournamentId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isOwner =
          data.ownerId === user.uid || data.createdBy === user.uid;
        const isAdmin =
          Array.isArray(data.admins) && data.admins.includes(user.uid);
        const isSuperAdmin = user.email === "ramchat007@gmail.com";
        setHasAccess(isOwner || isAdmin || isSuperAdmin);
      }
      setCheckingAccess(false);
    }
    checkPermission();
  }, [user, tournamentId]);

  useEffect(() => {
    if (!hasAccess) return;
    const unsubPool = onSnapshot(
      query(
        collection(db, "tournaments", tournamentId, "auctionPlayers"),
        orderBy("name")
      ),
      (snap) => {
        setAuctionPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    const unsubTeams = onSnapshot(
      collection(db, "tournaments", tournamentId, "teams"),
      (snap) => {
        setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    const unsubSlots = onSnapshot(
      query(
        collection(db, "tournaments", tournamentId, "auction_slots"),
        orderBy("order")
      ),
      (snap) => {
        setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    getDocs(collection(db, "users")).then((snap) => {
      setGlobalUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    getDoc(doc(db, "tournaments", tournamentId)).then(
      (s) => s.exists() && setConfig((prev) => ({ ...prev, ...s.data() }))
    );
    return () => {
      unsubPool();
      unsubTeams();
      unsubSlots();
    };
  }, [tournamentId, hasAccess]);

  const addSlab = () =>
    setConfig({
      ...config,
      bidSlabs: [...(config.bidSlabs || []), { max: 1000, inc: 100 }],
    });
  const updateSlab = (index, field, value) => {
    const newSlabs = [...(config.bidSlabs || [])];
    newSlabs[index][field] = Number(value);
    setConfig({ ...config, bidSlabs: newSlabs });
  };
  const removeSlab = (index) =>
    setConfig({
      ...config,
      bidSlabs: config.bidSlabs.filter((_, i) => i !== index),
    });

  const handleUpdateConfig = async () => {
    await updateDoc(doc(db, "tournaments", tournamentId), {
      isAuction: true,
      minSquadSize: Number(config.minSquadSize),
      maxSquadSize: Number(config.maxSquadSize),
      minBasePrice: Number(config.minBasePrice),
      bidIncrement: Number(config.bidIncrement),
      maxBidPerPlayer: Number(config.maxBidPerPlayer),
      maxIconsPerTeam: Number(config.maxIconsPerTeam),
      bidSlabs: config.bidSlabs || [],
      allowDirectBuy: !!config.allowDirectBuy,
    });
    alert("Updated Successfully!");
  };

  const handleResetRules = async () => {
    if (!window.confirm("⚠️ Reset all tournament rules to defaults?")) return;
    try {
      await updateDoc(doc(db, "tournaments", tournamentId), systemDefaults);
      setConfig(systemDefaults);
      alert("Rules Reset Successfully!");
    } catch (e) {
      alert("Reset failed: " + e.message);
    }
  };

  const forceAuctionReady = async () => {
    await setDoc(doc(db, "tournaments", tournamentId, "auction", "state"), {
      status: "READY",
      currentPlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      lastUpdate: Date.now(),
    });
    alert("Auction Signal Repaired!");
  };

  const handleCreateSlot = async () => {
    if (!newSlotName) return;
    await addDoc(collection(db, "tournaments", tournamentId, "auction_slots"), {
      name: newSlotName.trim(),
      order: slots.length + 1,
      status: "pending",
      createdAt: Date.now(),
    });
    setNewSlotName("");
  };

  const handleDeleteSlot = async (slotId) =>
    window.confirm("Delete?") &&
    (await deleteDoc(
      doc(db, "tournaments", tournamentId, "auction_slots", slotId)
    ));

  const handleImport = async (uniqueSelection) => {
    const batch = writeBatch(db);
    const colRef = collection(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers"
    );
    uniqueSelection.forEach((p) => {
      const newRef = doc(colRef);
      batch.set(newRef, {
        originalPlayerId: p.id,
        name: p.name,
        role: p.role || "All-Rounder",
        photoURL: p.photoURL || "",
        basePrice: config.minBasePrice,
        status: "PENDING",
        soldPrice: 0,
        teamId: null,
        isIcon: false,
        auctionSlotId: null,
      });
    });
    await batch.commit();
    setShowPicker(false);
  };

  // ✅ THIS FUNCTION IS NOW IN THE CORRECT PLACE (Inside the parent component)
  const handleToggleIcon = async (player) => {
    const newStatus = !player.isIcon;
    const playerRef = doc(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
      player.id
    );

    try {
      await updateDoc(playerRef, { isIcon: newStatus });

      if (player.teamId) {
        const teamRef = doc(
          db,
          "tournaments",
          tournamentId,
          "teams",
          player.teamId
        );
        await runTransaction(db, async (tx) => {
          const teamSnap = await tx.get(teamRef);
          if (!teamSnap.exists()) return;

          const teamData = teamSnap.data();
          const roster = teamData.roster || [];

          const playerIndex = roster.findIndex((p) => p.id === player.id);
          if (playerIndex !== -1) {
            const newRoster = [...roster];
            newRoster[playerIndex] = {
              ...newRoster[playerIndex],
              isIcon: newStatus,
            };
            tx.update(teamRef, { roster: newRoster });
          }
        });
      }
    } catch (error) {
      console.error("Icon Sync Error:", error);
      alert("Failed to sync icon status.");
    }
  };

  const forceAssignPlayer = async (playerId, teamId, price) => {
    if (!teamId) return alert("Select team!");
    if (!window.confirm("Confirm Force Assign?")) return;
    try {
      await runTransaction(db, async (tx) => {
        const pRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          playerId
        );
        const tRef = doc(db, "tournaments", tournamentId, "teams", teamId);
        const pSnap = await tx.get(pRef);
        const pData = pSnap.data();
        tx.update(tRef, {
          spent: increment(Number(price)),
          roster: arrayUnion({
            id: playerId,
            name: pData.name,
            role: pData.role,
            price: Number(price),
            photoURL: pData.photoURL || "",
          }),
        });
        tx.update(pRef, {
          status: "SOLD",
          teamId: teamId,
          soldPrice: Number(price),
        });
      });
      alert("Player Assigned!");
    } catch (e) {
      alert(e.message);
    }
  };

  const reAddPlayer = async (playerId) => {
    if (!window.confirm("Reset Player?")) return;
    try {
      await runTransaction(db, async (tx) => {
        const pRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          playerId
        );
        const pData = (await tx.get(pRef)).data();
        if (pData.status === "SOLD" && pData.teamId) {
          const tRef = doc(
            db,
            "tournaments",
            tournamentId,
            "teams",
            pData.teamId
          );
          const tData = (await tx.get(tRef)).data();
          const newSpent = Math.max(
            0,
            (tData.spent || 0) - (pData.soldPrice || 0)
          );
          const newRoster = (tData.roster || []).filter(
            (item) => item.id !== playerId
          );
          tx.update(tRef, { spent: newSpent, roster: newRoster });
        }
        tx.update(pRef, { status: "PENDING", soldPrice: 0, teamId: null });
      });
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUpdateOwner = async (teamId, userId) => {
    const selectedUser = globalUsers.find((u) => u.id === userId);
    await updateDoc(doc(db, "tournaments", tournamentId, "teams", teamId), {
      ownerId: userId,
      ownerName: selectedUser
        ? selectedUser.displayName || selectedUser.email
        : "",
    });
  };

  const handleReset = async () => {
    if (!window.confirm("⚠ DANGER: DELETE EVERYTHING?")) return;
    setIsResetting(true);
    const batch = writeBatch(db);
    const collections = ["auctionPlayers", "auction_slots", "teams", "matches"];
    for (const cName of collections) {
      const snap = await getDocs(
        collection(db, "tournaments", tournamentId, cName)
      );
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    batch.delete(doc(db, "tournaments", tournamentId, "auction", "state"));
    await batch.commit();
    window.location.reload();
  };

  const teamsMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const displayList = auctionPlayers.filter((p) => {
    if (poolFilter === "SOLD") return p.status === "SOLD";
    if (poolFilter === "UNSOLD") return p.status.includes("UNSOLD");
    return p.status === "PENDING";
  });

  if (checkingAccess)
    return (
      <div className="fixed inset-0 bg-[#0F1115] flex items-center justify-center text-teal-500 font-bold">
        Checking Access...
      </div>
    );
  if (!hasAccess)
    return (
      <div className="fixed inset-0 bg-[#0F1115] flex items-center justify-center text-red-500 font-black uppercase">
        Access Denied
      </div>
    );

  return (
    <div className="fixed inset-0 z-[100] bg-[#0F1115] flex flex-col overflow-hidden">
      <GlobalPlayerPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onImport={handleImport}
        existingIds={auctionPlayers.map((p) => p.originalPlayerId)}
      />

      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#1C2128]">
        <h2 className="text-lg font-black text-slate-100 flex items-center gap-3 uppercase tracking-tighter italic">
          <span className="bg-teal-600 p-1.5 rounded-lg text-sm">⚙️</span>{" "}
          Auction Setup
        </h2>
        <button
          onClick={onClose}
          className="bg-white/5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase">
          Close
        </button>
      </div>

      <div className="flex border-b border-white/5 bg-[#161920] overflow-x-auto no-scrollbar">
        {["pool", "slots", "config", "teams", "matches"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-w-[90px] py-4 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 ${
              tab === t
                ? "text-teal-400 border-teal-400 bg-teal-500/5"
                : "text-slate-500 border-transparent"
            }`}>
            {t === "config" ? "Rules" : t === "teams" ? "Teams & Owners" : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {tab === "config" && (
          <div className="space-y-6">
            <div className="bg-teal-900/10 border border-teal-500/20 p-6 rounded-2xl flex justify-between items-center">
              <div>
                <h4 className="text-teal-400 font-black text-xs uppercase">
                  Repair Auction Signal
                </h4>
                <p className="text-slate-500 text-[10px]">
                  Use if dashboard is stuck on 'Connecting'
                </p>
              </div>
              <button
                onClick={forceAuctionReady}
                className="bg-teal-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase">
                Repair
              </button>
            </div>

            <div className="bg-[#0F1115] p-6 rounded-2xl border border-white/5 flex justify-between items-center mt-4">
              <div>
                <h4 className="text-white font-black text-xs uppercase">
                  Allow Direct Buy
                </h4>
                <p className="text-slate-500 text-[10px]">
                  Owners can buy 1 player at base price but can't bid again in
                  that slot.
                </p>
              </div>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    allowDirectBuy: !config.allowDirectBuy,
                  })
                }
                className={`w-14 h-8 rounded-full transition-all relative ${
                  config.allowDirectBuy ? "bg-teal-600" : "bg-slate-700"
                }`}>
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                    config.allowDirectBuy ? "left-7" : "left-1"
                  }`}></div>
              </button>
            </div>

            <div className="bg-[#1C2128] border border-white/5 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-slate-100 font-black uppercase text-xs">
                    Dynamic Bidding Slabs
                  </h3>
                  <button
                    onClick={addSlab}
                    className="bg-teal-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    + Add Slab
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(config.bidSlabs || []).map((slab, index) => (
                    <div
                      key={index}
                      className="flex gap-4 items-center bg-[#0F1115] p-3 rounded-xl border border-white/5">
                      <div className="flex-1">
                        <label className="text-[8px] text-slate-500 block mb-1 uppercase font-black">
                          Up to (₹)
                        </label>
                        <input
                          type="number"
                          className="bg-transparent text-white font-bold outline-none w-full"
                          value={slab.max}
                          onChange={(e) =>
                            updateSlab(index, "max", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex-1 border-l border-white/10 pl-4">
                        <label className="text-[8px] text-teal-500 block mb-1 uppercase font-black">
                          Inc (₹)
                        </label>
                        <input
                          type="number"
                          className="bg-transparent text-teal-400 font-bold outline-none w-full"
                          value={slab.inc}
                          onChange={(e) =>
                            updateSlab(index, "inc", e.target.value)
                          }
                        />
                      </div>
                      <button
                        onClick={() => removeSlab(index)}
                        className="text-red-500 text-xl">
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <h3 className="text-slate-100 font-black uppercase text-xs mb-8 border-b border-white/5 pb-4">
                Auction Logic Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">
                    Min Squad Size
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#0F1115] border border-white/10 rounded-xl p-4 text-slate-200"
                    value={config.minSquadSize}
                    onChange={(e) =>
                      setConfig({ ...config, minSquadSize: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">
                    Max Squad Size
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#0F1115] border border-white/10 rounded-xl p-4 text-slate-200"
                    value={config.maxSquadSize}
                    onChange={(e) =>
                      setConfig({ ...config, maxSquadSize: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">
                    Min Base Price
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#0F1115] border border-white/10 rounded-xl p-4 text-slate-200"
                    value={config.minBasePrice}
                    onChange={(e) =>
                      setConfig({ ...config, minBasePrice: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">
                    Fallback Increment
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#0F1115] border border-white/10 rounded-xl p-4 text-slate-200"
                    value={config.bidIncrement}
                    onChange={(e) =>
                      setConfig({ ...config, bidIncrement: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-orange-400 uppercase">
                    Max Bid Per Player
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#0F1115] border border-orange-500/20 rounded-xl p-4 text-slate-200 focus:border-orange-500/50"
                    value={config.maxBidPerPlayer}
                    onChange={(e) =>
                      setConfig({ ...config, maxBidPerPlayer: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-orange-400 uppercase">
                    Max Icons Per Team
                  </label>
                  <input
                    type="number"
                    className="w-full bg-[#0F1115] border border-orange-500/20 rounded-xl p-4 text-slate-200 focus:border-orange-500/50"
                    value={config.maxIconsPerTeam}
                    onChange={(e) =>
                      setConfig({ ...config, maxIconsPerTeam: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-12">
                <button
                  onClick={handleResetRules}
                  className="flex-1 bg-red-900/20 text-red-500 border border-red-500/20 font-black py-5 rounded-xl uppercase text-xs">
                  Reset Rules
                </button>
                <button
                  onClick={handleUpdateConfig}
                  className="flex-[2] bg-teal-600 text-white font-black py-5 rounded-xl uppercase text-xs shadow-lg">
                  Update Rules
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "teams" && (
          <div className="grid grid-cols-1 gap-6">
            {teams.map((t) => (
              <TeamCard
                key={t.id}
                t={t}
                globalUsers={globalUsers}
                tournamentId={tournamentId}
                maxSquadSize={config.maxSquadSize}
                onUpdateOwner={handleUpdateOwner}
              />
            ))}
          </div>
        )}

        {tab === "pool" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex bg-[#161920] rounded-xl p-1">
                {["PENDING", "SOLD", "UNSOLD"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setPoolFilter(f)}
                    className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase ${
                      poolFilter === f
                        ? "bg-[#0F1115] text-white"
                        : "text-slate-500"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="bg-teal-900/10 border border-teal-500/20 text-teal-400 px-6 py-3 rounded-xl font-black text-xs uppercase hover:bg-teal-900/20 active:scale-95 transition-all">
                + Add Players
              </button>
            </div>
            <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden shadow-2xl overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400 min-w-[1000px]">
                <thead className="bg-[#0F1115] text-[10px] font-black text-slate-500 border-b border-white/5 uppercase tracking-widest">
                  <tr>
                    <th className="p-5">Name</th>
                    <th className="p-5">Force Assign</th>
                    <th className="p-5">Assign Slot</th>
                    <th className="p-5">Base/Final Price</th>
                    <th className="p-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayList.map((p) => (
                    <PlayerRow
                      key={p.id}
                      p={p}
                      teams={teams}
                      teamsMap={teamsMap}
                      poolFilter={poolFilter}
                      slots={slots}
                      tournamentId={tournamentId}
                      onAssign={forceAssignPlayer}
                      onUpdatePrice={(id, val) =>
                        updateDoc(
                          doc(
                            db,
                            "tournaments",
                            tournamentId,
                            "auctionPlayers",
                            id
                          ),
                          { basePrice: Number(val) }
                        )
                      }
                      // ✅ CORRECT: Passing the function call
                      onToggleIcon={() => handleToggleIcon(p)}
                      onDelete={(id) =>
                        window.confirm("Remove?") &&
                        deleteDoc(
                          doc(
                            db,
                            "tournaments",
                            tournamentId,
                            "auctionPlayers",
                            id
                          )
                        )
                      }
                      onReset={reAddPlayer}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "slots" && (
          <div className="space-y-6">
            <div className="bg-[#1C2128] border border-white/5 p-6 rounded-[2rem]">
              <div className="flex gap-3">
                <input
                  className="flex-1 bg-[#0F1115] border border-white/10 rounded-xl px-5 py-3 text-slate-200 outline-none"
                  placeholder="Round Name"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                />
                <button
                  onClick={handleCreateSlot}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-2 rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-lg">
                  Add Round
                </button>
              </div>
            </div>
            {slots.map((s) => (
              <div
                key={s.id}
                className="bg-[#1C2128] p-4 rounded-xl flex justify-between items-center mb-2 border border-white/5">
                <span className="text-white font-bold">
                  {s.order}. {s.name}
                </span>
                <button
                  onClick={() => handleDeleteSlot(s.id)}
                  className="text-slate-600 hover:text-red-500">
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "matches" && (
          <MatchScheduler tournamentId={tournamentId} teams={teams} />
        )}

        <div className="mt-20 border-t border-red-500/10 pt-10">
          <div className="bg-red-900/5 border border-red-500/20 p-8 rounded-[2rem] flex justify-between items-center">
            <div>
              <h4 className="text-red-500 font-black uppercase text-xs">
                Emergency Reset
              </h4>
              <p className="text-red-400/50 text-[10px]">
                Deletes all auction data and teams.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="bg-red-600 text-white font-black py-4 px-8 rounded-xl text-xs uppercase">
              {isResetting ? "Purging..." : "Destroy Data"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
