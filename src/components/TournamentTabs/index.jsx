import React, { useMemo } from "react";
import MatchesTab from "../TournamentTabs/MatchesTab";
import TeamsTab from "../TournamentTabs/TeamsTab";
import PointsTab from "../TournamentTabs/PointsTab";
import PlayerStatsTab from "../TournamentTabs/PlayerStatsTab";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { calculatePointsTable } from "../../utils/statsHelper"; // Ensure this path is correct

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
  // 1. FILTER MATCHES
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
      upcomingMatches: upcoming.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      ),
      finishedMatches: finished.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
    };
  }, [matches]);

  // 2. CALCULATE POINTS TABLE
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

  // 3. CALCULATE DETAILED PLAYER STATS
  const { detailedStats, orangeCap, purpleCap, distinctTeams } = useMemo(() => {
    const players = {};

    // A. Init players from Roster
    tournamentTeams.forEach((team) => {
      const tName = team.name || "Unknown";
      const roster = team.roster || [];
      roster.forEach((p) => {
        const pName = typeof p === "object" ? p.name : p;
        if (pName) {
          players[pName] = {
            name: pName,
            team: tName,
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

    const getPlayer = (name, teamName) => {
      if (!players[name]) {
        players[name] = {
          name,
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
      return players[name];
    };

    matches.forEach((m) => {
      const innList = m.innings || [];
      innList.forEach((inn) => {
        const batTeam = inn.battingTeam;
        const bowlTeam = inn.bowlingTeam;

        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([pName, s]) => {
            const p = getPlayer(pName, batTeam);
            if (s.balls > 0 || s.out) {
              const r = parseInt(s.runs || 0);
              const b = parseInt(s.balls || 0);
              const f = parseInt(s.fours || 0);
              const x = parseInt(s.sixes || 0);
              p.runs += r;
              p.balls += b;
              p.fours += f;
              p.sixes += x;
              p.innings++;
              if (!s.out) p.notOuts++;
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

        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([pName, s]) => {
            const p = getPlayer(pName, bowlTeam);
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
      const bowlEco = overs > 0 ? (p.runsConceded / overs).toFixed(2) : "0.00";
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

  // --- STATS TAB STATE ---
  const [statsTab, setStatsTab] = React.useState("bat");
  const [teamFilter, setTeamFilter] = React.useState("all");
  const [sortStyle, setSortStyle] = React.useState("most_runs");
  const [expandedPlayer, setExpandedPlayer] = React.useState(null);

  const filteredStats = useMemo(() => {
    let data = detailedStats;
    if (teamFilter !== "all") data = data.filter((p) => p.team === teamFilter);
    return data.sort((a, b) => {
      if (statsTab === "bat") {
        if (sortStyle === "most_runs") return b.runs - a.runs;
        if (sortStyle === "high_score") return b.hs - a.hs;
        if (sortStyle === "strike_rate")
          return parseFloat(b.batSR) - parseFloat(a.batSR);
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
      } else if (statsTab === "bowl") {
        if (sortStyle === "most_wickets") return b.wickets - a.wickets;
        if (sortStyle === "best_economy")
          return parseFloat(a.bowlEco) - parseFloat(b.bowlEco);
      } else if (statsTab === "mvp") {
        return b.mvp - a.mvp;
      }
      return 0;
    });
  }, [detailedStats, teamFilter, statsTab, sortStyle]);

  // --- RENDER ---
  return (
    <>
      {/* 4. NAVIGATION */}
      <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 p-1.5 rounded-2xl flex overflow-x-auto shadow-2xl mb-8 no-scrollbar">
        {[
          { id: "matches", label: "Matches", icon: "🏟️" },
          { id: "teams", label: "Teams", icon: "👥" },
          { id: "points", label: "Points Table", icon: "📊" },
          { id: "players", label: "Player Stats", icon: "📈" },
          { id: "admin", label: "Settings", icon: "⚙️" },
        ]
          // ✅ FIX: Show settings tab if user has ANY edit rights (Owner OR Scorer)
          .filter((tab) => tab.id !== "admin" || canEdit)
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

      {/* 5. CONTENT */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === "matches" && (
          <MatchesTab
            liveMatches={liveMatches}
            upcomingMatches={upcomingMatches}
            finishedMatches={finishedMatches}
            tournamentId={tournamentId}
            canEdit={canEdit}
          />
        )}

        {activeTab === "teams" && (
          <TeamsTab
            tournamentTeams={tournamentTeams}
            isAuctionEnabled={isAuctionEnabled}
          />
        )}

        {activeTab === "points" && <PointsTab pointsTable={pointsTable} />}

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

        {/* ✅ ADMIN TAB */}
        {activeTab === "admin" && canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
            {/* Team Management (Visible to all editors) */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <h3 className="text-white font-bold text-lg mb-4">
                Team Management
              </h3>
              {isAuctionEnabled ? (
                <div className="bg-gray-950 p-4 rounded text-center text-gray-500">
                  🔒 Teams managed via Auction Console
                </div>
              ) : (
                <TeamManager tournamentId={tournamentId} />
              )}
            </div>

            {/* Access Control (Visible ONLY to Owner/Global Admin) */}
            {isOwner && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-white font-bold text-lg mb-4">
                  Access Control
                </h3>
                <TournamentAccessManager
                  tournament={tournamentData}
                  currentUserId={isOwner ? "OWNER" : ""}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
