import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../utils/helpers";
import PlayerProfileModal from "./PlayerProfileModal";
import TeamPosterModal from "./TeamPosterModal";
import { useTheme } from "../../context/ThemeContext";
import {
  Shield,
  Users,
  Trophy,
  X,
  Calendar,
  BarChart2,
  Crown,
  Wallet,
  Coins,
  CreditCard,
  Share2,
} from "lucide-react";

// --- 🛠️ HELPER: STANDARDIZED COMPARISON ---
const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();
const isSameTeam = (n1, n2) => normalize(n1) === normalize(n2);

// --- 📊 HELPER: GET CALCULATED HISTORY ---
const getTeamMatchList = (teamName, allMatches = []) => {
  if (!teamName || !allMatches.length) return [];

  const rawMatches = allMatches.filter((m) => {
    // Check meta names first (most reliable)
    if (isSameTeam(m.meta?.teamA, teamName) || isSameTeam(m.meta?.teamB, teamName)) return true;
    
    // Fallback to innings data if meta is missing
    const inn1Team = m.innings?.[0]?.battingTeam;
    const inn2Team = m.innings?.[1]?.battingTeam;
    return isSameTeam(inn1Team, teamName) || isSameTeam(inn2Team, teamName);
  });

  return rawMatches
    .map((m) => {
      const meta = m.meta || {};
      const inn1 = m.innings?.[0];
      const inn2 = m.innings?.[1];
      const status = normalize(m.status || meta.matchStatus || meta.status);
      const isFinished = status === "finished" || status === "completed";

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
            const [hours, minutes] = rawTime.split(":");
            const timeObj = new Date();
            timeObj.setHours(hours, minutes);
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

      // Determine Opponent
      let opponentName = "Opponent";
      if (isSameTeam(meta.teamA, teamName)) opponentName = meta.teamB;
      else if (isSameTeam(meta.teamB, teamName)) opponentName = meta.teamA;
      else if (isSameTeam(inn1?.battingTeam, teamName)) opponentName = inn2?.battingTeam;
      else if (isSameTeam(inn2?.battingTeam, teamName)) opponentName = inn1?.battingTeam;

      let resultStatus = "PENDING";
      let resultDescription = meta.result || (isFinished ? "Match Ended" : "Scheduled");

      if (inn1 && inn2 && isFinished) {
        const s1 = Number(inn1.score || 0);
        const s2 = Number(inn2.score || 0);
        
        let winningTeam = "";
        if (s1 > s2) winningTeam = inn1.battingTeam;
        else if (s2 > s1) winningTeam = inn2.battingTeam;
        else {
           // Check if there's a manual winner override in DB for ties
           const dbWinner = (m.winner || meta.result?.winner || "").trim();
           winningTeam = dbWinner || "Tie";
        }

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
    .sort((a, b) => {
       // Sort by date, newest first
       const dateA = new Date(a.meta?.startAt || a.meta?.date || 0);
       const dateB = new Date(b.meta?.startAt || b.meta?.date || 0);
       return dateB - dateA;
    });
};

// --- 🗂️ TEAM STATS MODAL ---
const TeamStatsModal = ({
  team,
  matches = [],
  allTeams = [],
  isOpen,
  onClose,
  isAuctionEnabled, // 🔥 This flag now controls the internal UI
}) => {
  const { theme, lightMode } = useTheme();

  const navigate = useNavigate();

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

  const currentTournamentId = matches[0]?.tournamentId || matches[0]?.meta?.tournament || "unknown";

  const getOpponentLogo = (name) => {
    const opTeam = allTeams.find((t) => isSameTeam(t.name, name));
    return opTeam?.logoUrl;
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div
        className={`relative w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-300 ${theme.card} ${lightMode ? "border border-gray-200" : "border border-white/10"}`}>
        {/* HEADER SECTION */}
        <div
          className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <div className="flex items-center gap-4">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border shadow-sm"
                alt=""
              />
            ) : (
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl border">
                <Shield size={28} className="text-gray-400" />
              </div>
            )}
            <div>
              <h2
                className={`text-xl md:text-2xl font-black uppercase italic leading-tight ${theme.text}`}>
                {team.name}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                {isAuctionEnabled && (
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Crown size={12} className="text-amber-500" />{" "}
                    {team.ownerName || "No Owner"}
                  </span>
                )}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${lightMode ? "bg-gray-200" : "bg-slate-800"}`}>
                  P:{dbStats.played} W:{dbStats.won} L:{dbStats.lost}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`flex p-1 rounded-xl border ${lightMode ? "bg-gray-100" : "bg-black/20"}`}>
            <button
              onClick={() => setActiveTab("squad")}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === "squad" ? "bg-teal-600 text-white shadow-lg" : "text-slate-500"}`}>
              Squad
            </button>
            <button
              onClick={() => setActiveTab("matches")}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === "matches" ? "bg-teal-600 text-white shadow-lg" : "text-slate-500"}`}>
              Matches
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {activeTab === "squad" && (
            <div className="animate-in slide-in-from-right-4 duration-300 space-y-8">
              {/* 🔥 1. PURSE STATS: ONLY show if auction is valid */}
              {isAuctionEnabled && (
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <StatCard
                    label="Purse"
                    value={formatCurrency(purse)}
                    icon={Wallet}
                    lightMode={lightMode}
                    theme={theme}
                  />
                  <StatCard
                    label="Spent"
                    value={formatCurrency(spent)}
                    icon={CreditCard}
                    color="text-red-500"
                    lightMode={lightMode}
                    theme={theme}
                  />
                  <StatCard
                    label="Remaining"
                    value={formatCurrency(remaining)}
                    icon={Coins}
                    color="text-green-500"
                    isBorder
                    lightMode={lightMode}
                    theme={theme}
                  />
                </div>
              )}

              {/* ROLE BREAKDOWN */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map(
                  (role) => (
                    <div
                      key={role}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center ${lightMode ? "bg-gray-50" : "bg-white/5"}`}>
                      <span
                        className={`text-[10px] font-bold uppercase ${theme.sub}`}>
                        {role}
                      </span>
                      <span className={`text-xl font-black ${theme.text}`}>
                        {roleCounts[role] || 0}
                      </span>
                    </div>
                  ),
                )}
              </div>

              {/* SQUAD TABLE */}
              <div
                className={`rounded-3xl border overflow-hidden ${lightMode ? "bg-gray-50" : "bg-[#0F1115]"}`}>
                <table className="w-full text-left text-sm">
                  <thead
                    className={`text-[10px] font-black uppercase ${lightMode ? "bg-gray-100 text-gray-500" : "bg-white/5 text-slate-500"}`}>
                    <tr>
                      <th className="p-4">Player</th>
                      <th className="p-4 hidden sm:table-cell">Role</th>
                      {/* 🔥 2. TABLE HEADER: Hide if no auction */}
                      {isAuctionEnabled && (
                        <th className="p-4 text-right">Sold Price</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {roster.map((p, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-3 md:p-4 flex items-center gap-3">
                          <img
                            src={
                              p.photoURL ||
                              `https://ui-avatars.com/api/?name=${p.name}`
                            }
                            className="w-8 h-8 rounded-lg object-cover"
                            alt=""
                          />
                          <span className="font-bold text-sm">{p.name}</span>
                        </td>
                        <td className="p-4 text-xs font-bold uppercase hidden sm:table-cell opacity-60">
                          {p.role}
                        </td>
                        {/* 🔥 3. TABLE DATA: Hide if no auction */}
                        {isAuctionEnabled && (
                          <td className="p-4 text-right font-mono font-bold text-teal-500">
                            {formatCurrency(p.soldPrice || p.price || 0)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* 🔥 NEW: MATCH HISTORY TAB */}
          {activeTab === "matches" && (
            <div className="animate-in slide-in-from-left-4 duration-300 space-y-4">
              {history.length === 0 ? (
                <div className={`text-center py-16 italic ${theme.sub}`}>
                  <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                  No matches found for {team.name}.
                </div>
              ) : (
                history.map((match, idx) => (
                  <div
                    key={match.id || idx}
                    onClick={() => navigate(`/tournaments/${currentTournamentId}/scorecard/${match.id}`)} // 🟢 NEW: Navigation added
                    className={`p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:scale-[1.01] shadow-sm cursor-pointer ${
                      lightMode ? "bg-white border-gray-200 hover:border-teal-400" : "bg-[#161920] border-white/5 hover:border-teal-500/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Result Badge */}
                      <div
                        className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-sm font-black shadow-lg ${
                          match.computedResult === "WON"
                            ? "bg-teal-500 text-black shadow-teal-500/30"
                            : match.computedResult === "LOST"
                            ? "bg-red-500 text-white shadow-red-500/30"
                            : match.computedResult === "TIE"
                            ? "bg-amber-500 text-black shadow-amber-500/30"
                            : "bg-slate-700 text-white shadow-slate-900/50"
                        }`}
                      >
                        {match.computedResult === "PENDING" ? "TBD" : match.computedResult}
                      </div>

                      {/* Match Details */}
                      <div>
                        <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme.sub}`}>
                          vs {match.computedOpponent}
                        </div>
                        <div className={`text-sm md:text-base font-bold leading-tight ${theme.text}`}>
                          {match.computedResultText}
                        </div>
                        <div className={`text-xs mt-1 flex items-center gap-3 font-medium ${theme.sub}`}>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {match.displayDateTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- STAT CARD COMPONENT ---
const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  isBorder = false,
  lightMode,
  theme,
}) => (
  <div
    className={`p-3 md:p-5 rounded-2xl md:rounded-3xl border text-center md:text-left shadow-lg ${
      lightMode ? "bg-white border-gray-200" : "bg-[#0F1115] border-white/5"
    } ${isBorder ? "border-b-4 border-b-green-500 md:border-b-0 md:border-l-4 md:border-l-green-500" : ""}`}>
    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start opacity-70">
      {Icon && <Icon size={12} className={theme.sub} />}
      <p
        className={`text-[8px] md:text-[10px] uppercase font-black tracking-widest ${theme.sub}`}>
        {label}
      </p>
    </div>
    <p
      className={`text-sm md:text-2xl font-mono font-bold truncate ${color || theme.text}`}>
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
  const { theme, lightMode } = useTheme();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [viewingTeamStats, setViewingTeamStats] = useState(null);
  const [posterTeam, setPosterTeam] = useState(null);

  const displayName = tournamentName || "OFFICIAL SQUAD";

  if (!tournamentTeams.length)
    return (
      <div
        className={`text-center py-20 rounded-3xl border border-dashed italic ${lightMode ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-[#161920] text-slate-600 border-white/5"}`}>
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
            className={`border rounded-[2rem] overflow-hidden shadow-xl transition-all flex flex-col h-full group relative ${
              lightMode
                ? "bg-white border-gray-200 hover:border-teal-300"
                : "bg-[#1C2128] border-white/5 hover:border-teal-500/30"
            }`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPosterTeam(team);
              }}
              className={`absolute top-5 right-5 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all border active:scale-95 shadow-lg ${
                lightMode
                  ? "bg-white hover:bg-teal-600 text-gray-400 hover:text-white border-gray-200"
                  : "bg-white/5 hover:bg-teal-600 text-slate-400 hover:text-white border-white/5"
              }`}>
              <Share2 size={14} />
            </button>

            <div className="p-6 pb-4 flex items-center gap-4">
              <div className="relative">
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    className={`w-16 h-16 rounded-2xl object-cover border shadow-2xl ${lightMode ? "bg-white border-gray-200" : "bg-black border-white/5"}`}
                    alt=""
                  />
                ) : (
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${lightMode ? "bg-gray-100 border-gray-200" : "bg-slate-800 border-white/10"}`}>
                    <Shield size={32} className="text-gray-400" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-teal-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md border border-teal-400/50">
                  {team.roster?.length || 0}
                </div>
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3
                  className={`text-xl font-black truncate italic uppercase tracking-tight leading-tight ${theme.text}`}>
                  {team.name}
                </h3>
                {isAuctionEnabled && (
                  <p
                    className={`text-xs font-bold truncate mt-0.5 flex items-center gap-1.5 ${lightMode ? "text-amber-600" : "text-amber-500/80"}`}>
                    <Crown size={12} /> {team.ownerName || "No Owner"}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <span
                    className={`text-[9px] border px-2 py-0.5 rounded font-mono shadow-sm ${lightMode ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-white/5 text-slate-400 border-white/5"}`}>
                    P: {dbStats.played}
                  </span>
                  {dbStats.won > 0 && (
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold border shadow-sm ${lightMode ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-teal-900/30 text-teal-400 border-teal-500/20"}`}>
                      W: {dbStats.won}
                    </span>
                  )}
                  {dbStats.lost > 0 && (
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold border shadow-sm ${lightMode ? "bg-red-100 text-red-700 border-red-200" : "bg-red-900/30 text-red-400 border-red-500/20"}`}>
                      L: {dbStats.lost}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 🔥 ALREADY PRESENT: Auction Progress Bar Conditional Logic */}
            {isAuctionEnabled && (
              <div className="px-6 py-2">
                <div className="flex justify-between text-[10px] font-black uppercase mb-1 tracking-widest">
                  <span className={theme.sub}>Auction Budget</span>
                  <span
                    className={
                      remaining < 0 ? "text-red-500" : "text-teal-500"
                    }>
                    {Math.round(spentPercentage)}%
                  </span>
                </div>
                <div
                  className={`h-1.5 w-full rounded-full overflow-hidden flex shadow-inner ${lightMode ? "bg-gray-200" : "bg-white/5"}`}>
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
                      className={`w-10 h-10 rounded-xl object-cover border grayscale group-hover/player:grayscale-0 transition-all duration-300 ${lightMode ? "bg-white border-gray-200" : "bg-black border-white/10"}`}
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
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors shadow-md ${lightMode ? "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200" : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"}`}>
                    +{team.roster.length - 6}
                  </div>
                )}
              </div>
            </div>

            <div
              className={`p-4 mt-auto flex justify-center border-t transition-colors ${lightMode ? "bg-gray-50 border-gray-200 group-hover:bg-gray-100" : "bg-[#161920] border-white/5 group-hover:bg-[#1c2128]"}`}>
              <button
                onClick={() => setViewingTeamStats(team)}
                className={`text-[10px] font-black uppercase tracking-widest hover:text-teal-500 transition-all flex items-center gap-2 group/btn ${theme.sub}`}>
                View Team Analysis
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
      <TeamStatsModal
        team={viewingTeamStats}
        matches={matches}
        allTeams={tournamentTeams}
        isOpen={!!viewingTeamStats}
        onClose={() => setViewingTeamStats(null)}
        isAuctionEnabled={isAuctionEnabled} // 🔥 Pass prop down to Modal
      />
      <TeamPosterModal
        team={posterTeam}
        isOpen={!!posterTeam}
        onClose={() => setPosterTeam(null)}
        tournamentName={displayName}
        isAuctionEnabled={isAuctionEnabled}
      />
    </div>
  );
}
