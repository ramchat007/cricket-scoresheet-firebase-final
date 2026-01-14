import React, { useMemo, useState } from "react";
import { calculatePointsTable } from "../../utils/statsHelper";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { useNavigate } from "react-router-dom";

// Helper components
import MatchesTab from "./MatchesTab";
import TeamsTab from "./TeamsTab";
import PointsTab from "./PointsTab";
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
  const [statsTab, setStatsTab] = useState("bat");
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
      upcomingMatches: upcoming.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      ),
      finishedMatches: finished.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
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

  // --- 3. DETAILED PLAYER STATS ---
  const { detailedStats, orangeCap, purpleCap, distinctTeams } = useMemo(() => {
    const players = {};

    // A. Init players
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
      let innList = [];
      if (Array.isArray(m.innings)) innList = m.innings;
      else if (m.innings && typeof m.innings === "object")
        innList = Object.values(m.innings);

      innList.forEach((inn) => {
        if (!inn) return;
        const batTeam = inn.battingTeam;
        const bowlTeam = inn.bowlingTeam;

        // Batting
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

        // Bowling
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

  // --- 4. FILTERED STATS ---
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
      } else if (statsTab === "mvp") return b.mvp - a.mvp;
      return 0;
    });
  }, [detailedStats, teamFilter, statsTab, sortStyle]);

  // --- RENDER CONTENT ---
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
      {/* MOBILE-OPTIMIZED TABS NAVIGATION */}
      <div className="sticky top-2 z-40 mb-6 mx-[-16px] px-4 md:mx-0 md:px-0">
        <div className="bg-[#1C2128]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl flex overflow-x-auto shadow-2xl custom-scrollbar snap-x snap-mandatory">
          {[
            { id: "matches", label: "Matches", icon: "🏟️" },
            { id: "teams", label: "Teams", icon: "👥" },
            { id: "points", label: "Points", icon: "📊" },
            { id: "players", label: "Stats", icon: "📈" },
            { id: "admin", label: "Admin", icon: "⚙️" },
          ]
            .filter((tab) => tab.id !== "admin" || canEdit || isOwner)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Optional: smooth scroll to top when tab changes
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex-shrink-0 flex-1 min-w-[90px] md:min-w-[120px] px-3 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 snap-center ${
                  activeTab === tab.id
                    ? "bg-[#0F1115] text-white shadow-lg border border-white/10 scale-95 md:scale-100"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                }`}>
                <span className="text-sm md:text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
        </div>
      </div>

      {/* CONTENT AREA - with extra padding for bottom navigation on mobile if needed */}
      <div className="pb-20 md:pb-0">
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
            tournamentData={tournamentData}
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

        {activeTab === "admin" && (canEdit || isOwner) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
            {/* Team Management / Auction */}
            <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <h3 className="text-slate-100 font-bold text-lg mb-6 flex items-center gap-2">
                <span className="text-cyan-500">🛡️</span> Team Management
              </h3>
              {isAuctionEnabled ? (
                <div className="bg-[#0F1115] border border-white/5 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-4">🔒</div>
                  <h4 className="text-slate-200 font-bold mb-2">
                    Rosters Locked
                  </h4>
                  <p className="text-slate-500 text-sm mb-6">
                    This is an Auction Tournament. Teams are managed in the
                    Auction Console.
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/tournaments/${tournamentId}/auction`)
                    }
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-purple-900/20">
                    Go to Auction Console
                  </button>
                </div>
              ) : (
                <TeamManager tournamentId={tournamentId} />
              )}
            </div>

            {/* Owner Zone */}
            {isOwner && (
              <TournamentAccessManager tournament={tournamentData} tournamentId={tournamentId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
