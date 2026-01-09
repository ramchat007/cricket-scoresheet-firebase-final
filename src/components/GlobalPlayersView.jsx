import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  listGlobalPlayers,
  createGlobalPlayer,
  updateGlobalPlayer,
  deleteGlobalPlayer,
  listTournaments,
  listMatchesForTournament,
} from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function GlobalPlayersView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // --- STATE ---
  const [players, setPlayers] = useState([]);
  const [allMatches, setAllMatches] = useState([]); // Stores every match from every tournament
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);

  const [sortConfig, setSortConfig] = useState({
    key: "runs",
    direction: "desc",
  });

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    role: "All-Rounder",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
    mobile: "",
    photoURL: "",
  });

  // --- 1. DATA FETCHING (AUTO LOAD EVERYTHING) ---
  useEffect(() => {
    const loadRealTimeData = async () => {
      setLoading(true);
      try {
        // A. Load Players
        const playersList = await listGlobalPlayers();
        setPlayers(playersList);

        // B. Load ALL Matches from ALL Tournaments
        const tournaments = await listTournaments();
        let collectedMatches = [];

        // Run in parallel for speed
        await Promise.all(
          tournaments.map(async (t) => {
            const matches = await listMatchesForTournament(t.id);
            // Tag match with tournament ID for linking
            const tagged = matches.map((m) => ({ ...m, tournamentId: t.id }));
            collectedMatches = [...collectedMatches, ...tagged];
          })
        );

        setAllMatches(collectedMatches);
      } catch (err) {
        console.error("Error loading global data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRealTimeData();
  }, []);

  // --- 2. LIVE STATS CALCULATION ENGINE ---
  const { processedPlayers, orangeCap, purpleCap } = useMemo(() => {
    if (players.length === 0)
      return { processedPlayers: [], orangeCap: null, purpleCap: null };

    // A. Map: PlayerID -> Stats Object
    const statsMap = {};
    players.forEach((p) => {
      statsMap[p.id] = {
        ...p,
        calculatedStats: {
          matches: 0,
          runs: 0,
          wickets: 0,
          highestScore: 0,
          history: [],
        },
      };
    });

    // B. Map: Name/OriginalID -> GlobalID (For matching match data to global players)
    const identityMap = {};
    players.forEach((p) => {
      // Clean name for fuzzy match
      identityMap[p.name.trim().toLowerCase()] = p.id;
      // Also map by ID if available
      identityMap[p.id] = p.id;
    });

    // C. Process Every Match
    allMatches.forEach((match) => {
      // Only count finished/live matches
      const status = (match.status || match.meta?.status || "").toLowerCase();
      if (!["finished", "completed", "ongoing", "live"].includes(status))
        return;

      // Extract Innings
      let inningsArray = [];
      if (Array.isArray(match.innings)) {
        inningsArray = match.innings;
      } else if (match.innings && typeof match.innings === "object") {
        inningsArray = Object.values(match.innings);
      }

      if (inningsArray.length === 0) return;

      // Helper: Find Global Player ID from Match Player Data
      const findGlobalId = (name, originalId) => {
        const lowerName = (name || "").trim().toLowerCase();
        // 1. Try Bridge ID (if stored in squad)
        if (originalId && identityMap[originalId])
          return identityMap[originalId];
        // 2. Try Fuzzy Name
        return identityMap[lowerName];
      };

      inningsArray.forEach((inn) => {
        // Batting Stats
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName, null); // We don't have originalID easily here, rely on name
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const r = Number(s.runs) || 0;

              // Only add if they actually played
              if (s.balls > 0 || s.out) {
                // Check if we already added this match to history (to avoid double counting if bad data)
                const alreadyProcessed = p.calculatedStats.history.some(
                  (h) => h.matchId === match.id
                );

                if (!alreadyProcessed) {
                  p.calculatedStats.matches += 1;
                  p.calculatedStats.history.push({
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    date: match.date,
                    opponent:
                      inn.battingTeam === match.meta?.teamA
                        ? match.meta?.teamB
                        : match.meta?.teamA,
                    runs: r,
                    wickets: 0, // Will update below
                  });
                } else {
                  // Update existing entry (rare edge case)
                  const entry = p.calculatedStats.history.find(
                    (h) => h.matchId === match.id
                  );
                  entry.runs += r;
                }

                p.calculatedStats.runs += r;
                if (r > p.calculatedStats.highestScore)
                  p.calculatedStats.highestScore = r;
              }
            }
          });
        }

        // Bowling Stats
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName, null);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const w = Number(s.wickets) || 0;

              if (s.balls > 0) {
                const alreadyProcessed = p.calculatedStats.history.some(
                  (h) => h.matchId === match.id
                );

                if (!alreadyProcessed) {
                  // Played as bowler only
                  p.calculatedStats.matches += 1;
                  p.calculatedStats.history.push({
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    date: match.date,
                    opponent: inn.battingTeam || "Opponent",
                    runs: 0,
                    wickets: w,
                  });
                } else {
                  // Played as all-rounder (already added in batting)
                  const entry = p.calculatedStats.history.find(
                    (h) => h.matchId === match.id
                  );
                  entry.wickets += w;
                }

                p.calculatedStats.wickets += w;
              }
            }
          });
        }
      });
    });

    // D. Sort & Filter for Display
    let result = Object.values(statsMap);

    // Apply Search Filter
    if (searchTerm) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply Sort
    result.sort((a, b) => {
      let valA, valB;
      if (["name", "role"].includes(sortConfig.key)) {
        valA = a[sortConfig.key];
        valB = b[sortConfig.key];
      } else {
        valA = a.calculatedStats[sortConfig.key] || 0;
        valB = b.calculatedStats[sortConfig.key] || 0;
      }

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    // E. Calculate Caps (Orange/Purple)
    const allStats = Object.values(statsMap);
    const orange = [...allStats].sort(
      (a, b) => b.calculatedStats.runs - a.calculatedStats.runs
    )[0];
    const purple = [...allStats].sort(
      (a, b) => b.calculatedStats.wickets - a.calculatedStats.wickets
    )[0];

    return {
      processedPlayers: result,
      orangeCap: orange?.calculatedStats.runs > 0 ? orange : null,
      purpleCap: purple?.calculatedStats.wickets > 0 ? purple : null,
    };
  }, [players, allMatches, searchTerm, sortConfig]);

  // --- ACTIONS ---
  const handleDelete = async (playerId, e) => {
    e.stopPropagation();
    if (!window.confirm("⚠ Permanently delete this player?")) return;
    try {
      await deleteGlobalPlayer(playerId);
      // Optimistic update
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    } catch (error) {
      alert("Failed to delete player.");
    }
  };

  const goToMatch = (tournamentId, matchId) => {
    if (tournamentId && matchId) {
      navigate(`/tournaments/${tournamentId}/scorecard/${matchId}`);
    }
  };

  const handleSort = (key) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  // --- COMPRESSION ---
  const compressImage = (file, maxWidth = 400) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * ratio;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
      };
    });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const compressedBase64 = await compressImage(file, 400);
      setFormData((prev) => ({ ...prev, photoURL: compressedBase64 }));
    } catch (error) {
      alert("Failed to process image.");
    } finally {
      setProcessingImage(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      id: "",
      name: "",
      role: "All-Rounder",
      battingStyle: "Right Hand Bat",
      bowlingStyle: "Right Arm Medium",
      mobile: "",
      photoURL: "",
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (player, e) => {
    e.stopPropagation();
    const sanitizeStyle = (val, defaultVal) =>
      !val || val === "Unknown" ? defaultVal : val;
    setFormData({
      id: player.id,
      name: player.name,
      role: player.role || "All-Rounder",
      battingStyle: sanitizeStyle(player.battingStyle, "Right Hand Bat"),
      bowlingStyle: sanitizeStyle(player.bowlingStyle, "Right Arm Medium"),
      mobile: player.mobile || "",
      photoURL: player.photoURL || "",
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert("Name is required");

    try {
      if (isEditing && formData.id) {
        await updateGlobalPlayer(formData.id, {
          name: formData.name,
          role: formData.role,
          battingStyle: formData.battingStyle,
          bowlingStyle: formData.bowlingStyle,
          mobile: formData.mobile,
          photoURL: formData.photoURL,
        });
        alert("Player Updated!");
      } else {
        const { id, ...payload } = formData;
        await createGlobalPlayer({
          ...payload,
          stats: { matches: 0, runs: 0, wickets: 0 },
        });
        alert("Player Created!");
      }
      setShowModal(false);
      // Reload players to reflect changes (matches remain same)
      const data = await listGlobalPlayers();
      setPlayers(data);
    } catch (error) {
      alert("Error saving player.");
    }
  };

  const toggleRowExpansion = (playerId) => {
    setExpandedPlayerId(expandedPlayerId === playerId ? null : playerId);
  };

  const SortIcon = ({ colKey }) => (
    <span
      className={
        sortConfig.key === colKey
          ? "text-cyan-400 ml-1"
          : "text-gray-600 ml-1 opacity-0 group-hover:opacity-50"
      }>
      {sortConfig.key === colKey
        ? sortConfig.direction === "asc"
          ? "↑"
          : "↓"
        : "⇅"}
    </span>
  );

  const DetailItem = ({ label, value, isMono = false }) => (
    <div className="flex flex-col p-2 bg-gray-900/50 rounded border border-gray-800">
      <span className="text-[9px] uppercase font-bold text-gray-500 mb-1">
        {label}
      </span>
      <span
        className={`text-sm text-white break-words ${
          isMono ? "font-mono text-cyan-400" : ""
        }`}>
        {value || "N/A"}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-2 md:p-4 pb-20">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              <span className="text-cyan-500">🌍</span>{" "}
              <span>Global Database</span>
            </h1>
            <p className="text-gray-400 text-xs mt-1 flex items-center gap-2">
              {processedPlayers.length} players found.
              {/* No more Sync button needed, it's live */}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end">
            <input
              type="text"
              placeholder="🔍 Search name..."
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 w-full md:w-64 focus:border-cyan-500 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {user && (
              <button
                onClick={openAddModal}
                className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg font-bold text-sm shadow-lg whitespace-nowrap transition-colors">
                + Add
              </button>
            )}
          </div>
        </div>

        {/* ✅ ORANGE & PURPLE CAPS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {orangeCap && (
            <div className="bg-gradient-to-br from-orange-900/20 to-gray-900 border border-orange-500/20 p-5 rounded-2xl flex items-center gap-5 shadow-lg relative overflow-hidden">
              <div className="bg-orange-500/10 p-3 rounded-full text-3xl">
                🏏
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">
                  Global Orange Cap
                </div>
                <div className="text-xl font-bold text-white">
                  {orangeCap.name}
                </div>
                <div className="text-sm text-gray-400 font-mono">
                  {orangeCap.calculatedStats.runs} Runs
                </div>
              </div>
            </div>
          )}
          {purpleCap && (
            <div className="bg-gradient-to-br from-purple-900/20 to-gray-900 border border-purple-500/20 p-5 rounded-2xl flex items-center gap-5 shadow-lg relative overflow-hidden">
              <div className="bg-purple-500/10 p-3 rounded-full text-3xl">
                🥎
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1">
                  Global Purple Cap
                </div>
                <div className="text-xl font-bold text-white">
                  {purpleCap.name}
                </div>
                <div className="text-sm text-gray-400 font-mono">
                  {purpleCap.calculatedStats.wickets} Wickets
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center text-cyan-500 animate-pulse text-sm font-mono">
              Fetching all tournament data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-950 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-white group w-[40%] md:w-[30%]"
                      onClick={() => handleSort("name")}>
                      Player Details <SortIcon colKey="name" />
                    </th>
                    <th
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group"
                      onClick={() => handleSort("matches")}>
                      Mat <SortIcon colKey="matches" />
                    </th>
                    <th
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group"
                      onClick={() => handleSort("runs")}>
                      Runs <SortIcon colKey="runs" />
                    </th>
                    <th
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group hidden md:table-cell"
                      onClick={() => handleSort("highestScore")}>
                      HS <SortIcon colKey="highestScore" />
                    </th>
                    <th
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group"
                      onClick={() => handleSort("wickets")}>
                      Wkts <SortIcon colKey="wickets" />
                    </th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {processedPlayers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-8 text-gray-500">
                        No players found.
                      </td>
                    </tr>
                  ) : (
                    processedPlayers.map((player) => (
                      <React.Fragment key={player.id}>
                        <tr
                          onClick={() => toggleRowExpansion(player.id)}
                          className={`hover:bg-gray-800/50 transition-colors cursor-pointer ${
                            expandedPlayerId === player.id
                              ? "bg-gray-800/30"
                              : ""
                          }`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  player.photoURL ||
                                  "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                                }
                                alt=""
                                className="w-10 h-10 rounded-full object-cover bg-gray-700 border border-gray-600 flex-shrink-0"
                                onError={(e) => {
                                  e.target.src =
                                    "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                                }}
                              />
                              <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-white text-sm leading-tight truncate max-w-[120px] md:max-w-none">
                                  {player.name}
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-[9px] bg-gray-800 text-gray-300 px-1.5 rounded border border-gray-700 truncate">
                                    {player.role}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center text-white font-mono">
                            {player.calculatedStats.matches}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-cyan-400">
                            {player.calculatedStats.runs}
                          </td>
                          <td className="px-2 py-3 text-center text-gray-400 hidden md:table-cell">
                            {player.calculatedStats.highestScore}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-green-400">
                            {player.calculatedStats.wickets}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2 items-center">
                              <span
                                className="text-gray-500 mr-2 text-xs transition-transform duration-200 transform"
                                style={{
                                  transform:
                                    expandedPlayerId === player.id
                                      ? "rotate(180deg)"
                                      : "rotate(0deg)",
                                }}>
                                ▼
                              </span>
                              {user && (
                                <>
                                  <button
                                    onClick={(e) => openEditModal(player, e)}
                                    className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-all">
                                    ✎
                                  </button>
                                  <button
                                    onClick={(e) => handleDelete(player.id, e)}
                                    className="text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-900/20 transition-all">
                                    🗑
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {expandedPlayerId === player.id && (
                          <tr className="bg-gray-950/80 border-t border-b border-gray-800 animate-in slide-in-from-top-1">
                            <td colSpan={8} className="p-4 md:p-6">
                              <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-shrink-0">
                                  <img
                                    src={
                                      player.photoURL ||
                                      "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                                    }
                                    alt={player.name}
                                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border-2 border-cyan-500/50 shadow-lg shadow-cyan-900/20 bg-gray-800"
                                    onError={(e) => {
                                      e.target.src =
                                        "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                                    }}
                                  />
                                </div>
                                <div className="flex-grow w-full">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <DetailItem
                                      label="Full Name"
                                      value={player.name}
                                    />
                                    <DetailItem
                                      label="Role"
                                      value={player.role}
                                    />
                                    <DetailItem
                                      label="Batting"
                                      value={player.battingStyle}
                                    />
                                    <DetailItem
                                      label="Bowling"
                                      value={player.bowlingStyle}
                                    />
                                    <DetailItem
                                      label="Mobile"
                                      value={player.mobile}
                                      isMono={true}
                                    />
                                    <DetailItem
                                      label="Registered"
                                      value={
                                        player.createdAt
                                          ? new Date(
                                              player.createdAt
                                            ).toLocaleDateString()
                                          : "N/A"
                                      }
                                    />
                                  </div>

                                  {/* ✅ UNIFIED MATCH HISTORY UI */}
                                  <div className="pt-4 border-t border-gray-800">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                      <span>📜</span> Match History (
                                      {player.calculatedStats.history.length})
                                    </h4>
                                    {player.calculatedStats.history.length >
                                    0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {player.calculatedStats.history
                                          .slice(0, 10)
                                          .map((match, idx) => (
                                            <div
                                              key={idx}
                                              onClick={() =>
                                                goToMatch(
                                                  match.tournamentId,
                                                  match.matchId
                                                )
                                              }
                                              className="bg-gray-800 border border-gray-700 p-3 rounded-lg cursor-pointer hover:border-cyan-500/50 hover:bg-gray-750 transition-all flex justify-between items-center group">
                                              <div>
                                                <div className="text-[10px] text-gray-500 mb-0.5">
                                                  {new Date(
                                                    match.date
                                                  ).toLocaleDateString() ||
                                                    "Date"}
                                                </div>
                                                <div className="font-bold text-sm text-gray-200">
                                                  vs{" "}
                                                  {match.opponent || "Opponent"}
                                                </div>
                                              </div>

                                              {/* ✅ Shows Both Stats in One Card */}
                                              <div className="text-right flex flex-col items-end">
                                                <div className="flex gap-2 text-xs">
                                                  {match.runs > 0 && (
                                                    <span className="text-cyan-400 font-bold">
                                                      🏏 {match.runs}
                                                    </span>
                                                  )}
                                                  {match.wickets > 0 && (
                                                    <span className="text-green-400 font-bold">
                                                      🥎 {match.wickets}
                                                    </span>
                                                  )}
                                                  {match.runs === 0 &&
                                                    match.wickets === 0 && (
                                                      <span className="text-gray-500">
                                                        -
                                                      </span>
                                                    )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-600 italic p-3 border border-dashed border-gray-800 rounded bg-gray-900/50">
                                        No match history recorded.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL (UNCHANGED) */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-lg font-bold text-white">
                  {isEditing ? "Edit Player Profile" : "Create New Player"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex flex-col items-center">
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => fileInputRef.current.click()}>
                      <div
                        className={`w-28 h-28 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl ${
                          formData.photoURL
                            ? "border-cyan-500"
                            : "border-dashed border-gray-600 hover:border-gray-400"
                        }`}>
                        {formData.photoURL ? (
                          <img
                            src={formData.photoURL}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center">
                            <span className="text-3xl">📷</span>
                            <p className="text-[10px] text-gray-400 uppercase mt-1 font-bold">
                              Photo
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Full Name
                    </label>
                    <input
                      className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Mobile
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none"
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({ ...formData, mobile: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        "Batsman",
                        "Bowler",
                        "All-Rounder",
                        "Wicket Keeper",
                      ].map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setFormData({ ...formData, role })}
                          className={`py-3 px-2 rounded-lg text-xs font-bold border transition-all ${
                            formData.role === role
                              ? "bg-cyan-900/40 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                              : "bg-gray-800 border-gray-800 text-gray-400 hover:bg-gray-700"
                          }`}>
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Batting
                      </label>
                      <select
                        className="w-full bg-black border border-gray-700 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
                        value={formData.battingStyle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            battingStyle: e.target.value,
                          })
                        }>
                        <option>Right Hand Bat</option>
                        <option>Left Hand Bat</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Bowling
                      </label>
                      <select
                        className="w-full bg-black border border-gray-700 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
                        value={formData.bowlingStyle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bowlingStyle: e.target.value,
                          })
                        }>
                        <option>Right Arm Medium</option>
                        <option>Right Arm Fast</option>
                        <option>Right Arm Spin</option>
                        <option>Left Arm Medium</option>
                        <option>Left Arm Fast</option>
                        <option>Left Arm Spin</option>
                        <option>None</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={processingImage}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50">
                    {processingImage
                      ? "Processing..."
                      : isEditing
                      ? "Update Player"
                      : "Create Player"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
