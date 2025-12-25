// src/pages/TournamentDetails.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listMatchesForTournament, getTournament } from "../utils/firestore";
import { calculatePointsTable } from "../utils/statsHelper";
import { useAuth } from "../hooks/useAuth";
import TeamManager from "../components/TeamManager";
import TournamentAccessManager from "../components/TournamentAccessManager";

// --- SUB-COMPONENT: GLOBAL TEAM SELECTOR MODAL ---
const GlobalTeamSelector = ({ isOpen, onClose, onImport, existingTeamIds }) => {
  const [globalTeams, setGlobalTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchGlobal = async () => {
        setLoading(true);
        try {
          const snap = await getDocs(collection(db, "teams"));
          const teams = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          const available = teams.filter(
            (t) => !existingTeamIds.includes(t.id)
          );
          setGlobalTeams(available);
        } catch (error) {
          console.error("Error loading global teams:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchGlobal();
    }
  }, [isOpen, existingTeamIds]);

  const toggleSelection = (team) => {
    if (selectedTeams.find((t) => t.id === team.id)) {
      setSelectedTeams((prev) => prev.filter((t) => t.id !== team.id));
    } else {
      setSelectedTeams((prev) => [...prev, team]);
    }
  };

  const handleImport = () => {
    onImport(selectedTeams);
    setSelectedTeams([]);
    onClose();
  };

  if (!isOpen) return null;

  const filteredTeams = globalTeams.filter((t) =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h3 className="text-xl font-bold text-white">Import Global Teams</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 bg-gray-900 border-b border-gray-800">
          <input
            type="text"
            placeholder="Search global teams..."
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center text-cyan-500 animate-pulse mt-4">
              Loading Global Database...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center text-gray-500 mt-4">
              No available teams found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTeams.map((team) => {
                const isSelected = !!selectedTeams.find(
                  (t) => t.id === team.id
                );
                return (
                  <div
                    key={team.id}
                    onClick={() => toggleSelection(team)}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? "bg-cyan-900/20 border-cyan-500 shadow-md"
                        : "bg-gray-800 border-gray-700 hover:border-gray-500"
                    }`}>
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-10 h-10 rounded-full object-cover bg-black"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg">
                          🛡️
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-sm">
                          {team.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {team.players ? team.players.length : 0} Players
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-cyan-400 text-xl">✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors text-sm font-bold">
            Cancel
          </button>
          <button
            disabled={selectedTeams.length === 0}
            onClick={handleImport}
            className={`px-6 py-2 rounded-lg text-white font-bold text-sm transition-all ${
              selectedTeams.length > 0
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:shadow-lg"
                : "bg-gray-700 cursor-not-allowed opacity-50"
            }`}>
            Import {selectedTeams.length} Teams
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function TournamentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("matches");
  const [matches, setMatches] = useState([]);
  const [tournamentData, setTournamentData] = useState(null);

  // Stores full team objects {id, name, logo}
  const [tournamentTeams, setTournamentTeams] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Stats State
  const [statsTab, setStatsTab] = useState("bat");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortStyle, setSortStyle] = useState("most_runs");
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  // 1. Check Admin
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().isAdmin) setIsAdmin(true);
      } catch (e) {
        console.error(e);
      }
    }
    checkAdmin();
  }, [user]);

  // 2. Fetch Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [tData, matchesData] = await Promise.all([
        getTournament(id),
        listMatchesForTournament(id),
      ]);
      setTournamentData(tData);
      setMatches(matchesData);

      const teamSnap = await getDocs(collection(db, `tournaments/${id}/teams`));
      const loadedTeams = teamSnap.docs.map((d) => ({
        id: d.id,
        originalTeamId: d.data().originalTeamId || d.id,
        name: d.data().name || "Unknown Team",
        logo: d.data().logo,
      }));
      setTournamentTeams(loadedTeams);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // 3. Import Logic
  const handleImportTeams = async (selectedTeams) => {
    try {
      const batch = writeBatch(db);
      const teamsRef = collection(db, `tournaments/${id}/teams`);
      selectedTeams.forEach((team) => {
        const newTeamRef = doc(teamsRef);
        batch.set(newTeamRef, {
          ...team,
          originalTeamId: team.id,
          addedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      alert(`Successfully imported ${selectedTeams.length} teams!`);
      fetchData();
    } catch (error) {
      console.error("Import failed", error);
      alert("Failed to import teams.");
    }
  };

  // Delete Handler
  const handleDeleteTournament = async () => {
    const confirmDelete = window.confirm(
      "⚠ DANGER: Are you sure you want to delete this tournament?\n\nThis will remove the tournament from your dashboard."
    );
    if (!confirmDelete) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, "tournaments", id));
      alert("Tournament deleted.");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete.");
      setLoading(false);
    }
  };

  // Permissions
  const canEdit = useMemo(() => {
    if (isAdmin) return true;
    if (!user || !tournamentData) return false;
    return (
      tournamentData.ownerId === user.uid ||
      tournamentData.scorers?.includes(user.uid)
    );
  }, [user, tournamentData, isAdmin]);

  const isOwner =
    isAdmin || (user && tournamentData && user.uid === tournamentData.ownerId);

  // --- 4. STATS CALCULATIONS ---

  const pointsTable = useMemo(() => {
    const calculatedStats = calculatePointsTable(matches);
    const statsMap = {};
    calculatedStats.forEach((t) => {
      if (t && t.name) statsMap[t.name] = t;
    });

    const mergedTable = tournamentTeams.map((team) => {
      const teamName = team.name || "Unknown Team";
      if (statsMap[teamName]) {
        return statsMap[teamName];
      }
      return {
        name: teamName,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        nrr: "0.000",
      };
    });

    return mergedTable.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (parseFloat(b.nrr) !== parseFloat(a.nrr))
        return parseFloat(b.nrr) - parseFloat(a.nrr);
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [matches, tournamentTeams]);

  const detailedStats = useMemo(() => {
    const players = {};
    const initPlayer = (name, team) => {
      if (!players[name]) {
        players[name] = {
          name,
          team,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          innings: 0,
          notOuts: 0,
          hs: 0,
          wickets: 0,
          runsConceded: 0,
          ballsBowled: 0,
          history: [],
        };
      }
    };

    matches.forEach((m) => {
      const inningsList = Array.isArray(m.innings) ? m.innings : [];
      inningsList.forEach((inn) => {
        if (!inn) return;
        const battingTeam = inn.battingTeam;
        const bowlingTeam = inn.bowlingTeam;
        const date = m.date;

        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([name, s]) => {
            initPlayer(name, battingTeam);
            if (s.balls > 0 || s.out) {
              players[name].runs += s.runs || 0;
              players[name].balls += s.balls || 0;
              players[name].fours += s.fours || 0;
              players[name].sixes += s.sixes || 0;
              players[name].innings += 1;
              if (!s.out) players[name].notOuts += 1;
              if ((s.runs || 0) > players[name].hs) players[name].hs = s.runs;
              players[name].history.push({
                type: "bat",
                matchId: m.id,
                date,
                opponent: bowlingTeam,
                runs: s.runs,
                balls: s.balls,
                out: s.out,
                isNotOut: !s.out,
                mvpPoints: s.runs * 1 + s.fours * 1 + s.sixes * 2,
              });
            }
          });
        }
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([name, s]) => {
            initPlayer(name, bowlingTeam);
            if (s.balls > 0) {
              players[name].wickets += s.wickets || 0;
              players[name].runsConceded += s.runs || 0;
              players[name].ballsBowled += s.balls || 0;
              players[name].history.push({
                type: "bowl",
                matchId: m.id,
                date,
                opponent: battingTeam,
                wickets: s.wickets,
                runsConceded: s.runs,
                overs: `${Math.floor(s.balls / 6)}.${s.balls % 6}`,
                mvpPoints: s.wickets * 20,
              });
            }
          });
        }
      });
    });

    return Object.values(players).map((p) => {
      const batAvg =
        p.innings - p.notOuts > 0
          ? (p.runs / (p.innings - p.notOuts)).toFixed(2)
          : p.runs.toFixed(2);
      const batSR =
        p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";
      const oversBowled = p.ballsBowled / 6;
      const bowlEco =
        oversBowled > 0 ? (p.runsConceded / oversBowled).toFixed(2) : "0.00";
      const bowlAvg =
        p.wickets > 0 ? (p.runsConceded / p.wickets).toFixed(2) : "0.00";
      const mvp = p.runs * 1 + p.wickets * 20 + p.fours * 1 + p.sixes * 2;
      return { ...p, batAvg, batSR, bowlEco, bowlAvg, mvp };
    });
  }, [matches]);

  const orangeCap = useMemo(() => {
    const sorted = [...detailedStats].sort((a, b) => b.runs - a.runs);
    return sorted.length > 0 && sorted[0].runs > 0 ? sorted[0] : null;
  }, [detailedStats]);

  const purpleCap = useMemo(() => {
    const sorted = [...detailedStats].sort((a, b) => b.wickets - a.wickets);
    return sorted.length > 0 && sorted[0].wickets > 0 ? sorted[0] : null;
  }, [detailedStats]);

  const filteredStats = useMemo(() => {
    let data = detailedStats;
    if (teamFilter !== "all") data = data.filter((p) => p.team === teamFilter);
    if (statsTab === "bat") data = data.filter((p) => p.innings > 0);
    if (statsTab === "bowl") data = data.filter((p) => p.ballsBowled > 0);

    return data.sort((a, b) => {
      if (statsTab === "bat") {
        if (sortStyle === "most_runs") return b.runs - a.runs;
        if (sortStyle === "high_score") return b.hs - a.hs;
        if (sortStyle === "strike_rate")
          return parseFloat(b.batSR) - parseFloat(a.batSR);
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
        if (sortStyle === "most_fours") return b.fours - a.fours;
        if (sortStyle === "average")
          return parseFloat(b.batAvg) - parseFloat(a.batAvg);
      } else if (statsTab === "bowl") {
        if (sortStyle === "most_wickets") return b.wickets - a.wickets;
        if (sortStyle === "best_economy")
          return parseFloat(a.bowlEco) - parseFloat(b.bowlEco);
        if (sortStyle === "best_avg")
          return parseFloat(a.bowlAvg) - parseFloat(b.bowlAvg);
      } else if (statsTab === "mvp") {
        return b.mvp - a.mvp;
      }
      return 0;
    });
  }, [detailedStats, teamFilter, statsTab, sortStyle]);

  const distinctTeams = useMemo(
    () => [...new Set(detailedStats.map((p) => p.team).filter(Boolean))],
    [detailedStats]
  );

  const getUnifiedHistory = (history) => {
    const unified = {};
    history.forEach((h) => {
      if (!unified[h.matchId])
        unified[h.matchId] = { ...h, bat: null, bowl: null, totalPoints: 0 };
      if (h.type === "bat") unified[h.matchId].bat = h;
      if (h.type === "bowl") unified[h.matchId].bowl = h;
      unified[h.matchId].totalPoints += h.mvpPoints || 0;
    });
    return Object.values(unified).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-950 text-cyan-500 animate-pulse font-bold">
        LOADING...
      </div>
    );
  if (!tournamentData) return <div>Not Found</div>;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen">
      <GlobalTeamSelector
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportTeams}
        existingTeamIds={tournamentTeams.map((t) => t.originalTeamId)} // Pass IDs only
      />

      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">
              Tournament Dashboard
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400">
                {tournamentData.name || id}
              </span>
            </h2>
            <div className="text-sm text-gray-400 flex gap-4 mt-2 font-mono">
              <span>📍 {tournamentData.location}</span>
              <span>📅 {tournamentData.startDate}</span>
            </div>
          </div>
          <div className="bg-gray-800 p-1 rounded-lg flex items-center border border-gray-700 overflow-x-auto">
            {[
              { id: "matches", label: "Matches" },
              { id: "points", label: "Points" },
              { id: "players", label: "Stats" },
              { id: "admin", label: "Admin" },
            ]
              .filter((tab) => tab.id !== "admin" || isOwner)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-gray-700 text-white shadow-sm border border-gray-600"
                      : "text-gray-400 hover:text-gray-200"
                  }`}>
                  {tab.label}
                </button>
              ))}
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 mt-6"></div>
      </div>

      {/* --- MATCHES TAB --- */}
      {activeTab === "matches" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
          {matches.length === 0 && (
            <div className="text-gray-500 col-span-3 text-center py-10">
              No matches scheduled yet.
            </div>
          )}
          {matches.map((m) => {
            const status = m.status || m.meta?.status || "upcoming";
            const isLive = status === "in-progress" || status === "ongoing";
            const isFinished = status === "finished";

            return (
              <div
                key={m.id}
                onClick={() => navigate(`/tournaments/${id}/scorecard/${m.id}`)}
                className={`group relative bg-gray-900 border rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  isLive
                    ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    : "border-gray-800 hover:border-cyan-500/50"
                }`}>
                <div
                  className={`h-1 w-full ${
                    isLive
                      ? "bg-red-500 animate-pulse"
                      : isFinished
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-mono text-gray-500">
                        {m.date}
                      </span>
                      {/* ✅ ADDED: OVER LIMIT BADGE */}
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded w-fit">
                        {m.meta?.overs
                          ? `${m.meta.overs} Overs`
                          : "Limited Overs"}
                      </span>
                    </div>
                    {isLive && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-900/30 animate-pulse">
                        LIVE
                      </span>
                    )}
                    {isFinished && (
                      <span className="text-[10px] font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-900/30">
                        FINISHED
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {m.meta?.teamA}{" "}
                      <span className="text-gray-600 text-sm mx-1">vs</span>{" "}
                      {m.meta?.teamB}
                    </div>
                    {isFinished && (
                      <div className="text-sm text-green-400 flex items-center gap-1">
                        🏆 Won by{" "}
                        {m.winner ||
                          m.result?.winner ||
                          m.meta?.result ||
                          "Unknown"}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="mt-4 pt-3 border-t border-gray-800 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/live/${id}/${m.id}`);
                        }}
                        className="text-sm font-bold text-cyan-400 hover:text-white bg-cyan-900/20 hover:bg-cyan-600 px-3 py-1 rounded transition-colors uppercase tracking-wider">
                        Edit Scoring
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- POINTS TABLE --- */}
      {activeTab === "points" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-950 text-gray-400 text-[10px] uppercase font-bold">
                <tr>
                  <th className="px-6 py-4">Pos</th>
                  <th className="px-6 py-4">Team</th>
                  <th className="px-4 text-center">P</th>
                  <th className="px-4 text-center">W</th>
                  <th className="px-4 text-center">L</th>
                  <th className="px-4 text-center text-white">Pts</th>
                  <th className="px-4 text-right">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pointsTable.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-gray-500">#{i + 1}</td>
                    <td className="px-6 py-4 font-bold text-white">{t.name}</td>
                    <td className="px-4 text-center text-gray-400">
                      {t.played}
                    </td>
                    <td className="px-4 text-center text-green-400">{t.won}</td>
                    <td className="px-4 text-center text-red-400">{t.lost}</td>
                    <td className="px-4 text-center text-xl font-black text-cyan-400">
                      {t.points}
                    </td>
                    <td className="px-4 text-right">{t.nrr}</td>
                  </tr>
                ))}
                {pointsTable.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500 italic">
                      No teams registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- NEW PLAYER STATS TAB --- */}
      {activeTab === "players" && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {orangeCap && (
              <div className="bg-gradient-to-br from-orange-900/30 to-gray-900 border border-orange-500/30 p-4 rounded-xl flex items-center gap-4 relative overflow-hidden shadow-lg shadow-orange-900/10">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
                  🏏
                </div>
                <div className="bg-orange-500/20 text-orange-400 p-3 rounded-full text-2xl border border-orange-500/40">
                  🧢
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                    Orange Cap
                  </div>
                  <div className="text-xl font-bold text-white leading-tight">
                    {orangeCap.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {orangeCap.runs} Runs
                  </div>
                </div>
              </div>
            )}
            {purpleCap && (
              <div className="bg-gradient-to-br from-purple-900/30 to-gray-900 border border-purple-500/30 p-4 rounded-xl flex items-center gap-4 relative overflow-hidden shadow-lg shadow-purple-900/10">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
                  🥎
                </div>
                <div className="bg-purple-500/20 text-purple-400 p-3 rounded-full text-2xl border border-purple-500/40">
                  🧢
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-purple-500">
                    Purple Cap
                  </div>
                  <div className="text-xl font-bold text-white leading-tight">
                    {purpleCap.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {purpleCap.wickets} Wickets
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {["bat", "bowl", "mvp"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setStatsTab(type);
                  setSortStyle(
                    type === "bat"
                      ? "most_runs"
                      : type === "bowl"
                      ? "most_wickets"
                      : "mvp"
                  );
                }}
                className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
                  statsTab === type
                    ? "bg-cyan-600 text-white shadow-lg"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}>
                {type === "bat"
                  ? "🏏 Batting"
                  : type === "bowl"
                  ? "🥎 Bowling"
                  : "👑 MVP"}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-2.5 flex-1 focus:border-cyan-500"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {distinctTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-2.5 flex-1 focus:border-cyan-500"
              value={sortStyle}
              onChange={(e) => setSortStyle(e.target.value)}>
              {statsTab === "bat" && (
                <>
                  <option value="most_runs">Most Runs</option>
                  <option value="high_score">Highest Score</option>
                  <option value="average">Best Average</option>
                  <option value="strike_rate">Best Strike Rate</option>
                  <option value="most_sixes">Most Sixes</option>
                  <option value="most_fours">Most Fours</option>
                </>
              )}
              {statsTab === "bowl" && (
                <>
                  <option value="most_wickets">Most Wickets</option>
                  <option value="best_economy">Best Economy</option>
                  <option value="best_avg">Best Average</option>
                </>
              )}
              {statsTab === "mvp" && <option value="mvp">MVP Points</option>}
            </select>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            {filteredStats.map((p, index) => (
              <div
                key={index}
                className="border-b border-gray-800 last:border-0">
                <div
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                    expandedPlayer === p.name
                      ? "bg-gray-800"
                      : "hover:bg-gray-800/30"
                  }`}
                  onClick={() =>
                    setExpandedPlayer(expandedPlayer === p.name ? null : p.name)
                  }>
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-black text-gray-600 w-6">
                      {(index + 1).toString().padStart(2, "0")}
                    </div>
                    <div>
                      <div className="font-bold text-white text-base">
                        {p.name}
                      </div>
                      <div className="text-sm text-gray-500">{p.team}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {statsTab === "bat" && (
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase">
                            Runs
                          </div>
                          <div className="font-bold text-cyan-400">
                            {p.runs}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase">
                            Inn
                          </div>
                          <div className="text-white">{p.innings}</div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-[10px] text-gray-500 uppercase">
                            SR
                          </div>
                          <div className="text-gray-300">{p.batSR}</div>
                        </div>
                      </div>
                    )}
                    {statsTab === "bowl" && (
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase">
                            Wkts
                          </div>
                          <div className="font-bold text-cyan-400">
                            {p.wickets}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase">
                            Eco
                          </div>
                          <div className="text-white">{p.bowlEco}</div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-[10px] text-gray-500 uppercase">
                            Avg
                          </div>
                          <div className="text-gray-300">{p.bowlAvg}</div>
                        </div>
                      </div>
                    )}
                    {statsTab === "mvp" && (
                      <div className="text-xl font-black text-yellow-500">
                        {p.mvp}{" "}
                        <span className="text-[10px] text-gray-500 font-normal">
                          pts
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {expandedPlayer === p.name && (
                  <div className="bg-gray-950/50 p-4 border-t border-gray-800 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-4 gap-2 mb-4 text-center text-sm pb-4 border-b border-gray-800/50">
                      {statsTab === "bat" ? (
                        <>
                          <div className="bg-gray-900 p-2 rounded">
                            HS: <b className="text-white">{p.hs}</b>
                          </div>
                          <div className="bg-gray-900 p-2 rounded">
                            Avg: <b className="text-white">{p.batAvg}</b>
                          </div>
                          <div className="bg-gray-900 p-2 rounded">
                            4s: <b className="text-green-400">{p.fours}</b>
                          </div>
                          <div className="bg-gray-900 p-2 rounded">
                            6s: <b className="text-cyan-400">{p.sixes}</b>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-900 p-2 rounded">
                            Overs:{" "}
                            <b className="text-white">
                              {(p.ballsBowled / 6).toFixed(1)}
                            </b>
                          </div>
                          <div className="bg-gray-900 p-2 rounded">
                            Runs:{" "}
                            <b className="text-red-400">{p.runsConceded}</b>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">
                        Match History
                      </div>
                      {(statsTab === "mvp"
                        ? getUnifiedHistory(p.history)
                        : p.history.filter((h) => h.type === statsTab)
                      ).map((log, lIdx) => (
                        <div
                          key={lIdx}
                          onClick={() =>
                            navigate(
                              `/tournaments/${id}/scorecard/${log.matchId}`
                            )
                          }
                          className="flex justify-between items-center bg-gray-900 hover:bg-gray-800 p-2 rounded cursor-pointer transition-colors">
                          <div className="text-sm">
                            <div className="text-gray-400">{log.date}</div>
                            <div className="font-bold text-gray-200">
                              vs {log.opponent}
                            </div>
                          </div>
                          <div className="text-sm font-mono text-right">
                            {/* ✅ FIX: ISOLATED VIEWS TO PREVENT OVERLAP */}
                            {statsTab === "bat" && (
                              <>
                                <span
                                  className={`font-bold ${
                                    log.runs >= 30
                                      ? "text-yellow-400"
                                      : "text-white"
                                  }`}>
                                  {log.runs}
                                </span>
                                <span className="text-gray-500 text-[10px]">
                                  ({log.balls})
                                </span>
                                {log.isNotOut && (
                                  <span className="text-cyan-400 text-[10px] ml-1">
                                    *
                                  </span>
                                )}
                              </>
                            )}
                            {statsTab === "bowl" && (
                              <>
                                <span
                                  className={`font-bold ${
                                    log.wickets >= 2
                                      ? "text-yellow-400"
                                      : "text-white"
                                  }`}>
                                  {log.wickets}
                                </span>
                                <span className="text-gray-500 mx-1">/</span>
                                <span className="text-gray-400">
                                  {log.runsConceded}
                                </span>
                                <div className="text-[10px] text-gray-500">
                                  ({log.overs} ov)
                                </div>
                              </>
                            )}
                            {statsTab === "mvp" && (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-yellow-400">
                                  {log.totalPoints} pts
                                </span>
                                <div className="text-[10px] text-gray-500 flex gap-2">
                                  {log.bat && (
                                    <span>
                                      🏏 {log.bat.runs}({log.bat.balls})
                                    </span>
                                  )}
                                  {/* ✅ FIX: Only show bowling if played */}
                                  {log.bowl && (
                                    <span>
                                      🥎 {log.bowl.wickets}/
                                      {log.bowl.runsConceded}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {p.history.length === 0 && (
                        <div className="text-sm text-gray-500 italic">
                          No activity in this category.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredStats.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No stats available for this selection.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ADMIN TAB --- */}
      {canEdit && activeTab === "admin" && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-white font-bold text-lg mb-2">
              🛡️ Team Management
            </h3>
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full bg-blue-600/20 text-blue-400 border border-blue-600/30 px-4 py-2 rounded-lg font-bold mb-4">
              + Import Teams
            </button>
            <TeamManager tournamentId={id} />
          </div>
          {isOwner && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
                <h3 className="text-white font-bold text-lg mb-2">
                  🔐 Access Control
                </h3>
                <TournamentAccessManager
                  tournament={tournamentData}
                  currentUserId={user.uid}
                />
              </div>
              <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-5">
                <h4 className="text-red-500 font-bold mb-2">⚠️ Danger Zone</h4>
                <button
                  onClick={handleDeleteTournament}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold w-full transition-colors">
                  Delete Tournament
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
