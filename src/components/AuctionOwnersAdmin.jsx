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

// --- SUB-COMPONENT: OWNER ASSIGNMENT FORM (Unchanged) ---
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
    if (mode === "existing" && !selectedPlayerId) return alert("Please select an owner");
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
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team Name</label>
        <input type="text" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white outline-none font-bold" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Auction Purse</label>
        <div className="flex items-center bg-black border border-gray-700 rounded-lg overflow-hidden">
          <span className="px-4 text-gray-500 font-bold">₹</span>
          <input type="number" className="w-full bg-transparent text-white px-2 py-3 outline-none" value={purse} onChange={(e) => setPurse(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Assign Owner</label>
        <div className="flex bg-gray-800 rounded-lg p-1 mb-3">
          <button type="button" onClick={() => setMode("existing")} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${mode === "existing" ? "bg-cyan-600 text-white" : "text-gray-400"}`}>Select Global</button>
          <button type="button" onClick={() => setMode("new")} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${mode === "new" ? "bg-green-600 text-white" : "text-gray-400"}`}>Create New</button>
        </div>
        {mode === "existing" ? (
          <select className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white outline-none" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
            <option value="">-- Select Person --</option>
            {globalPlayers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
          </select>
        ) : (
          <div className="space-y-3">
            <input placeholder="Owner Name" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white outline-none" value={newOwnerData.name} onChange={(e) => setNewOwnerData({ ...newOwnerData, name: e.target.value })} />
            <input placeholder="Mobile" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white outline-none" value={newOwnerData.mobile} onChange={(e) => setNewOwnerData({ ...newOwnerData, mobile: e.target.value })} />
          </div>
        )}
        <div className="mt-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex items-start gap-3">
          <input type="checkbox" id="isPlayer" className="mt-1" checked={isPlayer} onChange={(e) => setIsPlayer(e.target.checked)} />
          <div className="flex-1">
            <label htmlFor="isPlayer" className="text-sm font-bold text-white block">Also Add to Squad?</label>
            {isPlayer && (
               <select className="mt-2 w-full bg-black border border-gray-600 rounded px-2 py-1 text-xs text-white" value={playerRole} onChange={(e) => setPlayerRole(e.target.value)}>
                 <option>All-Rounder</option><option>Batsman</option><option>Bowler</option><option>Wicket Keeper</option>
               </select>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-4 border-t border-gray-800">
        <button type="button" onClick={onCancel} className="flex-1 text-gray-400 font-bold">Cancel</button>
        <button onClick={handleSubmit} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-3 rounded-lg">Save</button>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function AuctionOwnersAdmin({ tournamentId }) {
  const [globalPlayers, setGlobalPlayers] = useState([]);
  const [auctionPlayers, setAuctionPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gPlayers, teamsSnap, apSnap] = await Promise.all([
        listGlobalPlayers(),
        getDocs(collection(db, `tournaments/${tournamentId}/teams`)),
        getDocs(collection(db, `tournaments/${tournamentId}/auctionPlayers`))
      ]);
      setGlobalPlayers(gPlayers);
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAuctionPlayers(apSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [tournamentId]);

  const mergedData = useMemo(() => {
    return teams.map((team) => {
      const owner = globalPlayers.find((p) => p.id === team.ownerId);
      const squadMembers = auctionPlayers.filter((p) => p.status === "SOLD" && p.teamId === team.id);
      const ownerPlayerEntry = auctionPlayers.find((p) => p.originalPlayerId === team.ownerId && p.teamId === team.id);
      return { ...team, ownerName: owner?.name || "Unassigned", ownerRole: owner?.role || "N/A", isAssigned: !!owner, squadCount: squadMembers.length, isOwnerPlaying: !!ownerPlayerEntry };
    });
  }, [teams, globalPlayers, auctionPlayers]);

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
      {/* UI structure remains identical to your existing file, but logic is now transaction-safe */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Owner & Team Management</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="px-4 py-2 text-cyan-400 text-sm border border-cyan-900/50 rounded-lg">Refresh</button>
          <button onClick={() => setEditingTeam({ id: null, purse: 10000 })} className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg shadow-lg">+ Add Team</button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-800">
        <table className="w-full text-left text-gray-300">
          <thead className="text-[10px] text-gray-500 uppercase bg-gray-950 font-black tracking-widest">
            <tr><th className="px-6 py-4">Team</th><th className="px-6 py-4">Owner</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4">Purse</th><th className="px-6 py-4 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? <tr><td colSpan={5} className="text-center p-12 text-cyan-500 animate-pulse font-bold">Syncing...</td></tr> : mergedData.map((team) => (
              <tr key={team.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-white font-bold text-lg">{team.name}</div>
                  <div className="text-xs text-gray-500">{team.squadCount} Players in Squad</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-200">{team.ownerName}</div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-gray-500 uppercase">{team.ownerRole}</span>
                    {team.isOwnerPlaying && <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1.5 rounded border border-purple-800">PLAYING</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                   <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase border ${team.isAssigned ? 'bg-green-900/20 text-green-400 border-green-800/50' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                     {team.isAssigned ? 'Active' : 'Unassigned'}
                   </span>
                </td>
                <td className="px-6 py-4 text-white font-mono font-bold">₹ {parseInt(team.purse || 0).toLocaleString()}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setEditingTeam(team)} className="text-cyan-400 hover:text-white bg-cyan-900/10 p-2 rounded-lg border border-cyan-900/30">✎</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {processing ? <div className="p-10 text-center text-cyan-500 animate-pulse font-bold">Saving Data...</div> : (
              <OwnerAssignmentForm team={editingTeam} globalPlayers={globalPlayers} onSave={handleSave} onCancel={() => setEditingTeam(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}