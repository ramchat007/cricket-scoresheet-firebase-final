import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  runTransaction,
  arrayUnion,
  deleteDoc, // 🟢 NEW
  writeBatch, // 🟢 NEW
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";
import { useTheme } from "../context/ThemeContext";
import { Trash2 } from "lucide-react"; // 🟢 NEW

// --- UTILITY: COMPRESS IMAGE TO BASE64 ---
const compressImage = (file, maxWidth = 400) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Compress to JPEG with 0.7 quality
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- SUB-COMPONENT: OWNER ASSIGNMENT FORM (Form Modal) ---
const OwnerAssignmentForm = ({
  team,
  globalPlayers,
  tournamentId,
  onSave,
  onCancel,
  onDelete, // 🟢 NEW PROP
}) => {
  const { theme, lightMode } = useTheme();
  const [mode, setMode] = useState("existing");
  const [teamName, setTeamName] = useState(team?.name || "");
  const [purse, setPurse] = useState(team?.purse || 10000);

  // LOGO STATE
  const [logoBase64, setLogoBase64] = useState(team?.logoUrl || null);
  const [processingImage, setProcessingImage] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState(team?.ownerId || "");
  const [newOwnerData, setNewOwnerData] = useState({
    name: "",
    mobile: "",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
  });
  const [isPlayer, setIsPlayer] = useState(team?.isOwnerPlaying || false);
  const [playerRole, setPlayerRole] = useState("All-Rounder");

  // Toggle to filter owners by this tournament
  const [tournamentOnly, setTournamentOnly] = useState(false);

  // --- HANDLER: Compress & Set State ---
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const compressed = await compressImage(file, 400);
      setLogoBase64(compressed);
    } catch (error) {
      alert("Failed to process image.");
      console.error(error);
    } finally {
      setProcessingImage(false);
    }
  };

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
      logoUrl: logoBase64,
    });
  };

  // FILTER GLOBAL PLAYERS
  const filteredOwners = useMemo(() => {
    return globalPlayers.filter((p) => {
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
      return matchesTourney;
    });
  }, [globalPlayers, tournamentOnly, tournamentId]);

  const inputClass = `w-full rounded px-3 py-2 outline-none font-bold border transition-colors ${
    lightMode
      ? "bg-white border-gray-300 text-gray-900 focus:border-teal-500"
      : "bg-black border-gray-700 text-white focus:border-teal-500"
  }`;

  const wrapperClass = `p-3 rounded-lg border ${
    lightMode ? "bg-gray-50 border-gray-200" : "bg-gray-800/50 border-gray-700"
  }`;

  return (
    <div className="p-6 space-y-5">
      <div className="text-center mb-4">
        <h3 className={`text-xl font-bold ${theme.text}`}>
          {team?.id ? "Edit Team & Owner" : "Create New Team"}
        </h3>
      </div>

      {/* --- LOGO UPLOAD SECTION --- */}
      <div className="flex justify-center mb-4">
        <div className="relative group">
          <div
            className={`w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden ${
              lightMode
                ? "bg-gray-100 border-gray-300"
                : "bg-gray-900 border-gray-600"
            } ${processingImage ? "animate-pulse" : ""}`}>
            {logoBase64 ? (
              <img
                src={logoBase64}
                alt="Logo Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className={`text-xs text-center font-bold px-2 ${lightMode ? "text-gray-500" : "text-gray-500"}`}>
                {processingImage ? "Processing..." : "Upload Logo"}
              </span>
            )}
          </div>
          <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
            <span className="text-white text-xs font-bold">Change</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        </div>
      </div>

      <div className={wrapperClass}>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          Team Name
        </label>
        <input
          type="text"
          className={inputClass}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
          Auction Purse
        </label>
        <div
          className={`flex items-center border rounded-lg overflow-hidden ${
            lightMode ? "bg-white border-gray-300" : "bg-black border-gray-700"
          }`}>
          <span className="px-4 text-gray-500 font-bold">₹</span>
          <input
            type="number"
            className={`w-full bg-transparent px-2 py-3 outline-none font-bold ${theme.text}`}
            value={purse}
            onChange={(e) => setPurse(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
          Assign Owner
        </label>
        <div
          className={`flex rounded-lg p-1 mb-3 ${lightMode ? "bg-gray-200" : "bg-gray-800"}`}>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              mode === "existing"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}>
            Select Global
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              mode === "new"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}>
            Create New
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <select
              className={`${inputClass} py-3`}
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}>
              <option value="">-- Select Person --</option>
              {filteredOwners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.role ? `(${p.role})` : ""}
                </option>
              ))}
            </select>

            {/* Checkbox to filter the dropdown list */}
            <label
              className={`flex items-center gap-2 cursor-pointer text-[10px] font-bold ${theme.sub}`}>
              <input
                type="checkbox"
                checked={tournamentOnly}
                onChange={(e) => setTournamentOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-cyan-600 rounded"
              />
              Show only players registered for this tournament
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              placeholder="Owner Name"
              className={inputClass}
              value={newOwnerData.name}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, name: e.target.value })
              }
            />
            <input
              placeholder="Mobile"
              className={inputClass}
              value={newOwnerData.mobile}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, mobile: e.target.value })
              }
            />
          </div>
        )}

        <div
          className={`mt-4 p-3 rounded-lg flex items-start gap-3 ${wrapperClass}`}>
          <input
            type="checkbox"
            id="isPlayer"
            className="mt-1 w-4 h-4 accent-teal-600 cursor-pointer"
            checked={isPlayer}
            onChange={(e) => setIsPlayer(e.target.checked)}
          />
          <div className="flex-1">
            <label
              htmlFor="isPlayer"
              className={`text-sm font-bold block cursor-pointer ${theme.text}`}>
              Also Add to Squad?
            </label>
            {isPlayer && (
              <select
                className={`mt-2 text-xs py-1.5 ${inputClass}`}
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
      
      {/* 🟢 MODIFIED FOOTER ACTIONS (Added Delete) */}
      <div
        className={`flex gap-2 pt-4 border-t ${lightMode ? "border-gray-200" : "border-gray-800"}`}>
        
        {team?.id && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("⚠️ Delete this team and release its players back into the auction pool?")) {
                onDelete(team.id);
              }
            }}
            className={`flex items-center justify-center p-3 rounded-lg transition-colors border ${lightMode ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-red-900/20 text-red-500 border-red-900/50 hover:bg-red-900/40"}`}
            title="Delete Team"
          >
            <Trash2 size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className={`flex-1 font-bold rounded-lg transition-colors border ${
            lightMode
              ? "text-gray-600 bg-gray-100 border-gray-200 hover:bg-gray-200"
              : "text-gray-300 bg-gray-800 border-gray-700 hover:bg-gray-700"
          }`}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg shadow-md active:scale-95 transition-all">
          Save
        </button>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function AuctionOwnersAdmin({ tournamentId }) {
  const { theme, lightMode } = useTheme();
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
            mod.getDoc(doc(db, "tournaments", tournamentId)),
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
        (p) => p.status === "SOLD" && p.teamId === team.id,
      );
      const spent = squadMembers.reduce(
        (acc, p) => acc + (p.soldPrice || 0),
        0,
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

        // 1. Handle New Profile
        if (payload.mode === "new") {
          const newPlayerRef = doc(collection(db, "globalPlayers"));
          transaction.set(newPlayerRef, {
            name: payload.newOwnerData.name,
            role: payload.isPlayer ? payload.playerRole : "Owner",
            mobile: payload.newOwnerData.mobile,
            createdAt: new Date().toISOString(),
          });
          finalOwnerId = newPlayerRef.id;
          ownerDetails = {
            name: payload.newOwnerData.name,
            photoURL: "",
            role: payload.isPlayer ? payload.playerRole : "Owner",
          };
        } else {
          const p = globalPlayers.find((x) => x.id === finalOwnerId);
          ownerDetails = {
            name: p?.name,
            photoURL: p?.photoURL || "",
            role: p?.role,
            stats: p?.stats || {},
          };
        }

        // 2. Prepare Team Update
        const teamData = {
          name: payload.teamName,
          purse: payload.purse,
          ownerId: finalOwnerId,
          ownerName: ownerDetails.name,
          logoUrl: payload.logoUrl || null,
        };

        let teamRef;
        if (payload.teamId) {
          teamRef = doc(
            db,
            `tournaments/${tournamentId}/teams`,
            payload.teamId,
          );
          transaction.update(teamRef, teamData);
        } else {
          teamRef = doc(collection(db, `tournaments/${tournamentId}/teams`));
          transaction.set(teamRef, {
            ...teamData,
            spent: 0,
            roster: [],
            stats: { played: 0, won: 0, lost: 0, points: 0, nrr: 0 },
          });
        }

        // 3. Handle "Owner as Player"
        if (payload.isPlayer) {
          const auctionPlayersRef = collection(
            db,
            `tournaments/${tournamentId}/auctionPlayers`,
          );
          const existingQuery = query(
            auctionPlayersRef,
            where("originalPlayerId", "==", finalOwnerId),
          );
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
            transaction.update(
              doc(auctionPlayersRef, auctionPlayerDocId),
              auctionPlayerData,
            );
          } else {
            const newAPRef = doc(auctionPlayersRef);
            auctionPlayerDocId = newAPRef.id;
            transaction.set(newAPRef, {
              ...auctionPlayerData,
              basePrice: 0,
              statsSnapshot: ownerDetails.stats || {},
            });
          }

          transaction.update(teamRef, {
            roster: arrayUnion({
              id: auctionPlayerDocId,
              name: ownerDetails.name,
              role: ownerDetails.role,
              soldPrice: 0,
              isOwner: true,
              isIcon: true,
              originalId: finalOwnerId,
              photoURL: ownerDetails.photoURL,
            }),
          });
        }
      });

      setEditingTeam(null);
      await fetchData();
    } catch (e) {
      alert("Transaction failed: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  // 🟢 NEW: HANDLE INDIVIDUAL TEAM DELETE
  const handleDeleteTeam = async (teamId) => {
    setProcessing(true);
    try {
      // 1. Delete Team Doc
      await deleteDoc(doc(db, `tournaments/${tournamentId}/teams`, teamId));

      // 2. Release associated players via batch
      const apRef = collection(db, `tournaments/${tournamentId}/auctionPlayers`);
      const q = query(apRef, where("teamId", "==", teamId));
      const snap = await getDocs(q);

      const batch = writeBatch(db);
      snap.forEach((d) => {
        const pData = d.data();
        if (pData.isOwner) {
          // Dynamically created owner-players should be removed entirely
          batch.delete(d.ref);
        } else {
          // Regular players go back to the unsold/pending pool
          batch.update(d.ref, {
            status: "PENDING",
            teamId: null,
            soldPrice: 0,
          });
        }
      });
      await batch.commit();

      setEditingTeam(null);
      await fetchData();
    } catch (error) {
      alert("Failed to delete team: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 🟢 NEW: HANDLE MASTER RESET (Delete All Teams & Release All Players)
  const handleResetAllTeams = async () => {
    if (!window.confirm("🚨 DANGER ZONE: This will delete ALL teams and reset ALL players back to the auction pool. This action CANNOT BE UNDONE. Are you absolutely sure?")) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Delete all teams
      teams.forEach((t) => {
        batch.delete(doc(db, `tournaments/${tournamentId}/teams`, t.id));
      });

      // 2. Release all auction players
      auctionPlayers.forEach((p) => {
        const pRef = doc(db, `tournaments/${tournamentId}/auctionPlayers`, p.id);
        if (p.isOwner) {
          batch.delete(pRef); // Remove owners that were added as players
        } else {
          batch.update(pRef, {
            status: "PENDING",
            teamId: null,
            soldPrice: 0,
          });
        }
      });

      await batch.commit();
      await fetchData(); // Refresh entirely
    } catch (error) {
      alert("Failed to reset teams: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const borderClass = lightMode ? "border-gray-200" : "border-white/5";

  return (
    <div className="space-y-6">
      <div
        className={`flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 gap-4 ${borderClass}`}>
        <div>
          <h2
            className={`text-xl font-black ${theme.text} uppercase tracking-tighter italic`}>
            Teams & Purse Management
          </h2>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className={`px-4 py-2 text-[10px] font-bold border rounded-xl transition-colors ${
              lightMode
                ? "text-teal-700 border-teal-200 hover:bg-teal-50"
                : "text-teal-400 border-teal-500/20 hover:bg-teal-500/10"
            }`}>
            Refresh
          </button>

          {/* 🟢 NEW: Reset All Button */}
          {teams.length > 0 && (
            <button
              onClick={handleResetAllTeams}
              className={`px-4 py-2 text-[10px] font-bold border rounded-xl transition-colors ${
                lightMode
                  ? "text-red-600 border-red-200 hover:bg-red-50"
                  : "text-red-500 border-red-500/30 hover:bg-red-500/10"
              }`}
            >
              Reset Teams Data
            </button>
          )}

          <button
            onClick={() => setEditingTeam({ id: null, purse: 10000 })}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95">
            + Add Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center p-12 text-teal-500 animate-pulse font-bold text-xs uppercase tracking-widest">
            Loading Teams...
          </div>
        ) : mergedData.length === 0 ? (
          <div
            className={`col-span-full text-center p-12 ${theme.sub} italic text-xs`}>
            No teams found. Add one to get started.
          </div>
        ) : (
          mergedData.map((t) => {
            const balance = (t.purse || 0) - (t.spent || 0);
            return (
              <div
                key={t.id}
                className={`${theme.card} p-5 rounded-[2.5rem] shadow-xl border ${borderClass} hover:border-teal-500/30 transition-all group relative`}>
                <button
                  onClick={() => setEditingTeam(t)}
                  className={`absolute top-5 right-5 px-3 py-1.5 rounded-lg transition-all text-xs font-bold z-10 ${
                    lightMode
                      ? "text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-teal-600"
                      : "text-slate-500 bg-white/5 hover:bg-white/10 hover:text-teal-400"
                  }`}>
                  ✎ Edit
                </button>

                <div className="mb-6 flex items-center gap-4 pr-16">
                  {/* Logo Display */}
                  <div
                    className={`h-16 w-16 rounded-full border flex items-center justify-center overflow-hidden shrink-0 ${
                      lightMode
                        ? "bg-gray-100 border-gray-200"
                        : "bg-black/40 border-white/10"
                    }`}>
                    {t.logoUrl ? (
                      <img
                        src={t.logoUrl}
                        alt={t.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl opacity-50">🛡️</span>
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <div className="text-[8px] text-teal-500 uppercase font-black tracking-[0.2em] mb-1">
                      Active Team
                    </div>
                    <div
                      className={`font-black ${theme.text} text-xl uppercase italic leading-none truncate`}>
                      {t.name}
                    </div>
                    <div
                      className={`text-[10px] ${theme.sub} font-bold mt-1 truncate`}>
                      Owner: <span className={theme.text}>{t.ownerName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-4 rounded-2xl border shadow-inner ${
                        lightMode
                          ? "bg-gray-50 border-gray-200"
                          : "bg-[#0F1115] border-white/5"
                      }`}>
                      <div
                        className={`text-[7px] ${theme.sub} uppercase font-black mb-1`}>
                        Squad
                      </div>
                      <div
                        className={`text-lg font-black ${theme.text} italic`}>
                        {t.squadCount}{" "}
                        <span
                          className={`text-[9px] ${theme.sub} ml-0.5 not-italic`}>
                          / {config?.maxSquadSize}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-2xl border shadow-inner ${
                        lightMode
                          ? "bg-gray-50 border-gray-200"
                          : "bg-[#0F1115] border-white/5"
                      }`}>
                      <div
                        className={`text-[7px] ${theme.sub} uppercase font-black mb-1`}>
                        Spent
                      </div>
                      <div className="text-lg font-black text-red-500 truncate">
                        ₹{t.spent.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border border-l-4 border-l-green-500 relative overflow-hidden ${
                      lightMode
                        ? "bg-gray-50 border-gray-200"
                        : "bg-[#0F1115] border-white/5"
                    }`}>
                    <div className="flex justify-between items-center">
                      <div
                        className={`text-[8px] ${theme.sub} uppercase font-black tracking-widest`}>
                        Balance
                      </div>
                      <div className="text-lg font-black text-green-500 dark:text-green-400 font-mono tracking-tighter truncate">
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
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 ${
            lightMode
              ? "bg-gray-900/60 backdrop-blur-sm"
              : "bg-black/80 backdrop-blur-md"
          }`}>
          <div
            className={`${theme.card} border ${borderClass} w-full max-w-md rounded-2xl shadow-2xl overflow-hidden`}>
            {processing ? (
              <div className="p-12 text-center text-teal-500 animate-pulse font-black uppercase text-xs tracking-widest">
                Processing Action...
              </div>
            ) : (
              <OwnerAssignmentForm
                team={editingTeam}
                globalPlayers={globalPlayers}
                tournamentId={tournamentId}
                onSave={handleSave}
                onCancel={() => setEditingTeam(null)}
                onDelete={handleDeleteTeam} // 🟢 Passed down correctly
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}