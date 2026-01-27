import React, { useState, useMemo } from "react";
import { formatCurrency } from "../../utils/helpers";
import PlayerProfileModal from "./PlayerProfileModal";
import TeamPosterModal from "./TeamPosterModal";

// --- 🛠️ HELPER: STANDARDIZED COMPARISON ---
const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();
const isSameTeam = (n1, n2) => normalize(n1) === normalize(n2);

// --- 📊 HELPER: GET CALCULATED HISTORY ---
const getTeamMatchList = (teamName, allMatches = []) => {
  if (!teamName || !allMatches.length) return [];

  // 1. Filter matches involving this team
  const rawMatches = allMatches.filter((m) => {
    const names = [
      m.meta?.teamA,
      m.meta?.teamB,
      m.innings?.[0]?.battingTeam,
      m.innings?.[1]?.battingTeam,
    ];
    return names.some((n) => isSameTeam(n, teamName));
  });

  // 2. Process each match
  return rawMatches
    .map((m) => {
      const meta = m.meta || {};
      const inn1 = m.innings?.[0];
      const inn2 = m.innings?.[1];
      const status = normalize(m.status || meta.matchStatus || meta.status);
      const isFinished = status === "finished" || status === "completed";

      // --- A. Venue & Date Logic (Updated to match MatchCard) ---
      const venue = m.venue || meta.venue || "Venue TBD";

      let formattedDateTime = "Date TBD";
      const rawDate = m.date || meta.date;
      const rawTime = m.time || meta.time;

      if (rawDate) {
        const dateObj = new Date(rawDate);
        const datePart = dateObj.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });
        let timePart = "";

        if (rawTime) {
          try {
            // Check if time is HH:MM
            const [hours, minutes] = rawTime.split(":");
            const timeObj = new Date();
            timeObj.setHours(hours);
            timeObj.setMinutes(minutes);
            timePart = timeObj.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
          } catch (e) {
            timePart = rawTime;
          }
        }
        formattedDateTime = timePart ? `${datePart}, ${timePart}` : datePart;
      }

      // --- B. Determine Opponent ---
      const possibleOpponents = [
        meta.teamA,
        meta.teamB,
        inn1?.battingTeam,
        inn2?.battingTeam,
      ];
      const opponentName =
        possibleOpponents.find((n) => n && !isSameTeam(n, teamName)) ||
        "Opponent";

      // --- C. Determine Result ---
      let resultStatus = "PENDING";
      let resultDescription =
        meta.result || (isFinished ? "Match Ended" : "Scheduled");

      if (inn1 && inn2 && isFinished) {
        const s1 = Number(inn1.score || 0);
        const s2 = Number(inn2.score || 0);

        // Math-First Winner Detection
        let winningTeam = "";
        if (s1 > s2) winningTeam = inn1.battingTeam;
        else if (s2 > s1) winningTeam = inn2.battingTeam;
        else winningTeam = "Tie";

        // Generate "Won by..." text
        if (s1 > s2) {
          const diff = s1 - s2;
          resultDescription = `${inn1.battingTeam} won by ${diff} run${diff !== 1 ? "s" : ""}`;
        } else if (s2 > s1) {
          const totalWickets = parseInt(meta.totalWickets || 10);
          const diff = Math.max(0, totalWickets - (inn2.wickets || 0));
          resultDescription = `${inn2.battingTeam} won by ${diff} wicket${diff !== 1 ? "s" : ""}`;
        } else {
          resultDescription = "Match Tied";
        }

        // Set W/L Status
        if (isSameTeam(winningTeam, teamName)) resultStatus = "WON";
        else if (isSameTeam(winningTeam, "tie")) resultStatus = "TIE";
        else resultStatus = "LOST";
      }

      return {
        ...m,
        computedResult: resultStatus,
        computedResultText: resultDescription,
        computedOpponent: opponentName,
        displayDateTime: formattedDateTime,
        displayVenue: venue,
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

// --- 🗂️ TEAM STATS MODAL ---
const TeamStatsModal = ({
  team,
  matches = [],
  allTeams = [],
  isOpen,
  onClose,
}) => {
  if (!isOpen || !team) return null;

  const [activeTab, setActiveTab] = useState("squad");

  const dbStats = team.stats || { played: 0, won: 0, lost: 0 };
  const history = useMemo(
    () => getTeamMatchList(team.name, matches),
    [team.name, matches],
  );

  const roster = team.roster || [];
  const purse = Number(team.purse) || 0;
  const spent = Number(team.spent) || 0;
  const remaining = purse - spent;

  const roleCounts = roster.reduce((acc, p) => {
    const role = p.role || "Unknown";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const getOpponentLogo = (name) => {
    const opTeam = allTeams.find((t) => isSameTeam(t.name, name));
    return opTeam?.logoUrl;
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-[#1C2128] border border-white/10 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-[#161920] p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover bg-black border border-white/10"
                alt=""
              />
            ) : (
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl">
                🛡️
              </div>
            )}
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase italic leading-tight">
                {team.name}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-amber-500 font-bold tracking-tight">
                  👑 {team.ownerName || "No Owner"}
                </span>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold border border-white/10">
                    P:{dbStats.played}
                  </span>
                  {dbStats.won > 0 && (
                    <span className="text-[10px] bg-teal-900/40 text-teal-400 px-2 py-0.5 rounded font-bold border border-teal-500/20">
                      W:{dbStats.won}
                    </span>
                  )}
                  {dbStats.lost > 0 && (
                    <span className="text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded font-bold border border-red-500/20">
                      L:{dbStats.lost}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full md:w-auto">
            <button
              onClick={() => setActiveTab("squad")}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === "squad" ? "bg-teal-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>
              Squad
            </button>
            <button
              onClick={() => setActiveTab("matches")}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === "matches" ? "bg-teal-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}>
              Matches ({history.length})
            </button>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:static w-8 h-8 rounded-full bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {/* VIEW: SQUAD & AUCTION */}
          {activeTab === "squad" && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-8">
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <StatCard label="Purse" value={formatCurrency(purse)} />
                <StatCard
                  label="Spent"
                  value={formatCurrency(spent)}
                  color="text-red-400"
                />
                <StatCard
                  label="Remaining"
                  value={formatCurrency(remaining)}
                  color="text-green-400"
                  isBorder
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map(
                  (role) => (
                    <div
                      key={role}
                      className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center group hover:bg-white/10 transition-colors">
                      <span className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                        {role}
                      </span>
                      <span className="text-lg md:text-xl font-black text-teal-500">
                        {roleCounts[role] || 0}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <div className="bg-[#0F1115] rounded-3xl border border-white/5 overflow-hidden shadow-inner">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="p-4">Player</th>
                      <th className="p-4 hidden sm:table-cell">Role</th>
                      <th className="p-4 text-right">Sold Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {roster.map((p, i) => (
                      <tr
                        key={i}
                        className="hover:bg-white/5 transition-colors group">
                        <td className="p-3 md:p-4 flex items-center gap-3">
                          <img
                            src={
                              p.photoURL ||
                              `https://ui-avatars.com/api/?name=${p.name}`
                            }
                            className="w-8 h-8 rounded-lg object-cover bg-black border border-white/5"
                            alt=""
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-100 text-xs md:text-sm group-hover:text-teal-400 transition-colors">
                              {p.name}
                            </span>
                            <span className="text-[9px] text-slate-500 uppercase sm:hidden font-bold">
                              {p.role}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-bold uppercase text-slate-500 hidden sm:table-cell">
                          {p.role}
                        </td>
                        <td className="p-4 text-right font-mono text-teal-400 font-bold">
                          {formatCurrency(p.soldPrice || p.price || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: MATCH HISTORY */}
          {activeTab === "matches" && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              {history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history.map((m, idx) => {
                    const resultColor =
                      m.computedResult === "WON"
                        ? "border-teal-500/30 bg-teal-500/5"
                        : m.computedResult === "LOST"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-slate-500/30 bg-[#0F1115]";
                    const statusBadge =
                      m.computedResult === "WON"
                        ? "text-teal-400"
                        : m.computedResult === "LOST"
                          ? "text-red-400"
                          : "text-slate-400";
                    const opLogo = getOpponentLogo(m.computedOpponent);

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border ${resultColor} relative overflow-hidden group`}>
                        {/* Top Row: Date & Status */}
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                              {m.displayDateTime}
                            </span>
                            <span
                              className="text-[9px] text-slate-500 font-medium truncate max-w-[120px]"
                              title={m.displayVenue}>
                              📍 {m.displayVenue}
                            </span>
                          </div>
                          {m.computedResult !== "PENDING" ? (
                            <span
                              className={`text-xs font-black ${statusBadge}`}>
                              {m.computedResult}
                            </span>
                          ) : (
                            <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase">
                              Upcoming
                            </span>
                          )}
                        </div>

                        {/* Middle Row: VS Opponent */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="text-[10px] text-slate-500 font-bold uppercase">
                                Vs
                              </div>
                            <div className="w-10 h-10 rounded-xl bg-[#0F1115] border border-white/10 flex items-center justify-center overflow-hidden">
                              {opLogo ? (
                                <img
                                  src={opLogo}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <span className="text-sm">🛡️</span>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white leading-none">
                                {m.computedOpponent}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Result Text */}
                        <div className="mt-3 pt-3 border-t border-white/5 text-right">
                          <p className="text-xs font-mono text-slate-300 italic">
                            {m.computedResultText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-white/10 rounded-3xl bg-[#0F1115]">
                  <p className="text-sm italic">
                    No matches recorded for this team.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color = "text-white", isBorder = false }) => (
  <div
    className={`bg-[#0F1115] p-3 md:p-5 rounded-2xl md:rounded-3xl border border-white/5 ${isBorder ? "border-b-4 border-b-green-500 md:border-b-0 md:border-l-4 md:border-l-green-500" : ""} text-center md:text-left shadow-lg`}>
    <p className="text-[8px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">
      {label}
    </p>
    <p className={`text-sm md:text-2xl font-mono font-bold truncate ${color}`}>
      {value}
    </p>
  </div>
);

// --- MAIN TEAMS TAB ---
export default function TeamsTab({
  tournamentTeams = [],
  tournamentName,
  isAuctionEnabled,
  matches = [],
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [viewingTeamStats, setViewingTeamStats] = useState(null);
  const [posterTeam, setPosterTeam] = useState(null);

  const displayName = tournamentName || "OFFICIAL SQUAD";

  if (!tournamentTeams.length)
    return (
      <div className="text-center py-20 text-slate-600 bg-[#161920] rounded-3xl border border-dashed border-white/5 italic">
        No teams found in this tournament.
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {tournamentTeams.map((team) => {
        const dbStats = team.stats || { played: 0, won: 0, lost: 0 };
        const remaining = (team.purse || 0) - (team.spent || 0);
        const spentPercentage =
          team.purse > 0 ? Math.min((team.spent / team.purse) * 100, 100) : 0;

        return (
          <div
            key={team.id}
            className="bg-[#1C2128] border border-white/5 rounded-[2rem] overflow-hidden shadow-xl hover:border-teal-500/30 transition-all flex flex-col h-full group relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPosterTeam(team);
              }}
              className="absolute top-5 right-5 z-20 w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-teal-600 rounded-full transition-all text-slate-400 hover:text-white border border-white/5 active:scale-95 shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>

            <div className="p-6 pb-4 flex items-center gap-4">
              <div className="relative">
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    className="w-16 h-16 rounded-2xl object-cover bg-black border border-white/5 shadow-2xl"
                    alt=""
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl border border-white/10 text-slate-500 shadow-inner">
                    🛡️
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-teal-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md border border-teal-400/50">
                  {team.roster?.length || 0}
                </div>
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-xl font-black text-slate-100 truncate italic uppercase tracking-tight leading-tight">
                  {team.name}
                </h3>
                <p className="text-xs font-bold text-amber-500/80 truncate mt-0.5 flex items-center gap-1.5">
                  👑 {team.ownerName || "No Owner"}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="text-[9px] bg-white/5 text-slate-400 border border-white/5 px-2 py-0.5 rounded font-mono shadow-sm">
                    P: {dbStats.played}
                  </span>
                  {dbStats.won > 0 && (
                    <span className="text-[9px] bg-teal-900/30 text-teal-400 px-2 py-0.5 rounded font-bold border border-teal-500/20 shadow-sm shadow-teal-500/10">
                      W: {dbStats.won}
                    </span>
                  )}
                  {dbStats.lost > 0 && (
                    <span className="text-[9px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded font-bold border border-red-500/20 shadow-sm shadow-red-500/10">
                      L: {dbStats.lost}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isAuctionEnabled && (
              <div className="px-6 py-2">
                <div className="flex justify-between text-[10px] font-black uppercase mb-1 tracking-widest">
                  <span className="text-slate-600">Auction Budget</span>
                  <span
                    className={
                      remaining < 0 ? "text-red-400" : "text-teal-400"
                    }>
                    {Math.round(spentPercentage)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-1000 shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                    style={{ width: `${spentPercentage}%` }}
                  />
                </div>
              </div>
            )}

            <div className="p-6 flex-1">
              <div className="flex flex-wrap gap-2">
                {team.roster?.slice(0, 6).map((player, i) => (
                  <div
                    key={i}
                    className="relative cursor-pointer hover:scale-110 transition-transform group/player shadow-lg"
                    onClick={() => setSelectedPlayer(player)}>
                    <img
                      src={
                        player.photoURL ||
                        `https://ui-avatars.com/api/?name=${player.name}`
                      }
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 grayscale group-hover/player:grayscale-0 transition-all duration-300"
                      alt=""
                    />
                    <div className="absolute -top-1.5 -right-1.5 flex gap-0.5">
                      {player.isIcon && (
                        <div className="bg-amber-500 text-black text-[7px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-black border border-black shadow-sm">
                          ★
                        </div>
                      )}
                      {player.isDirectBuy && (
                        <div className="bg-purple-500 text-white text-[7px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-black border border-black shadow-sm">
                          ⚡
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {team.roster?.length > 6 && (
                  <div
                    onClick={() => setViewingTeamStats(team)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 cursor-pointer hover:bg-white/10 transition-colors shadow-md">
                    +{team.roster.length - 6}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#161920] mt-auto flex justify-center border-t border-white/5 group-hover:bg-[#1c2128] transition-colors">
              <button
                onClick={() => setViewingTeamStats(team)}
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all flex items-center gap-2 group/btn">
                View Team Analysis{" "}
                <span className="text-teal-500 group-hover/btn:translate-x-1 transition-transform inline-block">
                  →
                </span>
              </button>
            </div>
          </div>
        );
      })}

      <PlayerProfileModal
        player={selectedPlayer}
        isOpen={!!selectedPlayer}
        matches={matches}
        onClose={() => setSelectedPlayer(null)}
      />
      {/* ✅ ALL TEAMS PASSED HERE */}
      <TeamStatsModal
        team={viewingTeamStats}
        matches={matches}
        allTeams={tournamentTeams}
        isOpen={!!viewingTeamStats}
        onClose={() => setViewingTeamStats(null)}
      />
      <TeamPosterModal
        team={posterTeam}
        isOpen={!!posterTeam}
        onClose={() => setPosterTeam(null)}
        tournamentName={displayName}
      />
    </div>
  );
}
