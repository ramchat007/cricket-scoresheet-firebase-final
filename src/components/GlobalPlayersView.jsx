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
// 1. Theme & Icons
import { useTheme } from "../context/ThemeContext";
import {
  Search,
  Filter,
  Plus,
  Trophy,
  Medal,
  ChevronDown,
  Edit3,
  Trash2,
  X,
  Camera,
  Receipt,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

// --- TOAST COMPONENT ---
const NotificationToast = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 border backdrop-blur-xl ${
        isError
          ? "bg-red-500/20 border-red-500/30 text-red-500"
          : "bg-teal-500/20 border-teal-500/30 text-teal-400"
      }`}>
      {isError ? <AlertCircle size={20} /> : <Check size={20} />}
      <div>
        <h4 className="font-black text-sm uppercase tracking-wider">
          {isError ? "Error" : "Success"}
        </h4>
        <p className="text-xs font-bold opacity-90">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
};

export default function GlobalPlayersView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 2. Consume Theme natively (removed lightMode)
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-2xl";

  // Refs
  const fileInputRef = useRef(null);
  const paymentInputRef = useRef(null);

  // --- STATE ---
  const [players, setPlayers] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [notification, setNotification] = useState(null);

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
    paymentScreenshotURL: "",
  });

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- 1. DATA FETCHING ---
  useEffect(() => {
    const loadRealTimeData = async () => {
      setLoading(true);
      try {
        const playersList = await listGlobalPlayers();
        setPlayers(playersList);

        const tournaments = await listTournaments();
        let collectedMatches = [];

        await Promise.all(
          tournaments.map(async (t) => {
            const matches = await listMatchesForTournament(t.id);
            const tagged = matches.map((m) => ({ ...m, tournamentId: t.id }));
            collectedMatches = [...collectedMatches, ...tagged];
          }),
        );

        setAllMatches(collectedMatches);
      } catch (err) {
        console.error("Error loading global data:", err);
        showToast("Failed to load player data", "error");
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

    // 1. Initialize Map
    const statsMap = {};
    players.forEach((p) => {
      let latest = {
        photoURL: p.photoURL,
        paymentScreenshotURL: p.paymentScreenshotURL,
        role: p.role || "All-Rounder",
        battingStyle: p.battingStyle || "Right Hand Bat",
        bowlingStyle: p.bowlingStyle || "Right Arm Medium",
        date: new Date(p.updatedAt || p.createdAt || 0).getTime(),
      };

      if (p.tournamentData) {
        Object.values(p.tournamentData).forEach((tData) => {
          const tDate = new Date(
            tData.lastEdited || tData.registeredAt || 0,
          ).getTime();
          if (tDate >= latest.date) {
            latest.date = tDate;
            if (tData.photoURL) latest.photoURL = tData.photoURL;
            if (tData.paymentScreenshotURL)
              latest.paymentScreenshotURL = tData.paymentScreenshotURL;
            if (tData.role) latest.role = tData.role;
            if (tData.battingStyle) latest.battingStyle = tData.battingStyle;
            if (tData.bowlingStyle) latest.bowlingStyle = tData.bowlingStyle;
          }
        });
      }

      statsMap[p.id] = {
        ...p,
        latestProfile: latest,
        calculatedStats: {
          matches: 0,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          runsConceded: 0,
          ballsBowled: 0,
          highestScore: 0,
          notOuts: 0,
          history: [],
        },
      };
    });

    // 2. Identity Map
    const identityMap = {};
    players.forEach((p) => {
      identityMap[p.name.trim().toLowerCase()] = p.id;
      identityMap[p.id] = p.id;
    });

    // 3. Process Matches
    allMatches.forEach((match) => {
      const status = (match.status || match.meta?.status || "").toLowerCase();
      if (!["finished", "completed"].includes(status)) return;

      let inningsArray = Array.isArray(match.innings)
        ? match.innings
        : Object.values(match.innings || {});
      if (inningsArray.length === 0) return;

      const findGlobalId = (name) =>
        identityMap[(name || "").trim().toLowerCase()];

      inningsArray.forEach((inn) => {
        // Batting Stats
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const r = Number(s.runs) || 0;
              const b = Number(s.balls) || 0;
              const isOut = s.out;

              if (b > 0 || isOut) {
                p.calculatedStats.runs += r;
                p.calculatedStats.ballsFaced += b;
                p.calculatedStats.fours += Number(s.fours) || 0;
                p.calculatedStats.sixes += Number(s.sixes) || 0;
                if (!isOut) p.calculatedStats.notOuts += 1;
                if (r > p.calculatedStats.highestScore)
                  p.calculatedStats.highestScore = r;

                const existingHist = p.calculatedStats.history.find(
                  (h) => h.matchId === match.id,
                );
                if (existingHist) {
                  existingHist.runs = r;
                  existingHist.isNotOut = !isOut;
                } else {
                  p.calculatedStats.history.push({
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    date: match.date || match.meta?.date,
                    opponent: inn.bowlingTeam || "Opponent",
                    runs: r,
                    wickets: 0,
                    isNotOut: !isOut,
                  });
                }
              }
            }
          });
        }

        // Bowling Stats
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const w = Number(s.wickets) || 0;
              const rc = Number(s.runs) || 0;
              const bb = Number(s.balls) || 0;

              if (bb > 0) {
                p.calculatedStats.wickets += w;
                p.calculatedStats.runsConceded += rc;
                p.calculatedStats.ballsBowled += bb;

                const existingHist = p.calculatedStats.history.find(
                  (h) => h.matchId === match.id,
                );
                if (existingHist) {
                  existingHist.wickets = w;
                } else {
                  p.calculatedStats.history.push({
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    date: match.date || match.meta?.date,
                    opponent: inn.battingTeam || "Opponent",
                    runs: 0,
                    wickets: w,
                    isNotOut: false,
                  });
                }
              }
            }
          });
        }
      });
    });

    const allStats = Object.values(statsMap).map((p) => {
      p.calculatedStats.matches = p.calculatedStats.history.length;
      return p;
    });

    // 5. Cap Calculation
    const orange = [...allStats].sort((a, b) => {
      if (b.calculatedStats.runs !== a.calculatedStats.runs) {
        return b.calculatedStats.runs - a.calculatedStats.runs;
      }
      const srA =
        a.calculatedStats.ballsFaced > 0
          ? (a.calculatedStats.runs / a.calculatedStats.ballsFaced) * 100
          : 0;
      const srB =
        b.calculatedStats.ballsFaced > 0
          ? (b.calculatedStats.runs / b.calculatedStats.ballsFaced) * 100
          : 0;
      return srB - srA;
    })[0];

    const purple = [...allStats].sort((a, b) => {
      if (b.calculatedStats.wickets !== a.calculatedStats.wickets) {
        return b.calculatedStats.wickets - a.calculatedStats.wickets;
      }
      const ballsA = a.calculatedStats.ballsBowled;
      const ballsB = b.calculatedStats.ballsBowled;
      const ecoA =
        ballsA > 0 ? a.calculatedStats.runsConceded / (ballsA / 6) : 9999;
      const ecoB =
        ballsB > 0 ? b.calculatedStats.runsConceded / (ballsB / 6) : 9999;
      return ecoA - ecoB;
    })[0];

    // 6. Filter & Sort
    let result = [...allStats];

    if (searchTerm) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    if (roleFilter !== "All") {
      result = result.filter((p) => p.latestProfile.role === roleFilter);
    }

    result.sort((a, b) => {
      let valA, valB;
      if (
        ["runs", "wickets", "highestScore", "matches"].includes(sortConfig.key)
      ) {
        valA = a.calculatedStats[sortConfig.key] || 0;
        valB = b.calculatedStats[sortConfig.key] || 0;
      } else if (
        ["role", "battingStyle", "bowlingStyle"].includes(sortConfig.key)
      ) {
        valA = a.latestProfile[sortConfig.key];
        valB = b.latestProfile[sortConfig.key];
      } else if (sortConfig.key === "name") {
        valA = a.name;
        valB = b.name;
      } else {
        valA = 0;
        valB = 0;
      }

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return {
      processedPlayers: result,
      orangeCap: orange?.calculatedStats.runs > 0 ? orange : null,
      purpleCap: purple?.calculatedStats.wickets > 0 ? purple : null,
    };
  }, [players, allMatches, searchTerm, roleFilter, sortConfig]);

  // --- ACTIONS ---
  const handleDelete = async (playerId, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "⚠ Permanently delete this player from the Global Database?",
      )
    )
      return;
    try {
      await deleteGlobalPlayer(playerId);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      showToast("Player deleted successfully");
    } catch (error) {
      showToast("Failed to delete player", "error");
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
      showToast("Failed to process image", "error");
    } finally {
      setProcessingImage(false);
    }
  };

  const handlePaymentImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const compressedBase64 = await compressImage(file, 500);
      setFormData((prev) => ({
        ...prev,
        paymentScreenshotURL: compressedBase64,
      }));
    } catch (error) {
      showToast("Failed to process payment image", "error");
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
      paymentScreenshotURL: "",
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (player, e) => {
    e.stopPropagation();

    const profile = player.latestProfile || {};

    const sanitizeStyle = (val, defaultVal) =>
      !val || val === "Unknown" ? defaultVal : val;

    setFormData({
      id: player.id,
      name: player.name,
      role: profile.role || "All-Rounder",
      battingStyle: sanitizeStyle(profile.battingStyle, "Right Hand Bat"),
      bowlingStyle: sanitizeStyle(profile.bowlingStyle, "Right Arm Medium"),
      mobile: player.mobile || "",
      photoURL: profile.photoURL || "",
      paymentScreenshotURL: profile.paymentScreenshotURL || "",
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return showToast("Name is required", "error");

    setProcessingImage(true);

    try {
      if (isEditing && formData.id) {
        await updateGlobalPlayer(formData.id, {
          name: formData.name,
          role: formData.role,
          battingStyle: formData.battingStyle,
          bowlingStyle: formData.bowlingStyle,
          mobile: formData.mobile,
          photoURL: formData.photoURL,
          paymentScreenshotURL: formData.paymentScreenshotURL,
          updatedAt: new Date().toISOString(),
        });
        showToast("Player Updated Globally!");
      } else {
        const { id, ...payload } = formData;
        await createGlobalPlayer({
          ...payload,
          stats: { matches: 0, runs: 0, wickets: 0 },
        });
        showToast("Player Created!");
      }
      setShowModal(false);
      const data = await listGlobalPlayers();
      setPlayers(data);
    } catch (error) {
      showToast("Error saving player", "error");
    } finally {
      setProcessingImage(false);
    }
  };

  const toggleRowExpansion = (playerId) => {
    setExpandedPlayerId(expandedPlayerId === playerId ? null : playerId);
  };

  const SortIcon = ({ colKey }) => (
    <span
      className={`ml-1 transition-opacity ${sortConfig.key === colKey ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
      {sortConfig.key === colKey && sortConfig.direction === "asc" ? "↑" : "↓"}
    </span>
  );

  const DetailItem = ({ label, value, isMono = false }) => (
    <div
      className={`flex flex-col p-3 rounded-xl border bg-current/5 border-current/10`}>
      <span
        className={`text-[9px] uppercase font-black mb-1 tracking-wider ${textSub}`}>
        {label}
      </span>
      <span
        className={`text-sm break-words font-bold ${isMono ? "font-mono text-teal-500" : textMain}`}>
        {value || "N/A"}
      </span>
    </div>
  );

  // 🟢 Clean, adaptable transparent inputs
  const inputClass = `w-full rounded-xl px-4 py-3 outline-none font-bold border transition-colors bg-current/5 border-current/10 focus:bg-current/10 focus:border-teal-500 text-inherit placeholder:opacity-50`;

  return (
    <div
      className={`min-h-screen p-2 md:p-4 pb-20 font-sans transition-colors duration-300 bg-transparent ${textMain}`}>
      <NotificationToast
        message={notification?.message}
        type={notification?.type}
        onClose={() => setNotification(null)}
      />

      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="text-center md:text-left">
            <h1
              className={`text-2xl font-black uppercase tracking-tighter italic flex items-center gap-2 justify-center md:justify-start ${textMain}`}>
              <span
                className={`p-2 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20`}>
                <Trophy size={20} />
              </span>
              Global Database
            </h1>
            <p
              className={`text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start ${textSub}`}>
              {processedPlayers.length} players found
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto justify-center md:justify-end items-center">
            {/* Search Input */}
            <div className="relative w-full md:w-56">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`}
                size={16}
              />
              <input
                type="text"
                placeholder="Search name..."
                className={`${inputClass} pl-10`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <div className="relative w-full md:w-auto">
              <Filter
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`}
                size={16}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={`${inputClass} pl-10 cursor-pointer appearance-none pr-8`}>
                <option value="All" className="text-black">
                  All Roles
                </option>
                <option value="Batsman" className="text-black">
                  Batsman
                </option>
                <option value="Bowler" className="text-black">
                  Bowler
                </option>
                <option value="All-Rounder" className="text-black">
                  All-Rounder
                </option>
                <option value="Wicket Keeper" className="text-black">
                  Wicket Keeper
                </option>
              </select>
              <ChevronDown
                className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`}
                size={14}
              />
            </div>

            {user && (
              <button
                onClick={openAddModal}
                className={`bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-emerald-600"} hover:opacity-90 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg whitespace-nowrap transition-all active:scale-95 text-white w-full md:w-auto flex items-center justify-center gap-2`}>
                <Plus size={14} /> Add
              </button>
            )}
          </div>
        </div>

        {/* CAPS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {orangeCap && (
            <div
              className={`p-5 rounded-[2rem] flex items-center gap-5 shadow-xl relative overflow-hidden group border transition-all bg-orange-500/10 border-orange-500/20`}>
              <div
                className={`p-4 rounded-full text-3xl border group-hover:scale-110 transition-transform bg-orange-500/20 border-orange-500/30 text-orange-500`}>
                <Medal size={32} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">
                  Global Orange Cap
                </div>
                <div className={`text-xl font-black italic ${textMain}`}>
                  {orangeCap.name}
                </div>
                <div className={`text-sm font-mono font-bold mt-1 ${textSub}`}>
                  {orangeCap.calculatedStats.runs} Runs
                </div>
              </div>
            </div>
          )}
          {purpleCap && (
            <div
              className={`p-5 rounded-[2rem] flex items-center gap-5 shadow-xl relative overflow-hidden group border transition-all bg-purple-500/10 border-purple-500/20`}>
              <div
                className={`p-4 rounded-full text-3xl border group-hover:scale-110 transition-transform bg-purple-500/20 border-purple-500/30 text-purple-500`}>
                <Medal size={32} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">
                  Global Purple Cap
                </div>
                <div className={`text-xl font-black italic ${textMain}`}>
                  {purpleCap.name}
                </div>
                <div className={`text-sm font-mono font-bold mt-1 ${textSub}`}>
                  {purpleCap.calculatedStats.wickets} Wickets
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div
          className={`border border-current/10 rounded-[2rem] overflow-hidden shadow-2xl ${cardBg}`}>
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-teal-500 animate-pulse text-xs font-black uppercase tracking-widest gap-3">
              <Loader2 className="animate-spin" size={32} />
              Fetching Global Data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead
                  className={`text-[10px] uppercase font-black tracking-[0.2em] border-b border-current/10 bg-black/20 ${textSub}`}>
                  <tr>
                    <th
                      className="px-6 py-4 cursor-pointer hover:opacity-70 group w-[40%] md:w-[30%] transition-opacity"
                      onClick={() => handleSort("name")}>
                      Player Details <SortIcon colKey="name" />
                    </th>
                    <th
                      className="px-4 py-4 text-center cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("matches")}>
                      Mat <SortIcon colKey="matches" />
                    </th>
                    <th
                      className="px-4 py-4 text-center cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("runs")}>
                      Runs <SortIcon colKey="runs" />
                    </th>
                    <th
                      className="px-4 py-4 text-center cursor-pointer hover:opacity-70 group hidden md:table-cell transition-opacity"
                      onClick={() => handleSort("highestScore")}>
                      HS <SortIcon colKey="highestScore" />
                    </th>
                    <th
                      className="px-4 py-4 text-center cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("wickets")}>
                      Wkts <SortIcon colKey="wickets" />
                    </th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-current/10`}>
                  {processedPlayers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className={`text-center py-16 italic text-sm ${textSub}`}>
                        No players found.
                      </td>
                    </tr>
                  ) : (
                    processedPlayers.map((player) => {
                      const profile = player.latestProfile;
                      const displayPhoto =
                        profile.photoURL ||
                        "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                      const displayRole = profile.role;
                      const displayBatting = profile.battingStyle;
                      const displayBowling = profile.bowlingStyle;

                      return (
                        <React.Fragment key={player.id}>
                          <tr
                            onClick={() => toggleRowExpansion(player.id)}
                            className={`cursor-pointer group transition-colors ${
                              expandedPlayerId === player.id
                                ? "bg-current/10"
                                : "hover:bg-current/5"
                            }`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <img
                                  src={displayPhoto}
                                  alt=""
                                  className={`w-12 h-12 rounded-xl object-cover border border-current/10 flex-shrink-0 shadow-sm bg-current/5`}
                                  onError={(e) => {
                                    e.target.src =
                                      "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                                  }}
                                />
                                <div className="flex flex-col overflow-hidden">
                                  <span
                                    className={`font-bold text-sm leading-tight truncate max-w-[120px] md:max-w-none transition-colors ${textMain}`}>
                                    {player.name}
                                  </span>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    <span
                                      className={`text-[9px] px-2 py-0.5 rounded border border-current/10 truncate uppercase font-bold tracking-wider bg-current/5 ${textSub}`}>
                                      {displayRole}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td
                              className={`px-4 py-4 text-center font-mono font-bold ${textSub}`}>
                              {player.calculatedStats.matches}
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-teal-500 font-mono text-base">
                              {player.calculatedStats.runs}
                            </td>
                            <td
                              className={`px-4 py-4 text-center font-mono font-bold hidden md:table-cell ${textSub}`}>
                              {player.calculatedStats.highestScore}
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-purple-500 font-mono text-base">
                              {player.calculatedStats.wickets}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-3 items-center">
                                <ChevronDown
                                  className={`transition-transform duration-200 ${expandedPlayerId === player.id ? "rotate-180" : ""} ${textSub}`}
                                  size={16}
                                />
                                {user && (
                                  <>
                                    <button
                                      onClick={(e) => openEditModal(player, e)}
                                      className={`p-2 rounded-lg transition-all bg-current/5 border border-transparent hover:bg-current/10 hover:border-current/10 text-inherit opacity-70 hover:opacity-100`}>
                                      <Edit3 size={16} />
                                    </button>
                                    <button
                                      onClick={(e) =>
                                        handleDelete(player.id, e)
                                      }
                                      className="text-red-500/70 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all">
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {expandedPlayerId === player.id && (
                            <tr
                              className={`border-t border-b border-current/10 animate-in slide-in-from-top-1 bg-black/40 backdrop-blur-md`}>
                              <td colSpan={8} className="p-6">
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                  <div className="flex-shrink-0">
                                    <img
                                      src={displayPhoto}
                                      alt={player.name}
                                      className={`w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border-2 shadow-2xl cursor-pointer border-teal-500/30 bg-current/5 shadow-teal-500/10`}
                                      onClick={() =>
                                        displayPhoto &&
                                        setPreviewImage(displayPhoto)
                                      }
                                      onError={(e) => {
                                        e.target.src =
                                          "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                                      }}
                                    />
                                  </div>
                                  <div className="flex-grow w-full">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                      <DetailItem
                                        label="Full Name"
                                        value={player.name}
                                      />
                                      <DetailItem
                                        label="Role"
                                        value={displayRole}
                                      />
                                      <DetailItem
                                        label="Batting"
                                        value={displayBatting}
                                      />
                                      <DetailItem
                                        label="Bowling"
                                        value={displayBowling}
                                      />
                                      <DetailItem
                                        label="Mobile"
                                        value={player.mobile}
                                        isMono={true}
                                      />
                                      <DetailItem
                                        label="Last Updated"
                                        value={
                                          profile.date
                                            ? new Date(
                                                profile.date,
                                              ).toLocaleDateString()
                                            : "N/A"
                                        }
                                      />
                                    </div>

                                    <div
                                      className={`pt-6 border-t border-current/10`}>
                                      <h4
                                        className={`text-xs font-black uppercase mb-4 flex items-center gap-2 tracking-widest ${textSub}`}>
                                        Global Match History (
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
                                                    match.matchId,
                                                  )
                                                }
                                                className={`p-4 rounded-xl cursor-pointer transition-all flex justify-between items-center group/card border bg-current/5 border-current/10 hover:border-teal-500/50 hover:bg-current/10`}>
                                                <div>
                                                  <div
                                                    className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${textSub}`}>
                                                    {new Date(
                                                      match.date,
                                                    ).toLocaleDateString() ||
                                                      "Date"}
                                                  </div>
                                                  <div
                                                    className={`font-bold text-sm transition-colors group-hover/card:text-teal-500 ${textMain}`}>
                                                    vs{" "}
                                                    {match.opponent ||
                                                      "Opponent"}
                                                  </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                  <div className="flex gap-3 text-xs">
                                                    {match.runs > 0 && (
                                                      <span className="text-teal-500 font-bold font-mono">
                                                        🏏 {match.runs}
                                                      </span>
                                                    )}
                                                    {match.wickets > 0 && (
                                                      <span className="text-purple-500 font-bold font-mono">
                                                        🥎 {match.wickets}
                                                      </span>
                                                    )}
                                                    {match.runs === 0 &&
                                                      match.wickets === 0 && (
                                                        <span
                                                          className={textSub}>
                                                          -
                                                        </span>
                                                      )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      ) : (
                                        <div
                                          className={`text-xs italic p-6 border border-dashed rounded-xl text-center font-medium bg-current/5 border-current/10 text-inherit opacity-60`}>
                                          No global match history recorded.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* IMAGE LIGHTBOX */}
        {previewImage && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={previewImage}
                alt="Preview"
                className="rounded-xl shadow-2xl border border-white/10"
                style={{ maxWidth: "70vw", maxHeight: "70vh" }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                className="absolute -top-12 right-0 text-white hover:text-red-400 font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
                onClick={() => setPreviewImage(null)}>
                Close <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
            <div
              className={`border border-current/10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${cardBg} ${textMain}`}>
              <div
                className={`p-6 border-b border-current/10 flex justify-between items-center sticky top-0 z-10 bg-black/20`}>
                <h3
                  className={`text-lg font-black uppercase tracking-tight italic ${textMain}`}>
                  {isEditing ? "Edit Global Profile" : "Create New Player"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-current/10 hover:bg-current/20 text-inherit opacity-70 hover:opacity-100`}>
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto p-8 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex gap-4 justify-center">
                    {/* Profile Photo */}
                    <div className="flex flex-col items-center">
                      <div
                        className="relative group cursor-pointer"
                        onClick={() => fileInputRef.current.click()}>
                        <div
                          className={`w-24 h-24 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl ${
                            formData.photoURL
                              ? "border-teal-500 shadow-teal-500/20 bg-black/40"
                              : "bg-current/5 border-current/20 border-dashed hover:border-teal-500/50"
                          }`}>
                          {formData.photoURL ? (
                            <img
                              src={formData.photoURL}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className={`opacity-50 ${textSub}`} />
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
                      <p
                        className={`text-[9px] uppercase mt-2 font-black tracking-widest text-center ${textSub}`}>
                        Profile
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input
                      className={inputClass}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      placeholder="Full Name"
                    />
                    <input
                      className={inputClass}
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({ ...formData, mobile: e.target.value })
                      }
                      placeholder="Mobile Number"
                    />

                    <div className="grid grid-cols-2 gap-3">
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
                          className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                            formData.role === role
                              ? "bg-teal-500/20 border-teal-500 text-teal-400 shadow-lg"
                              : "bg-current/5 border-current/10 text-inherit opacity-70 hover:opacity-100 hover:bg-current/10"
                          }`}>
                          {role}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <select
                        className={`${inputClass} text-xs cursor-pointer`}
                        value={formData.battingStyle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            battingStyle: e.target.value,
                          })
                        }>
                        <option className="text-black">Right Hand Bat</option>
                        <option className="text-black">Left Hand Bat</option>
                      </select>
                      <select
                        className={`${inputClass} text-xs cursor-pointer`}
                        value={formData.bowlingStyle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bowlingStyle: e.target.value,
                          })
                        }>
                        <option className="text-black">Right Arm Medium</option>
                        <option className="text-black">Right Arm Fast</option>
                        <option className="text-black">Right Arm Spin</option>
                        <option className="text-black">Left Arm Medium</option>
                        <option className="text-black">Left Arm Fast</option>
                        <option className="text-black">Left Arm Spin</option>
                        <option className="text-black">None</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processingImage}
                    className={`w-full bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-teal-500"} hover:opacity-90 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 active:scale-[0.98]`}>
                    {processingImage
                      ? "Processing..."
                      : isEditing
                        ? "Update Global Profile"
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
