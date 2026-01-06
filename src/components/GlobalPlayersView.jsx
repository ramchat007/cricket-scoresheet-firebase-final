// src/components/GlobalPlayersView.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
// 1. IMPORT deleteGlobalPlayer
import {
  listGlobalPlayers,
  createGlobalPlayer,
  updateGlobalPlayer,
  deleteGlobalPlayer,
} from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function GlobalPlayersView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [players, setPlayers] = useState([]);
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

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    const data = await listGlobalPlayers();
    setPlayers(data);
    setLoading(false);
  };

  // --- 2. DELETE HANDLER ---
  const handleDelete = async (playerId, e) => {
    e.stopPropagation(); // Stop row from expanding

    const confirmDelete = window.confirm(
      "⚠ Are you sure you want to permanently delete this player? This cannot be undone."
    );
    if (!confirmDelete) return;

    try {
      await deleteGlobalPlayer(playerId);
      // Remove from local state immediately for speed
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      alert("Player deleted successfully.");
    } catch (error) {
      alert("Failed to delete player.");
    }
  };

  const handleSort = (key) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayers = useMemo(() => {
    let sortable = [...players];
    if (searchTerm) {
      sortable = sortable.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let valA, valB;
        if (["name", "role"].includes(sortConfig.key)) {
          valA = a[sortConfig.key];
          valB = b[sortConfig.key];
        } else {
          valA = a.stats?.[sortConfig.key] || 0;
          valB = b.stats?.[sortConfig.key] || 0;
        }

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [players, sortConfig, searchTerm]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 0.2 * 900 * 900)
      return alert("Image too large (Max 200KB)");

    setProcessingImage(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        setFormData((prev) => ({ ...prev, photoURL: compressedBase64 }));
        setProcessingImage(false);
      };
    };
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
        await createGlobalPlayer(payload);
        alert("Player Created!");
      }
      setShowModal(false);
      fetchPlayers();
    } catch (error) {
      console.error(error);
      alert("Error saving player.");
    }
  };

  const toggleHistory = (playerId) => {
    setExpandedPlayerId(expandedPlayerId === playerId ? null : playerId);
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey)
      return (
        <span className="text-gray-600 ml-1 opacity-0 group-hover:opacity-50">
          ⇅
        </span>
      );
    return (
      <span className="text-cyan-400 ml-1">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const goToMatch = (tournamentId, matchId) => {
    if (!tournamentId || !matchId) return;
    navigate(`/tournaments/${tournamentId}/scorecard/${matchId}`);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-2 md:p-4 pb-20">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              <span className="text-cyan-500">🌍</span>{" "}
              <span>Global Player Database</span>
            </h1>
            <p className="text-gray-400 text-xs mt-1">
              {players.length} players registered across all tournaments.
            </p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
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

        {/* TABLE VIEW */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center text-cyan-500 animate-pulse text-sm font-mono">
              Loading Database...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-950 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-white group w-[30%]"
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
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group hidden sm:table-cell"
                      onClick={() => handleSort("highestScore")}>
                      HS <SortIcon colKey="highestScore" />
                    </th>
                    <th
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group"
                      onClick={() => handleSort("wickets")}>
                      Wkts <SortIcon colKey="wickets" />
                    </th>
                    <th
                      className="px-2 py-3 text-center cursor-pointer hover:text-white group hidden sm:table-cell"
                      onClick={() => handleSort("bestBowling")}>
                      BB <SortIcon colKey="bestBowling" />
                    </th>
                    <th className="px-2 py-3 text-center hidden md:table-cell">
                      Field{" "}
                      <span className="text-[9px] text-gray-600">(Ct/St)</span>
                    </th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedPlayers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-8 text-gray-500">
                        No players found.
                      </td>
                    </tr>
                  ) : (
                    sortedPlayers.map((player) => (
                      <React.Fragment key={player.id}>
                        <tr
                          onClick={() => toggleHistory(player.id)}
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
                                className="w-10 h-10 rounded-full object-cover bg-gray-700 border border-gray-600"
                                onError={(e) => {
                                  e.target.src =
                                    "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="font-bold text-white text-sm leading-tight">
                                  {player.name}
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-[9px] bg-gray-800 text-gray-300 px-1.5 rounded border border-gray-700">
                                    {player.role}
                                  </span>
                                </div>
                                <div className="text-[9px] text-gray-500 mt-0.5 hidden sm:block">
                                  {player.battingStyle} • {player.bowlingStyle}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-2 py-3 text-center text-white font-mono">
                            {player.stats?.matches || 0}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-cyan-400">
                            {player.stats?.runs || 0}
                          </td>
                          <td className="px-2 py-3 text-center text-gray-400 hidden sm:table-cell">
                            {player.stats?.highestScore || 0}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-green-400">
                            {player.stats?.wickets || 0}
                          </td>
                          <td className="px-2 py-3 text-center text-gray-400 hidden sm:table-cell">
                            {player.stats?.bestBowling || "-"}
                          </td>
                          <td className="px-2 py-3 text-center text-gray-400 text-xs hidden md:table-cell">
                            {player.stats?.catches || 0} /{" "}
                            {player.stats?.stumpings || 0}
                          </td>

                          {/* 3. ACTIONS COLUMN (UPDATED) */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2 items-center">
                              <span className="text-gray-600 text-xs mr-2">
                                {expandedPlayerId === player.id ? "▲" : "▼"}
                              </span>

                              {user && (
                                <>
                                  <button
                                    onClick={(e) => openEditModal(player, e)}
                                    className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-all"
                                    title="Edit Player">
                                    ✎
                                  </button>
                                  {/* DELETE BUTTON */}
                                  <button
                                    onClick={(e) => handleDelete(player.id, e)}
                                    className="text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-900/20 transition-all"
                                    title="Delete Player">
                                    🗑
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {expandedPlayerId === player.id && (
                          <tr className="bg-gray-950/50">
                            <td colSpan={8} className="p-0">
                              <div className="p-4 border-b border-gray-800 animate-in slide-in-from-top-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                  <span>📜</span> Recent Match History
                                </h4>
                                {player.stats?.history &&
                                player.stats.history.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {player.stats.history.map((log, idx) => (
                                      <div
                                        key={idx}
                                        onClick={() =>
                                          goToMatch(
                                            log.tournamentId,
                                            log.matchId
                                          )
                                        }
                                        className="bg-gray-900 border border-gray-800 p-3 rounded-lg cursor-pointer hover:border-cyan-500/50 hover:bg-gray-800 transition-all group">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-[10px] text-gray-500">
                                            {log.date}
                                          </span>
                                          <span className="text-[10px] text-gray-400 group-hover:text-cyan-400">
                                            View ↗
                                          </span>
                                        </div>
                                        <div className="font-bold text-sm text-gray-200 mb-1">
                                          vs {log.opponent}
                                        </div>
                                        <div className="flex gap-3 text-xs">
                                          {log.runs !== undefined && (
                                            <span
                                              className={
                                                log.runs >= 30
                                                  ? "text-yellow-400 font-bold"
                                                  : "text-gray-400"
                                              }>
                                              {log.runs} Runs
                                            </span>
                                          )}
                                          {log.wickets !== undefined && (
                                            <span
                                              className={
                                                log.wickets >= 2
                                                  ? "text-green-400 font-bold"
                                                  : "text-gray-400"
                                              }>
                                              {log.wickets} Wkts
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-600 italic p-2 border border-dashed border-gray-800 rounded bg-gray-900/50">
                                    No match history available yet.
                                    <span className="block text-[10px] mt-1 text-gray-700">
                                      (History populates automatically when you
                                      finish matches using this player)
                                    </span>
                                  </div>
                                )}
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

        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                      <img
                        src={
                          formData.photoURL ||
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                        }
                        alt="Player"
                        className={`w-24 h-24 rounded-full border-4 border-gray-800 shadow-lg object-cover bg-gray-700 transition-opacity ${
                          processingImage ? "opacity-50" : "opacity-100"
                        }`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold uppercase">
                          Upload
                        </span>
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
                      className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-cyan-500 outline-none transition-colors"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Role
                      </label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white outline-none"
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({ ...formData, role: e.target.value })
                        }>
                        <option>Batsman</option>
                        <option>Bowler</option>
                        <option>All-Rounder</option>
                        <option>Wicket Keeper</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Phone
                      </label>
                      <input
                        className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white outline-none"
                        value={formData.mobile}
                        onChange={(e) =>
                          setFormData({ ...formData, mobile: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Batting Style
                    </label>
                    <select
                      className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white outline-none"
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
                      Bowling Style
                    </label>
                    <select
                      className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white outline-none"
                      value={formData.bowlingStyle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bowlingStyle: e.target.value,
                        })
                      }>
                      <option>None</option>
                      <option>Right Arm Fast</option>
                      <option>Right Arm Medium</option>
                      <option>Right Arm Spin</option>
                      <option>Left Arm Fast</option>
                      <option>Left Arm Medium</option>
                      <option>Left Arm Spin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={processingImage}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg font-bold text-white mt-4 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
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
