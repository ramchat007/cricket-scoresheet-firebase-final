import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";

// --- GLOBAL PLAYER SEARCH MODAL ---
const GlobalPlayerPicker = ({ isOpen, onClose, onImport, existingIds }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listGlobalPlayers().then((data) => {
        // Filter out players already in the auction
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

// --- MAIN SETUP PANEL ---
export default function AuctionAdminPanel({ tournamentId, onClose }) {
  const [tab, setTab] = useState("pool"); // 'pool' or 'teams'
  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  // Fetch Data
  const fetchData = async () => {
    // 1. Fetch Auction Players
    const pRef = collection(db, "tournaments", tournamentId, "auctionPlayers");
    const pSnap = await getDocs(query(pRef, orderBy("name")));
    setAuctionPlayers(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

    // 2. Fetch Teams
    const tRef = collection(db, "tournaments", tournamentId, "teams");
    const tSnap = await getDocs(tRef);
    setTeams(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchData();
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
      // Create a NEW document in the auction pool
      const newRef = doc(colRef);
      batch.set(newRef, {
        originalPlayerId: p.id, // Link back to Global DB
        name: p.name,
        role: p.role || "All-Rounder",
        basePrice: 100, // Default Base Price
        status: "UNSOLD",
        soldPrice: 0,
        teamId: null,
        // Optional: Snapshot current stats for the auction display
        statsSnapshot: {
          runs: p.stats?.runs || 0,
          wickets: p.stats?.wickets || 0,
          matches: p.stats?.matches || 0,
        },
      });
    });

    await batch.commit();
    setShowPicker(false);
    fetchData(); // Refresh the list
  };

  const updateBasePrice = async (playerId, newPrice) => {
    const ref = doc(
      db,
      "tournaments",
      tournamentId,
      "auctionPlayers",
      playerId
    );
    await updateDoc(ref, { basePrice: parseInt(newPrice) || 0 });
    // Optimistic Update
    setAuctionPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, basePrice: newPrice } : p))
    );
  };

  const deletePlayer = async (playerId) => {
    if (!window.confirm("Remove player from auction?")) return;
    await deleteDoc(
      doc(db, "tournaments", tournamentId, "auctionPlayers", playerId)
    );
    fetchData();
  };

  const updateTeamPurse = async (teamId, newPurse) => {
    const ref = doc(db, "tournaments", tournamentId, "teams", teamId);
    await updateDoc(ref, { purse: parseInt(newPurse) || 0 });
    // Optimistic Update
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, purse: newPurse } : t))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
      <GlobalPlayerPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onImport={handleImport}
        existingIds={auctionPlayers.map((p) => p.originalPlayerId)}
      />

      {/* HEADER */}
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

      {/* TABS */}
      <div className="flex border-b border-gray-800 bg-gray-900">
        <button
          onClick={() => setTab("pool")}
          className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider ${
            tab === "pool"
              ? "text-cyan-400 border-b-2 border-cyan-400"
              : "text-gray-500 hover:text-white"
          }`}>
          Player Pool ({auctionPlayers.length})
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider ${
            tab === "teams"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-500 hover:text-white"
          }`}>
          Team Wallets ({teams.length})
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* --- TAB: PLAYER POOL --- */}
        {tab === "pool" && (
          <div className="space-y-4">
            <button
              onClick={() => setShowPicker(true)}
              className="w-full py-4 bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-900/50 transition-all flex items-center justify-center gap-2">
              <span>+</span> Add Players from Global DB
            </button>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-950 text-xs uppercase font-bold text-gray-500">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Base Price</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {auctionPlayers.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-800/50">
                      <td className="p-4 font-bold text-white">{p.name}</td>
                      <td className="p-4">{p.role}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          className="bg-black border border-gray-700 rounded px-2 py-1 w-24 text-white focus:border-cyan-500 outline-none"
                          value={p.basePrice}
                          onChange={(e) =>
                            updateBasePrice(p.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => deletePlayer(p.id)}
                          className="text-red-500 hover:text-red-400">
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                  {auctionPlayers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center italic">
                        No players in pool yet.
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
            {teams.map((t) => (
              <div
                key={t.id}
                className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-lg">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Players: {t.players?.length || 0}
                  </div>
                </div>
                <div className="text-right">
                  <label className="text-[10px] text-green-500 font-bold uppercase block mb-1">
                    Total Purse
                  </label>
                  <input
                    type="number"
                    className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-right w-32 focus:border-green-500 outline-none"
                    value={t.purse || 0}
                    onChange={(e) => updateTeamPurse(t.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div className="text-gray-500 col-span-2 text-center">
                No teams found in tournament.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
