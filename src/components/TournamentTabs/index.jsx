import React, { useMemo, useState } from "react";
import { calculatePointsTable } from "../../utils/statsHelper";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import BracketTab from "../BracketTab";
import {
  LayoutList,
  Users,
  Trophy,
  BarChart2,
  Settings,
  Shield,
  Lock,
  GitMerge,
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
  tournament,
  tournamentData,
  tournamentName,
  tournamentTeams = [],
  matches = [],
  canEdit,
  isOwner,
  isAuctionEnabled,
  onOpenCorrection,
}) {
  const navigate = useNavigate();

  // 🟢 1. Drop lightMode and extract the dynamic theme engine properties
  const { theme } = useTheme();

  // Safely fallback to default classes if a theme isn't fully loaded yet
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";
  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const accentText = theme?.accentText || "text-cyan-400";
  const gradientBtn = theme?.gradient || "from-cyan-600 to-blue-600";

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
      {/* 🟢 TABS NAVIGATION (Upgraded Glassmorphism) */}
      <div className="sticky top-2 z-40 mb-3 md:mb-6 mx-[-16px] px-3 md:mx-0 md:px-0">
        <div
          className={`backdrop-blur-2xl border p-1 md:p-1.5 rounded-xl md:rounded-2xl flex overflow-x-auto shadow-2xl no-scrollbar snap-x snap-mandatory ${cardBg}`}>
          {[
            { id: "matches", label: "Matches", icon: LayoutList },
            { id: "bracket", label: "Bracket", icon: GitMerge },
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
                  className={`flex-shrink-0 flex-1 min-w-[76px] md:min-w-[120px] px-2 py-2 md:px-3 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-xs font-black uppercase tracking-wider transition-all flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 snap-center ${
                    isActive
                      ? // 🟢 Active Tab matches the exact theme gradient
                        `bg-gradient-to-r ${gradientBtn} text-white shadow-lg shadow-black/20 scale-95 md:scale-100`
                      : // 🟢 Inactive Tab adapts cleanly to dark glass
                        `${textSub} hover:${textMain} hover:bg-white/10 border border-transparent`
                  }`}>
                  <Icon
                    size={16}
                    className={`md:w-4 md:h-4 ${isActive ? "text-white" : ""}`}
                  />
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
            onOpenCorrection={onOpenCorrection}
          />
        )}
        {activeTab === "bracket" && (
          <BracketTab
            tournament={tournament}
            liveMatches={liveMatches}
            upcomingMatches={upcomingMatches}
            finishedMatches={finishedMatches}
            matches={matches}
            tournamentId={tournamentId}
            teams={tournamentTeams}
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

        {/* 🟢 ADMIN SECTION (Upgraded Glassmorphism) */}
        {activeTab === "admin" && (canEdit || isOwner) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in zoom-in-95">
            <div
              className={`border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-2xl relative overflow-hidden group ${cardBg}`}>
              <h3
                className={`font-bold text-base md:text-lg mb-4 md:mb-6 flex items-center gap-2 ${textMain}`}>
                <Shield size={18} className={`${accentText} md:w-5 md:h-5`} />{" "}
                Team Management
              </h3>
              {isAuctionEnabled ? (
                <div
                  className={`border border-white/10 rounded-xl p-5 md:p-8 text-center bg-black/20 backdrop-blur-md`}>
                  <div className="flex justify-center mb-3 md:mb-4">
                    <Lock size={28} className={`${textSub} md:w-8 md:h-8`} />
                  </div>
                  <h4
                    className={`font-bold text-sm md:text-base mb-1.5 md:mb-2 ${textMain}`}>
                    Rosters Locked
                  </h4>
                  <p className={`text-xs md:text-sm mb-4 md:mb-6 ${textSub}`}>
                    Teams are managed in the Auction Console.
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/tournaments/${tournamentId}/auction`)
                    }
                    className={`w-full bg-gradient-to-r ${gradientBtn} text-white font-bold py-2.5 px-4 md:py-3 md:px-6 rounded-lg md:rounded-xl text-xs md:text-base shadow-lg hover:opacity-90 transition-all`}>
                    Go to Auction Console
                  </button>
                </div>
              ) : (
                <TeamManager tournamentId={tournamentId} />
              )}
            </div>

            <div className="space-y-4 md:space-y-6">
              {canEdit && (
                <TournamentSettings
                  tournament={tournamentData}
                  tournamentId={tournamentId}
                />
              )}
              {isOwner && (
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
