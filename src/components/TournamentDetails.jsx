import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { listMatchesForTournament, getTournament } from "../utils/firestore";
import { calculatePointsTable } from "../utils/statsHelper";
import { useAuth } from "../hooks/useAuth";
import TeamManager from "../components/TeamManager";
import TournamentAccessManager from "../components/TournamentAccessManager";

// ... (Keep GlobalTeamSelector component exactly as is) ...
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h3 className="text-xl font-bold text-white">Import Global Teams</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <div className="p-4 bg-gray-900 border-b border-gray-800">
          <input
            type="text"
            placeholder="Search global teams..."
            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="text-center text-cyan-500 animate-pulse mt-4 font-mono text-sm">
              Loading Global Database...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center text-gray-500 mt-4 italic">
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
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                      isSelected
                        ? "bg-cyan-900/20 border-cyan-500 shadow-lg shadow-cyan-900/20"
                        : "bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750"
                    }`}>
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-10 h-10 rounded-full object-cover bg-black shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-lg shadow-sm">
                          🛡️
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-sm">
                          {team.name}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                          {team.players ? team.players.length : 0} Players
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-cyan-400 text-xl font-bold">✓</div>
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
            className={`px-6 py-2 rounded-lg text-white font-bold text-sm transition-all shadow-lg ${
              selectedTeams.length > 0
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transform hover:scale-105"
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
        ownerName: d.data().ownerName || "", // Ensure ownerName is loaded
        purse: d.data().purse || 0,
        spent: d.data().spent || 0,
        logo: d.data().logo,
        players: d.data().players || [],
        roster: d.data().roster || [],
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

  // --- AUCTION TOGGLE LOGIC ---
  const handleEnableAuction = async () => {
    if (!window.confirm("Enable Auction Module for this tournament?")) return;
    try {
      setLoading(true);
      const ref = doc(db, "tournaments", id);
      await updateDoc(ref, { isAuction: true });
      await fetchData(); // Reload to reflect changes
      alert("Auction Module Enabled!");
    } catch (e) {
      console.error(e);
      alert("Error enabling auction: " + e.message);
      setLoading(false);
    }
  };

  const handleDisableAuction = async () => {
    if (
      !window.confirm(
        "DISABLE AUCTION?\n\nThis will re-enable manual team editing. Are you sure?"
      )
    )
      return;
    try {
      setLoading(true);
      const ref = doc(db, "tournaments", id);
      await updateDoc(ref, { isAuction: false });
      await fetchData(); // Reload to reflect changes
      alert("Auction Disabled. Manual editing restored.");
    } catch (e) {
      console.error(e);
      alert("Error disabling auction: " + e.message);
      setLoading(false);
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

  // Permissions Logic
  const canEdit = useMemo(() => {
    if (!user) return false;
    if (isAdmin) return true;
    if (id === "generic") return true;
    if (!tournamentData) return false;
    const isOwner = tournamentData.ownerId === user.uid;
    const isScorer = tournamentData.scorers?.includes(user.uid);
    return isOwner || isScorer;
  }, [user, tournamentData, isAdmin, id]);

  const isOwner =
    isAdmin || (user && tournamentData && user.uid === tournamentData.ownerId);

  // --- MATCHES CATEGORIZATION ---
  const { liveMatches, upcomingMatches, finishedMatches } = useMemo(() => {
    const live = [];
    const upcoming = [];
    const finished = [];

    matches.forEach((m) => {
      const status = m.status || m.meta?.status || "upcoming";
      const normStatus = status.toLowerCase();

      if (normStatus === "finished" || normStatus === "completed") {
        finished.push(m);
      } else if (
        normStatus === "in-progress" ||
        normStatus === "ongoing" ||
        normStatus === "live"
      ) {
        live.push(m);
      } else {
        upcoming.push(m);
      }
    });

    return {
      liveMatches: live,
      upcomingMatches: upcoming.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      ),
      finishedMatches: finished.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
    };
  }, [matches]);

  // --- HELPER: RENDER MATCH CARD ---
  const renderMatchCard = (m) => {
    const status = m.status || m.meta?.status || "upcoming";
    const normStatus = status.toLowerCase();
    const isLive =
      normStatus === "in-progress" ||
      normStatus === "ongoing" ||
      normStatus === "live";
    const isFinished = normStatus === "finished" || normStatus === "completed";

    return (
      <div
        key={m.id}
        onClick={() => navigate(`/tournaments/${id}/scorecard/${m.id}`)}
        className={`group relative bg-gray-900 border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
          isLive
            ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            : "border-gray-800 hover:border-gray-600"
        }`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          {isLive && (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-white bg-red-600 px-2 py-1 rounded-full shadow-lg shadow-red-600/40 animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
            </span>
          )}
          {isFinished && (
            <span className="text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded-full border border-green-900/50">
              FINISHED
            </span>
          )}
        </div>

        <div className="p-5 flex flex-col h-full">
          <div className="text-xs font-mono text-gray-500 mb-4 flex items-center gap-2">
            <span>{m.date}</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
            <span>{m.meta?.overs ? `${m.meta.overs} Ov` : "LO"}</span>
          </div>

          <div className="flex flex-col gap-3 flex-1 justify-center">
            <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform duration-300">
              <span className="text-lg font-bold text-white leading-tight">
                {m.meta?.teamA}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-600 bg-gray-800 px-1.5 rounded">
                VS
              </span>
              <div className="h-px bg-gray-800 flex-1"></div>
            </div>
            <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform duration-300 delay-75">
              <span className="text-lg font-bold text-white leading-tight">
                {m.meta?.teamB}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-gray-800/50 min-h-[30px] flex items-end justify-between">
            {isFinished ? (
              <div className="text-xs font-medium text-green-400/90 truncate max-w-[70%]">
                🏆 {m.winner || m.result?.winner || "Result TBA"}
              </div>
            ) : (
              <div className="text-xs text-gray-600 italic">
                Match not started
              </div>
            )}

            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/live/${id}/${m.id}`);
                }}
                className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all ${
                  isLive
                    ? "bg-red-600 text-white hover:bg-red-500 shadow-md"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                }`}>
                {isLive ? "Scoring..." : "Manage"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- 4. STATS CALCULATIONS ---
  const pointsTable = useMemo(() => {
    const calculatedStats = calculatePointsTable(matches);
    const statsMap = {};
    calculatedStats.forEach((t) => {
      if (t && t.name) statsMap[t.name] = t;
    });

    const mergedTable = tournamentTeams.map((team) => {
      const teamName = team.name || "Unknown Team";
      if (statsMap[teamName]) return statsMap[teamName];
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

  // --- REFACTORED DETAILED STATS (UPDATED to include ALL players) ---
  const detailedStats = useMemo(() => {
    const players = {};
    const idToNameMap = {}; // 🌉 The Bridge

    // A. Initialize stats from Rosters & Build Map
    tournamentTeams.forEach((team) => {
      const teamName = team.name || "Unknown Team";

      // Handle roster (objects) or legacy players (strings)
      if (team.roster && Array.isArray(team.roster)) {
        team.roster.forEach((p) => {
          const pName = p.name || "Unknown";
          // Map ID -> Name
          if (p.id) idToNameMap[p.id] = pName;

          // Initialize Player
          if (!players[pName]) {
            players[pName] = createPlayerStatsObject(pName, teamName);
          }
        });
      } else if (team.players && Array.isArray(team.players)) {
        team.players.forEach((pName) => {
          if (!players[pName]) {
            players[pName] = createPlayerStatsObject(pName, teamName);
          }
        });
      }
    });

    // Helper to create empty stats object
    function createPlayerStatsObject(name, team) {
      return {
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

    // Helper: Resolve Name and Get/Create Player Object
    const getPlayer = (key, teamName) => {
      // 1. Try resolving ID to Name
      let resolvedName = idToNameMap[key] || key; // Fallback to key if no map found

      // 2. Normalize
      resolvedName = String(resolvedName).trim();

      // 3. Init if missing
      if (!players[resolvedName]) {
        players[resolvedName] = createPlayerStatsObject(resolvedName, teamName);
      }

      return players[resolvedName];
    };

    // B. Aggregate from Matches
    matches.forEach((m) => {
      const inningsList = Array.isArray(m.innings) ? m.innings : [];

      inningsList.forEach((inn) => {
        if (!inn) return;
        const battingTeam = inn.battingTeam;
        const bowlingTeam = inn.bowlingTeam || "Opponent"; // Fallback
        const date = m.date || m.createdAt;

        // --- Batting ---
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([key, s]) => {
            const p = getPlayer(key, battingTeam);

            if (s.balls > 0 || s.out) {
              p.runs += Number(s.runs) || 0;
              p.balls += Number(s.balls) || 0;
              p.fours += Number(s.fours) || 0;
              p.sixes += Number(s.sixes) || 0;
              p.innings += 1;
              if (!s.out) p.notOuts += 1;
              if ((s.runs || 0) > p.hs) p.hs = s.runs;

              p.history.push({
                type: "bat",
                matchId: m.id,
                date,
                opponent: bowlingTeam,
                runs: s.runs,
                balls: s.balls,
                out: s.out,
              });
            }
          });
        }

        // --- Bowling ---
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([key, s]) => {
            const p = getPlayer(key, bowlingTeam);

            if (s.balls > 0) {
              p.wickets += Number(s.wickets) || 0;
              p.runsConceded += Number(s.runs) || 0;
              p.ballsBowled += Number(s.balls) || 0;

              p.history.push({
                type: "bowl",
                matchId: m.id,
                date,
                opponent: battingTeam,
                wickets: s.wickets,
                runs: s.runs,
                overs: `${Math.floor(s.balls / 6)}.${s.balls % 6}`,
              });
            }
          });
        }
      });
    });

    // C. Calculate Averages & Rates
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
  }, [matches, tournamentTeams]);

  const orangeCap = useMemo(() => {
    const sorted = [...detailedStats].sort((a, b) => b.runs - a.runs);
    return sorted.length > 0 && sorted[0].runs > 0 ? sorted[0] : null;
  }, [detailedStats]);

  const purpleCap = useMemo(() => {
    const sorted = [...detailedStats].sort((a, b) => b.wickets - a.wickets);
    return sorted.length > 0 && sorted[0].wickets > 0 ? sorted[0] : null;
  }, [detailedStats]);

  // --- FILTERED STATS (Updated: Shows everyone) ---
  const filteredStats = useMemo(() => {
    let data = detailedStats;

    // Only filter by Team, NOT by activity (innings/overs)
    if (teamFilter !== "all") data = data.filter((p) => p.team === teamFilter);

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
      <div className="flex justify-center items-center min-h-screen bg-[#0f172a] text-cyan-500 animate-pulse font-bold tracking-widest text-lg">
        LOADING...
      </div>
    );
  if (!tournamentData)
    return (
      <div className="text-white text-center mt-20">Tournament Not Found</div>
    );

  // Check if auction is enabled
  const isAuctionEnabled = tournamentData.isAuction === true;

  return (
    <div className="w-full min-h-screen bg-[#0f172a] text-gray-200 font-sans pb-20">
      <GlobalTeamSelector
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportTeams}
        existingTeamIds={tournamentTeams.map((t) => t.originalTeamId)}
      />

      {/* --- HERO HEADER --- */}
      <div className="relative bg-gradient-to-br from-gray-900 via-[#1e293b] to-gray-900 border-b border-gray-800 pt-8 pb-20 px-4 overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-900/30 text-cyan-400 border border-cyan-800/50">
                  Tournament
                </span>
                <span className="text-xs font-mono text-gray-500">
                  {tournamentData.location}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400">
                  {tournamentData.name || id}
                </span>
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1.5 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700/50">
                  📅 {tournamentData.startDate}
                </span>
                <span className="flex items-center gap-1.5 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700/50">
                  🏆 {tournamentTeams.length} Teams
                </span>
              </div>
            </div>

            {/* AUCTION ACTIONS */}
            {canEdit && (
              <div className="flex gap-3">
                {isAuctionEnabled ? (
                  <>
                    <button
                      onClick={() => navigate(`/tournaments/${id}/auction`)}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105 flex items-center gap-2">
                      <span>🔨</span> Enter Auction
                    </button>
                    {/* NEW: Disable Button */}
                    <button
                      onClick={handleDisableAuction}
                      className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 font-bold py-3 px-4 rounded-xl transition-all"
                      title="Turn off auction mode">
                      ⛔ Stop
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEnableAuction}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2">
                    <span>⚙️</span> Enable Auction Module
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- CONTENT CONTAINER --- */}
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-20">
        {/* --- NAVIGATION TABS --- */}
        <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 p-1.5 rounded-2xl flex overflow-x-auto shadow-2xl mb-8 no-scrollbar">
          {[
            { id: "matches", label: "Matches", icon: "🏟️" },
            { id: "teams", label: "Teams", icon: "👥" }, // ✅ Added Teams Tab
            { id: "points", label: "Points Table", icon: "📊" },
            { id: "players", label: "Player Stats", icon: "📈" },
            { id: "admin", label: "Settings", icon: "⚙️" },
          ]
            .filter((tab) => tab.id !== "admin" || isOwner)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-gray-800 text-white shadow-md border border-gray-700"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}>
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
        </div>

        {/* --- TAB CONTENT --- */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* MATCHES TAB */}
          {activeTab === "matches" && (
            <div className="space-y-12">
              {/* Live Section */}
              {liveMatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    Live Now
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveMatches.map(renderMatchCard)}
                  </div>
                </div>
              )}

              {/* Upcoming Section */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                  Upcoming Matches
                </h3>
                {upcomingMatches.length === 0 ? (
                  <div className="text-gray-600 bg-gray-900/50 border border-dashed border-gray-800 rounded-xl p-8 text-center italic">
                    No upcoming matches scheduled.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingMatches.map(renderMatchCard)}
                  </div>
                )}
              </div>

              {/* Finished Section */}
              {finishedMatches.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-6 bg-gray-700 rounded-full"></span>
                    Results
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {finishedMatches.map(renderMatchCard)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ✅ TEAMS TAB (NEW)  */}
          {activeTab === "teams" && (
            <div>
              {tournamentTeams.length === 0 ? (
                <div className="text-center py-12 text-gray-500 italic">
                  No teams added to this tournament yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournamentTeams.map((team) => (
                    <div
                      key={team.id}
                      className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-gray-700">
                      {/* Card Header with Owner */}
                      <div className="bg-gray-950 p-5 border-b border-gray-800">
                        <div className="flex items-center gap-4 mb-3">
                          {team.logo ? (
                            <img
                              src={team.logo}
                              alt={team.name}
                              className="w-12 h-12 rounded-full object-cover border border-gray-700"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-xl shadow-inner">
                              🛡️
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-black text-white leading-tight">
                              {team.name}
                            </h3>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              {team.players ? team.players.length : 0} Players
                            </div>
                          </div>
                        </div>

                        {/* Owner Highlight */}
                        <div className="bg-gradient-to-r from-yellow-900/20 to-transparent border-l-2 border-yellow-500 pl-3 py-1">
                          <div className="text-[10px] uppercase font-bold text-yellow-600 tracking-wider">
                            Team Owner
                          </div>
                          <div className="text-yellow-400 font-bold text-sm flex items-center gap-1.5">
                            <span>👑</span>{" "}
                            {team.ownerName || "No Owner Assigned"}
                          </div>
                        </div>
                      </div>

                      {/* Stats / Purse Info  */}
                      {isAuctionEnabled && (
                        <div className="bg-gray-900 px-5 py-3 flex justify-between items-center text-xs border-b border-gray-800">
                          <div className="text-gray-400">
                            Purse:{" "}
                            <span className="text-white font-mono">
                              ₹{(team.purse || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-gray-400">
                            Spent:{" "}
                            <span className="text-red-400 font-mono">
                              ₹{(team.spent || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Squad List */}
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-gray-900/50">
                        {team.roster && team.roster.length > 0 ? (
                          <div className="divide-y divide-gray-800/50">
                            {team.roster.map((player, idx) => (
                              <div
                                key={idx}
                                className="px-5 py-3 flex justify-between items-center hover:bg-gray-800/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-600 font-mono text-xs w-4">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="text-sm font-bold text-gray-200">
                                      {player.name}
                                      {player.isOwner && (
                                        <span className="ml-2 text-[9px] bg-purple-900 text-purple-300 px-1 rounded border border-purple-500/30">
                                          OWNER
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 uppercase">
                                      {player.role || "Player"}
                                    </div>
                                  </div>
                                </div>
                                {player.soldPrice > 0 && (
                                  <div className="text-xs font-mono text-green-400">
                                    ₹
                                    {parseInt(
                                      player.soldPrice
                                    ).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-gray-600 text-xs italic">
                            No players in squad yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* POINTS TABLE TAB */}
          {activeTab === "points" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-950/50 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
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
                      <tr
                        key={i}
                        className={`hover:bg-gray-800/50 transition-colors ${
                          i < 4
                            ? "bg-gradient-to-r from-green-900/5 to-transparent border-l-4 border-green-500"
                            : "border-l-4 border-transparent"
                        }`}>
                        <td className="px-6 py-4 font-mono text-gray-500">
                          #{i + 1}
                        </td>
                        <td className="px-6 py-4 font-bold text-white text-base">
                          {t.name}
                        </td>
                        <td className="px-4 text-center text-gray-400">
                          {t.played}
                        </td>
                        <td className="px-4 text-center font-bold text-green-400">
                          {t.won}
                        </td>
                        <td className="px-4 text-center text-red-400">
                          {t.lost}
                        </td>
                        <td className="px-4 text-center">
                          <span className="inline-block bg-gray-800 text-white font-bold px-2 py-1 rounded min-w-[30px]">
                            {t.points}
                          </span>
                        </td>
                        <td className="px-4 text-right font-mono text-gray-400">
                          {t.nrr}
                        </td>
                      </tr>
                    ))}
                    {pointsTable.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-gray-500 italic">
                          No teams registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PLAYER STATS TAB */}
          {activeTab === "players" && (
            <div>
              {/* Caps Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {orangeCap && (
                  <div className="bg-gradient-to-br from-orange-900/20 to-gray-900 border border-orange-500/20 p-5 rounded-2xl flex items-center gap-5 relative overflow-hidden shadow-lg shadow-orange-500/5">
                    <div className="bg-orange-500/10 p-3 rounded-full text-3xl">
                      🏏
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">
                        Orange Cap
                      </div>
                      <div className="text-2xl font-bold text-white leading-none">
                        {orangeCap.name}
                      </div>
                      <div className="text-sm text-gray-400 mt-1 font-mono">
                        {orangeCap.runs} Runs
                      </div>
                    </div>
                  </div>
                )}
                {purpleCap && (
                  <div className="bg-gradient-to-br from-purple-900/20 to-gray-900 border border-purple-500/20 p-5 rounded-2xl flex items-center gap-5 relative overflow-hidden shadow-lg shadow-purple-500/5">
                    <div className="bg-purple-500/10 p-3 rounded-full text-3xl">
                      🥎
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1">
                        Purple Cap
                      </div>
                      <div className="text-2xl font-bold text-white leading-none">
                        {purpleCap.name}
                      </div>
                      <div className="text-sm text-gray-400 mt-1 font-mono">
                        {purpleCap.wickets} Wickets
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex bg-gray-800 p-1 rounded-lg">
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
                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                          statsTab === type
                            ? "bg-cyan-600 text-white shadow"
                            : "text-gray-400 hover:text-gray-200"
                        }`}>
                        {type === "bat"
                          ? "🏏 Batting"
                          : type === "bowl"
                          ? "🥎 Bowling"
                          : "👑 MVP"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <select
                      className="bg-black border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
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
                      className="bg-black border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                      value={sortStyle}
                      onChange={(e) => setSortStyle(e.target.value)}>
                      {statsTab === "bat" && (
                        <>
                          <option value="most_runs">Most Runs</option>
                          <option value="high_score">Highest Score</option>
                          <option value="strike_rate">Strike Rate</option>
                          <option value="most_sixes">Most 6s</option>
                        </>
                      )}
                      {statsTab === "bowl" && (
                        <>
                          <option value="most_wickets">Most Wickets</option>
                          <option value="best_economy">Best Economy</option>
                        </>
                      )}
                      {statsTab === "mvp" && (
                        <option value="mvp">MVP Points</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Detailed List */}
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
                        setExpandedPlayer(
                          expandedPlayer === p.name ? null : p.name
                        )
                      }>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600 font-mono text-sm w-4">
                          {index + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white text-base leading-tight">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-gray-500 uppercase font-bold">
                            {p.team}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {/* Dynamic Stat Display based on Tab */}
                        {statsTab === "bat" && (
                          <div>
                            <div className="font-bold text-cyan-400 text-lg">
                              {p.runs}
                            </div>
                            <div className="text-[9px] text-gray-500 uppercase">
                              Runs
                            </div>
                          </div>
                        )}
                        {statsTab === "bowl" && (
                          <div>
                            <div className="font-bold text-green-400 text-lg">
                              {p.wickets}
                            </div>
                            <div className="text-[9px] text-gray-500 uppercase">
                              Wickets
                            </div>
                          </div>
                        )}
                        {statsTab === "mvp" && (
                          <div className="flex flex-col items-end">
                            <div className="font-black text-yellow-500 text-lg">
                              {p.mvp}
                            </div>
                            <div className="flex gap-2 text-[10px] text-gray-500">
                              {p.runs > 0 && <span>🏏{p.runs}</span>}
                              {p.wickets > 0 && <span>🥎{p.wickets}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded View */}
                    {expandedPlayer === p.name && (
                      <div className="bg-black/30 p-5 border-t border-gray-800 animate-in slide-in-from-top-2">
                        <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-gray-800/50">
                          {/* Batting Row */}
                          {(statsTab === "bat" ||
                            (statsTab === "mvp" && p.runs > 0)) && (
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  Runs
                                </div>
                                <div className="font-bold text-white">
                                  {p.runs}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  Avg
                                </div>
                                <div className="font-bold text-white">
                                  {p.batAvg}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  SR
                                </div>
                                <div className="font-bold text-white">
                                  {p.batSR}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  HS
                                </div>
                                <div className="font-bold text-white">
                                  {p.hs}
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Bowling Row */}
                          {(statsTab === "bowl" ||
                            (statsTab === "mvp" && p.ballsBowled > 0)) && (
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  Wkts
                                </div>
                                <div className="font-bold text-green-400">
                                  {p.wickets}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  Eco
                                </div>
                                <div className="font-bold text-white">
                                  {p.bowlEco}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  Avg
                                </div>
                                <div className="font-bold text-white">
                                  {p.bowlAvg}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                                <div className="text-[10px] text-gray-500 uppercase">
                                  Overs
                                </div>
                                <div className="font-bold text-white">
                                  {(p.ballsBowled / 6).toFixed(1)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
                          Match History
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-2.5 rounded-lg cursor-pointer transition-all flex justify-between items-center group">
                              <div>
                                <div className="text-xs font-bold text-gray-300 group-hover:text-cyan-400 transition-colors">
                                  vs {log.opponent}
                                </div>
                                <div className="text-[9px] text-gray-500">
                                  {log.date}
                                </div>
                              </div>
                              <div className="text-right text-xs font-mono">
                                {statsTab === "bat" && (
                                  <span
                                    className={
                                      log.runs >= 30
                                        ? "text-yellow-400 font-bold"
                                        : "text-white"
                                    }>
                                    {log.runs} runs
                                  </span>
                                )}
                                {statsTab === "bowl" && (
                                  <span
                                    className={
                                      log.wickets >= 2
                                        ? "text-green-400 font-bold"
                                        : "text-white"
                                    }>
                                    {log.wickets} wkts
                                  </span>
                                )}
                                {statsTab === "mvp" && (
                                  <span className="text-yellow-500 font-bold">
                                    {log.totalPoints} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADMIN TAB */}
          {canEdit && activeTab === "admin" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl group-hover:scale-110 transition-transform">
                  🛡️
                </div>
                <h3 className="text-white font-bold text-lg mb-4">
                  Team Management
                </h3>

                {/* --- NEW CHECK: HIDE TEAM SETTINGS IF AUCTION MODE --- */}
                {tournamentData.isAuction ? (
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <h4 className="text-white font-bold mb-2">
                      Rosters Locked
                    </h4>
                    <p className="text-gray-500 text-sm mb-6">
                      This is an <strong>Auction Tournament</strong>. Teams and
                      players are managed exclusively through the Auction
                      Console to ensure fair play.
                    </p>
                    <button
                      onClick={() => navigate(`/tournaments/${id}/auction`)}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-all">
                      Go to Auction Console
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-blue-400 border border-blue-900/30 px-4 py-3 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 transition-all">
                      <span>+</span> Import Global Teams
                    </button>
                    <TeamManager tournamentId={id} />
                  </>
                )}
              </div>

              {isOwner && (
                <div className="space-y-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-white font-bold text-lg mb-4">
                      Access Control
                    </h3>
                    <TournamentAccessManager
                      tournament={tournamentData}
                      currentUserId={user.uid}
                    />
                  </div>
                  <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-6">
                    <h4 className="text-red-500 font-bold mb-2">Danger Zone</h4>
                    <p className="text-red-400/50 text-xs mb-4">
                      This action cannot be undone.
                    </p>
                    <button
                      onClick={handleDeleteTournament}
                      className="bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold w-full transition-colors shadow-lg shadow-red-900/20">
                      Delete Tournament
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
