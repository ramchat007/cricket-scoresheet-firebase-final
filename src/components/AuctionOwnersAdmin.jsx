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
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listGlobalPlayers } from "../utils/firestore";
import { useTheme } from "../context/ThemeContext";
import { Trash2 } from "lucide-react";

// ☁️ CLOUDINARY CONFIGURATION
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// --- ☁️ UNIVERSAL CLOUDINARY UPLOADER ---
const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
};

// --- SUB-COMPONENT: OWNER ASSIGNMENT FORM (Form Modal) ---
const OwnerAssignmentForm = ({
  team,
  globalPlayers,
  tournamentId,
  onSave,
  onCancel,
  onDelete,
}) => {
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";

  const [mode, setMode] = useState("existing");
  const [teamName, setTeamName] = useState(team?.name || "");
  const [purse, setPurse] = useState(team?.purse || 10000);

  // 🟢 LOGO STATE (Now using Cloudinary URL instead of Base64)
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState(team?.logoUrl || null);
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

  const [tournamentOnly, setTournamentOnly] = useState(false);

  // --- 🟢 HANDLER: Cloudinary Upload ---
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setProcessingImage(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      setUploadedLogoUrl(secureUrl);
    } catch (error) {
      alert("Failed to upload image to Cloudinary.");
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
      logoUrl: uploadedLogoUrl, // 🟢 Passes the Cloudinary URL
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

  const inputClass = `w-full rounded-xl px-4 py-3 outline-none font-bold border transition-colors bg-current/5 border-current/10 focus:bg-current/10 focus:border-teal-500 text-inherit placeholder:opacity-50 cursor-pointer`;
  const wrapperClass = `p-4 rounded-xl border bg-current/5 border-current/10`;

  return (
    <div className="p-6 space-y-5">
      <div className="text-center mb-4">
        <h3
          className={`text-xl font-black italic tracking-tight uppercase ${textMain}`}>
          {team?.id ? "Edit Team & Owner" : "Create New Team"}
        </h3>
      </div>

      {/* --- LOGO UPLOAD SECTION --- */}
      <div className="flex justify-center mb-4">
        <div className="relative group">
          <div
            className={`w-24 h-24 rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-current/5 border-current/20 ${
              processingImage ? "animate-pulse" : ""
            }`}>
            {uploadedLogoUrl ? (
              <img
                src={uploadedLogoUrl}
                alt="Logo Preview"
                className="w-full h-full object-cover drop-shadow-md"
              />
            ) : (
              <span className={`text-xs text-center font-bold px-2 ${textSub}`}>
                {processingImage ? "Uploading..." : "Upload Logo"}
              </span>
            )}
          </div>
          <label className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 rounded-3xl cursor-pointer transition-all">
            <span className="text-white text-xs font-bold uppercase tracking-widest">
              Change
            </span>
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
        <label
          className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${textSub}`}>
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
        <label
          className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${textSub}`}>
          Auction Purse
        </label>
        <div
          className={`flex items-center border rounded-xl overflow-hidden bg-current/5 border-current/10 focus-within:bg-current/10 focus-within:border-teal-500 transition-colors`}>
          <span className={`px-4 font-bold ${textSub}`}>₹</span>
          <input
            type="number"
            className={`w-full bg-transparent px-2 py-3 outline-none font-black text-lg ${textMain}`}
            value={purse}
            onChange={(e) => setPurse(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label
          className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${textSub}`}>
          Assign Owner
        </label>
        <div
          className={`flex rounded-xl p-1 mb-3 bg-current/10 border border-current/10`}>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-colors ${
              mode === "existing"
                ? "bg-teal-500 text-white shadow-md"
                : "text-inherit opacity-50 hover:opacity-100"
            }`}>
            Select Global
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-colors ${
              mode === "new"
                ? "bg-emerald-500 text-white shadow-md"
                : "text-inherit opacity-50 hover:opacity-100"
            }`}>
            Create New
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-3">
            <select
              className={inputClass}
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}>
              <option value="" className="text-black">
                -- Select Person --
              </option>
              {filteredOwners.map((p) => (
                <option key={p.id} value={p.id} className="text-black">
                  {p.name} {p.role ? `(${p.role})` : ""}
                </option>
              ))}
            </select>

            <label
              className={`flex items-center gap-2 cursor-pointer text-[10px] font-bold ${textSub}`}>
              <input
                type="checkbox"
                checked={tournamentOnly}
                onChange={(e) => setTournamentOnly(e.target.checked)}
                className="w-4 h-4 accent-teal-500 rounded"
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
              placeholder="Mobile (Optional)"
              className={inputClass}
              value={newOwnerData.mobile}
              onChange={(e) =>
                setNewOwnerData({ ...newOwnerData, mobile: e.target.value })
              }
            />
          </div>
        )}

        <div
          className={`mt-4 p-4 rounded-xl flex items-start gap-3 bg-current/5 border border-current/10`}>
          <input
            type="checkbox"
            id="isPlayer"
            className="mt-1 w-4 h-4 accent-teal-500 cursor-pointer"
            checked={isPlayer}
            onChange={(e) => setIsPlayer(e.target.checked)}
          />
          <div className="flex-1">
            <label
              htmlFor="isPlayer"
              className={`text-sm font-bold block cursor-pointer ${textMain}`}>
              Also Add to Squad?
            </label>
            {isPlayer && (
              <select
                className={`mt-3 ${inputClass}`}
                value={playerRole}
                onChange={(e) => setPlayerRole(e.target.value)}>
                <option className="text-black">All-Rounder</option>
                <option className="text-black">Batsman</option>
                <option className="text-black">Bowler</option>
                <option className="text-black">Wicket Keeper</option>
              </select>
            )}
          </div>
        </div>
      </div>

      <div className={`flex gap-2 pt-4 border-t border-current/10`}>
        {team?.id && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "⚠️ Delete this team and release its players back into the auction pool?",
                )
              ) {
                onDelete(team.id);
              }
            }}
            className={`flex items-center justify-center p-4 rounded-xl transition-colors border bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white`}
            title="Delete Team">
            <Trash2 size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className={`flex-1 font-black uppercase tracking-widest text-xs rounded-xl transition-colors border bg-current/5 border-transparent hover:bg-current/10 text-inherit opacity-70 hover:opacity-100`}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={processingImage}
          className={`flex-1 bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-emerald-600"} text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg active:scale-95 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}>
          {processingImage ? "Uploading..." : "Save Team"}
        </button>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function AuctionOwnersAdmin({ tournamentId }) {
  const { theme } = useTheme();
  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";

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

  const handleDeleteTeam = async (teamId) => {
    setProcessing(true);
    try {
      // 1. Delete Team Doc
      await deleteDoc(doc(db, `tournaments/${tournamentId}/teams`, teamId));

      // 2. Release associated players via batch
      const apRef = collection(
        db,
        `tournaments/${tournamentId}/auctionPlayers`,
      );
      const q = query(apRef, where("teamId", "==", teamId));
      const snap = await getDocs(q);

      const batch = writeBatch(db);
      snap.forEach((d) => {
        const pData = d.data();
        if (pData.isOwner) {
          batch.delete(d.ref);
        } else {
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

  const handleResetAllTeams = async () => {
    if (
      !window.confirm(
        "🚨 DANGER ZONE: This will delete ALL teams and reset ALL players back to the auction pool. This action CANNOT BE UNDONE. Are you absolutely sure?",
      )
    )
      return;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      teams.forEach((t) => {
        batch.delete(doc(db, `tournaments/${tournamentId}/teams`, t.id));
      });

      auctionPlayers.forEach((p) => {
        const pRef = doc(
          db,
          `tournaments/${tournamentId}/auctionPlayers`,
          p.id,
        );
        if (p.isOwner) {
          batch.delete(pRef);
        } else {
          batch.update(pRef, {
            status: "PENDING",
            teamId: null,
            soldPrice: 0,
          });
        }
      });

      await batch.commit();
      await fetchData();
    } catch (error) {
      alert("Failed to reset teams: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`flex flex-col md:flex-row justify-between items-start md:items-end border-b border-current/10 pb-4 gap-4`}>
        <div>
          <h2
            className={`text-xl font-black ${textMain} uppercase tracking-tighter italic`}>
            Teams & Purse Management
          </h2>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-xl transition-colors bg-current/5 border-current/10 text-inherit hover:bg-current/10`}>
            Refresh
          </button>

          {teams.length > 0 && (
            <button
              onClick={handleResetAllTeams}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-xl transition-colors bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40`}>
              Reset Teams Data
            </button>
          )}

          <button
            onClick={() => setEditingTeam({ id: null, purse: 10000 })}
            className={`px-5 py-2.5 bg-gradient-to-r ${theme?.gradient || "from-indigo-600 to-purple-600"} text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 hover:opacity-90`}>
            + Add Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center p-12 text-teal-500 animate-pulse font-black text-xs uppercase tracking-widest">
            Loading Teams...
          </div>
        ) : mergedData.length === 0 ? (
          <div
            className={`col-span-full text-center p-12 ${textSub} italic text-xs`}>
            No teams found. Add one to get started.
          </div>
        ) : (
          mergedData.map((t) => {
            const balance = (t.purse || 0) - (t.spent || 0);
            return (
              <div
                key={t.id}
                className={`${cardBg} p-5 rounded-[2.5rem] shadow-xl border border-current/10 hover:border-teal-500/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group relative`}>
                <button
                  onClick={() => setEditingTeam(t)}
                  className={`absolute top-5 right-5 px-4 py-2 rounded-xl transition-all text-[9px] uppercase tracking-widest font-black z-10 bg-current/10 text-inherit opacity-70 hover:opacity-100 hover:bg-teal-500 hover:text-white`}>
                  ✎ Edit
                </button>

                <div className="mb-6 flex items-center gap-4 pr-16">
                  {/* Logo Display */}
                  <div
                    className={`h-16 w-16 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0 bg-current/5 border-current/10`}>
                    {t.logoUrl ? (
                      <img
                        src={t.logoUrl}
                        alt={t.name}
                        className="h-full w-full object-cover drop-shadow-md p-1"
                      />
                    ) : (
                      <span className="text-2xl opacity-50 text-inherit">
                        🛡️
                      </span>
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <div className="text-[8px] text-teal-500 uppercase font-black tracking-[0.2em] mb-1">
                      Active Team
                    </div>
                    <div
                      className={`font-black ${textMain} text-xl uppercase italic leading-none truncate`}>
                      {t.name}
                    </div>
                    <div
                      className={`text-[10px] ${textSub} font-bold mt-1 truncate`}>
                      Owner: <span className={textMain}>{t.ownerName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-4 rounded-3xl border border-current/10 bg-current/5 shadow-inner`}>
                      <div
                        className={`text-[7px] ${textSub} uppercase font-black mb-1`}>
                        Squad
                      </div>
                      <div className={`text-lg font-black ${textMain} italic`}>
                        {t.squadCount}{" "}
                        <span
                          className={`text-[9px] ${textSub} ml-0.5 not-italic`}>
                          / {config?.maxSquadSize || 15}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-3xl border border-current/10 bg-current/5 shadow-inner`}>
                      <div
                        className={`text-[7px] ${textSub} uppercase font-black mb-1`}>
                        Spent
                      </div>
                      <div className="text-lg font-black text-red-500 truncate">
                        ₹{t.spent.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-5 rounded-3xl border border-current/10 bg-current/5 border-l-4 border-l-green-500 relative overflow-hidden`}>
                    <div className="flex justify-between items-center">
                      <div
                        className={`text-[8px] ${textSub} uppercase font-black tracking-widest`}>
                        Balance
                      </div>
                      <div className="text-xl font-black text-green-500 font-mono tracking-tighter truncate">
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
          className={`fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 bg-black/80 backdrop-blur-md`}>
          <div
            className={`${cardBg} border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden`}>
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
                onDelete={handleDeleteTeam}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
