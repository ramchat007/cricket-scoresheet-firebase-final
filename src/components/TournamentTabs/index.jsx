import React, { useMemo, useState } from "react";
import { calculatePointsTable } from "../../utils/statsHelper";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  LayoutList,
  Users,
  Trophy,
  BarChart2,
  Settings,
  Shield,
  Lock,
} from "lucide-react";

// Helper components
import MatchesTab from "./MatchesTab";
import TeamsTab from "./TeamsTab";
import PointsTab from "./PointsTab";
import PlayerStatsTab from "./PlayerStatsTab";
import TournamentSettings from "./TournamentSettings";

export default function TournamentTabs({
  activeTab,
  setActiveTab,
  tournamentId,
  tournamentData,
  tournamentName,
  tournamentTeams = [],
  matches = [],
  canEdit,
  isOwner,
  isAuctionEnabled,
}) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

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
        (a, b) => new Date(a.date) - new Date(b.date),
      ),
      finishedMatches: finished.sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      ),
    };
  }, [matches]);

  // --- 2. POINTS TABLE PREPARATION ---
  const pointsTableData = useMemo(() => {
    const hasDBStats = tournamentTeams.some(
      (t) => t.stats && t.stats.played > 0,
    );

    if (hasDBStats) {
      return tournamentTeams
        .map((t) => ({
          id: t.id,
          name: t.name,
          logo: t.logoUrl,
          ...t.stats,
          history: t.history || [],
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.won !== a.won) return b.won - a.won;
          return parseFloat(b.nrr || 0) - parseFloat(a.nrr || 0);
        });
    }
    return calculatePointsTable(matches);
  }, [matches, tournamentTeams]);

  // --- 3. DETAILED PLAYER STATS (With SR Bonus) ---
  const { detailedStats, orangeCap, purpleCap, distinctTeams } = useMemo(() => {
    const players = {};

    const initPlayer = (rawName, team) => {
      const name = String(rawName || "Unknown").trim();
      if (!players[name]) {
        players[name] = {
          name,
          team: team?.trim() || "Independent",
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

    // A. Pre-initialize from Roster
    tournamentTeams.forEach((team) => {
      const teamName = (team.name || "Unknown Team").trim();
      const roster = team.roster || team.players || [];
      roster.forEach((p) => {
        const pName = typeof p === "object" ? p.name : p;
        if (pName) initPlayer(pName, teamName);
      });
    });

    // B. Process Matches
    matches.forEach((m) => {
      if (!m.innings) return;
      const innList = Array.isArray(m.innings)
        ? m.innings
        : Object.values(m.innings);

      innList.forEach((inn) => {
        if (!inn) return;
        const batTeam = (inn.battingTeam || "").trim();
        const bowlTeam = (inn.bowlingTeam || "").trim();

        // 🏏 Batting
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

              let inningMVP = r + f + x * 2;
              if (b >= 10 && (r / b) * 100 >= 200) inningMVP += 5;
              p.mvp += inningMVP;

              // ✅ ENHANCED HISTORY DATA
              p.history.push({
                type: "bat",
                matchId: m.id,
                date: m.date || m.meta?.date || new Date().toISOString(),
                opponent: bowlTeam,
                runs: r,
                balls: b,
                fours: f,
                sixes: x,
                wickets: 0,
                notOut: !s.out,
              });
            }
          });
        }

        // 🥎 Bowling
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([name, s]) => {
            const p = initPlayer(name, bowlTeam);
            if (s.balls > 0) {
              const w = parseInt(s.wickets || 0);
              const r_conceded = parseInt(s.runs || 0);
              const b_bowled = parseInt(s.balls || 0);

              p.wickets += w;
              p.runsConceded += r_conceded;
              p.ballsBowled += b_bowled;
              p.mvp += w * 20;

              // ✅ ENHANCED HISTORY DATA
              p.history.push({
                type: "bowl",
                matchId: m.id,
                date: m.date,
                opponent: batTeam,
                wickets: w,
                runs: 0,
                runsConceded: r_conceded,
                fours: 0,
                sixes: 0,
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

      // Calculate Economy safely
      const bowlEco = overs > 0 ? (p.runsConceded / overs).toFixed(2) : "0.00";
      const bowlAvg =
        p.wickets > 0 ? (p.runsConceded / p.wickets).toFixed(2) : "0.00";

      p.history.sort((a, b) => new Date(b.date) - new Date(a.date));

      return { ...p, batAvg, batSR, bowlEco, bowlAvg };
    });

    // --- SORTING LOGIC (STRICT) ---

    // 🟠 Orange Cap: Runs > Strike Rate > Average
    const orange = [...statsArray].sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      if (parseFloat(b.batSR) !== parseFloat(a.batSR))
        return parseFloat(b.batSR) - parseFloat(a.batSR);
      return parseFloat(b.batAvg) - parseFloat(a.batAvg);
    })[0];

    // 🟣 Purple Cap: Wickets > Economy (Low) > Strike Rate (Low)
    const purple = [...statsArray].sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;

      if (a.ballsBowled > 0 && b.ballsBowled > 0) {
        return parseFloat(a.bowlEco) - parseFloat(b.bowlEco);
      }
      return b.ballsBowled - a.ballsBowled;
    })[0];

    const teamList = [
      ...new Set(statsArray.map((p) => p.team).filter(Boolean)),
    ];

    return {
      detailedStats: statsArray,
      orangeCap: orange,
      purpleCap: purple,
      distinctTeams: teamList,
    };
  }, [matches, tournamentTeams]);

  // --- 4. FILTERED STATS ---
  const filteredStats = useMemo(() => {
    let data = detailedStats;
    if (teamFilter !== "all") data = data.filter((p) => p.team === teamFilter);

    return data.sort((a, b) => {
      if (statsTab === "bat") {
        if (sortStyle === "most_runs")
          return b.runs - a.runs || parseFloat(b.batSR) - parseFloat(a.batSR);
        if (sortStyle === "high_score") return b.hs - a.hs;
        if (sortStyle === "strike_rate")
          return parseFloat(b.batSR) - parseFloat(a.batSR);
        if (sortStyle === "most_sixes") return b.sixes - a.sixes;
      } else if (statsTab === "bowl") {
        if (sortStyle === "most_wickets") {
          if (b.wickets !== a.wickets) return b.wickets - a.wickets;
          return parseFloat(a.bowlEco) - parseFloat(b.bowlEco);
        }
        if (sortStyle === "best_economy") {
          if (a.ballsBowled === 0) return 1;
          if (b.ballsBowled === 0) return -1;
          return parseFloat(a.bowlEco) - parseFloat(b.bowlEco);
        }
      } else if (statsTab === "mvp") {
        return b.mvp - a.mvp; // Rank by MVP Points
      }
      return 0;
    });
  }, [detailedStats, teamFilter, statsTab, sortStyle]);

  // --- RENDER ---
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
      {/* TABS NAVIGATION */}
      <div className="sticky top-2 z-40 mb-6 mx-[-16px] px-4 md:mx-0 md:px-0">
        <div
          className={`backdrop-blur-xl border p-1.5 rounded-2xl flex overflow-x-auto shadow-2xl no-scrollbar snap-x snap-mandatory ${
            lightMode
              ? "bg-white/90 border-gray-200"
              : "bg-[#1C2128]/90 border-white/10"
          }`}>
          {[
            { id: "matches", label: "Matches", icon: LayoutList },
            { id: "teams", label: "Teams", icon: Users },
            { id: "points", label: "Points", icon: Trophy },
            { id: "players", label: "Stats", icon: BarChart2 },
            { id: "admin", label: "Admin", icon: Settings },
          ]
            .filter((tab) => tab.id !== "admin" || canEdit || isOwner)
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex-shrink-0 flex-1 min-w-[90px] md:min-w-[120px] px-3 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 snap-center ${
                    isActive
                      ? "bg-teal-600 text-white shadow-lg scale-95 md:scale-100"
                      : `text-slate-500 hover:bg-white/5 border border-transparent ${lightMode ? "hover:text-teal-600 hover:bg-gray-50" : "hover:text-slate-300"}`
                  }`}>
                  <Icon size={16} className={isActive ? "text-white" : ""} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      <div className="pb-24 md:pb-0">
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
            tournamentName={tournamentName}
            isAuctionEnabled={isAuctionEnabled}
            matches={matches}
          />
        )}
        {activeTab === "points" && (
          <PointsTab
            pointsTable={pointsTableData}
            matches={matches}
            teams={tournamentTeams}
            tournamentId={tournamentId}
            canEdit={canEdit}
          />
        )}

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
            matches={matches}
            id={tournamentId}
          />
        )}

        {activeTab === "admin" && (canEdit || isOwner) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
            <div
              className={`border rounded-2xl p-6 shadow-xl relative overflow-hidden group ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
              <h3
                className={`font-bold text-lg mb-6 flex items-center gap-2 ${theme.text}`}>
                <Shield size={20} className="text-cyan-500" /> Team Management
              </h3>
              {isAuctionEnabled ? (
                <div
                  className={`border rounded-xl p-8 text-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                  <div className="flex justify-center mb-4">
                    <Lock size={32} className="text-gray-400" />
                  </div>
                  <h4 className={`font-bold mb-2 ${theme.text}`}>
                    Rosters Locked
                  </h4>
                  <p className={`text-sm mb-6 ${theme.sub}`}>
                    Teams are managed in the Auction Console.
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/tournaments/${tournamentId}/auction`)
                    }
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all">
                    Go to Auction Console
                  </button>
                </div>
              ) : (
                <TeamManager tournamentId={tournamentId} />
              )}
            </div>
            <div className="space-y-6">
              {canEdit && (
                <TournamentSettings
                  tournament={tournamentData}
                  tournamentId={tournamentId}
                />
              )}
              {canEdit && (
                <TournamentAccessManager
                  tournamentData={tournamentData}
                  tournamentId={tournamentId}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
