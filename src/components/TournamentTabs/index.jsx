import React, { useMemo, useState } from "react";
import { calculatePointsTable } from "../../utils/statsHelper";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { useNavigate } from "react-router-dom";

// Helper components for tabs
import MatchesTab from "./MatchesTab";
import TeamsTab from "./TeamsTab";
import PointsTab from "./PointsTab"; // Note: Filename was PointsTab in your snippet
import PlayerStatsTab from "./PlayerStatsTab";

export default function TournamentTabs({
  activeTab,
  setActiveTab,
  tournamentId,
  tournamentData,
  tournamentTeams,
  matches,
  canEdit,
  isOwner,
  isAuctionEnabled,
}) {
  const navigate = useNavigate();

  // --- STATS STATE ---
  const [statsTab, setStatsTab] = useState("bat"); // 'bat' | 'bowl' | 'mvp'
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortStyle, setSortStyle] = useState("most_runs");
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  // --- 1. FILTER MATCHES ---
  const { liveMatches, upcomingMatches, finishedMatches } = useMemo(() => {
    const live = [];
    const upcoming = [];
    const finished = [];

    matches.forEach((m) => {
      const status = m.status || m.meta?.status || "upcoming";
      const normStatus = status.toLowerCase();

      if (["finished", "completed"].includes(normStatus)) {
        finished.push(m);
      } else if (["in-progress", "ongoing", "live"].includes(normStatus)) {
        live.push(m);
      } else {
        upcoming.push(m);
      }
    });

    return {
      liveMatches: live,
      upcomingMatches: upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)),
      finishedMatches: finished.sort((a, b) => new Date(b.date) - new Date(a.date)),
    };
  }, [matches]);

  // --- 2. POINTS TABLE CALCULATION ---
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
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [matches, tournamentTeams]);

  // --- 3. DETAILED PLAYER STATS (Fix Applied Here) ---
  const { detailedStats, orangeCap, purpleCap, distinctTeams } = useMemo(() => {
    const players = {};

    // A. Init players from rosters
    tournamentTeams.forEach((team) => {
      const teamName = team.name || "Unknown Team";
      const memberNames = team.roster?.map((r) => r.name) || team.players || [];

      memberNames.forEach((p) => {
        const playerName = typeof p === "object" ? p.name : p;
        if (playerName) {
            players[playerName] = {
            name: playerName,
            team: teamName,
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
            mvp: 0,
            };
        }
      });
    });

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
          mvp: 0,
        };
      }
      return players[name];
    };

    // B. Process Matches
    matches.forEach((m) => {
      // ✅ FIX: Ensure innList is always an array
      let innList = [];
      if (Array.isArray(m.innings)) {
        innList = m.innings;
      } else if (m.innings && typeof m.innings === 'object') {
        innList = Object.values(m.innings);
      }

      innList.forEach((inn) => {
        if (!inn) return;
        const batTeam = inn.battingTeam;
        const bowlTeam = inn.bowlingTeam;

        // Batting Stats
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([name, s]) => {
            const p = initPlayer(name, batTeam);
            if (s.balls > 0 || s.out) {
              const r = parseInt(s.runs || 0);
              const b = parseInt(s.balls || 0);
              const f = parseInt(s.fours || 0);
              const x = parseInt(s.sixes || 0);
              
              p.runs += r;
              p.balls += b;
              p.fours += f;
              p.sixes += x;
              p.innings += 1;
              if (!s.out) p.notOuts += 1;
              if (r > p.hs) p.hs = r;
              p.mvp += r + f + x * 2;
              
              p.history.push({
                type: "bat",
                matchId: m.id,
                date: m.date,
                opponent: bowlTeam,
                runs: r,
                balls: b,
              });
            }
          });
        }

        // Bowling Stats
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([name, s]) => {
            const p = initPlayer(name, bowlTeam);
            if (s.balls > 0) {
              const w = parseInt(s.wickets || 0);
              const r = parseInt(s.runs || 0);
              const b = parseInt(s.balls || 0);

              p.wickets += w;
              p.runsConceded += r;
              p.ballsBowled += b;
              p.mvp += w * 20;

              p.history.push({
                type: "bowl",
                matchId: m.id,
                date: m.date,
                opponent: batTeam,
                wickets: w,
                runs: r,
                overs: `${Math.floor(b / 6)}.${b % 6}`,
              });
            }
          });
        }
      });
    });

    const statsArray = Object.values(players).map((p) => {
      const batAvg =
        p.innings - p.notOuts > 0
          ? (p.runs / (p.innings - p.notOuts)).toFixed(2)
          : p.runs.toFixed(2);
      const batSR =
        p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";
      const overs = p.ballsBowled / 6;
      const bowlEco =
        overs > 0 ? (p.runsConceded / overs).toFixed(2) : "0.00";
      const bowlAvg =
        p.wickets > 0 ? (p.runsConceded / p.wickets).toFixed(2) : "0.00";
      return { ...p, batAvg, batSR, bowlEco, bowlAvg };
    });

    const orange = [...statsArray].sort((a, b) => b.runs - a.runs)[0];
    const purple = [...statsArray].sort((a, b) => b.wickets - a.wickets)[0];
    const teams = [...new Set(statsArray.map((p) => p.team).filter(Boolean))];

    return {
        detailedStats: statsArray,
        orangeCap: orange,
        purpleCap: purple,
        distinctTeams: teams,
    };
  }, [matches, tournamentTeams]);

  // --- 4. FILTERED STATS ---
  const filteredStats = useMemo(() => {
    let data = detailedStats;
    if (teamFilter !== "all")
      data = data.filter((p) => p.team === teamFilter);

    return data.sort((a, b) => {
      if (statsTab === "bat") {
        if (sortStyle === "most_runs") return b.runs - a.runs;
        if (sortStyle === "high_score") return b.hs - a.hs;
        if (sortStyle === "strike_rate") return parseFloat(b.batSR) - parseFloat(a.batSR);
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
      } else if (statsTab === "bowl") {
        if (sortStyle === "most_wickets") return b.wickets - a.wickets;
        if (sortStyle === "best_economy") return parseFloat(a.bowlEco) - parseFloat(b.bowlEco);
      } else if (statsTab === "mvp") {
        return b.mvp - a.mvp;
      }
      return 0;
    });
  }, [detailedStats, teamFilter, statsTab, sortStyle]);

  // --- RENDER CONTENT ---
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* TABS NAVIGATION */}
      <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 p-1.5 rounded-2xl flex overflow-x-auto shadow-2xl mb-8 no-scrollbar">
        {[
          { id: "matches", label: "Matches", icon: "🏟️" },
          { id: "teams", label: "Teams", icon: "👥" },
          { id: "points", label: "Points Table", icon: "📊" },
          { id: "players", label: "Player Stats", icon: "📈" },
          { id: "admin", label: "Settings", icon: "⚙️" },
        ]
          .filter((tab) => tab.id !== "admin" || (canEdit || isOwner))
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? "bg-gray-800 text-white shadow-md border border-gray-700"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
      </div>

      {/* MATCHES TAB */}
      {activeTab === "matches" && (
        <MatchesTab 
            liveMatches={liveMatches}
            upcomingMatches={upcomingMatches}
            finishedMatches={finishedMatches}
            tournamentId={tournamentId}
            canEdit={canEdit} 
        />
      )}

      {/* TEAMS TAB */}
      {activeTab === "teams" && (
        <TeamsTab tournamentTeams={tournamentTeams} isAuctionEnabled={isAuctionEnabled} />
      )}

      {/* POINTS TABLE TAB */}
      {activeTab === "points" && (
        <PointsTab pointsTable={pointsTable} />
      )}

      {/* PLAYERS STATS TAB */}
      {activeTab === "players" && (
        <PlayerStatsTab
          statsTab={statsTab}
          setStatsTab={setStatsTab}
          sortStyle={sortStyle}
          setSortStyle={setSortStyle}
          teamFilter={teamFilter}
          setTeamFilter={setTeamFilter}
          filteredStats={filteredStats}
          expandedPlayer={expandedPlayer}
          setExpandedPlayer={setExpandedPlayer}
          orangeCap={orangeCap}
          purpleCap={purpleCap}
          distinctTeams={distinctTeams}
          id={tournamentId}
        />
      )}

      {/* ADMIN TAB */}
      {activeTab === "admin" && (canEdit || isOwner) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
          {/* Team Management / Auction */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <h3 className="text-white font-bold text-lg mb-4">Team Management</h3>
            {isAuctionEnabled ? (
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h4 className="text-white font-bold mb-2">Rosters Locked</h4>
                <p className="text-gray-500 text-sm mb-6">
                  This is an Auction Tournament. Teams are managed in the Auction Console.
                </p>
                <button
                  onClick={() => navigate(`/tournaments/${tournamentId}/auction`)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                  Go to Auction Console
                </button>
              </div>
            ) : (
              <TeamManager tournamentId={tournamentId} />
            )}
          </div>

          {/* Owner Zone */}
          {isOwner && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-white font-bold text-lg mb-4">Access Control</h3>
                <TournamentAccessManager tournament={tournamentData} />
              </div>
              <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-6">
                <h4 className="text-red-500 font-bold mb-2">Danger Zone</h4>
                <p className="text-red-400/50 text-xs mb-4">This action cannot be undone.</p>
                <button
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold w-full transition-colors shadow-lg shadow-red-900/20"
                  onClick={() => {
                     if(window.confirm("Delete Tournament?")) alert("Feature Pending: Delete");
                  }}
                >
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