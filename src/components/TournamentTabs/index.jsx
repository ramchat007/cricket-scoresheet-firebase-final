import React, { useMemo, useState, useEffect } from "react";
import { calculatePointsTable } from "../../utils/statsHelper";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import BracketTab from "../BracketTab";
import { supabase } from "../../utils/supabase"; // 🟢 Added Supabase import

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
import SettingsTab from "./SettingsTab";

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
  const { theme, lightMode } = useTheme();

  // --- STATS STATE ---
  const [statsTab, setStatsTab] = useState("bat");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortStyle, setSortStyle] = useState("most_runs");
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  // 🟢 NEW: State to hold Supabase Data
  const [dbBattingStats, setDbBattingStats] = useState([]);
  const [dbBowlingStats, setDbBowlingStats] = useState([]);

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

  // --- 3. FETCH SUPABASE AUTO-SYNC STATS ---
  useEffect(() => {
    if (!tournamentId || !supabase) return;

    const fetchLeaderboards = async () => {
      // console.log("📡 Fetching stats for tournament:", tournamentId);

      // 1. Fetch Batting
      const { data: batData, error: batErr } = await supabase
        .from("vw_tournament_batting_stats")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("total_runs", { ascending: false });

      if (batErr) console.error("❌ Batting Fetch Error:", batErr);
      // else console.log("✅ Batting Data Arrived:", batData);

      if (batData) setDbBattingStats(batData);

      // 2. Fetch Bowling
      const { data: bowlData, error: bowlErr } = await supabase
        .from("vw_tournament_bowling_stats")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("wickets", { ascending: false });

      if (bowlErr) console.error("❌ Bowling Fetch Error:", bowlErr);
      // else console.log("✅ Bowling Data Arrived:", bowlData);

      if (bowlData) setDbBowlingStats(bowlData);
    };

    fetchLeaderboards();
  }, [tournamentId, matches.length]);

  // --- 4. FORMAT FOR THE UI (ROSTER + HISTORY + SUPABASE) ---
  const { detailedStats, orangeCap, purpleCap, distinctTeams } = useMemo(() => {
    const playerDictionary = {};
    const teamList = new Set();

    // 1. Initialize Everyone from Rosters
    tournamentTeams.forEach((team) => {
      const teamName = (team.name || "Unknown Team").trim();
      teamList.add(teamName);

      const roster = team.roster || team.players || [];
      roster.forEach((p) => {
        const pName = typeof p === "object" ? p.name : p;
        if (pName) {
          playerDictionary[pName] = {
            name: pName,
            team: teamName,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            batSR: "0.00",
            batAvg: "0.00",
            innings: 0,
            notOuts: 0,
            hs: 0,
            wickets: 0,
            runsConceded: 0,
            ballsBowled: 0,
            oversBowled: "0.0",
            bowlEco: "0.00",
            bowlAvg: "0.00",
            mvp: 0,
            history: [],
          };
        }
      });
    });

    // 2. Build History & Innings Count from Firebase Matches
    matches.forEach((m) => {
      if (!m.innings) return;
      const innList = Array.isArray(m.innings)
        ? m.innings
        : Object.values(m.innings);

      innList.forEach((inn) => {
        if (!inn) return;
        const batTeam = (inn.battingTeam || "").trim();
        const bowlTeam = (inn.bowlingTeam || "").trim();

        // Batting History
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([name, s]) => {
            if (!playerDictionary[name]) {
              playerDictionary[name] = {
                name,
                team: batTeam,
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                batSR: "0.00",
                batAvg: "0.00",
                innings: 0,
                notOuts: 0,
                hs: 0,
                wickets: 0,
                runsConceded: 0,
                ballsBowled: 0,
                oversBowled: "0.0",
                bowlEco: "0.00",
                bowlAvg: "0.00",
                mvp: 0,
                history: [],
              };
            }
            const p = playerDictionary[name];
            if (s.balls > 0 || s.out) {
              p.innings += 1;
              if (!s.out) p.notOuts += 1;
              if (parseInt(s.runs || 0) > p.hs) p.hs = parseInt(s.runs || 0);

              p.history.push({
                type: "bat",
                matchId: m.id,
                date: m.date || m.meta?.date || new Date().toISOString(),
                opponent: bowlTeam,
                runs: parseInt(s.runs || 0),
                balls: parseInt(s.balls || 0),
                fours: parseInt(s.fours || 0),
                sixes: parseInt(s.sixes || 0),
                notOut: !s.out,
              });
            }
          });
        }

        // Bowling History
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([name, s]) => {
            if (!playerDictionary[name]) {
              playerDictionary[name] = {
                name,
                team: bowlTeam,
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                batSR: "0.00",
                batAvg: "0.00",
                innings: 0,
                notOuts: 0,
                hs: 0,
                wickets: 0,
                runsConceded: 0,
                ballsBowled: 0,
                oversBowled: "0.0",
                bowlEco: "0.00",
                bowlAvg: "0.00",
                mvp: 0,
                history: [],
              };
            }
            const p = playerDictionary[name];
            if (s.balls > 0) {
              p.history.push({
                type: "bowl",
                matchId: m.id,
                date: m.date || m.meta?.date,
                opponent: batTeam,
                wickets: parseInt(s.wickets || 0),
                runsConceded: parseInt(s.runs || 0),
                ballsBowled: parseInt(s.balls || 0),
              });
            }
          });
        }
      });
    });

    // 3. Inject Perfect Supabase Math for Totals
    dbBattingStats.forEach((p) => {
      const name = p.player_name;
      if (playerDictionary[name]) {
        playerDictionary[name].runs = Number(p.total_runs || 0);
        playerDictionary[name].balls = Number(p.balls_faced || 0);
        playerDictionary[name].fours = Number(p.fours || 0);
        playerDictionary[name].sixes = Number(p.sixes || 0);
        playerDictionary[name].batSR = p.strike_rate || "0.00";

        // Calculate Average using Supabase Runs and Firebase Innings
        const outs =
          playerDictionary[name].innings - playerDictionary[name].notOuts;
        playerDictionary[name].batAvg =
          outs > 0
            ? (playerDictionary[name].runs / outs).toFixed(2)
            : playerDictionary[name].runs.toFixed(2);

        playerDictionary[name].mvp +=
          Number(p.total_runs || 0) +
          Number(p.fours || 0) +
          Number(p.sixes || 0) * 2;
      }
    });

    dbBowlingStats.forEach((p) => {
      const name = p.player_name;
      if (playerDictionary[name]) {
        playerDictionary[name].wickets = Number(p.wickets || 0);
        playerDictionary[name].runsConceded = Number(p.runs_conceded || 0);
        playerDictionary[name].ballsBowled = Number(p.legal_balls_bowled || 0);
        playerDictionary[name].oversBowled = p.overs_bowled || "0.0";
        playerDictionary[name].bowlEco =
          Number(p.legal_balls_bowled) > 0
            ? (
                Number(p.runs_conceded) /
                (Number(p.legal_balls_bowled) / 6)
              ).toFixed(2)
            : "0.00";

        // Calculate Average
        playerDictionary[name].bowlAvg =
          playerDictionary[name].wickets > 0
            ? (
                playerDictionary[name].runsConceded /
                playerDictionary[name].wickets
              ).toFixed(2)
            : "0.00";

        playerDictionary[name].mvp += Number(p.wickets || 0) * 20;
      }
    });

    // 4. Final Polish & Sort
    const statsArray = Object.values(playerDictionary).map((p) => {
      p.history.sort((a, b) => new Date(b.date) - new Date(a.date));
      return p;
    });

    const orange = [...statsArray].sort((a, b) => b.runs - a.runs)[0];
    const purple = [...statsArray].sort((a, b) => b.wickets - a.wickets)[0];

    return {
      detailedStats: statsArray,
      orangeCap: orange,
      purpleCap: purple,
      distinctTeams: Array.from(teamList),
    };
  }, [dbBattingStats, dbBowlingStats, tournamentTeams, matches]);

  // --- 5. FILTERED STATS ---
  const filteredStats = useMemo(() => {
    let data = detailedStats;

    return data.sort((a, b) => {
      if (statsTab === "bat") {
        if (sortStyle === "most_runs")
          return b.runs - a.runs || parseFloat(b.batSR) - parseFloat(a.batSR);
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
        return b.mvp - a.mvp;
      }
      return 0;
    });
  }, [detailedStats, teamFilter, statsTab, sortStyle]);

  // --- RENDER ---
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
      {/* TABS NAVIGATION */}
      <div className="sticky top-2 z-40 mb-3 md:mb-6 mx-[-16px] px-3 md:mx-0 md:px-0">
        <div
          className={`backdrop-blur-xl border p-1 md:p-1.5 rounded-xl md:rounded-2xl flex overflow-x-auto shadow-2xl no-scrollbar snap-x snap-mandatory ${
            lightMode
              ? "bg-white/90 border-gray-200"
              : "bg-[#1C2128]/90 border-white/10"
          }`}>
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
                      ? "bg-teal-600 text-white shadow-lg scale-95 md:scale-100"
                      : `text-slate-500 hover:bg-white/5 border border-transparent ${lightMode ? "hover:text-teal-600 hover:bg-gray-50" : "hover:text-slate-300"}`
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
            tournamentId={tournamentId}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in zoom-in-95">
            <div
              className={`border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl relative overflow-hidden group ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
              <h3
                className={`font-bold text-base md:text-lg mb-4 md:mb-6 flex items-center gap-2 ${theme.text}`}>
                <Shield size={18} className="text-cyan-500 md:w-5 md:h-5" />{" "}
                Team Management
              </h3>
              {isAuctionEnabled ? (
                <>
                  <div
                    className={`border rounded-xl p-5 md:p-8 text-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                    <div className="flex justify-center mb-3 md:mb-4">
                      <Lock size={28} className="text-gray-400 md:w-8 md:h-8" />
                    </div>
                    <h4
                      className={`font-bold text-sm md:text-base mb-1.5 md:mb-2 ${theme.text}`}>
                      Rosters Locked
                    </h4>
                    <p
                      className={`text-xs md:text-sm mb-4 md:mb-6 ${theme.sub}`}>
                      Teams are managed in the Auction Console.
                    </p>
                    <button
                      onClick={() =>
                        navigate(`/tournaments/${tournamentId}/auction`)
                      }
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2.5 px-4 md:py-3 md:px-6 rounded-lg md:rounded-xl text-xs md:text-base shadow-lg hover:shadow-purple-500/20 transition-all">
                      Go to Auction Console
                    </button>
                  </div>
                  <SettingsTab
                    tournament={{ ...tournamentData, id: tournamentId }}
                    canEdit={canEdit}
                  />
                </>
              ) : (
                <TeamManager tournamentId={tournamentId} />
              )}
              {/* 🟢 TEMPORARY MIGRATION BUTTON - DELETE AFTER USING */}
              {/* <div
                className={`border rounded-xl p-6 shadow-xl ${theme.card} ${lightMode ? "border-red-200 bg-red-50" : "border-red-900/30 bg-red-900/10"}`}
              >
                <h3 className={`font-bold text-lg mb-2 text-red-500`}>
                  Database Backfill
                </h3>
                <p className={`text-sm mb-4 ${theme.sub}`}>
                  Click this ONCE to copy the old 14 Firebase matches into
                  Supabase so they appear on the leaderboards.
                </p>
                <button
                  onClick={async () => {
                    // console.log("🚀 Starting Migration of old matches...");
                    let totalMigrated = 0;

                    for (const m of matches) {
                      if (!m.innings) continue;

                      // 1. Check if this match is already in Supabase so we don't duplicate!
                      const { count } = await supabase
                        .from("ball_events")
                        .select("*", { count: "exact", head: true })
                        .eq("match_id", m.id);

                      if (count > 0) {
                        // console.log(
                        //   `⏩ Match ${m.id} already in Supabase. Skipping.`,
                        // );
                        continue;
                      }

                      // 2. Gather all the old balls from Firebase
                      const allEvents = [];
                      let seq = 1;

                      const processTimeline = (inn) => {
                        if (!inn || !inn.timeline) return;
                        inn.timeline.forEach((ball) => {
                          allEvents.push({
                            tournament_id: tournamentId,
                            match_id: m.id,
                            action_id: `migrated-${m.id}-${seq}`,
                            event_type: "BALL",
                            payload: { newBall: ball },
                            sequence_no: seq++,
                          });
                        });
                      };

                      processTimeline(m.innings[0]);
                      processTimeline(m.innings[1]);

                      // 3. Push them into Supabase
                      if (allEvents.length > 0) {
                        // console.log(
                        //   `⏳ Pushing ${allEvents.length} balls for match ${m.id}...`,
                        // );
                        const { error } = await supabase
                          .from("ball_events")
                          .insert(allEvents);
                        if (error) {
                          console.error(
                            "❌ Error migrating match",
                            m.id,
                            error,
                          );
                        } else {
                          // console.log(`✅ Success: Migrated match ${m.id}`);
                          totalMigrated++;
                        }
                      }
                    }
                    alert(
                      `🎉 Migration Complete! Successfully copied ${totalMigrated} matches to Supabase.`,
                    );
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  Run Migration Script
                </button>
              </div> */}
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
