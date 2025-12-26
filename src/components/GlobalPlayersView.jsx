// src/components/GlobalPlayersView.jsx
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
// 1. Import useNavigate
import { useNavigate } from "react-router-dom";
import { db } from "../utils/firebase";

export default function GlobalPlayersView() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState([]);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  // 2. Initialize Hook
  const navigate = useNavigate();

  const [sortConfig, setSortConfig] = useState({
    key: "mvpScore",
    direction: "desc",
  });

  // 1. Fetch Tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const q = query(
          collection(db, "tournaments"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Tournament",
          ...doc.data(),
        }));
        setTournaments(list);
        if (list.length > 0) setSelectedTournamentId(list[0].id);
      } catch (err) {
        console.error("Error loading tournaments:", err);
      }
    };
    fetchTournaments();
  }, []);

  // 2. Fetch & Calculate Stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedTournamentId) return;

      setLoading(true);
      setStats([]);
      setExpandedPlayer(null);

      try {
        const matchesRef = collection(
          db,
          "tournaments",
          selectedTournamentId,
          "matches"
        );
        const snapshot = await getDocs(matchesRef);

        const playerMap = {};

        snapshot.docs.forEach((doc) => {
          const match = doc.data();
          if (!match.innings) return;

          const matchPerformances = {};

          match.innings.forEach((inn) => {
            // Batting
            if (inn.batsmenStats) {
              Object.entries(inn.batsmenStats).forEach(([name, s]) => {
                if (!matchPerformances[name])
                  matchPerformances[name] = createMatchLog();
                matchPerformances[name].runs += s.runs || 0;
                matchPerformances[name].balls += s.balls || 0;
                matchPerformances[name].fours += s.fours || 0;
                matchPerformances[name].sixes += s.sixes || 0;
                matchPerformances[name].team = inn.battingTeam;
                matchPerformances[name].opponent = inn.bowlingTeam;
                matchPerformances[name].outDesc = s.out || "Not Out";
              });
            }
            // Bowling
            if (inn.bowlerStats) {
              Object.entries(inn.bowlerStats).forEach(([name, s]) => {
                if (!matchPerformances[name])
                  matchPerformances[name] = createMatchLog();
                matchPerformances[name].wickets += s.wickets || 0;
                matchPerformances[name].runsConceded += s.runs || 0;
                matchPerformances[name].overs += s.balls || 0;
                matchPerformances[name].team = inn.bowlingTeam;
                if (!matchPerformances[name].opponent)
                  matchPerformances[name].opponent = inn.battingTeam;
              });
            }
          });

          // Merge into Global Map
          Object.entries(matchPerformances).forEach(([name, p]) => {
            if (!playerMap[name]) initPlayer(playerMap, name, p.team);

            playerMap[name].runs += p.runs;
            playerMap[name].balls += p.balls;
            playerMap[name].fours += p.fours;
            playerMap[name].sixes += p.sixes;
            playerMap[name].wickets += p.wickets;
            playerMap[name].runsConceded += p.runsConceded;
            playerMap[name].overs += p.overs;
            playerMap[name].matches += 1;

            playerMap[name].logs.push({
              matchId: doc.id, // Store ID for navigation
              opponent: p.opponent || "Unknown",
              runs: p.runs,
              balls: p.balls,
              wickets: p.wickets,
              outDesc: p.outDesc,
              date: match.createdAt
                ? new Date(match.createdAt.seconds * 1000).toLocaleDateString()
                : "N/A",
            });
          });
        });

        // Final Aggregate
        const statsArray = Object.values(playerMap).map((p) => {
          const mvpScore = p.runs + p.wickets * 20;
          return {
            ...p,
            mvpScore,
            sr: p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0",
            eco:
              p.overs > 0 ? (p.runsConceded / (p.overs / 6)).toFixed(1) : "0.0",
          };
        });

        setStats(statsArray);
      } catch (err) {
        console.error("Error fetching match stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedTournamentId]);

  const createMatchLog = () => ({
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    runsConceded: 0,
    overs: 0,
    team: "",
    opponent: "",
    outDesc: null,
  });

  const initPlayer = (map, name, team) => {
    map[name] = {
      name,
      team,
      matches: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      overs: 0,
      runsConceded: 0,
      logs: [],
    };
  };

  const handleRowClick = (playerName) => {
    setExpandedPlayer(expandedPlayer === playerName ? null : playerName);
  };

  // 3. Navigation Handler
  const handleMatchClick = (matchId) => {
    // Navigates to the specific match page
    // navigate(`/tournament/${selectedTournamentId}/match/${matchId}`);
    navigate(`/tournaments/${selectedTournamentId}/scorecard/${matchId}`)
  };

  const sortedStats = useMemo(() => {
    let sortable = [...stats];
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        const valA = parseFloat(a[sortConfig.key]) || 0;
        const valB = parseFloat(b[sortConfig.key]) || 0;
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [stats, sortConfig]);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "desc"
          ? "asc"
          : "desc",
    });
  };

  const SortIcon = ({ colKey }) =>
    sortConfig.key !== colKey ? (
      <span className="text-gray-600 ml-1">⇅</span>
    ) : sortConfig.direction === "asc" ? (
      <span className="text-cyan-400 ml-1">↑</span>
    ) : (
      <span className="text-cyan-400 ml-1">↓</span>
    );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Player Stats
            </h1>
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mt-1">
              Click rows for match details
            </p>
          </div>

          <div className="w-full md:w-72">
            <select
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none"
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-12 text-center text-gray-500 italic">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
              <div>Compiling Match Data...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-900 text-gray-400 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-4 w-1/4">Player</th>
                    <th
                      className="px-2 py-4 text-center cursor-pointer"
                      onClick={() => handleSort("matches")}>
                      Mat <SortIcon colKey="matches" />
                    </th>
                    <th
                      className="px-2 py-4 text-center cursor-pointer bg-gray-800/50"
                      onClick={() => handleSort("mvpScore")}>
                      MVP <SortIcon colKey="mvpScore" />
                    </th>
                    <th
                      className="px-2 py-4 text-center cursor-pointer"
                      onClick={() => handleSort("runs")}>
                      Runs <SortIcon colKey="runs" />
                    </th>
                    <th
                      className="px-2 py-4 text-center cursor-pointer hidden sm:table-cell"
                      onClick={() => handleSort("sr")}>
                      SR <SortIcon colKey="sr" />
                    </th>
                    <th
                      className="px-2 py-4 text-center cursor-pointer border-l border-gray-700"
                      onClick={() => handleSort("wickets")}>
                      Wkts <SortIcon colKey="wickets" />
                    </th>
                    <th
                      className="px-2 py-4 text-center cursor-pointer hidden sm:table-cell"
                      onClick={() => handleSort("eco")}>
                      Eco <SortIcon colKey="eco" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {sortedStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-8 text-gray-500">
                        No stats available.
                      </td>
                    </tr>
                  ) : (
                    sortedStats.map((p, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          onClick={() => handleRowClick(p.name)}
                          className={`cursor-pointer transition-colors border-l-4 ${
                            expandedPlayer === p.name
                              ? "bg-gray-700 border-cyan-500"
                              : "hover:bg-gray-700/30 border-transparent"
                          }`}>
                          <td className="px-4 py-3">
                            <div className="font-bold text-white flex items-center gap-2">
                              {sortConfig.key === "mvpScore" && idx === 0 && (
                                <span className="text-lg">👑</span>
                              )}
                              {p.name}
                              {expandedPlayer === p.name ? (
                                <span className="text-[10px] text-cyan-400">
                                  ▲
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-600">
                                  ▼
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase">
                              {p.team}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-mono text-white">
                            {p.matches}
                          </td>
                          <td className="px-2 py-3 text-center font-black text-purple-400 bg-gray-800/30">
                            {p.mvpScore}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-gray-300">
                            {p.runs}
                          </td>
                          <td className="px-2 py-3 text-center font-mono text-gray-400 text-xs hidden sm:table-cell">
                            {p.sr}
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-cyan-400 border-l border-gray-700/50">
                            {p.wickets}
                          </td>
                          <td className="px-2 py-3 text-center font-mono text-gray-400 hidden sm:table-cell">
                            {p.eco}
                          </td>
                        </tr>

                        {expandedPlayer === p.name && (
                          <tr className="bg-gray-800/50 animate-in slide-in-from-top-2">
                            <td colSpan={8} className="p-3">
                              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                                <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-widest">
                                  Match History
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {p.logs.map((log, i) => (
                                    <div
                                      key={i}
                                      onClick={() =>
                                        handleMatchClick(log.matchId)
                                      } // CLICK EVENT HERE
                                      className="bg-gray-800 p-2 rounded border border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-700 hover:border-cyan-500/50 transition-all group">
                                      <div>
                                        <div className="text-xs text-gray-400 font-bold mb-0.5 group-hover:text-cyan-400 transition-colors">
                                          vs {log.opponent}{" "}
                                          <span className="text-[10px] text-gray-600">
                                            ↗
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-gray-600">
                                          {log.outDesc || "DNB"}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xs font-mono text-white">
                                          <span
                                            className={
                                              log.runs > 29
                                                ? "text-yellow-400 font-bold"
                                                : ""
                                            }>
                                            {log.runs}r
                                          </span>
                                          <span className="text-gray-600 mx-1">
                                            /
                                          </span>
                                          <span
                                            className={
                                              log.wickets > 2
                                                ? "text-cyan-400 font-bold"
                                                : ""
                                            }>
                                            {log.wickets}w
                                          </span>
                                        </div>
                                        <div className="text-[9px] text-gray-500">
                                          {log.balls}b
                                        </div>
                                      </div>
                                    </div>
                                  ))}
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
      </div>
    </div>
  );
}
