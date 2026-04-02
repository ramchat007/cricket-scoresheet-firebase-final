import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { useTheme } from "../context/ThemeContext";
import MatchScheduler from "./MatchScheduler";
import AuctionOwnersAdmin from "./AuctionOwnersAdmin";

// --- 2. OPTIMIZED SUB-COMPONENT (Wrapped in React.memo) ---
const PlayerRow = React.memo(
  ({
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
    const { theme, lightMode } = useTheme();
    const [tempTeam, setTempTeam] = useState("");
    const [tempPrice, setTempPrice] = useState(p.basePrice || 100);

    useEffect(() => {
      setTempPrice(p.basePrice || 100);
    }, [p.basePrice]);

    const handleAssignClick = () => {
      onAssign(p.id, tempTeam, tempPrice);
    };

    const handlePriceBlur = () => {
      if (tempPrice !== p.basePrice) {
        onUpdatePrice(p.id, tempPrice);
      }
    };

    const inputClass = `border rounded-lg p-2 text-[10px] outline-none font-bold ${
      lightMode
        ? "bg-white border-gray-300 text-gray-900 focus:border-teal-500"
        : "bg-[#0F1115] border-teal-500/20 text-slate-300 focus:border-teal-500/50"
    }`;

    return (
      <tr
        className={`hover:${lightMode ? "bg-gray-50" : "bg-[#0F1115]/50"} transition-colors group`}>
        <td className={`p-5 font-bold ${theme.text} whitespace-nowrap`}>
          <div>
            {p.name}
            <div className={`text-[9px] ${theme.sub} uppercase mt-1`}>
              {p.role}
            </div>
          </div>
        </td>
        <td className="p-5">
          {p.status !== "SOLD" ? (
            <div className="flex items-center gap-2">
              <select
                className={`${inputClass} w-32`}
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
                className={`${inputClass} w-20 text-teal-500`}
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
              />
              <button
                onClick={handleAssignClick}
                className="bg-teal-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-teal-500 transition-colors shadow-sm">
                Assign
              </button>
            </div>
          ) : (
            <span className="text-[9px] text-teal-600 dark:text-teal-500 font-bold uppercase">
              Sold to {teamsMap[p.teamId]}
            </span>
          )}
        </td>
        <td className="p-5">
          <select
            className={`${inputClass} w-full max-w-[160px] cursor-pointer`}
            value={p.auctionSlotId || ""}
            onChange={(e) =>
              updateDoc(
                doc(db, "tournaments", tournamentId, "auctionPlayers", p.id),
                { auctionSlotId: e.target.value },
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
            <span className="text-emerald-600 dark:text-green-400 font-bold text-sm">
              ₹{p.soldPrice?.toLocaleString()}
            </span>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className={theme.sub}>₹</span>
              <input
                type="number"
                className={`border rounded-lg px-2 py-1.5 w-24 outline-none font-bold ${
                  lightMode
                    ? "bg-white border-gray-300 text-gray-900"
                    : "bg-[#0F1115] border-white/10 text-slate-200"
                }`}
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                onBlur={handlePriceBlur}
              />
            </div>
          )}
        </td>
        <td className="p-5 text-right flex justify-end gap-3 items-center">
          <button
            onClick={() => onToggleIcon(p)}
            className={`text-lg transition-all ${
              p.isIcon
                ? "text-amber-500 scale-110"
                : "text-gray-400 hover:text-gray-500 dark:text-slate-700 dark:hover:text-slate-500"
            }`}>
            ★
          </button>
          {(poolFilter === "UNSOLD" || poolFilter === "SOLD") && (
            <button
              onClick={() => onReset(p.id)}
              className={`border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors ${
                lightMode
                  ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                  : "bg-teal-900/20 text-teal-400 border-teal-500/20 hover:bg-teal-900/30"
              }`}>
              ↺ Reset
            </button>
          )}
          <button
            onClick={() => onDelete(p.id)}
            className={`${theme.sub} hover:text-red-500 transition-colors p-2`}>
            🗑
          </button>
        </td>
      </tr>
    );
  },
);

// --- GLOBAL PLAYER PICKER MODAL ---
const GlobalPlayerPicker = ({
  isOpen,
  onClose,
  onImport,
  existingIds,
  tournamentId,
}) => {
  const { theme, lightMode } = useTheme();
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const [tournamentOnly, setTournamentOnly] = useState(false);

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
      setTournamentOnly(false);
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

  const filtered = players.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());

    let matchesTourney = true;
    if (tournamentOnly && tournamentId) {
      matchesTourney =
        String(p.tournamentId) === String(tournamentId) ||
        String(p.tournament) === String(tournamentId) ||
        String(p.tId) === String(tournamentId) ||
        (Array.isArray(p.tournaments) &&
          p.tournaments.includes(tournamentId)) ||
        (Array.isArray(p.registeredTournaments) &&
          p.registeredTournaments.includes(tournamentId));
    }

    return matchesSearch && matchesTourney;
  });

  const isAllSelected =
    filtered.length > 0 &&
    filtered.every((p) => selected.some((s) => s.id === p.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelected((prev) =>
        prev.filter((s) => !filtered.some((f) => f.id === s.id)),
      );
    } else {
      setSelected((prev) => {
        const newSelected = [...prev];
        filtered.forEach((f) => {
          if (!newSelected.some((s) => s.id === f.id)) {
            newSelected.push(f);
          }
        });
        return newSelected;
      });
    }
  };

  const borderClass = lightMode ? "border-gray-200" : "border-white/10";
  const headerFooterBg = lightMode ? "bg-gray-50" : "bg-[#1C2128]";
  const inputBg = lightMode
    ? "bg-white text-gray-900 placeholder:text-gray-400"
    : "bg-[#0F1115] text-slate-200";

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-md ${lightMode ? "bg-white/80" : "bg-[#0F1115]/95"}`}>
      <div
        className={`${theme.card} border ${borderClass} w-full max-w-lg rounded-3xl flex flex-col max-h-[80vh] shadow-2xl`}>
        <div
          className={`p-6 border-b ${borderClass} flex justify-between items-center ${headerFooterBg} rounded-t-3xl`}>
          <h3
            className={`${theme.text} font-black uppercase tracking-tight text-lg italic`}>
            Global Database
          </h3>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              lightMode
                ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}>
            ✕
          </button>
        </div>

        <div className={`p-4 border-b ${borderClass}`}>
          <input
            className={`w-full border ${borderClass} rounded-xl px-4 py-3 outline-none focus:border-teal-500 font-bold ${inputBg}`}
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex justify-between items-center mt-3">
            <label
              className={`flex items-center gap-2 cursor-pointer text-[10px] sm:text-xs font-bold ${theme.sub}`}>
              <input
                type="checkbox"
                checked={tournamentOnly}
                onChange={(e) => setTournamentOnly(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded"
              />
              Filter by Tournament
            </label>

            <button
              onClick={handleSelectAll}
              disabled={filtered.length === 0}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all disabled:opacity-30 ${
                isAllSelected
                  ? "bg-teal-500 text-white border-teal-500 shadow-md"
                  : lightMode
                    ? "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
              }`}>
              {isAllSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-teal-500 animate-pulse font-bold">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className={`text-center py-10 italic text-xs ${theme.sub}`}>
              No players found.{" "}
              {tournamentOnly ? "Try unchecking the tournament filter." : ""}
            </div>
          ) : (
            filtered.map((p) => {
              const isSel = selected.find((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${
                    isSel
                      ? lightMode
                        ? "bg-teal-50 border-teal-500 shadow-sm"
                        : "bg-teal-500/10 border-teal-500/50"
                      : lightMode
                        ? "bg-white border-gray-200 hover:border-teal-300"
                        : "bg-[#0F1115] border-white/5 hover:border-white/10"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                        isSel
                          ? lightMode
                            ? "bg-teal-100 text-teal-700"
                            : "bg-teal-500 text-black"
                          : lightMode
                            ? "bg-gray-100 text-gray-600"
                            : "bg-white/5 text-slate-500"
                      }`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div
                        className={`text-sm font-bold ${isSel ? (lightMode ? "text-teal-700" : "text-teal-400") : theme.text}`}>
                        {p.name}
                      </div>
                      <div
                        className={`text-[10px] ${theme.sub} uppercase font-bold tracking-wider`}>
                        {p.role}
                      </div>
                    </div>
                  </div>
                  {isSel && <div className="text-teal-500 font-black">✓</div>}
                </div>
              );
            })
          )}
        </div>
        <div
          className={`p-6 border-t ${borderClass} flex justify-end gap-3 rounded-b-3xl ${headerFooterBg}`}>
          <button
            onClick={onClose}
            className={`px-6 py-3 border rounded-xl font-black uppercase text-xs transition-colors ${
              lightMode
                ? "text-gray-600 border-gray-300 hover:bg-gray-200"
                : "text-slate-500 border-white/10 hover:bg-white/5"
            }`}>
            Cancel
          </button>
          <button
            onClick={() => onImport(selected)}
            disabled={selected.length === 0}
            className="bg-teal-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg disabled:opacity-30 active:scale-95 transition-all">
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
  const { theme, lightMode } = useTheme();

  const [tab, setTab] = useState("pool");
  const [roleFilter, setRoleFilter] = useState("All");
  const [slotFilter, setSlotFilter] = useState("All");
  const [poolFilter, setPoolFilter] = useState("PENDING");

  // Data State
  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);

  // UI State
  const [newSlotName, setNewSlotName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editingSlotName, setEditingSlotName] = useState("");

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

  const handleCancelEdit = () => {
    setEditingSlotId(null);
    setEditingSlotName("");
  };

  // --- PERMISSION CHECK ---
  useEffect(() => {
    async function checkPermission() {
      if (!user) return (setHasAccess(false), setCheckingAccess(false));
      const docSnap = await getDoc(doc(db, "tournaments", tournamentId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isOwner =
          (Array.isArray(data.ownerId)
            ? data.ownerId.includes(user.uid)
            : data.ownerId === user.uid) || data.createdBy === user.uid;
        const isAdmin =
          Array.isArray(data.admins) && data.admins.includes(user.uid);
        const isSuperAdmin = user.email === "ramchat007@gmail.com";
        setHasAccess(isOwner || isAdmin || isSuperAdmin);
      }
      setCheckingAccess(false);
    }
    checkPermission();
  }, [user, tournamentId]);

  // --- DATA LISTENER ---
  useEffect(() => {
    if (!hasAccess) return;

    const unsubPool = onSnapshot(
      query(
        collection(db, "tournaments", tournamentId, "auctionPlayers"),
        orderBy("name"),
      ),
      (snap) => {
        const players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAuctionPlayers(players);
      },
    );

    const unsubTeams = onSnapshot(
      collection(db, "tournaments", tournamentId, "teams"),
      (snap) => {
        setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );

    const unsubSlots = onSnapshot(
      query(
        collection(db, "tournaments", tournamentId, "auction_slots"),
        orderBy("order"),
      ),
      (snap) => {
        setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );

    getDocs(collection(db, "users")).then((snap) => {
      setGlobalUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    getDoc(doc(db, "tournaments", tournamentId)).then(
      (s) => s.exists() && setConfig((prev) => ({ ...prev, ...s.data() })),
    );
    return () => {
      unsubPool();
      unsubTeams();
      unsubSlots();
    };
  }, [tournamentId, hasAccess]);

  const teamsMap = useMemo(() => {
    return Object.fromEntries(teams.map((t) => [t.id, t.name]));
  }, [teams]);

  // --- HANDLERS ---
  const handleToggleIcon = useCallback(
    async (player) => {
      setAuctionPlayers((current) =>
        current.map((p) =>
          p.id === player.id ? { ...p, isIcon: !p.isIcon } : p,
        ),
      );

      const playerRef = doc(
        db,
        "tournaments",
        tournamentId,
        "auctionPlayers",
        player.id,
      );
      const newStatus = !player.isIcon;

      try {
        await updateDoc(playerRef, { isIcon: newStatus });
        if (player.teamId) {
          const teamRef = doc(
            db,
            "tournaments",
            tournamentId,
            "teams",
            player.teamId,
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
        setAuctionPlayers((current) =>
          current.map((p) =>
            p.id === player.id ? { ...p, isIcon: !newStatus } : p,
          ),
        );
        alert("Failed to sync icon status.");
      }
    },
    [tournamentId],
  );

  const forceAssignPlayer = useCallback(
    async (playerId, teamId, price) => {
      if (!teamId) return alert("Select team!");
      if (!window.confirm("Confirm Force Assign?")) return;

      setAuctionPlayers((current) =>
        current.map((p) =>
          p.id === playerId
            ? { ...p, status: "SOLD", teamId: teamId, soldPrice: Number(price) }
            : p,
        ),
      );

      try {
        await runTransaction(db, async (tx) => {
          const pRef = doc(
            db,
            "tournaments",
            tournamentId,
            "auctionPlayers",
            playerId,
          );
          const tRef = doc(db, "tournaments", tournamentId, "teams", teamId);

          const pSnap = await tx.get(pRef);
          const tSnap = await tx.get(tRef);

          if (!pSnap.exists() || !tSnap.exists())
            throw new Error("Data missing");

          const pData = pSnap.data();
          const tData = tSnap.data();
          const finalPrice = Number(price);

          const historyEntry = {
            bid: finalPrice,
            bidderId: teamId,
            bidderName: tData.name || "Admin Assign",
            type: "FORCE_ASSIGN",
            timestamp: Date.now(),
          };

          tx.update(tRef, {
            spent: increment(finalPrice),
            roster: arrayUnion({
              id: playerId,
              name: pData.name,
              role: pData.role,
              price: finalPrice,
              photoURL: pData.photoURL || "",
              auctionSlotId: pData.auctionSlotId || null,
            }),
          });

          tx.update(pRef, {
            status: "SOLD",
            teamId: teamId,
            soldPrice: finalPrice,
            bidHistory: [historyEntry],
          });
        });
      } catch (e) {
        alert(e.message);
      }
    },
    [tournamentId],
  );

  const handleUpdatePrice = useCallback(
    async (playerId, val) => {
      setAuctionPlayers((current) =>
        current.map((p) =>
          p.id === playerId ? { ...p, basePrice: Number(val) } : p,
        ),
      );
      await updateDoc(
        doc(db, "tournaments", tournamentId, "auctionPlayers", playerId),
        { basePrice: Number(val) },
      );
    },
    [tournamentId],
  );

  const handleDeletePlayer = useCallback(
    async (playerId) => {
      if (!window.confirm("Remove?")) return;
      setAuctionPlayers((current) => current.filter((p) => p.id !== playerId));
      await deleteDoc(
        doc(db, "tournaments", tournamentId, "auctionPlayers", playerId),
      );
    },
    [tournamentId],
  );

  const reAddPlayer = useCallback(
    async (playerId) => {
      if (
        !window.confirm(
          "Are you sure you want to reset this player back to the auction pool?",
        )
      )
        return;

      try {
        await runTransaction(db, async (tx) => {
          // --- 1. READ PHASE (All gets must happen first) ---
          const pRef = doc(
            db,
            "tournaments",
            tournamentId,
            "auctionPlayers",
            playerId,
          );
          const pSnap = await tx.get(pRef);

          if (!pSnap.exists()) {
            throw new Error("Player not found.");
          }

          const pData = pSnap.data();
          let tRef = null;
          let tSnap = null;

          // If they are sold, we must fetch the team document BEFORE doing any writes
          if (pData.status === "SOLD" && pData.teamId) {
            tRef = doc(db, "tournaments", tournamentId, "teams", pData.teamId);
            tSnap = await tx.get(tRef);
          }

          // --- 2. WRITE PHASE (Now we can safely update) ---

          // A. Update the Team (Refund money & Remove from Roster)
          if (tRef && tSnap && tSnap.exists()) {
            const tData = tSnap.data();

            // Safely parse as integers to prevent NaN calculation errors
            const currentSpent = parseInt(tData.spent) || 0;
            const refundAmount = parseInt(pData.soldPrice) || 0;
            const newSpent = Math.max(0, currentSpent - refundAmount);

            // Filter out the player from the array safely
            const newRoster = (tData.roster || []).filter(
              (item) => item.id !== playerId && item.playerId !== playerId,
            );

            tx.update(tRef, {
              spent: newSpent,
              roster: newRoster,
            });
          }

          // B. Update the Player (Reset to Pending)
          tx.update(pRef, {
            status: "PENDING",
            soldPrice: 0,
            teamId: null,
          });
        });
      } catch (e) {
        console.error("Transaction Error:", e);
        alert("Failed to reset player: " + e.message);
      }
    },
    [tournamentId],
  );

  // --- CONFIG HANDLERS ---
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
      limitOnePlayerPerSlot: !!config.limitOnePlayerPerSlot,
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

  // 🔥 NEW: DANGER ZONE HANDLERS
  const handleSyncBasePrice = async () => {
    if (
      !window.confirm(
        `Update ALL players in the pool to the current Min Base Price (₹${config.minBasePrice})?`,
      )
    )
      return;
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      auctionPlayers.forEach((p) => {
        const pRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          p.id,
        );
        batch.update(pRef, { basePrice: Number(config.minBasePrice) });
      });
      await batch.commit();
      alert("Base price synced to all players successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to sync base prices.");
    }
    setIsResetting(false);
  };

  const handleResetAllPlayers = async () => {
    if (
      !window.confirm(
        "⚠️ UNSOLD ALL PLAYERS? This will remove all players from their teams and reset their statuses to PENDING. This cannot be undone!",
      )
    )
      return;
    setIsResetting(true);
    try {
      const batch = writeBatch(db);

      // 1. Reset all teams (Clear roster and spent budgets)
      teams.forEach((t) => {
        const tRef = doc(db, "tournaments", tournamentId, "teams", t.id);
        batch.update(tRef, { spent: 0, roster: [] });
      });

      // 2. Reset all players to PENDING
      auctionPlayers.forEach((p) => {
        const pRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          p.id,
        );
        batch.update(pRef, {
          status: "PENDING",
          soldPrice: 0,
          teamId: null,
          bidHistory: [],
        });
      });

      await batch.commit();
      alert("All players successfully reset to PENDING!");
    } catch (e) {
      console.error(e);
      alert("Failed to reset players.");
    }
    setIsResetting(false);
  };

  const handleClearAuctionPool = async () => {
    if (
      !window.confirm(
        "🚨 DELETE ALL PLAYERS from the auction pool? This will wipe every team's roster and completely empty the auction. This cannot be undone!",
      )
    )
      return;
    setIsResetting(true);
    try {
      const batch = writeBatch(db);

      // 1. Reset all teams
      teams.forEach((t) => {
        const tRef = doc(db, "tournaments", tournamentId, "teams", t.id);
        batch.update(tRef, { spent: 0, roster: [] });
      });

      // 2. Delete all players from the auction subcollection
      auctionPlayers.forEach((p) => {
        const pRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          p.id,
        );
        batch.delete(pRef);
      });

      await batch.commit();
      alert("Auction pool completely cleared!");
    } catch (e) {
      console.error(e);
      alert("Failed to clear auction pool.");
    }
    setIsResetting(false);
  };

  // --- SLOT HANDLERS ---
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

  const handleEditSlot = (slot) => {
    setEditingSlotId(slot.id);
    setEditingSlotName(slot.name);
  };

  const handleUpdateSlot = async (slotId) => {
    if (!editingSlotName.trim()) {
      alert("Slot name cannot be empty");
      return;
    }
    await updateDoc(
      doc(db, `tournaments/${tournamentId}/auction_slots`, slotId),
      { name: editingSlotName.trim() },
    );
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId ? { ...s, name: editingSlotName.trim() } : s,
      ),
    );
    setEditingSlotId(null);
    setEditingSlotName("");
  };

  const handleDeleteSlot = async (slotId) =>
    window.confirm("Delete?") &&
    (await deleteDoc(
      doc(db, "tournaments", tournamentId, "auction_slots", slotId),
    ));

  const handleImport = async (uniqueSelection) => {
    const batch = writeBatch(db);
    const colRef = collection(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
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

  // --- STATS CALCULATION ---
  const stats = useMemo(
    () => ({
      total: auctionPlayers.length,
      pending: auctionPlayers.filter((p) => p.status === "PENDING").length,
      sold: auctionPlayers.filter((p) => p.status === "SOLD").length,
      unsold: auctionPlayers.filter((p) => p.status.includes("UNSOLD")).length,
      batsmen: auctionPlayers.filter((p) => p.role === "Batsman").length,
      bowlers: auctionPlayers.filter((p) => p.role === "Bowler").length,
      allRounders: auctionPlayers.filter((p) => p.role === "All-Rounder")
        .length,
    }),
    [auctionPlayers],
  );

  const slotCounts = useMemo(
    () =>
      slots.reduce((acc, slot) => {
        acc[slot.id] = auctionPlayers.filter(
          (p) => p.auctionSlotId === slot.id,
        ).length;
        return acc;
      }, {}),
    [slots, auctionPlayers],
  );

  const unassignedCount = auctionPlayers.filter((p) => !p.auctionSlotId).length;

  const displayList = useMemo(() => {
    return auctionPlayers.filter((p) => {
      const statusMatch =
        (poolFilter === "SOLD" && p.status === "SOLD") ||
        (poolFilter === "UNSOLD" && p.status.includes("UNSOLD")) ||
        (poolFilter === "PENDING" && p.status === "PENDING");

      const roleMatch = roleFilter === "All" || p.role === roleFilter;
      let slotMatch = true;
      if (slotFilter === "Unassigned") {
        slotMatch = !p.auctionSlotId;
      } else if (slotFilter !== "All") {
        slotMatch = p.auctionSlotId === slotFilter;
      }
      return statusMatch && roleMatch && slotMatch;
    });
  }, [auctionPlayers, poolFilter, roleFilter, slotFilter]);

  // --- STYLES HELPER ---
  const borderClass = lightMode ? "border-gray-200" : "border-white/5";
  const inputBgClass = lightMode
    ? "bg-white border-gray-200 text-gray-900"
    : "bg-[#0F1115] border-white/10 text-slate-200";

  if (checkingAccess)
    return (
      <div
        className={`fixed inset-0 ${theme.bg} flex items-center justify-center text-teal-500 font-bold z-[100]`}>
        Checking Access...
      </div>
    );
  if (!hasAccess)
    return (
      <div
        className={`fixed inset-0 ${theme.bg} flex items-center justify-center text-red-500 font-black uppercase z-[100]`}>
        Access Denied
      </div>
    );

  return (
    <div
      className={`fixed inset-0 z-[100] ${theme.bg} flex flex-col overflow-hidden`}>
      <GlobalPlayerPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onImport={handleImport}
        existingIds={auctionPlayers.map((p) => p.originalPlayerId)}
        tournamentId={tournamentId}
      />

      <div
        className={`p-4 border-b ${borderClass} flex justify-between items-center ${theme.card}`}>
        <h2
          className={`${theme.text} font-black flex items-center gap-3 uppercase tracking-tighter italic text-lg`}>
          <span className="bg-teal-600 text-white p-1.5 rounded-lg text-sm">
            ⚙️
          </span>{" "}
          Auction Setup
        </h2>
        <button
          onClick={onClose}
          className={`${lightMode ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-white/5 hover:bg-white/10 text-white"} px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-colors`}>
          Close
        </button>
      </div>

      <div
        className={`flex border-b ${borderClass} ${lightMode ? "bg-gray-50" : "bg-[#161920]"} overflow-x-auto no-scrollbar`}>
        {["pool", "slots", "config", "teams", "matches"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-w-[90px] py-4 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 ${
              tab === t
                ? "text-teal-500 border-teal-500 bg-teal-500/5"
                : `${theme.sub} border-transparent hover:${theme.text}`
            }`}>
            {t === "config" ? "Rules" : t === "teams" ? "Teams & Owners" : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {tab === "config" && (
          <div className="space-y-6 pb-20">
            <div
              className={`border p-6 rounded-2xl flex justify-between items-center ${lightMode ? "bg-teal-50 border-teal-200" : "bg-teal-900/10 border-teal-500/20"}`}>
              <div>
                <h4 className="text-teal-600 dark:text-teal-400 font-black text-xs uppercase">
                  Repair Auction Signal
                </h4>
                <p
                  className={`text-[10px] ${lightMode ? "text-teal-800/60" : "text-slate-500"}`}>
                  Use if dashboard is stuck
                </p>
              </div>
              <button
                onClick={forceAuctionReady}
                className="bg-teal-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-teal-700 transition-colors shadow-sm">
                Repair
              </button>
            </div>

            <div
              className={`${theme.card} p-6 rounded-2xl border ${borderClass} flex justify-between items-center mt-4 shadow-sm`}>
              <div>
                <h4 className={`${theme.text} font-black text-xs uppercase`}>
                  Limit: 1 Player Per Slot
                </h4>
              </div>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    limitOnePlayerPerSlot: !config.limitOnePlayerPerSlot,
                  })
                }
                className={`w-14 h-8 rounded-full transition-all relative ${
                  config.limitOnePlayerPerSlot
                    ? "bg-teal-600"
                    : "bg-gray-300 dark:bg-slate-700"
                }`}>
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                    config.limitOnePlayerPerSlot ? "left-7" : "left-1"
                  }`}></div>
              </button>
            </div>

            <div
              className={`${theme.card} p-6 rounded-2xl border ${borderClass} flex justify-between items-center mt-4 shadow-sm`}>
              <div>
                <h4 className={`${theme.text} font-black text-xs uppercase`}>
                  Allow Direct Buy
                </h4>
              </div>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    allowDirectBuy: !config.allowDirectBuy,
                  })
                }
                className={`w-14 h-8 rounded-full transition-all relative ${
                  config.allowDirectBuy
                    ? "bg-teal-600"
                    : "bg-gray-300 dark:bg-slate-700"
                }`}>
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                    config.allowDirectBuy ? "left-7" : "left-1"
                  }`}></div>
              </button>
            </div>

            <div
              className={`${theme.card} border ${borderClass} p-8 rounded-[2rem] shadow-xl relative overflow-hidden`}>
              <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`${theme.text} font-black uppercase text-xs`}>
                    Dynamic Bidding Slabs
                  </h3>
                  <button
                    onClick={addSlab}
                    className="bg-teal-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-sm transition-colors">
                    + Add Slab
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(config.bidSlabs || []).map((slab, index) => (
                    <div
                      key={index}
                      className={`flex gap-4 items-center p-3 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                      <div className="flex-1">
                        <label
                          className={`text-[8px] ${theme.sub} block mb-1 uppercase font-black`}>
                          Up to (₹)
                        </label>
                        <input
                          type="number"
                          className={`bg-transparent ${theme.text} font-bold outline-none w-full`}
                          value={slab.max}
                          onChange={(e) =>
                            updateSlab(index, "max", e.target.value)
                          }
                        />
                      </div>
                      <div
                        className={`flex-1 border-l ${lightMode ? "border-gray-200" : "border-white/10"} pl-4`}>
                        <label className="text-[8px] text-teal-500 block mb-1 uppercase font-black">
                          Inc (₹)
                        </label>
                        <input
                          type="number"
                          className="bg-transparent text-teal-500 font-bold outline-none w-full"
                          value={slab.inc}
                          onChange={(e) =>
                            updateSlab(index, "inc", e.target.value)
                          }
                        />
                      </div>
                      <button
                        onClick={() => removeSlab(index)}
                        className="text-red-500 hover:text-red-600 text-xl px-2">
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <h3
                className={`${theme.text} font-black uppercase text-xs mb-8 border-b ${borderClass} pb-4`}>
                Auction Logic Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label
                    className={`text-[10px] font-black ${theme.sub} uppercase`}>
                    Min Squad Size
                  </label>
                  <input
                    type="number"
                    className={`w-full rounded-xl p-4 border outline-none font-bold ${inputBgClass}`}
                    value={config.minSquadSize}
                    onChange={(e) =>
                      setConfig({ ...config, minSquadSize: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className={`text-[10px] font-black ${theme.sub} uppercase`}>
                    Max Squad Size
                  </label>
                  <input
                    type="number"
                    className={`w-full rounded-xl p-4 border outline-none font-bold ${inputBgClass}`}
                    value={config.maxSquadSize}
                    onChange={(e) =>
                      setConfig({ ...config, maxSquadSize: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className={`text-[10px] font-black ${theme.sub} uppercase`}>
                    Min Base Price
                  </label>
                  <input
                    type="number"
                    className={`w-full rounded-xl p-4 border outline-none font-bold ${inputBgClass}`}
                    value={config.minBasePrice}
                    onChange={(e) =>
                      setConfig({ ...config, minBasePrice: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className={`text-[10px] font-black ${theme.sub} uppercase`}>
                    Fallback Increment
                  </label>
                  <input
                    type="number"
                    className={`w-full rounded-xl p-4 border outline-none font-bold ${inputBgClass}`}
                    value={config.bidIncrement}
                    onChange={(e) =>
                      setConfig({ ...config, bidIncrement: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500 uppercase">
                    Max Bid Per Player
                  </label>
                  <input
                    type="number"
                    className={`w-full rounded-xl p-4 border outline-none font-bold ${lightMode ? "bg-amber-50 border-amber-200 focus:border-amber-400 text-gray-900" : "bg-[#0F1115] border-amber-500/20 focus:border-amber-500/50 text-slate-200"}`}
                    value={config.maxBidPerPlayer}
                    onChange={(e) =>
                      setConfig({ ...config, maxBidPerPlayer: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500 uppercase">
                    Max Icons Per Team
                  </label>
                  <input
                    type="number"
                    className={`w-full rounded-xl p-4 border outline-none font-bold ${lightMode ? "bg-amber-50 border-amber-200 focus:border-amber-400 text-gray-900" : "bg-[#0F1115] border-amber-500/20 focus:border-amber-500/50 text-slate-200"}`}
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
                  className={`flex-1 font-black py-5 rounded-xl uppercase text-xs border transition-colors ${lightMode ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-red-900/20 text-red-500 border-red-500/20 hover:bg-red-900/30"}`}>
                  Reset Rules
                </button>
                <button
                  onClick={handleUpdateConfig}
                  className="flex-[2] bg-teal-600 hover:bg-teal-700 text-white font-black py-5 rounded-xl uppercase text-xs shadow-lg transition-all active:scale-[0.98]">
                  Update Rules
                </button>
              </div>
            </div>

            {/* 🔥 NEW DANGER ZONE SETTINGS */}
            <h3
              className={`${theme.text} font-black uppercase text-xs mt-12 mb-6 border-b ${borderClass} pb-4 text-red-500 flex items-center gap-2`}>
              <span>⚠️</span> Advanced Settings (Danger Zone)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Sync Base Prices */}
              <div
                className={`${theme.card} p-6 rounded-2xl border ${lightMode ? "border-blue-200 bg-blue-50/50" : "border-blue-500/20 bg-blue-900/10"} shadow-sm flex flex-col`}>
                <h4
                  className={`font-black text-xs uppercase ${lightMode ? "text-blue-700" : "text-blue-500"} mb-2`}>
                  Sync Base Prices
                </h4>
                <p
                  className={`text-[10px] ${theme.sub} mb-6 flex-1 leading-relaxed`}>
                  Updates every player currently in the auction pool to match
                  your Min Base Price (₹{config.minBasePrice}). Useful when
                  setting up.
                </p>
                <button
                  onClick={handleSyncBasePrice}
                  disabled={isResetting}
                  className={`w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${lightMode ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-blue-600/20 text-blue-500 hover:bg-blue-600 hover:text-white"}`}>
                  {isResetting ? "Processing..." : "Sync Price To All"}
                </button>
              </div>

              {/* Feature 2: Reset All Players */}
              <div
                className={`${theme.card} p-6 rounded-2xl border ${lightMode ? "border-amber-200 bg-amber-50/50" : "border-amber-500/20 bg-amber-900/10"} shadow-sm flex flex-col`}>
                <h4
                  className={`font-black text-xs uppercase ${lightMode ? "text-amber-700" : "text-amber-500"} mb-2`}>
                  Reset Entire Pool
                </h4>
                <p
                  className={`text-[10px] ${theme.sub} mb-6 flex-1 leading-relaxed`}>
                  Marks all SOLD and UNSOLD players back to PENDING. Removes
                  them from their assigned teams and refunds all budgets.
                </p>
                <button
                  onClick={handleResetAllPlayers}
                  disabled={isResetting}
                  className={`w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${lightMode ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-amber-600/20 text-amber-500 hover:bg-amber-600 hover:text-white"}`}>
                  {isResetting ? "Processing..." : "Reset To Pending"}
                </button>
              </div>

              {/* Feature 3: Delete Auction Pool */}
              <div
                className={`${theme.card} p-6 rounded-2xl border ${lightMode ? "border-red-200 bg-red-50/50" : "border-red-500/20 bg-red-900/10"} shadow-sm flex flex-col`}>
                <h4
                  className={`font-black text-xs uppercase ${lightMode ? "text-red-700" : "text-red-500"} mb-2`}>
                  Delete All Data
                </h4>
                <p
                  className={`text-[10px] ${theme.sub} mb-6 flex-1 leading-relaxed`}>
                  Completely wipes the auction pool and removes all players from
                  team rosters. Use this to start a fresh auction.
                </p>
                <button
                  onClick={handleClearAuctionPool}
                  disabled={isResetting}
                  className={`w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${lightMode ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white"}`}>
                  {isResetting ? "Processing..." : "Clear Auction Pool"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "teams" && (
          <div className="space-y-6 pb-20">
            <div className="grid grid-cols-1 gap-6">
              <AuctionOwnersAdmin tournamentId={tournamentId} />
            </div>
          </div>
        )}

        {tab === "pool" && (
          <div className="space-y-6 pb-20">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                className={`${theme.card} p-4 rounded-2xl border ${borderClass} shadow-sm`}>
                <div
                  className={`text-[10px] ${theme.sub} uppercase font-black`}>
                  Total Pooled
                </div>
                <div className={`text-2xl ${theme.text} font-black`}>
                  {stats.total}
                </div>
              </div>
              <div
                className={`${theme.card} p-4 rounded-2xl border ${borderClass} shadow-sm`}>
                <div className="text-[10px] text-teal-600 dark:text-teal-500 uppercase font-black">
                  Sold
                </div>
                <div className="text-2xl text-teal-600 dark:text-teal-400 font-black">
                  {stats.sold}
                </div>
              </div>
              <div
                className={`${theme.card} p-4 rounded-2xl border ${borderClass} shadow-sm`}>
                <div className="text-[10px] text-amber-600 dark:text-orange-500 uppercase font-black">
                  Pending
                </div>
                <div className="text-2xl text-amber-600 dark:text-orange-400 font-black">
                  {stats.pending}
                </div>
              </div>
              <div
                className={`${theme.card} p-4 rounded-2xl border ${borderClass} shadow-sm`}>
                <div className="text-[10px] text-red-600 dark:text-red-500 uppercase font-black">
                  Unsold
                </div>
                <div className="text-2xl text-red-600 dark:text-red-400 font-black">
                  {stats.unsold}
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div
              className={`flex flex-col md:flex-row justify-between items-center gap-4 ${theme.card} p-4 rounded-2xl border ${borderClass} shadow-sm`}>
              <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                <div
                  className={`flex ${lightMode ? "bg-gray-100" : "bg-[#0F1115]"} rounded-xl p-1 border ${borderClass}`}>
                  {["PENDING", "SOLD", "UNSOLD"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setPoolFilter(f)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                        poolFilter === f
                          ? "bg-teal-600 text-white shadow-sm"
                          : `${theme.sub} hover:${theme.text}`
                      }`}>
                      {f}{" "}
                      <span className="opacity-50 text-[9px] ml-1">
                        (
                        {f === "PENDING"
                          ? stats.pending
                          : f === "SOLD"
                            ? stats.sold
                            : stats.unsold}
                        )
                      </span>
                    </button>
                  ))}
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={`${inputBgClass} text-xs font-bold px-4 py-2.5 rounded-xl border outline-none focus:border-teal-500`}>
                  <option value="All">All Roles ({stats.total})</option>
                  <option value="Batsman">Batsman ({stats.batsmen})</option>
                  <option value="Bowler">Bowler ({stats.bowlers})</option>
                  <option value="All-Rounder">
                    All-Rounder ({stats.allRounders})
                  </option>
                  <option value="Wicket Keeper">Wicket Keeper</option>
                </select>
                <select
                  value={slotFilter}
                  onChange={(e) => setSlotFilter(e.target.value)}
                  className={`${inputBgClass} text-xs font-bold px-4 py-2.5 rounded-xl border outline-none focus:border-teal-500`}>
                  <option value="All">All Slots</option>
                  <option value="Unassigned">
                    Unassigned ({unassignedCount})
                  </option>
                  <option disabled>──────────</option>
                  {slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.name} ({slotCounts[slot.id] || 0})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="w-full md:w-auto bg-gradient-to-r from-teal-600 to-teal-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg hover:shadow-teal-500/20 active:scale-95 transition-all">
                + Import Players
              </button>
            </div>

            {/* Table */}
            <div
              className={`${theme.card} border ${borderClass} rounded-2xl overflow-hidden shadow-xl overflow-x-auto`}>
              <div
                className={`p-4 border-b ${borderClass} ${lightMode ? "bg-gray-50" : "bg-[#161920]"} text-[10px] font-bold ${theme.sub} uppercase tracking-widest`}>
                Showing {displayList.length} Players
              </div>
              <table
                className={`w-full text-left text-sm ${theme.text} min-w-[1000px]`}>
                <thead
                  className={`${lightMode ? "bg-gray-100" : "bg-[#0F1115]"} text-[10px] font-black ${theme.sub} border-b ${borderClass} uppercase tracking-widest`}>
                  <tr>
                    <th className="p-5">Name</th>
                    <th className="p-5">Force Assign</th>
                    <th className="p-5">Assign Slot</th>
                    <th className="p-5">Base/Final Price</th>
                    <th className="p-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${lightMode ? "divide-gray-200" : "divide-white/5"}`}>
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
                      onUpdatePrice={handleUpdatePrice}
                      onToggleIcon={handleToggleIcon}
                      onDelete={handleDeletePlayer}
                      onReset={reAddPlayer}
                    />
                  ))}
                </tbody>
              </table>
              {displayList.length === 0 && (
                <div className={`p-10 text-center ${theme.sub} italic text-xs`}>
                  No players found matching current filters.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "slots" && (
          <div className="space-y-6 pb-20">
            <div
              className={`${theme.card} border ${borderClass} p-6 rounded-[2rem] shadow-sm`}>
              <div className="flex gap-3">
                <input
                  className={`flex-1 rounded-xl px-5 py-3 outline-none font-bold border ${inputBgClass}`}
                  placeholder="Round Name"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                />
                <button
                  onClick={handleCreateSlot}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-2 rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-sm">
                  Add Round
                </button>
              </div>
            </div>
            {slots.map((s) => (
              <div
                key={s.id}
                className={`${theme.card} p-4 rounded-xl flex justify-between items-center mb-2 border ${borderClass} shadow-sm`}>
                <div className="flex-1">
                  {editingSlotId === s.id ? (
                    <input
                      className={`w-full rounded-lg px-4 py-2 outline-none font-bold border focus:border-teal-500 ${inputBgClass}`}
                      value={editingSlotName}
                      onChange={(e) => setEditingSlotName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className={`${theme.text} font-bold`}>
                      {s.order}. {s.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 ml-4">
                  {editingSlotId === s.id ? (
                    <>
                      <button
                        onClick={() => handleUpdateSlot(s.id)}
                        className="text-emerald-600 dark:text-green-500 font-bold text-xs hover:underline">
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className={`${theme.sub} hover:${theme.text} text-xs font-bold hover:underline`}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditSlot(s)}
                        className={`${theme.sub} hover:text-teal-500 transition-colors`}>
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(s.id)}
                        className={`${theme.sub} hover:text-red-500 transition-colors`}>
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "matches" && (
          <div className="pb-20">
            <MatchScheduler tournamentId={tournamentId} teams={teams} />
          </div>
        )}
      </div>
    </div>
  );
}
