import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers, createGlobalPlayer } from "../utils/firestore";

// --- SUB-COMPONENT: OWNER ASSIGNMENT FORM (Form Modal) ---
const OwnerAssignmentForm = ({ team, globalPlayers, onSave, onCancel }) => {
  const [mode, setMode] = useState("existing");
  const [teamName, setTeamName] = useState(team?.name || "");
  const [purse, setPurse] = useState(team?.purse || 10000);
  const [selectedPlayerId, setSelectedPlayerId] = useState(team?.ownerId || "");
  const [newOwnerData, setNewOwnerData] = useState({
    name: "",
    mobile: "",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
  });
  const [isPlayer, setIsPlayer] = useState(team?.isOwnerPlaying || false);
  const [playerRole, setPlayerRole] = useState("All-Rounder");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!teamName) return alert("Team Name is required");
    if (mode === "existing" && !selectedPlayerId)
      return alert("Please select an owner");
    if (mode === "new" && !newOwnerData.name) return alert("Name is required");

    onSave({
      teamId: team?.id || null,
      teamName,
      purse: parseInt(purse),
      mode,
      selectedPlayerId,
      newOwnerData,
      isPlayer,
      playerRole,
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white">
          {team?.id ? "Edit Team & Owner" : "Create New Team"}
        </h3>
      </div>
      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          Team Name
        </label>
        <input
          type="text"
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white outline-none font-bold"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          Auction Purse
        </label>
        <div className="flex items-center bg-black border border-gray-700 rounded-lg overflow-hidden">
          <span className="px-4 text-gray-500 font-bold">₹</span>
          <input
            type="number"
            className="w-full bg-transparent text-white px-2 py-3 outline-none"
            value={purse}
            onChange={(e) => setPurse(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
          Assign Owner
        </label>
        <div className="flex bg-gray-800 rounded-lg p-1 mb-3">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md ${
              mode === "existing" ? "bg-cyan-600 text-white" : "text-gray-400"
            }`}>
            Select Global
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md ${
              mode === "new" ? "bg-green-600 text-white" : "text-gray-400"
            }`}>
            Create New
          </button>
        </div>
        {mode === "existing" ? (
          <select
            className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white outline-none"
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}>
            <option value="">-- Select Person --</option>
            {globalPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-3">
            <input
              placeholder="Owner Name"
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white outline-none"
              value={newOwnerData.name}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, name: e.target.value })
              }
            />
            <input
              placeholder="Mobile"
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white outline-none"
              value={newOwnerData.mobile}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, mobile: e.target.value })
              }
            />
          </div>
        )}
        <div className="mt-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex items-start gap-3">
          <input
            type="checkbox"
            id="isPlayer"
            className="mt-1"
            checked={isPlayer}
            onChange={(e) => setIsPlayer(e.target.checked)}
          />
          <div className="flex-1">
            <label
              htmlFor="isPlayer"
              className="text-sm font-bold text-white block">
              Also Add to Squad?
            </label>
            {isPlayer && (
              <select
                className="mt-2 w-full bg-black border border-gray-600 rounded px-2 py-1 text-xs text-white"
                value={playerRole}
                onChange={(e) => setPlayerRole(e.target.value)}>
                <option>All-Rounder</option>
                <option>Batsman</option>
                <option>Bowler</option>
                <option>Wicket Keeper</option>
              </select>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-4 border-t border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-gray-400 font-bold">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-3 rounded-lg">
          Save
        </button>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function AuctionOwnersAdmin({ tournamentId }) {
  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [globalPlayers, setGlobalPlayers] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gPlayers, teamsSnap, apSnap] = await Promise.all([
        listGlobalPlayers(),
        getDocs(collection(db, `tournaments/${tournamentId}/teams`)),
        getDocs(collection(db, `tournaments/${tournamentId}/auctionPlayers`)),
      ]);
      setGlobalPlayers(gPlayers);
      setTeams(teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAuctionPlayers(apSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [teamsSnap, apSnap, tourneyDoc] = await Promise.all([
          getDocs(collection(db, `tournaments/${tournamentId}/teams`)),
          getDocs(collection(db, `tournaments/${tournamentId}/auctionPlayers`)),
          import("firebase/firestore").then((mod) =>
            mod.getDoc(doc(db, "tournaments", tournamentId))
          ),
        ]);

        setTeams(teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setAuctionPlayers(apSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        if (tourneyDoc.exists()) {
          setConfig(tourneyDoc.data());
        }
      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [tournamentId]);

  const mergedData = useMemo(() => {
    return teams.map((team) => {
      const squadMembers = auctionPlayers.filter(
        (p) => p.status === "SOLD" && p.teamId === team.id
      );
      const spent = squadMembers.reduce(
        (acc, p) => acc + (p.soldPrice || 0),
        0
      );
      return {
        ...team,
        ownerName: team.ownerName || "Unassigned",
        squadCount: squadMembers.length,
        spent: spent,
      };
    });
  }, [teams, auctionPlayers]);

  const handleSave = async (payload) => {
    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        let finalOwnerId = payload.selectedPlayerId;
        let ownerDetails = null;

        // 1. Handle New Profile Creation (Transactionally creates Global Player if needed)
        if (payload.mode === "new") {
          const newPlayerRef = doc(collection(db, "globalPlayers"));
          transaction.set(newPlayerRef, {
            name: payload.newOwnerData.name,
            role: payload.isPlayer ? payload.playerRole : "Owner",
            mobile: payload.newOwnerData.mobile,
            createdAt: new Date().toISOString()
          });
          finalOwnerId = newPlayerRef.id;
          ownerDetails = { name: payload.newOwnerData.name, photoURL: "", role: payload.isPlayer ? payload.playerRole : "Owner" };
        } else {
          const p = globalPlayers.find((x) => x.id === finalOwnerId);
          ownerDetails = { name: p?.name, photoURL: p?.photoURL || "", role: p?.role, stats: p?.stats || {} };
        }

        // 2. Prepare Team Update
        const teamData = {
          name: payload.teamName,
          purse: payload.purse,
          ownerId: finalOwnerId,
          ownerName: ownerDetails.name,
        };

        let teamRef;
        if (payload.teamId) {
          teamRef = doc(db, `tournaments/${tournamentId}/teams`, payload.teamId);
          transaction.update(teamRef, teamData);
        } else {
          teamRef = doc(collection(db, `tournaments/${tournamentId}/teams`));
          transaction.set(teamRef, { ...teamData, spent: 0, roster: [], stats: { played: 0, won: 0, lost: 0, points: 0, nrr: 0 } });
        }

        // 3. Handle "Owner as Player" Logic (Ensures Squad and Auction Pool stay synced)
        if (payload.isPlayer) {
          const auctionPlayersRef = collection(db, `tournaments/${tournamentId}/auctionPlayers`);
          const existingQuery = query(auctionPlayersRef, where("originalPlayerId", "==", finalOwnerId));
          const querySnap = await getDocs(existingQuery);

          let auctionPlayerDocId;
          const auctionPlayerData = {
            originalPlayerId: finalOwnerId,
            name: ownerDetails.name,
            role: ownerDetails.role,
            status: "SOLD",
            teamId: teamRef.id,
            soldPrice: 0,
            isOwner: true,
            isIcon: true,
            photoURL: ownerDetails.photoURL,
          };

          if (!querySnap.empty) {
            auctionPlayerDocId = querySnap.docs[0].id;
            transaction.update(doc(auctionPlayersRef, auctionPlayerDocId), auctionPlayerData);
          } else {
            const newAPRef = doc(auctionPlayersRef);
            auctionPlayerDocId = newAPRef.id;
            transaction.set(newAPRef, { ...auctionPlayerData, basePrice: 0, statsSnapshot: ownerDetails.stats || {} });
          }

          // Update Roster Array on Team
          transaction.update(teamRef, {
            roster: [{
              id: auctionPlayerDocId,
              name: ownerDetails.name,
              role: ownerDetails.role,
              soldPrice: 0,
              isOwner: true,
              isIcon: true,
              originalId: finalOwnerId,
              photoURL: ownerDetails.photoURL
            }]
          });
        }
      });

      setEditingTeam(null);
      await fetchData();
    } catch (e) {
      alert("Transaction failed: " + e.message);
    } finally { setProcessing(false); }
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/5 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 uppercase tracking-tighter italic">
            Teams & Purse Management
          </h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-teal-400 text-[10px] font-bold border border-teal-500/20 rounded-xl hover:bg-teal-500/10">
            Refresh
          </button>
          <button
            onClick={() => setEditingTeam({ id: null, purse: 1000000 })}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-colors">
            + Add Team
          </button>
        </div>
      </div>

      {/* --- REPLACED TABLE WITH GRID CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center p-12 text-teal-500 animate-pulse font-bold text-xs uppercase tracking-widest">
            Loading Teams...
          </div>
        ) : mergedData.length === 0 ? (
          <div className="col-span-full text-center p-12 text-slate-500 italic text-xs">
            No teams found. Add one to get started.
          </div>
        ) : (
          mergedData.map((t) => {
            const balance = (t.purse || 0) - (t.spent || 0);
            return (
              <div
                key={t.id}
                className="bg-[#1C2128] p-5 rounded-[2.5rem] shadow-xl border border-white/5 hover:border-teal-500/20 transition-all group relative">
                {/* Edit Button Absolute */}
                <button
                  onClick={() => setEditingTeam(t)}
                  className="absolute top-5 right-5 text-slate-500 hover:text-teal-400 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-all text-xs">
                  ✎ Edit
                </button>

                <div className="mb-6">
                  <div className="text-[8px] text-teal-500 uppercase font-black tracking-[0.2em] mb-1">
                    Active Team
                  </div>
                  <div className="font-black text-white text-xl uppercase italic leading-none pr-8 truncate">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1">
                    Owner: <span className="text-slate-300">{t.ownerName}</span>
                  </div>
                </div>

                {/* RICH STATS GRID (Styled like Form) */}
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0F1115] p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className="text-[7px] text-slate-500 uppercase font-black mb-1">
                        Squad
                      </div>
                      <div className="text-lg font-black text-white italic">
                        {t.squadCount}{" "}
                        <span className="text-[9px] text-slate-600 ml-0.5 not-italic">
                          / {config?.maxSquadSize}
                        </span>
                      </div>
                    </div>
                    <div className="bg-[#0F1115] p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className="text-[7px] text-slate-500 uppercase font-black mb-1">
                        Spent
                      </div>
                      <div className="text-lg font-black text-red-500 truncate">
                        ₹{t.spent.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0F1115] p-4 rounded-2xl border border-white/5 border-l-4 border-l-green-500 relative overflow-hidden">
                    <div className="flex justify-between items-center">
                      <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">
                        Balance
                      </div>
                      <div className="text-lg font-black text-green-400 font-mono tracking-tighter truncate">
                        ₹{balance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingTeam && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#1C2128] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {processing ? (
              <div className="p-12 text-center text-teal-500 animate-pulse font-black uppercase text-xs tracking-widest">
                Saving Changes...
              </div>
            ) : (
              <OwnerAssignmentForm
                team={editingTeam}
                globalPlayers={globalPlayers}
                onSave={handleSave}
                onCancel={() => setEditingTeam(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
