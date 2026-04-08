import React, { useMemo, useState, useEffect } from "react";
import { calculatePointsTable } from "../../utils/statsHelper";
import TournamentAccessManager from "../TournamentAccessManager";
import TeamManager from "../TeamManager";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import BracketTab from "../BracketTab";
import { supabase } from "../../utils/supabase";

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

  // --- 3. 🟢 PURE FIREBASE STATS ENGINE (SUPABASE COMPLETELY REMOVED) 🟢 ---
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
            id: typeof p === "object" ? p.id : pName,
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
            bowlInnings: 0,
            oversBowled: "0.0",
            bowlEco: "0.00",
            bowlAvg: "0.00",
            bestWickets: 0,
            bestRuns: 9999,
            bestBowling: "-",
            mvp: 0,
            boundaryRuns: 0,
            rawEco: 9999,
            history: [],
          };
        }
      });
    });

    // 2. Build Stats purely from the Clean Firebase Matches Array
    matches.forEach((m) => {
      const status = (m.status || m.meta?.status || "").toLowerCase();
      // Only count stats from completed matches
      if (!["finished", "completed"].includes(status) || !m.innings) return;

      const innList = Array.isArray(m.innings)
        ? m.innings
        : Object.values(m.innings);

      innList.forEach((inn) => {
        if (!inn) return;
        const batTeam = (inn.battingTeam || "").trim();
        const bowlTeam = (inn.bowlingTeam || "").trim();

        // Batting Math
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
                bowlInnings: 0,
                oversBowled: "0.0",
                bowlEco: "0.00",
                bowlAvg: "0.00",
                bestWickets: 0,
                bestRuns: 9999,
                bestBowling: "-",
                mvp: 0,
                boundaryRuns: 0,
                rawEco: 9999,
                history: [],
              };
            }
            const p = playerDictionary[name];

            if (s.balls > 0 || s.out || s.runs > 0) {
              p.innings += 1;
              if (!s.out) p.notOuts += 1;

              const r = parseInt(s.runs || 0);
              const b = parseInt(s.balls || 0);

              p.runs += r;
              p.balls += b;
              p.fours += parseInt(s.fours || 0);
              p.sixes += parseInt(s.sixes || 0);
              if (r > p.hs) p.hs = r;

              p.history.push({
                type: "bat",
                matchId: m.id,
                date: m.date || m.meta?.date || new Date().toISOString(),
                opponent: bowlTeam,
                runs: r,
                balls: b,
                fours: parseInt(s.fours || 0),
                sixes: parseInt(s.sixes || 0),
                notOut: !s.out,
              });
            }
          });
        }

        // Bowling Math
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
                bowlInnings: 0,
                oversBowled: "0.0",
                bowlEco: "0.00",
                bowlAvg: "0.00",
                bestWickets: 0,
                bestRuns: 9999,
                bestBowling: "-",
                mvp: 0,
                boundaryRuns: 0,
                rawEco: 9999,
                history: [],
              };
            }
            const p = playerDictionary[name];

            if (s.balls > 0 || s.overs > 0) {
              p.bowlInnings += 1;
              const w = parseInt(s.wickets || 0);
              const rc = parseInt(s.runs || 0);

              p.wickets += w;
              p.runsConceded += rc;

              const oversStr = String(s.overs || 0);
              const [fullOvers, extraBalls] = oversStr.split(".");
              const bBowled =
                parseInt(fullOvers || 0) * 6 + parseInt(extraBalls || 0);
              p.ballsBowled += bBowled;

              if (
                w > p.bestWickets ||
                (w === p.bestWickets && rc < p.bestRuns)
              ) {
                p.bestWickets = w;
                p.bestRuns = rc;
              }

              if (bBowled > 0) {
                p.history.push({
                  type: "bowl",
                  matchId: m.id,
                  date: m.date || m.meta?.date,
                  opponent: batTeam,
                  wickets: w,
                  runsConceded: rc,
                  ballsBowled: bBowled,
                });
              }
            }
          });
        }
      });
    });

    // 3. Final Calculations (Averages, Strike Rates, Economy, MVP)
    const statsArray = Object.values(playerDictionary).map((p) => {
      // Clean Matches count
      p.matches = new Set(p.history.map((h) => h.matchId)).size;

      // Batting Math
      const outs = p.innings - p.notOuts;
      p.batAvg =
        outs > 0
          ? (p.runs / outs).toFixed(2)
          : p.runs > 0
            ? p.runs.toFixed(2)
            : "0.00";
      p.batSR = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";

      // Bowling Math
      const oversBowled = p.ballsBowled / 6;
      p.bowlEco =
        oversBowled > 0 ? (p.runsConceded / oversBowled).toFixed(2) : "0.00";
      p.rawEco = oversBowled > 0 ? p.runsConceded / oversBowled : 9999;
      p.bowlAvg =
        p.wickets > 0 ? (p.runsConceded / p.wickets).toFixed(2) : "0.00";
      p.b_sr = p.wickets > 0 ? (p.ballsBowled / p.wickets).toFixed(2) : "0.00";
      p.bestBowling =
        p.bestWickets > 0 ? `${p.bestWickets}/${p.bestRuns}` : "-";

      // Points & Boundaries
      p.mvp = p.runs * 1 + p.wickets * 10 + p.sixes * 2 + p.fours * 1;
      p.boundaryRuns = p.fours * 4 + p.sixes * 6;

      p.history.sort((a, b) => new Date(b.date) - new Date(a.date));
      return p;
    });

    // Extract Caps
    const orange = [...statsArray].sort((a, b) => b.runs - a.runs)[0];
    const purple = [...statsArray].sort((a, b) => b.wickets - a.wickets)[0];

    return {
      detailedStats: statsArray,
      orangeCap: orange?.runs > 0 ? orange : null,
      purpleCap: purple?.wickets > 0 ? purple : null,
      distinctTeams: Array.from(teamList),
    };
  }, [tournamentTeams, matches]); // Notice: No Supabase dependencies!

  // --- 4. FILTERED STATS ---
  const filteredStats = useMemo(() => {
    let data = detailedStats;

    if (teamFilter && teamFilter !== "all") {
      data = data.filter(
        (p) => p.team.trim().toLowerCase() === teamFilter.trim().toLowerCase(),
      );
    }

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
          return a.rawEco - b.rawEco;
        }
        if (sortStyle === "best_economy") {
          if (a.ballsBowled === 0) return 1;
          if (b.ballsBowled === 0) return -1;
          return a.rawEco - b.rawEco;
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
          }`}
        >
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
                  }`}
                >
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
            id={tournamentId}
          />
        )}

        {activeTab === "admin" && (canEdit || isOwner) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in zoom-in-95">
            <div
              className={`border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl relative overflow-hidden group ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}
            >
              <h3
                className={`font-bold text-base md:text-lg mb-4 md:mb-6 flex items-center gap-2 ${theme.text}`}
              >
                <Shield size={18} className="text-cyan-500 md:w-5 md:h-5" />{" "}
                Team Management
              </h3>
              {isAuctionEnabled ? (
                <>
                  <div
                    className={`border rounded-xl p-5 md:p-8 text-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}
                  >
                    <div className="flex justify-center mb-3 md:mb-4">
                      <Lock size={28} className="text-gray-400 md:w-8 md:h-8" />
                    </div>
                    <h4
                      className={`font-bold text-sm md:text-base mb-1.5 md:mb-2 ${theme.text}`}
                    >
                      Rosters Locked
                    </h4>
                    <p
                      className={`text-xs md:text-sm mb-4 md:mb-6 ${theme.sub}`}
                    >
                      Teams are managed in the Auction Console.
                    </p>
                    <button
                      onClick={() =>
                        navigate(`/tournaments/${tournamentId}/auction`)
                      }
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2.5 px-4 md:py-3 md:px-6 rounded-lg md:rounded-xl text-xs md:text-base shadow-lg hover:shadow-purple-500/20 transition-all"
                    >
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

              <div
                className={`border rounded-xl p-6 shadow-xl mt-6 ${theme.card} ${lightMode ? "border-red-200 bg-red-50" : "border-red-900/30 bg-red-900/10"}`}
              >
                <h3 className={`font-bold text-lg mb-2 text-red-500`}>
                  Database Backfill
                </h3>
                <p className={`text-sm mb-4 ${theme.sub}`}>
                  Click this ONCE to copy the old Firebase matches into Supabase
                  so they appear on the TV broadcast overlays.
                </p>
                <button
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Are you sure you want to run the migration? This may take a minute.",
                      )
                    )
                      return;

                    let totalMigrated = 0;

                    for (const m of matches) {
                      if (!m.innings) continue;

                      try {
                        const { data: existingMatch } = await supabase
                          .from("matches")
                          .select("id")
                          .eq("id", m.id)
                          .maybeSingle();

                        if (existingMatch) {
                          continue;
                        }

                        const { error: matchError } = await supabase
                          .from("matches")
                          .insert({
                            id: m.id,
                            tournament_id: tournamentId,
                            team_a: m.meta?.teamA || "Team A",
                            team_b: m.meta?.teamB || "Team B",
                            toss_winner: m.meta?.toss?.winner || "",
                            toss_decision: m.meta?.toss?.decision || "",
                            total_overs: m.meta?.overs || 10,
                            status: m.status || m.meta?.status || "completed",
                          });

                        if (matchError) {
                          console.error(
                            `❌ Failed to create match ${m.id} in Supabase:`,
                            matchError,
                          );
                          continue;
                        }

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

                        if (allEvents.length > 0) {
                          const { error: ballError } = await supabase
                            .from("ball_events")
                            .insert(allEvents);

                          if (ballError) {
                            console.error(
                              `❌ Error migrating balls for match ${m.id}:`,
                              ballError,
                            );
                          } else {
                            totalMigrated++;
                          }
                        } else {
                          totalMigrated++;
                        }
                      } catch (err) {
                        console.error(
                          `❌ Unexpected error on match ${m.id}:`,
                          err,
                        );
                      }
                    }

                    alert(
                      `🎉 Migration Complete! Successfully copied ${totalMigrated} matches to Supabase.`,
                    );
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all w-full"
                >
                  Run Migration Script
                </button>
              </div>
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
