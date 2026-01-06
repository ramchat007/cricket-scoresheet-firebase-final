import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers, createGlobalPlayer } from "../utils/firestore";

// --- SUB-COMPONENT: OWNER ASSIGNMENT FORM ---
const OwnerAssignmentForm = ({ team, globalPlayers, onSave, onCancel }) => {
  // Mode: 'existing' or 'new'
  const [mode, setMode] = useState("existing");

  // Team Fields
  const [teamName, setTeamName] = useState(team?.name || "");
  const [purse, setPurse] = useState(team?.purse || 10000);

  // Existing Owner Mode
  const [selectedPlayerId, setSelectedPlayerId] = useState(team?.ownerId || "");

  // New Owner Mode
  const [newOwnerData, setNewOwnerData] = useState({
    name: "",
    mobile: "",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
  });

  // "Owner is Player" Logic
  // Check if the passed team object implies the owner is playing (passed from parent)
  const [isPlayer, setIsPlayer] = useState(team?.isOwnerPlaying || false);
  const [playerRole, setPlayerRole] = useState("All-Rounder");

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!teamName) return alert("Team Name is required");
    if (mode === "existing" && !selectedPlayerId)
      return alert("Please select an owner");
    if (mode === "new" && !newOwnerData.name) return alert("Name is required");

    const payload = {
      teamId: team?.id || null, // Handle new teams (id will be null)
      teamName,
      purse: parseInt(purse),
      mode,
      selectedPlayerId,
      newOwnerData,
      isPlayer,
      playerRole,
    };

    onSave(payload);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white">
          {team?.id ? "Edit Team & Owner" : "Create New Team"}
        </h3>
      </div>

      {/* 1. EDIT TEAM DETAILS */}
      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          Team Name
        </label>
        <input
          type="text"
          placeholder="e.g. Mumbai Indians"
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none font-bold"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </div>

      {/* 2. PURSE SETTING */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          Auction Purse (Budget)
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

      {/* 3. OWNER SELECTION TABS */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
          Assign Owner
        </label>
        <div className="flex bg-gray-800 rounded-lg p-1 mb-3">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              mode === "existing"
                ? "bg-cyan-600 text-white shadow"
                : "text-gray-400"
            }`}>
            Select Global Player
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              mode === "new"
                ? "bg-green-600 text-white shadow"
                : "text-gray-400"
            }`}>
            Create New Profile
          </button>
        </div>

        {/* MODE: EXISTING */}
        {mode === "existing" && (
          <div className="space-y-3">
            <select
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}>
              <option value="">-- Select Person --</option>
              {globalPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role || "Unknown"})
                </option>
              ))}
            </select>

            {/* OPTIONAL: ADD EXISTING OWNER TO SQUAD */}
            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex items-start gap-3">
              <input
                type="checkbox"
                id="isPlayerExisting"
                className="mt-1 w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500"
                checked={isPlayer}
                onChange={(e) => setIsPlayer(e.target.checked)}
              />
              <div className="flex-1">
                <label
                  htmlFor="isPlayerExisting"
                  className="text-sm font-bold text-white block">
                  Also Add to Squad?
                </label>
                <p className="text-xs text-gray-400">
                  If checked, this person will be added to the Auction Players
                  list as <span className="text-green-400">SOLD (Owner)</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MODE: NEW */}
        {mode === "new" && (
          <div className="space-y-3 animate-in slide-in-from-top-2">
            <input
              placeholder="Owner Name"
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-green-500"
              value={newOwnerData.name}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, name: e.target.value })
              }
            />
            <input
              placeholder="Mobile (Optional)"
              className="w-full bg-black border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-green-500"
              value={newOwnerData.mobile}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, mobile: e.target.value })
              }
            />

            {/* OWNER AS PLAYER CHECKBOX */}
            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex items-start gap-3">
              <input
                type="checkbox"
                id="isPlayerNew"
                className="mt-1 w-4 h-4 rounded text-green-500 focus:ring-green-500"
                checked={isPlayer}
                onChange={(e) => setIsPlayer(e.target.checked)}
              />
              <div className="flex-1">
                <label
                  htmlFor="isPlayerNew"
                  className="text-sm font-bold text-white block">
                  Add as Player?
                </label>
                <p className="text-xs text-gray-400">
                  Creates a player profile in the Auction Pool marked as Sold.
                </p>

                {isPlayer && (
                  <div className="mt-2 space-y-2">
                    <select
                      className="w-full bg-black border border-gray-600 rounded px-2 py-1 text-xs text-white"
                      value={playerRole}
                      onChange={(e) => setPlayerRole(e.target.value)}>
                      <option>All-Rounder</option>
                      <option>Batsman</option>
                      <option>Bowler</option>
                      <option>Wicket Keeper</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 font-bold transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all">
          {team?.id ? "Save Changes" : "Create Team"}
        </button>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function AuctionOwnersAdmin({ tournamentId }) {
  const [globalPlayers, setGlobalPlayers] = useState([]); // Stores Global DB Players
  const [auctionPlayers, setAuctionPlayers] = useState([]); // Stores Tournament Players (Source of Truth for Squads)
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [editingTeam, setEditingTeam] = useState(null);

  // 1. Fetch Data (Teams + AuctionPlayers + GlobalPlayers)
  const fetchData = async () => {
    setLoading(true);
    try {
      // A. Get Global Players (for dropdown)
      const gPlayers = await listGlobalPlayers();
      setGlobalPlayers(gPlayers);

      // B. Get Tournament Teams
      const teamsSnap = await getDocs(
        collection(db, `tournaments/${tournamentId}/teams`)
      );
      const teamList = teamsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setTeams(teamList);

      // C. Get Tournament Auction Players (To calculate squad counts & find owner-players)
      const apSnap = await getDocs(
        collection(db, `tournaments/${tournamentId}/auctionPlayers`)
      );
      const apList = apSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAuctionPlayers(apList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId]);

  // 2. Merge Data for Table Display
  const mergedData = useMemo(() => {
    return teams.map((team) => {
      // Find owner details from Global DB
      const owner = globalPlayers.find((p) => p.id === team.ownerId);

      // Calculate squad size from AuctionPlayers collection (Status = SOLD, TeamID matches)
      const squadMembers = auctionPlayers.filter(
        (p) => p.status === "SOLD" && p.teamId === team.id
      );

      // Check if Owner is playing (Exists in AuctionPlayers with isOwner: true)
      const ownerPlayerEntry = auctionPlayers.find(
        (p) => p.originalPlayerId === team.ownerId && p.teamId === team.id
      );

      return {
        ...team,
        ownerName: owner?.name || "Unassigned",
        ownerRole: owner?.role || "N/A",
        isAssigned: !!owner,
        squadCount: squadMembers.length,
        isOwnerPlaying: !!ownerPlayerEntry, // Flag for the Edit Form
      };
    });
  }, [teams, globalPlayers, auctionPlayers]);

  // 3. CREATE NEW TEAM HANDLER
  const handleCreateNewTeam = () => {
    setEditingTeam({
      id: null, // Signals NEW team
      name: "",
      purse: 10000,
      ownerId: "",
      isOwnerPlaying: false,
    });
  };

  // 4. SAVE HANDLER (The Core Logic Change)
  const handleSave = async (payload) => {
    setProcessing(true);
    try {
      let finalOwnerId = payload.selectedPlayerId;
      let ownerName = "";
      let ownerRole = "Owner";
      let ownerStats = {};

      // --- A. Handle "New Profile" Creation ---
      if (payload.mode === "new") {
        ownerName = payload.newOwnerData.name;
        ownerRole = payload.isPlayer ? payload.playerRole : "Owner";

        // Create in Global DB
        finalOwnerId = await createGlobalPlayer({
          name: ownerName,
          role: ownerRole,
          mobile: payload.newOwnerData.mobile,
          battingStyle: payload.newOwnerData.battingStyle || "Right Hand Bat",
          bowlingStyle: payload.newOwnerData.bowlingStyle || "Right Arm Medium",
        });
      } else {
        // Existing Mode: Get details
        const p = globalPlayers.find((x) => x.id === finalOwnerId);
        if (p) {
          ownerName = p.name;
          ownerRole = p.role;
          ownerStats = p.stats || {};
        }
      }

      // --- B. Prepare Team Data ---
      const teamData = {
        name: payload.teamName,
        purse: payload.purse,
        ownerId: finalOwnerId,
      };

      // --- C. Update or Create Team Document ---
      let teamRef;
      let resultingTeamId = payload.teamId;

      if (payload.teamId) {
        // UPDATE EXISTING TEAM
        teamRef = doc(db, `tournaments/${tournamentId}/teams`, payload.teamId);
        await updateDoc(teamRef, teamData);
      } else {
        // CREATE NEW TEAM
        // Note: New teams don't need 'roster' array anymore!
        const newTeamData = {
          ...teamData,
          spent: 0,
          stats: { played: 0, won: 0, lost: 0, points: 0, nrr: 0 },
        };
        const docRef = await addDoc(
          collection(db, `tournaments/${tournamentId}/teams`),
          newTeamData
        );
        teamRef = docRef;
        resultingTeamId = docRef.id;
      }

      // --- D. Handle "Owner as Player" Logic (Single Source of Truth) ---

      const auctionPlayersRef = collection(
        db,
        `tournaments/${tournamentId}/auctionPlayers`
      );

      if (payload.isPlayer) {
        // 1. Check if this player is ALREADY in the auction pool (to avoid duplicates)
        // We look for originalPlayerId matches
        const existingEntryQuery = query(
          auctionPlayersRef,
          where("originalPlayerId", "==", finalOwnerId)
        );
        const querySnap = await getDocs(existingEntryQuery);

        if (!querySnap.empty) {
          // Player exists in tournament, update them to be SOLD to this team
          const existingDocId = querySnap.docs[0].id;
          await updateDoc(doc(auctionPlayersRef, existingDocId), {
            status: "SOLD",
            teamId: resultingTeamId,
            soldPrice: 0, // Owners usually cost 0
            isOwner: true,
            role: ownerRole, // Ensure role is updated if changed
          });
        } else {
          // Player NOT in tournament, create new entry directly as SOLD
          await addDoc(auctionPlayersRef, {
            originalPlayerId: finalOwnerId,
            name: ownerName,
            role: ownerRole,
            status: "SOLD",
            teamId: resultingTeamId,
            soldPrice: 0,
            basePrice: 0,
            isOwner: true,
            statsSnapshot: {
              runs: ownerStats.runs || 0,
              wickets: ownerStats.wickets || 0,
              matches: ownerStats.matches || 0,
            },
          });
        }
      }
      // NOTE: If payload.isPlayer is FALSE, we might technically need to remove them
      // from auctionPlayers if they were previously playing, but we'll skip that complex logic
      // for now to avoid accidental deletions.

      setEditingTeam(null);
      await fetchData(); // Refresh all lists
    } catch (e) {
      console.error(e);
      alert("Failed to save changes: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Owner & Team Management
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Assign owners and automatically add them to the Squad list if they
            play.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="px-4 py-2 text-cyan-400 text-sm hover:text-white border border-cyan-900/50 rounded-lg hover:bg-cyan-900/20">
            Refresh
          </button>
          <button
            onClick={handleCreateNewTeam}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg flex items-center gap-2">
            <span>+</span> Add New Team
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="text-[10px] text-gray-500 uppercase bg-gray-950 font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Team Details</th>
                <th className="px-6 py-4">Assigned Owner</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Wallet (Purse)</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center p-12 text-cyan-500 animate-pulse font-bold">
                    Syncing Data...
                  </td>
                </tr>
              ) : mergedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center p-12 text-gray-500 italic">
                    No teams found. Click "Add New Team" to start.
                  </td>
                </tr>
              ) : (
                mergedData.map((team) => (
                  <tr
                    key={team.id}
                    className="hover:bg-gray-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-white font-bold text-lg">
                        {team.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {/* Now correctly calculated from AuctionPlayers collection */}
                        {team.squadCount} Players in Squad
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-200">
                        {team.isAssigned ? (
                          team.ownerName
                        ) : (
                          <span className="text-gray-600 italic">
                            -- Empty --
                          </span>
                        )}
                      </div>
                      {team.isAssigned && (
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] text-gray-500 uppercase">
                            {team.ownerRole}
                          </span>
                          {team.isOwnerPlaying && (
                            <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1.5 rounded border border-purple-800">
                              PLAYING
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {team.isAssigned ? (
                        <span className="inline-flex items-center gap-1.5 bg-green-900/20 text-green-400 border border-green-800/50 text-[10px] px-3 py-1 rounded-full font-bold uppercase">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="bg-gray-800 text-gray-500 border border-gray-700 text-[10px] px-3 py-1 rounded-full font-bold uppercase">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-mono font-bold">
                        ₹ {parseInt(team.purse || 0).toLocaleString()}
                      </div>
                      <div className="w-24 bg-gray-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full"
                          style={{
                            width: `${Math.min(
                              ((team.purse || 0) / 10000) * 100,
                              100
                            )}%`,
                          }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setEditingTeam(team)}
                        className="text-cyan-400 hover:text-white bg-cyan-900/10 hover:bg-cyan-600 p-2 rounded-lg transition-all border border-cyan-900/30"
                        title="Edit Owner & Purse">
                        <span className="text-xl">✎</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL --- */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {editingTeam.id ? "Configure Team Owner" : "Add New Team"}
              </h3>
              <button
                onClick={() => setEditingTeam(null)}
                className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {processing ? (
              <div className="p-10 text-center text-cyan-500 animate-pulse font-bold">
                Saving Data...
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
