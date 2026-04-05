import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { formatCurrency } from "../../utils/helpers";
import PlayerProfileModal from "./PlayerProfileModal";
import TeamPosterModal from "./TeamPosterModal";
import PlayerAvatar from "../PlayerAvatar";
import { useTheme } from "../../context/ThemeContext";
import {
  Shield,
  Users,
  Trophy,
  Calendar,
  Crown,
  Wallet,
  Coins,
  CreditCard,
  Share2,
  RefreshCw,
  X, // 🟢 FIXED: X icon is now explicitly imported!
} from "lucide-react";

// --- 🛠️ HELPER: STANDARDIZED COMPARISON ---
const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();
const isSameTeam = (n1, n2) => normalize(n1) === normalize(n2);

// --- 📸 HELPER: GET BEST PHOTO ---
const getBestPhoto = (player, hydrated) => {
  const photo =
    hydrated?.photoURL ||
    hydrated?.image ||
    hydrated?.profilePic ||
    player?.photoURL ||
    player?.image ||
    player?.profilePic;
  return typeof photo === "string" && photo.trim() !== "" ? photo : "";
};

// --- 📊 HELPER: GET CALCULATED HISTORY ---
const getTeamMatchList = (teamName, allMatches = []) => {
  if (!teamName || !allMatches.length) return [];
  const rawMatches = allMatches.filter((m) => {
    if (
      isSameTeam(m.meta?.teamA, teamName) ||
      isSameTeam(m.meta?.teamB, teamName)
    )
      return true;
    const inn1Team = m.innings?.[0]?.battingTeam;
    const inn2Team = m.innings?.[1]?.battingTeam;
    return isSameTeam(inn1Team, teamName) || isSameTeam(inn2Team, teamName);
  });

  return rawMatches
    .map((m) => {
      const meta = m.meta || {};
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

      let opponentName = "Opponent";
      if (isSameTeam(meta.teamA, teamName)) opponentName = meta.teamB;
      else if (isSameTeam(meta.teamB, teamName)) opponentName = meta.teamA;
      else if (isSameTeam(m.innings?.[0]?.battingTeam, teamName))
        opponentName = m.innings?.[1]?.battingTeam;
      else if (isSameTeam(m.innings?.[1]?.battingTeam, teamName))
        opponentName = m.innings?.[0]?.battingTeam;

      let resultStatus = "PENDING";
      let resultDescription =
        meta.result || (isFinished ? "Match Ended" : "Scheduled");

      if (m.innings?.[0] && m.innings?.[1] && isFinished) {
        const s1 = Number(m.innings[0].score || 0);
        const s2 = Number(m.innings[1].score || 0);
        let winningTeam =
          s1 > s2
            ? m.innings[0].battingTeam
            : s2 > s1
              ? m.innings[1].battingTeam
              : m.winner || "Tie";

        if (s1 > s2)
          resultDescription = `${m.innings[0].battingTeam} won by ${s1 - s2} runs`;
        else if (s2 > s1)
          resultDescription = `${m.innings[1].battingTeam} won by ${Math.max(0, parseInt(meta.totalWickets || 10) - (m.innings[1].wickets || 0))} wickets`;
        else resultDescription = "Match Tied";

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
    .sort(
      (a, b) =>
        new Date(b.meta?.startAt || b.meta?.date || 0) -
        new Date(a.meta?.startAt || a.meta?.date || 0),
    );
};

// --- 🗂️ TEAM STATS MODAL ---
const TeamStatsModal = ({
  team,
  matches = [],
  isOpen,
  onClose,
  isAuctionEnabled,
  masterPlayersMap = {},
  onForceSync,
  isFixingRosters,
}) => {
  const { theme, lightMode } = useTheme();
  const navigate = useNavigate();
  const { id: urlId } = useParams();
  const [activeTab, setActiveTab] = useState("squad");

  const tournamentId = team?.tournamentId || urlId;
  const dbStats = team?.stats || { played: 0, won: 0, lost: 0 };
  const history = useMemo(
    () => getTeamMatchList(team?.name, matches),
    [team?.name, matches],
  );
  const roster = team?.roster || [];
  const remaining = (team?.purse || 0) - (team?.spent || 0);

  const roleCounts = roster.reduce((acc, p) => {
    const role = p.role || "Unknown";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const currentTournamentId =
    tournamentId || matches[0]?.tournamentId || "unknown";

  if (!isOpen || !team) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div
        className={`relative w-full max-w-4xl rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/10"}`}
      >
        {/* --- 🎨 POLISHED HEADER --- */}
        <div
          className={`p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}
        >
          {/* Left: Team Identity */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            {team.logoUrl || team.logo ? (
              <img
                src={team.logoUrl || team.logo}
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border shadow-sm shrink-0"
                alt=""
              />
            ) : (
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl border shrink-0">
                <Shield size={28} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2
                className={`text-xl md:text-2xl font-black uppercase italic truncate leading-tight ${theme.text}`}
              >
                {team.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border shadow-sm ${lightMode ? "bg-white border-gray-200 text-gray-700" : "bg-slate-800 border-white/10 text-slate-300"}`}
                >
                  P:{dbStats.played} W:{dbStats.won} L:{dbStats.lost}
                </span>

                {onForceSync && (
                  <button
                    onClick={onForceSync}
                    disabled={isFixingRosters}
                    className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-colors ${lightMode ? "text-teal-600 hover:text-teal-700" : "text-teal-500 hover:text-teal-400"}`}
                  >
                    <RefreshCw
                      size={10}
                      className={isFixingRosters ? "animate-spin" : ""}
                    />
                    {isFixingRosters ? "Syncing..." : "Sync Photos"}
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Close Button (Visible only on small screens) */}
            <button
              onClick={onClose}
              className={`md:hidden w-8 h-8 flex items-center justify-center rounded-full shrink-0 ${lightMode ? "bg-gray-200 text-gray-600" : "bg-white/10 text-slate-400"}`}
            >
              <X size={16} />
            </button>
          </div>

          {/* Right: Navigation Tabs & Desktop Close */}
          <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
            <div
              className={`flex p-1 rounded-xl border w-full md:w-auto ${lightMode ? "bg-gray-100 border-gray-200" : "bg-black/20 border-white/5"}`}
            >
              {["squad", "matches"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeTab === t ? "bg-teal-600 text-white shadow-md" : `text-slate-500 ${lightMode ? "hover:text-gray-800" : "hover:text-slate-300"}`}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Desktop Close Button */}
            <button
              onClick={onClose}
              className={`hidden md:flex w-10 h-10 items-center justify-center rounded-full transition-all shrink-0 shadow-sm ${lightMode ? "bg-white border border-gray-200 hover:bg-gray-100 text-gray-500" : "bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white"}`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {activeTab === "squad" ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              {isAuctionEnabled && (
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <StatCard
                    label="Purse"
                    value={formatCurrency(team.purse || 0)}
                    icon={Wallet}
                    lightMode={lightMode}
                    theme={theme}
                  />
                  <StatCard
                    label="Spent"
                    value={formatCurrency(team.spent || 0)}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map(
                  (role) => (
                    <div
                      key={role}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center shadow-sm ${lightMode ? "bg-gray-50 border-gray-200" : "bg-white/5 border-white/5"}`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase ${theme.sub}`}
                      >
                        {role}
                      </span>
                      <span className={`text-xl font-black ${theme.text}`}>
                        {roleCounts[role] || 0}
                      </span>
                    </div>
                  ),
                )}
              </div>
              <div
                className={`rounded-2xl md:rounded-3xl border overflow-hidden shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-[#0F1115] border-white/5"}`}
              >
                <table className="w-full text-left text-sm">
                  <thead
                    className={`text-[10px] font-black uppercase ${lightMode ? "bg-gray-100 text-gray-500 border-b border-gray-200" : "bg-white/5 text-slate-500 border-b border-white/5"}`}
                  >
                    <tr>
                      <th className="p-4">Player</th>
                      <th className="p-4 hidden sm:table-cell">Role</th>
                      {isAuctionEnabled && (
                        <th className="p-4 text-right">Sold Price</th>
                      )}
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${lightMode ? "divide-gray-100" : "divide-white/5"}`}
                  >
                    {roster.map((p, i) => {
                      const hydrated =
                        masterPlayersMap[p.originalPlayerId] ||
                        masterPlayersMap[p.userId] ||
                        masterPlayersMap[p.id] ||
                        masterPlayersMap[normalize(p.name)] ||
                        p;
                      const finalPhoto = getBestPhoto(p, hydrated);

                      return (
                        <tr
                          key={i}
                          className={`transition-colors ${lightMode ? "hover:bg-gray-50" : "hover:bg-white/5"}`}
                        >
                          <td className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
                            <PlayerAvatar
                              player={hydrated}
                              playerId={
                                hydrated.originalPlayerId || hydrated.id || p.id
                              }
                              photoURL={finalPhoto}
                              tournamentId={currentTournamentId}
                              className={`w-10 h-10 rounded-xl object-cover border shadow-sm ${lightMode ? "border-gray-200" : "border-white/10"}`}
                            />
                            <span className={`font-bold text-sm ${theme.text}`}>
                              {p.name}
                            </span>
                          </td>
                          <td
                            className={`p-4 text-xs font-bold uppercase hidden sm:table-cell ${theme.sub}`}
                          >
                            {p.role}
                          </td>
                          {isAuctionEnabled && (
                            <td className="p-4 text-right font-mono font-bold text-teal-500">
                              {formatCurrency(p.soldPrice || p.price || 0)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-in slide-in-from-left-4 duration-300">
              {history.length === 0 ? (
                <div className={`text-center py-16 italic ${theme.sub}`}>
                  <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                  No matches recorded for this team yet.
                </div>
              ) : (
                history.map((m, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      navigate(
                        `/tournaments/${currentTournamentId}/scorecard/${m.id}`,
                      )
                    }
                    className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-sm ${lightMode ? "bg-white border-gray-200 hover:border-teal-400 hover:shadow-md" : "bg-white/5 border-white/5 hover:border-teal-500/50 hover:bg-white/10"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black shadow-inner ${m.computedResult === "WON" ? "bg-teal-500 text-black" : m.computedResult === "LOST" ? "bg-red-500 text-white" : "bg-slate-700 text-white"}`}
                      >
                        {m.computedResult === "PENDING"
                          ? "TBD"
                          : m.computedResult}
                      </div>
                      <div>
                        <div
                          className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${theme.sub}`}
                        >
                          vs {m.computedOpponent}
                        </div>
                        <div
                          className={`text-sm md:text-base font-bold leading-tight ${theme.text}`}
                        >
                          {m.computedResultText}
                        </div>
                        <div
                          className={`text-[10px] md:text-xs mt-1 flex items-center gap-1.5 font-medium ${theme.sub}`}
                        >
                          <Calendar size={12} /> {m.displayDateTime}
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

// 🟢 RESTORED: STAT CARD COMPONENT
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
    className={`p-3 md:p-5 rounded-2xl md:rounded-3xl border text-center md:text-left shadow-lg ${lightMode ? "bg-white border-gray-200" : "bg-[#0F1115] border-white/5"} ${isBorder ? "border-b-4 border-b-green-500 md:border-b-0 md:border-l-4 md:border-l-green-500" : ""}`}
  >
    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start opacity-70">
      {Icon && <Icon size={12} className={theme.sub} />}
      <p
        className={`text-[8px] md:text-[10px] uppercase font-black tracking-widest ${theme.sub}`}
      >
        {label}
      </p>
    </div>
    <p
      className={`text-sm md:text-2xl font-mono font-bold truncate ${color || theme.text}`}
    >
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
  tournamentId: propTournamentId,
}) {
  const { theme, lightMode } = useTheme();
  const navigate = useNavigate();
  const { id: urlTournamentId } = useParams();

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [viewingTeamStats, setViewingTeamStats] = useState(null);
  const [posterTeam, setPosterTeam] = useState(null);
  const [masterPlayersMap, setMasterPlayersMap] = useState({});
  const [isFixingRosters, setIsFixingRosters] = useState(false);

  const displayName = tournamentName || "OFFICIAL SQUAD";
  const safeTournamentId = propTournamentId || urlTournamentId || "unknown";

  // 🟢 AGGRESSIVE DEEP SYNC LOGIC: Scans 5 different ways to find a photo
  const syncPostAuctionRosters = async () => {
    if (
      !window.confirm(
        "This will run an aggressive deep sync to find all missing photos across the Global and Tournament databases. Continue?",
      )
    )
      return;
    if (!safeTournamentId || safeTournamentId === "unknown")
      return alert("Error: Tournament ID not found.");

    setIsFixingRosters(true);
    try {
      const photoDictionary = {};

      // 1. Scan Global Collection
      const globalSnap = await getDocs(collection(db, "players"));
      globalSnap.forEach((doc) => {
        const d = doc.data();
        const photo = d.photoURL || d.image || d.profilePic || "";
        if (photo && photo.trim() !== "") {
          photoDictionary[doc.id] = photo;
          if (d.originalPlayerId) photoDictionary[d.originalPlayerId] = photo;
          if (d.userId) photoDictionary[d.userId] = photo;
          if (d.name) photoDictionary[normalize(d.name)] = photo;
        }
      });

      // 2. Scan Tournament Collection (Auction Bridge)
      const auctionSnap = await getDocs(
        collection(db, "tournaments", safeTournamentId, "auctionPlayers"),
      );
      const bridgeMap = {};
      auctionSnap.forEach((doc) => {
        const d = doc.data();
        const photo = d.photoURL || d.image || d.profilePic || "";

        if (photo && photo.trim() !== "") {
          photoDictionary[doc.id] = photo;
          if (d.name) photoDictionary[normalize(d.name)] = photo;
        }
        if (d.originalPlayerId) {
          bridgeMap[doc.id] = d.originalPlayerId;
        }
      });

      // 3. Update Teams
      const teamsSnap = await getDocs(
        collection(db, "tournaments", safeTournamentId, "teams"),
      );
      const updatePromises = [];

      teamsSnap.forEach((teamDoc) => {
        const teamData = teamDoc.data();
        let changed = false;

        const patchedRoster = (teamData.roster || []).map((player) => {
          // Check all possible keys where this player might be saved
          const searchKeys = [
            player.originalPlayerId,
            player.userId,
            player.id,
            bridgeMap[player.id],
            normalize(player.name),
          ];

          let foundPhoto = player.photoURL || player.image || "";

          // Find the first valid photo in our massive dictionary
          for (const key of searchKeys) {
            if (key && photoDictionary[key]) {
              foundPhoto = photoDictionary[key];
              break;
            }
          }

          // If we found a valid photo and it's missing or different, patch it!
          if (foundPhoto && player.photoURL !== foundPhoto) {
            changed = true;
            return { ...player, photoURL: foundPhoto };
          }
          return player;
        });

        if (changed) {
          const teamRef = doc(
            db,
            "tournaments",
            safeTournamentId,
            "teams",
            teamDoc.id,
          );
          updatePromises.push(updateDoc(teamRef, { roster: patchedRoster }));
        }
      });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        alert(
          `✅ Deep Sync Complete! Updated photos for ${updatePromises.length} teams. Refreshing...`,
        );
        window.location.reload();
      } else {
        alert("✨ All rosters are already perfectly synced!");
      }
    } catch (error) {
      console.error("Deep Sync Error:", error);
      alert("Sync failed. Check console.");
    } finally {
      setIsFixingRosters(false);
    }
  };

  // 🟢 AGGRESSIVE PRELOAD FOR UI
  useEffect(() => {
    const fetchMasterMap = async () => {
      if (!safeTournamentId || safeTournamentId === "unknown") return;
      const tempMap = {};

      // Combine both databases into one massive UI map
      const globalSnap = await getDocs(collection(db, "players"));
      globalSnap.forEach((doc) => {
        const d = doc.data();
        tempMap[doc.id] = d;
        if (d.originalPlayerId) tempMap[d.originalPlayerId] = d;
        if (d.userId) tempMap[d.userId] = d;
        if (d.name) tempMap[normalize(d.name)] = d;
      });

      const auctionSnap = await getDocs(
        collection(db, "tournaments", safeTournamentId, "auctionPlayers"),
      );
      auctionSnap.forEach((doc) => {
        const d = doc.data();
        tempMap[doc.id] = { ...tempMap[doc.id], ...d };
        if (d.originalPlayerId)
          tempMap[d.originalPlayerId] = {
            ...tempMap[d.originalPlayerId],
            ...d,
          };
        if (d.userId) tempMap[d.userId] = { ...tempMap[d.userId], ...d };
        if (d.name)
          tempMap[normalize(d.name)] = { ...tempMap[normalize(d.name)], ...d };
      });

      setMasterPlayersMap(tempMap);
    };
    fetchMasterMap();
  }, [safeTournamentId]);

  if (!tournamentTeams.length)
    return (
      <div
        className={`text-center py-20 rounded-3xl border border-dashed italic ${lightMode ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-[#161920] text-slate-600 border-white/5"}`}
      >
        No teams found in this tournament.
      </div>
    );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-teal-500/10 p-4 rounded-2xl border border-teal-500/20 gap-4">
        <div className="flex items-center gap-3">
          <Users className="text-teal-500" size={24} />
          <div>
            <h2
              className={`font-black uppercase tracking-tight text-lg leading-tight ${theme.text}`}
            >
              Tournament Squads
            </h2>
            <p className={`text-xs font-bold ${theme.sub}`}>
              Live Roster Management
            </p>
          </div>
        </div>
        <button
          onClick={syncPostAuctionRosters}
          disabled={isFixingRosters}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 ${lightMode ? "bg-white border-2 border-teal-500 text-teal-600 hover:bg-teal-50" : "bg-black/40 border-2 border-teal-500/50 text-teal-400 hover:bg-teal-500/20"}`}
        >
          <RefreshCw
            size={16}
            className={isFixingRosters ? "animate-spin text-teal-500" : ""}
          />
          {isFixingRosters ? "Deep Syncing..." : "Fix Team Roster Photos"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournamentTeams.map((team) => {
          const dbStats = team.stats || { played: 0, won: 0, lost: 0 };
          const remaining = (team.purse || 0) - (team.spent || 0);
          const spentPercentage =
            team.purse > 0 ? Math.min((team.spent / team.purse) * 100, 100) : 0;
          const displayLogo = team.logo || team.logoUrl;

          return (
            <div
              key={team.id}
              className={`border rounded-[2rem] overflow-hidden shadow-xl flex flex-col h-full group relative ${lightMode ? "bg-white border-gray-200 hover:border-teal-300" : "bg-[#1C2128] border-white/5 hover:border-teal-500/30"}`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPosterTeam(team);
                }}
                className={`absolute top-5 right-5 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all border active:scale-95 shadow-lg ${lightMode ? "bg-white hover:bg-teal-600 text-gray-400 hover:text-white border-gray-200" : "bg-white/5 hover:bg-teal-600 text-slate-400 hover:text-white border-white/5"}`}
              >
                <Share2 size={14} />
              </button>

              <div className="p-6 pb-4 flex items-center gap-4">
                <div className="relative">
                  {displayLogo ? (
                    <img
                      src={displayLogo}
                      className={`w-16 h-16 rounded-2xl object-cover border shadow-2xl ${lightMode ? "bg-white border-gray-200" : "bg-black border-white/5"}`}
                      alt={team.name}
                    />
                  ) : (
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${lightMode ? "bg-gray-100 border-gray-200" : "bg-slate-800 border-white/10"}`}
                    >
                      <Shield size={32} className="text-gray-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 z-20 bg-teal-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md border border-teal-400/50">
                    {team.roster?.length || 0}
                  </div>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <h3
                    className={`text-xl font-black truncate italic uppercase tracking-tight leading-tight ${theme.text}`}
                  >
                    {team.name}
                  </h3>
                  {isAuctionEnabled && (
                    <p
                      className={`text-xs font-bold truncate mt-0.5 flex items-center gap-1.5 ${lightMode ? "text-amber-600" : "text-amber-500/80"}`}
                    >
                      <Crown size={12} /> {team.ownerName || "No Owner"}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-[9px] border px-2 py-0.5 rounded font-mono shadow-sm ${lightMode ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-white/5 text-slate-400 border-white/5"}`}
                    >
                      P: {dbStats.played}
                    </span>
                    {dbStats.won > 0 && (
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold border shadow-sm ${lightMode ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-teal-900/30 text-teal-400 border-teal-500/20"}`}
                      >
                        W: {dbStats.won}
                      </span>
                    )}
                    {dbStats.lost > 0 && (
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold border shadow-sm ${lightMode ? "bg-red-100 text-red-700 border-red-200" : "bg-red-900/30 text-red-400 border-red-500/20"}`}
                      >
                        L: {dbStats.lost}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isAuctionEnabled && (
                <div className="px-6 py-2">
                  <div className="flex justify-between text-[10px] font-black uppercase mb-1 tracking-widest">
                    <span className={theme.sub}>Auction Budget</span>
                    <span
                      className={
                        remaining < 0 ? "text-red-500" : "text-teal-500"
                      }
                    >
                      {Math.round(spentPercentage)}%
                    </span>
                  </div>
                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden flex shadow-inner ${lightMode ? "bg-gray-200" : "bg-white/5"}`}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-1000 shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                      style={{ width: `${spentPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="p-6 flex-1">
                <div className="flex flex-wrap gap-2">
                  {team.roster?.slice(0, 6).map((player, i) => {
                    const hydrated =
                      masterPlayersMap[player.originalPlayerId] ||
                      masterPlayersMap[player.userId] ||
                      masterPlayersMap[player.id] ||
                      masterPlayersMap[normalize(player.name)] ||
                      player;
                    const bestPhoto = getBestPhoto(player, hydrated);

                    return (
                      <div
                        key={i}
                        className="relative cursor-pointer hover:scale-110 transition-transform group/player shadow-lg"
                        onClick={() => setSelectedPlayer(hydrated)}
                      >
                        <PlayerAvatar
                          player={hydrated}
                          playerId={
                            hydrated.originalPlayerId ||
                            hydrated.id ||
                            player.id
                          }
                          photoURL={bestPhoto}
                          tournamentId={safeTournamentId}
                          className={`w-10 h-10 rounded-xl object-cover border grayscale group-hover/player:grayscale-0 transition-all duration-300 ${lightMode ? "bg-white border-gray-200" : "bg-black border-white/10"}`}
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
                    );
                  })}
                  {team.roster?.length > 6 && (
                    <div
                      onClick={() => setViewingTeamStats(team)}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors shadow-md ${lightMode ? "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200" : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"}`}
                    >
                      +{team.roster.length - 6}
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`p-4 mt-auto flex justify-center border-t transition-colors ${lightMode ? "bg-gray-50 border-gray-200 group-hover:bg-gray-100" : "bg-[#161920] border-white/5 group-hover:bg-[#1c2128]"}`}
              >
                <button
                  onClick={() => setViewingTeamStats(team)}
                  className={`text-[10px] font-black uppercase tracking-widest hover:text-teal-500 transition-all flex items-center gap-2 group/btn ${theme.sub}`}
                >
                  View Team Analysis{" "}
                  <span className="text-teal-500 group-hover/btn:translate-x-1 transition-transform inline-block">
                    →
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <PlayerProfileModal
        player={selectedPlayer}
        isOpen={!!selectedPlayer}
        matches={matches}
        onClose={() => setSelectedPlayer(null)}
        tournamentId={safeTournamentId}
        masterPlayersMap={masterPlayersMap}
      />
      <TeamStatsModal
        team={viewingTeamStats}
        matches={matches}
        isOpen={!!viewingTeamStats}
        onClose={() => setViewingTeamStats(null)}
        isAuctionEnabled={isAuctionEnabled}
        masterPlayersMap={masterPlayersMap}
        onForceSync={syncPostAuctionRosters}
        isFixingRosters={isFixingRosters}
      />
      <TeamPosterModal
        team={posterTeam}
        isOpen={!!posterTeam}
        onClose={() => setPosterTeam(null)}
        tournamentName={displayName}
        isAuctionEnabled={isAuctionEnabled}
        tournamentId={safeTournamentId}
        masterPlayersMap={masterPlayersMap}
      />
    </div>
  );
}
