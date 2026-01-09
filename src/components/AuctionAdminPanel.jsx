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
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";
import AuctionOwnersAdmin from "./AuctionOwnersAdmin";
import MatchScheduler from "./MatchScheduler"; // ✅ Import reused component

// --- 1. GLOBAL PLAYER SEARCH MODAL (Unchanged) ---
const GlobalPlayerPicker = ({ isOpen, onClose, onImport, existingIds }) => {
  // ... (Keep existing GlobalPlayerPicker code exactly as it was) ...
  // For brevity in this response, assume the code from the previous step exists here.
  // Use the exact same code for GlobalPlayerPicker provided in previous steps.
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
          <h3 className="text-white font-bold">
            Select Players from Global DB
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
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
            <div className="text-center py-10 text-cyan-500">
              Loading Database...
            </div>
          ) : (
            filtered.map((p) => {
              const isSel = selected.find((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 ${
                    isSel
                      ? "bg-cyan-900/30 border border-cyan-500/50"
                      : "hover:bg-gray-800 border border-transparent"
                  }`}>
                  <div className="text-white font-bold text-sm">
                    {p.name}{" "}
                    <span className="text-gray-500 font-normal text-xs ml-2">
                      ({p.role})
                    </span>
                  </div>
                  {isSel && <div className="text-cyan-400">✓</div>}
                </div>
              );
            })
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No available players found. <br />
              <span className="text-xs text-gray-600">
                (All global players are already in this tournament)
              </span>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onImport(selected)}
            disabled={selected.length === 0}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
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
  // eslint-disable-next-line
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

    return () => {
      unsubPool();
      unsubTeams();
    };
  }, [tournamentId]);

  // --- ACTIONS ---

  const handleImport = async (selectedGlobalPlayers) => {
    const batch = writeBatch(db);
    const colRef = collection(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers"
    );

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
    const ref = doc(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
      playerId
    );
    const price = parseInt(newPrice);
    await updateDoc(ref, { basePrice: isNaN(price) ? 0 : price });
  };

  const toggleIconStatus = async (playerId, currentStatus) => {
    const ref = doc(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
      playerId
    );
    await updateDoc(ref, { isIcon: !currentStatus });
  };

  const deletePlayer = async (playerId) => {
    if (!window.confirm("Remove player? This cannot be undone.")) return;
    await deleteDoc(
      doc(db, "tournaments", tournamentId, "auctionPlayers", playerId)
    );
  };

  const reAddPlayer = async (playerId) => {
    if (!window.confirm("Reset to PENDING? Refunds purse & updates squad."))
      return;

    try {
      await runTransaction(db, async (transaction) => {
        const playerRef = doc(
          db,
          "tournaments",
          tournamentId,
          "auctionPlayers",
          playerId
        );
        const playerSnap = await transaction.get(playerRef);

        if (!playerSnap.exists()) throw new Error("Player not found!");
        const playerData = playerSnap.data();

        if (playerData.status === "SOLD" && playerData.teamId) {
          const teamRef = doc(
            db,
            "tournaments",
            tournamentId,
            "teams",
            playerData.teamId
          );
          const teamSnap = await transaction.get(teamRef);

          if (teamSnap.exists()) {
            const teamData = teamSnap.data();

            // Safe calculations
            const currentSpent = Number(teamData.spent) || 0;
            const refundAmount = Number(playerData.soldPrice) || 0;
            const newSpent = Math.max(0, currentSpent - refundAmount);

            const currentRoster = Array.isArray(teamData.roster)
              ? teamData.roster
              : [];
            // Filter out player
            const newRoster = currentRoster
              .filter((p) => p.id !== playerId)
              .map((p) => ({
                id: p.id || "",
                name: p.name || "Unknown",
                role: p.role || "Player",
                soldPrice: Number(p.soldPrice) || 0,
                isOwner: !!p.isOwner,
                isIcon: !!p.isIcon,
                originalId: p.originalId || null,
              }));

            transaction.update(teamRef, {
              spent: newSpent,
              roster: newRoster,
            });
          }
        }

        transaction.update(playerRef, {
          status: "PENDING",
          soldPrice: 0,
          teamId: null,
        });
      });
    } catch (e) {
      console.error("Error resetting player:", e);
      alert("Failed to reset player: " + e.message);
    }
  };

  const updateTeamPurse = async (teamId, newPurse) => {
    const ref = doc(db, "tournaments", tournamentId, "teams", teamId);
    const purseVal = parseInt(newPurse);
    await updateDoc(ref, { purse: isNaN(purseVal) ? 0 : purseVal });
  };

  const handleReset = async () => {
    // ... (Use same reset logic as before) ...
    // For brevity, ensuring this part isn't truncated
    if (
      !window.confirm(
        "⚠ DANGER: DELETE ALL Auction Data & Teams? Cannot be undone."
      )
    )
      return;

    setIsResetting(true);
    try {
      const batchSize = 500;
      let batch = writeBatch(db);
      let opCount = 0;

      // 1. Delete Players
      const poolRef = collection(
        db,
        "tournaments",
        tournamentId,
        "auctionPlayers"
      );
      const poolSnap = await getDocs(poolRef);
      poolSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        opCount++;
        if (opCount >= batchSize) {
          batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      });

      // 2. Delete State
      const stateDocRef = doc(
        db,
        "tournaments",
        tournamentId,
        "auction",
        "state"
      );
      batch.delete(stateDocRef);
      opCount++;

      // 3. Delete Teams
      const teamSnap = await getDocs(
        collection(db, "tournaments", tournamentId, "teams")
      );
      teamSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        opCount++;
        if (opCount >= batchSize) {
          batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      });

      // 4. Matches
      const matchSnap = await getDocs(
        collection(db, "tournaments", tournamentId, "matches")
      );
      matchSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        opCount++;
        if (opCount >= batchSize) {
          batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      });

      if (opCount > 0) await batch.commit();

      alert("Reset Complete.");
      onClose();
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  const displayList = auctionPlayers.filter((p) => {
    if (poolFilter === "SOLD") return p.status === "SOLD";
    if (poolFilter === "UNSOLD")
      return p.status === "UNSOLD" || p.status === "UNSOLD_PASSED";
    return p.status === "PENDING";
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
      <GlobalPlayerPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onImport={handleImport}
        existingIds={auctionPlayers.map((p) => p.originalPlayerId)}
      />

      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>⚙️</span> Auction Setup
        </h2>
        <button
          onClick={onClose}
          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
          Close & Return
        </button>
      </div>

      <div className="flex border-b border-gray-800 bg-gray-900 overflow-x-auto">
        <button
          onClick={() => setTab("pool")}
          className={`flex-1 min-w-[100px] py-4 text-sm font-bold uppercase tracking-wider ${
            tab === "pool"
              ? "text-cyan-400 border-b-2 border-cyan-400"
              : "text-gray-500 hover:text-white"
          }`}>
          Players
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`flex-1 min-w-[100px] py-4 text-sm font-bold uppercase tracking-wider ${
            tab === "teams"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-500 hover:text-white"
          }`}>
          Wallets
        </button>
        <button
          onClick={() => setTab("owners")}
          className={`flex-1 min-w-[100px] py-4 text-sm font-bold uppercase tracking-wider ${
            tab === "owners"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-gray-500 hover:text-white"
          }`}>
          Owners
        </button>
        <button
          onClick={() => setTab("matches")}
          className={`flex-1 min-w-[100px] py-4 text-sm font-bold uppercase tracking-wider ${
            tab === "matches"
              ? "text-yellow-400 border-b-2 border-yellow-400"
              : "text-gray-500 hover:text-white"
          }`}>
          Matches
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* --- TAB: PLAYER POOL --- */}
        {tab === "pool" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex bg-gray-800 rounded-lg p-1">
                {["PENDING", "SOLD", "UNSOLD"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPoolFilter(filter)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      poolFilter === filter
                        ? "bg-gray-700 text-white shadow"
                        : "text-gray-400 hover:text-gray-200"
                    }`}>
                    {filter}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-lg font-bold text-sm hover:bg-cyan-900/50 transition-all">
                + Add Players
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-950 text-xs uppercase font-bold text-gray-500">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">
                      {poolFilter === "SOLD" ? "Sold For" : "Base Price"}
                    </th>
                    {poolFilter === "SOLD" && <th className="p-4">Team</th>}
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {displayList.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-800/50">
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {p.isOwner && (
                            <span className="text-[9px] bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded">
                              OWNER
                            </span>
                          )}
                          {p.isIcon && (
                            <span className="text-[9px] bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                              ★ ICON
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">{p.role}</td>
                      <td className="p-4">
                        {poolFilter === "SOLD" ? (
                          <span className="text-green-400 font-mono">
                            ₹ {p.soldPrice}
                          </span>
                        ) : (
                          <input
                            type="number"
                            className="bg-black border border-gray-700 rounded px-2 py-1 w-24 text-white focus:border-cyan-500 outline-none"
                            value={p.basePrice}
                            onChange={(e) =>
                              updateBasePrice(p.id, e.target.value)
                            }
                          />
                        )}
                      </td>
                      {poolFilter === "SOLD" && (
                        <td className="p-4 text-white">
                          {teamsMap[p.teamId] || "Unknown Team"}
                        </td>
                      )}
                      <td className="p-4 text-right flex justify-end gap-3 items-center">
                        <button
                          onClick={() => toggleIconStatus(p.id, p.isIcon)}
                          className={`text-lg transition-colors ${
                            p.isIcon
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-gray-600 hover:text-gray-400"
                          }`}>
                          ★
                        </button>
                        {(poolFilter === "UNSOLD" || poolFilter === "SOLD") && (
                          <button
                            onClick={() => reAddPlayer(p.id)}
                            className="bg-cyan-900/50 text-cyan-400 hover:bg-cyan-600 hover:text-white px-2 py-1 rounded transition-colors">
                            ↺
                          </button>
                        )}
                        <button
                          onClick={() => deletePlayer(p.id)}
                          className="text-red-500 hover:text-red-400">
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                  {displayList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center italic">
                        No players found in {poolFilter} list.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB: TEAM WALLETS --- */}
        {tab === "teams" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((t) => {
              const purse = Number(t.purse) || 0;
              const spent = Number(t.spent) || 0;
              const remaining = purse - spent;
              const percentUsed = purse > 0 ? (spent / purse) * 100 : 0;
              return (
                <div
                  key={t.id}
                  className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white text-lg">
                        {t.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Squad: {t.roster?.length || 0}
                      </div>
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] text-gray-500 font-bold uppercase block">
                        Remaining
                      </label>
                      <div
                        className={`text-xl font-mono font-bold ${
                          remaining < 1000 ? "text-red-400" : "text-white"
                        }`}>
                        ₹{remaining.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        remaining < 2000 ? "bg-red-500" : "bg-green-500"
                      }`}
                      style={{ width: `${percentUsed}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                    <div className="text-xs text-gray-500">
                      Purse:{" "}
                      <span className="text-green-400 font-bold">
                        ₹{purse.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="number"
                      className="bg-black border border-gray-700 rounded px-2 py-1 w-24 text-white text-right text-xs focus:border-green-500 outline-none"
                      value={t.purse || 0}
                      onChange={(e) => updateTeamPurse(t.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- TAB: OWNERS --- */}
        {tab === "owners" && (
          <div className="animate-in fade-in">
            <AuctionOwnersAdmin tournamentId={tournamentId} />
          </div>
        )}

        {/* --- TAB: MATCHES (Reused Component) --- */}
        {tab === "matches" && (
          <MatchScheduler tournamentId={tournamentId} teams={teams} />
        )}

        {/* --- DANGER ZONE --- */}
        <div className="mt-12 border-t border-red-900/50 pt-8 mb-8">
          <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h4 className="text-red-500 font-bold text-lg">Danger Zone</h4>
              <p className="text-red-400/60 text-sm">
                Deleting the auction will remove the "Live State", clear the
                player pool, <strong>DELETE ALL TEAMS</strong> and{" "}
                <strong>MATCHES</strong>.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg whitespace-nowrap transition-all hover:scale-105 disabled:opacity-50">
              {isResetting ? "Deleting..." : "⚠ Delete Auction Data"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
