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
  
  // Refs for file inputs
  const fileInputRef = useRef(null);       // Profile Photo
  const paymentInputRef = useRef(null);    // Payment Screenshot

  // --- STATE ---
  const [players, setPlayers] = useState([]);
  const [allMatches, setAllMatches] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);

  // Lightbox State
  const [previewImage, setPreviewImage] = useState(null);

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
    paymentScreenshotURL: "", // ✅ Added payment field
  });

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

    const statsMap = {};
    players.forEach((p) => {
      statsMap[p.id] = {
        ...p,
        calculatedStats: { matches: 0, runs: 0, wickets: 0, highestScore: 0, history: [] },
      };
    });

    const identityMap = {};
    players.forEach((p) => {
      identityMap[p.name.trim().toLowerCase()] = p.id;
      identityMap[p.id] = p.id;
    });

    allMatches.forEach((match) => {
      const status = (match.status || match.meta?.status || "").toLowerCase();
      if (!["finished", "completed", "ongoing", "live"].includes(status)) return;

      let inningsArray = Array.isArray(match.innings) ? match.innings : Object.values(match.innings || {});
      if (inningsArray.length === 0) return;

      const findGlobalId = (name, originalId) => {
        const lowerName = (name || "").trim().toLowerCase();
        if (originalId && identityMap[originalId]) return identityMap[originalId];
        return identityMap[lowerName];
      };

      inningsArray.forEach((inn) => {
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName, null);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const r = Number(s.runs) || 0;
              if (s.balls > 0 || s.out) {
                const alreadyProcessed = p.calculatedStats.history.some((h) => h.matchId === match.id);
                if (!alreadyProcessed) {
                  p.calculatedStats.matches += 1;
                  p.calculatedStats.history.push({
                    matchId: match.id, tournamentId: match.tournamentId, date: match.date,
                    opponent: inn.battingTeam === match.meta?.teamA ? match.meta?.teamB : match.meta?.teamA,
                    runs: r, wickets: 0,
                  });
                } else {
                  const entry = p.calculatedStats.history.find((h) => h.matchId === match.id);
                  entry.runs += r;
                }
                p.calculatedStats.runs += r;
                if (r > p.calculatedStats.highestScore) p.calculatedStats.highestScore = r;
              }
            }
          });
        }
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName, null);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const w = Number(s.wickets) || 0;
              if (s.balls > 0) {
                const alreadyProcessed = p.calculatedStats.history.some((h) => h.matchId === match.id);
                if (!alreadyProcessed) {
                  p.calculatedStats.matches += 1;
                  p.calculatedStats.history.push({
                    matchId: match.id, tournamentId: match.tournamentId, date: match.date,
                    opponent: inn.battingTeam || "Opponent", runs: 0, wickets: w,
                  });
                } else {
                  const entry = p.calculatedStats.history.find((h) => h.matchId === match.id);
                  entry.wickets += w;
                }
                p.calculatedStats.wickets += w;
              }
            }
          });
        }
      });
    });

    let result = Object.values(statsMap);
    if (searchTerm) {
      result = result.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

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

    const allStats = Object.values(statsMap);
    const orange = [...allStats].sort((a, b) => b.calculatedStats.runs - a.calculatedStats.runs)[0];
    const purple = [...allStats].sort((a, b) => b.calculatedStats.wickets - a.calculatedStats.wickets)[0];

    return { processedPlayers: result, orangeCap: orange?.calculatedStats.runs > 0 ? orange : null, purpleCap: purple?.calculatedStats.wickets > 0 ? purple : null };
  }, [players, allMatches, searchTerm, sortConfig]);

  // --- ACTIONS ---
  const handleDelete = async (playerId, e) => {
    e.stopPropagation();
    if (!window.confirm("⚠ Permanently delete this player?")) return;
    try {
      await deleteGlobalPlayer(playerId);
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

  // Handler for Profile Photo
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

  // ✅ Handler for Payment Screenshot
  const handlePaymentImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const compressedBase64 = await compressImage(file, 500); // Slightly larger for readability
      setFormData((prev) => ({ ...prev, paymentScreenshotURL: compressedBase64 }));
    } catch (error) {
      alert("Failed to process payment image.");
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
    const sanitizeStyle = (val, defaultVal) => !val || val === "Unknown" ? defaultVal : val;
    setFormData({
      id: player.id,
      name: player.name,
      role: player.role || "All-Rounder",
      battingStyle: sanitizeStyle(player.battingStyle, "Right Hand Bat"),
      bowlingStyle: sanitizeStyle(player.bowlingStyle, "Right Arm Medium"),
      mobile: player.mobile || "",
      photoURL: player.photoURL || "",
      paymentScreenshotURL: player.paymentScreenshotURL || "", // ✅ Load existing payment image
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
          paymentScreenshotURL: formData.paymentScreenshotURL, // ✅ Save payment URL
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
    <span className={sortConfig.key === colKey ? "text-teal-400 ml-1" : "text-slate-600 ml-1 opacity-0 group-hover:opacity-50"}>
      {sortConfig.key === colKey ? (sortConfig.direction === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  const DetailItem = ({ label, value, isMono = false }) => (
    <div className="flex flex-col p-3 bg-[#161920] rounded-xl border border-white/5">
      <span className="text-[9px] uppercase font-black text-slate-500 mb-1 tracking-wider">{label}</span>
      <span className={`text-sm text-slate-200 break-words font-bold ${isMono ? "font-mono text-teal-400" : ""}`}>{value || "N/A"}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 p-2 md:p-4 pb-20 font-sans">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic flex items-center gap-2 justify-center md:justify-start">
              <span className="bg-teal-500/10 text-teal-500 p-2 rounded-xl">🌍</span>
              <span>Global Database</span>
            </h1>
            <p className="text-slate-500 text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
              {processedPlayers.length} players found
            </p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto justify-center md:justify-end">
            <input
              type="text"
              placeholder="Search name..."
              className="bg-[#1C2128] border border-white/10 text-slate-200 rounded-xl px-5 py-3 w-full md:w-64 focus:border-teal-500/50 outline-none text-sm font-bold placeholder:text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {user && (
              <button
                onClick={openAddModal}
                className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg whitespace-nowrap transition-all active:scale-95 text-white">
                + Add
              </button>
            )}
          </div>
        </div>

        {/* CAPS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {orangeCap && (
            <div className="bg-gradient-to-br from-orange-900/30 to-[#161920] border border-orange-500/20 p-5 rounded-[2rem] flex items-center gap-5 shadow-xl relative overflow-hidden group">
              <div className="bg-orange-500/10 p-4 rounded-full text-3xl border border-orange-500/20 group-hover:scale-110 transition-transform">🏏</div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Global Orange Cap</div>
                <div className="text-xl font-black text-slate-100 italic">{orangeCap.name}</div>
                <div className="text-sm text-slate-400 font-mono font-bold mt-1">{orangeCap.calculatedStats.runs} Runs</div>
              </div>
            </div>
          )}
          {purpleCap && (
            <div className="bg-gradient-to-br from-purple-900/30 to-[#161920] border border-purple-500/20 p-5 rounded-[2rem] flex items-center gap-5 shadow-xl relative overflow-hidden group">
              <div className="bg-purple-500/10 p-4 rounded-full text-3xl border border-purple-500/20 group-hover:scale-110 transition-transform">🥎</div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">Global Purple Cap</div>
                <div className="text-xl font-black text-slate-100 italic">{purpleCap.name}</div>
                <div className="text-sm text-slate-400 font-mono font-bold mt-1">{purpleCap.calculatedStats.wickets} Wickets</div>
              </div>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="bg-[#1C2128] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center text-teal-500 animate-pulse text-xs font-black uppercase tracking-widest">Fetching all tournament data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-[#0F1115] text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer hover:text-slate-300 group w-[40%] md:w-[30%] transition-colors" onClick={() => handleSort("name")}>Player Details <SortIcon colKey="name" /></th>
                    <th className="px-4 py-4 text-center cursor-pointer hover:text-slate-300 group transition-colors" onClick={() => handleSort("matches")}>Mat <SortIcon colKey="matches" /></th>
                    <th className="px-4 py-4 text-center cursor-pointer hover:text-slate-300 group transition-colors" onClick={() => handleSort("runs")}>Runs <SortIcon colKey="runs" /></th>
                    <th className="px-4 py-4 text-center cursor-pointer hover:text-slate-300 group hidden md:table-cell transition-colors" onClick={() => handleSort("highestScore")}>HS <SortIcon colKey="highestScore" /></th>
                    <th className="px-4 py-4 text-center cursor-pointer hover:text-slate-300 group transition-colors" onClick={() => handleSort("wickets")}>Wkts <SortIcon colKey="wickets" /></th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {processedPlayers.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-16 text-slate-600 italic text-sm">No players found.</td></tr>
                  ) : (
                    processedPlayers.map((player) => (
                      <React.Fragment key={player.id}>
                        <tr onClick={() => toggleRowExpansion(player.id)} className={`hover:bg-white/5 transition-colors cursor-pointer group ${expandedPlayerId === player.id ? "bg-white/5" : ""}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <img src={player.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"} alt="" className="w-12 h-12 rounded-xl object-cover bg-[#0F1115] border border-white/10 flex-shrink-0 shadow-sm" onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/847/847969.png"; }} />
                              <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-slate-200 text-sm leading-tight truncate max-w-[120px] md:max-w-none group-hover:text-white transition-colors">{player.name}</span>
                                <div className="flex flex-wrap gap-1 mt-1.5"><span className="text-[9px] bg-[#0F1115] text-slate-500 px-2 py-0.5 rounded border border-white/10 truncate uppercase font-bold tracking-wider">{player.role}</span></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-slate-400 font-mono font-bold">{player.calculatedStats.matches}</td>
                          <td className="px-4 py-4 text-center font-bold text-teal-400 font-mono text-base">{player.calculatedStats.runs}</td>
                          <td className="px-4 py-4 text-center text-slate-500 font-mono font-bold hidden md:table-cell">{player.calculatedStats.highestScore}</td>
                          <td className="px-4 py-4 text-center font-bold text-green-400 font-mono text-base">{player.calculatedStats.wickets}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-3 items-center">
                              <span className="text-slate-600 mr-2 text-xs transition-transform duration-200 transform group-hover:text-slate-400" style={{ transform: expandedPlayerId === player.id ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                              {user && (
                                <>
                                  <button onClick={(e) => openEditModal(player, e)} className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all">✎</button>
                                  <button onClick={(e) => handleDelete(player.id, e)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-all">🗑</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {expandedPlayerId === player.id && (
                          <tr className="bg-[#0F1115] border-t border-b border-white/5 animate-in slide-in-from-top-1">
                            <td colSpan={8} className="p-6">
                              <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="flex-shrink-0">
                                  <img src={player.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"} alt={player.name} className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover border-2 border-teal-500/30 shadow-2xl shadow-teal-900/20 bg-[#161920]" onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/847/847969.png"; }} />
                                </div>
                                <div className="flex-grow w-full">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    <DetailItem label="Full Name" value={player.name} />
                                    <DetailItem label="Role" value={player.role} />
                                    <DetailItem label="Batting" value={player.battingStyle} />
                                    <DetailItem label="Bowling" value={player.bowlingStyle} />
                                    <DetailItem label="Mobile" value={player.mobile} isMono={true} />
                                    <DetailItem label="Registered" value={player.createdAt ? new Date(player.createdAt).toLocaleDateString() : "N/A"} />
                                  </div>

                                  {user && player.paymentScreenshotURL && (
                                    <div className="mb-8 pt-6 border-t border-white/5">
                                        <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">Receipt / Proof</h4>
                                        <div 
                                          className="relative group w-full md:w-64 cursor-pointer" 
                                          onClick={() => setPreviewImage(player.paymentScreenshotURL)}
                                        >
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                                <span className="text-white font-bold text-xs uppercase tracking-widest">Click to Enlarge</span>
                                            </div>
                                            <img src={player.paymentScreenshotURL} alt="Payment" className="w-full h-32 object-cover rounded-xl border border-white/10" />
                                        </div>
                                    </div>
                                  )}

                                  <div className="pt-6 border-t border-white/5">
                                    <h4 className="text-xs font-black text-slate-500 uppercase mb-4 flex items-center gap-2 tracking-widest"><span>📜</span> Match History ({player.calculatedStats.history.length})</h4>
                                    {player.calculatedStats.history.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {player.calculatedStats.history.slice(0, 10).map((match, idx) => (
                                            <div key={idx} onClick={() => goToMatch(match.tournamentId, match.matchId)} className="bg-[#161920] border border-white/5 p-4 rounded-xl cursor-pointer hover:border-teal-500/40 hover:bg-[#1C2128] transition-all flex justify-between items-center group/card">
                                              <div>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">{new Date(match.date).toLocaleDateString() || "Date"}</div>
                                                <div className="font-bold text-sm text-slate-200 group-hover/card:text-teal-400 transition-colors">vs {match.opponent || "Opponent"}</div>
                                              </div>
                                              <div className="text-right flex flex-col items-end">
                                                <div className="flex gap-3 text-xs">
                                                  {match.runs > 0 && <span className="text-teal-400 font-bold font-mono">🏏 {match.runs}</span>}
                                                  {match.wickets > 0 && <span className="text-green-400 font-bold font-mono">🥎 {match.wickets}</span>}
                                                  {match.runs === 0 && match.wickets === 0 && <span className="text-slate-600 font-bold">-</span>}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-600 italic p-6 border border-dashed border-white/5 rounded-xl bg-[#161920] text-center font-medium">No match history recorded.</div>
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

        {/* IMAGE LIGHTBOX */}
        {previewImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img 
                src={previewImage} 
                alt="Payment Proof" 
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()} 
              />
              <button 
                className="absolute -top-12 right-0 text-white hover:text-red-400 font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
                onClick={() => setPreviewImage(null)}
              >
                Close ✕
              </button>
            </div>
          </div>
        )}

        {/* EDIT/CREATE MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-[#0F1115]/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#1C2128] border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/5 bg-[#1C2128] flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight italic">{isEditing ? "Edit Player Profile" : "Create New Player"}</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
              </div>
              <div className="overflow-y-auto p-8 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* TWO IMAGE UPLOADS */}
                  <div className="flex gap-4 justify-center">
                    {/* 1. Profile Photo */}
                    <div className="flex flex-col items-center">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl bg-[#0F1115] ${formData.photoURL ? "border-teal-500 shadow-teal-500/20" : "border-dashed border-white/10 hover:border-white/30"}`}>
                            {formData.photoURL ? <img src={formData.photoURL} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center"><span className="text-2xl opacity-50 grayscale">📷</span></div>}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                        <p className="text-[9px] text-slate-500 uppercase mt-2 font-black tracking-widest text-center">Profile</p>
                        </div>
                    </div>

                    {/* 2. Payment Proof */}
                    <div className="flex flex-col items-center">
                        <div className="relative group cursor-pointer" onClick={() => paymentInputRef.current.click()}>
                        <div className={`w-24 h-24 rounded-xl border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl bg-[#0F1115] ${formData.paymentScreenshotURL ? "border-amber-500 shadow-amber-500/20" : "border-dashed border-white/10 hover:border-white/30"}`}>
                            {formData.paymentScreenshotURL ? <img src={formData.paymentScreenshotURL} alt="Proof" className="w-full h-full object-cover" /> : <div className="text-center"><span className="text-2xl opacity-50 grayscale">🧾</span></div>}
                        </div>
                        <input type="file" ref={paymentInputRef} onChange={handlePaymentImageUpload} className="hidden" accept="image/*" />
                        <p className="text-[9px] text-slate-500 uppercase mt-2 font-black tracking-widest text-center">Payment Proof</p>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-teal-500/50 transition-all font-bold placeholder:text-slate-600" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Full Name" />
                    <input className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-teal-500/50 transition-all font-bold placeholder:text-slate-600" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} placeholder="Mobile Number" />
                    <div className="grid grid-cols-2 gap-3">
                        {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map((role) => (
                            <button key={role} type="button" onClick={() => setFormData({ ...formData, role })} className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${formData.role === role ? "bg-teal-500/10 border-teal-500/50 text-teal-400 shadow-lg" : "bg-[#0F1115] border-white/5 text-slate-500 hover:text-slate-300"}`}>{role}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-teal-500/50" value={formData.battingStyle} onChange={(e) => setFormData({ ...formData, battingStyle: e.target.value })}><option>Right Hand Bat</option><option>Left Hand Bat</option></select>
                        <select className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 outline-none focus:border-teal-500/50" value={formData.bowlingStyle} onChange={(e) => setFormData({ ...formData, bowlingStyle: e.target.value })}><option>Right Arm Medium</option><option>Right Arm Fast</option><option>Right Arm Spin</option><option>Left Arm Medium</option><option>Left Arm Fast</option><option>Left Arm Spin</option><option>None</option></select>
                    </div>
                  </div>
                  <button type="submit" disabled={processingImage} className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg shadow-teal-900/20 transition-all disabled:opacity-50 active:scale-[0.98]">{processingImage ? "Processing..." : isEditing ? "Update Player" : "Create Player"}</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}