import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  collection,
  onSnapshot,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import PlayerAvatar from "../PlayerAvatar";
import {
  X,
  Crown,
  Gavel,
  TrendingUp,
  Activity,
  Award,
  Zap,
  Target,
  RefreshCw,
} from "lucide-react";

const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();

export default function PlayerProfileModal({
  player,
  isOpen,
  onClose,
  matches: propMatches,
  isAuctionEnabled,
  masterPlayersMap = {},
  tournamentId: propTournamentId, // 🟢 1. Accept the prop passed from TeamsTab
}) {
  const { id: urlId } = useParams(); // 🟢 2. Safely grab 'id' from URL if needed

  // 🟢 3. Create a bulletproof tournamentId
  const tournamentId = propTournamentId || urlId;

  const { theme, lightMode } = useTheme();
  const [livePlayer, setLivePlayer] = useState(null);
  const [fetchedMatches, setFetchedMatches] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const matches = propMatches || fetchedMatches;

  // 1. FETCH LIVE DATA
  useEffect(() => {
    if (!isOpen || !player || !player.id || !tournamentId) return;

    const playerRef = doc(
      db,
      "tournaments",
      tournamentId,
      "players",
      player.id,
    );
    const unsubPlayer = onSnapshot(playerRef, (docSnap) => {
      if (docSnap.exists()) {
        setLivePlayer({ id: docSnap.id, ...docSnap.data() });
      }
    });

    if (!propMatches) {
      const matchesRef = collection(db, "tournaments", tournamentId, "matches");
      getDocs(matchesRef).then((snap) => {
        const mList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFetchedMatches(mList);
      });
    }
    return () => unsubPlayer();
  }, [isOpen, player, tournamentId, propMatches]);

  // 2. CALCULATE STATS
  const stats = useMemo(() => {
    const data = livePlayer || player || {};
    const playerName = (data.name || "").trim();

    const res = {
      matches: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      runsConceded: 0,
      ballsBowled: 0,
      highScore: 0,
      notOuts: 0,
      innings: 0,
    };
    if (!matches || matches.length === 0) return res;

    matches.forEach((m) => {
      const innList = m.innings
        ? Array.isArray(m.innings)
          ? m.innings
          : Object.values(m.innings)
        : [];
      let playedInMatch = false;

      innList.forEach((inn) => {
        if (!inn) return;
        if (inn.batsmenStats && inn.batsmenStats[playerName]) {
          const s = inn.batsmenStats[playerName];
          if (s.balls > 0 || s.out) {
            playedInMatch = true;
            res.innings++;
            res.runs += s.runs || 0;
            res.balls += s.balls || 0;
            res.fours += s.fours || 0;
            res.sixes += s.sixes || 0;
            if (!s.out) res.notOuts++;
            if ((s.runs || 0) > res.highScore) res.highScore = s.runs || 0;
          }
        }
        if (inn.bowlerStats && inn.bowlerStats[playerName]) {
          const s = inn.bowlerStats[playerName];
          if (s.balls > 0) {
            playedInMatch = true;
            res.wickets += s.wickets || 0;
            res.runsConceded += s.runs || 0;
            res.ballsBowled += s.balls || 0;
          }
        }
      });
      if (playedInMatch) res.matches++;
    });

    res.avg =
      res.innings - res.notOuts > 0
        ? (res.runs / (res.innings - res.notOuts)).toFixed(1)
        : res.runs > 0
          ? res.runs
          : "0.0";
    res.sr = res.balls > 0 ? ((res.runs / res.balls) * 100).toFixed(0) : "0";
    const overs = res.ballsBowled / 6;
    res.economy = overs > 0 ? (res.runsConceded / overs).toFixed(1) : "0.0";

    return res;
  }, [livePlayer, player, matches]);

  // 🟢 INDIVIDUAL FORCE SYNC FUNCTION
  // 🟢 INDIVIDUAL FORCE SYNC FUNCTION (UPGRADED)
  const forceSyncPhoto = async () => {
    setIsSyncing(true);
    try {
      let foundPhoto = "";

      // 1. Check Global Database
      const globalSnap = await getDocs(collection(db, "players"));
      globalSnap.forEach((d) => {
        const data = d.data();
        if (
          d.id === player.originalPlayerId ||
          d.id === player.id ||
          normalize(data.name) === normalize(player.name)
        ) {
          const photo = data.photoURL || data.image || data.profilePic;
          if (photo && photo.trim() !== "") foundPhoto = photo;
        }
      });

      // 2. Check Local Auction Database (Where your photos usually hide!)
      if (!foundPhoto) {
        const auctionSnap = await getDocs(
          collection(db, "tournaments", tournamentId, "auctionPlayers"),
        );
        auctionSnap.forEach((d) => {
          const data = d.data();
          if (
            d.id === player.originalPlayerId ||
            d.id === player.id ||
            normalize(data.name) === normalize(player.name)
          ) {
            const photo = data.photoURL || data.image || data.profilePic;
            if (photo && photo.trim() !== "") foundPhoto = photo;
          }
        });
      }

      // 3. Absolute Fallback to the Master UI Map
      if (!foundPhoto) {
        const hydrated =
          masterPlayersMap[player.originalPlayerId] ||
          masterPlayersMap[player.id] ||
          masterPlayersMap[normalize(player.name)];
        foundPhoto =
          hydrated?.photoURL || hydrated?.image || hydrated?.profilePic || "";
      }

      // 4. If we found it, patch it EVERYWHERE
      if (foundPhoto && foundPhoto.trim() !== "") {
        // A. Patch local tournament player
        await updateDoc(
          doc(db, "tournaments", tournamentId, "players", player.id),
          { photoURL: foundPhoto },
        ).catch(() => console.log("Not in players sub"));

        // B. Patch auction player
        await updateDoc(
          doc(db, "tournaments", tournamentId, "auctionPlayers", player.id),
          { photoURL: foundPhoto },
        ).catch(() => console.log("Not in auction sub"));

        // C. Patch the Team Roster array directly!
        const teamsSnap = await getDocs(
          collection(db, "tournaments", tournamentId, "teams"),
        );
        teamsSnap.forEach(async (teamDoc) => {
          const tData = teamDoc.data();
          let rosterUpdated = false;

          const newRoster = (tData.roster || []).map((p) => {
            if (
              p.id === player.id ||
              p.originalPlayerId === player.id ||
              normalize(p.name) === normalize(player.name)
            ) {
              rosterUpdated = true;
              return { ...p, photoURL: foundPhoto };
            }
            return p;
          });

          if (rosterUpdated) {
            await updateDoc(
              doc(db, "tournaments", tournamentId, "teams", teamDoc.id),
              { roster: newRoster },
            );
          }
        });

        alert("✅ Photo successfully found and synced to the database!");
      } else {
        alert(
          "⚠️ Could not find a photo for this player anywhere in the system.",
        );
      }
    } catch (error) {
      console.error(error);
      alert("Failed to sync photo. Check console.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen || !player) return null;

  const hydratedPlayer =
    masterPlayersMap[player.originalPlayerId] ||
    masterPlayersMap[player.id] ||
    masterPlayersMap[normalize(player.name)] ||
    player;
  const displayData = livePlayer || hydratedPlayer || {};
  const finalPrice = displayData.soldPrice || displayData.price || 0;

  // 🟢 CRITICAL FIX: Force the photoURL to fall back correctly so livePlayer doesn't hide it
  const finalPhotoURL =
    livePlayer?.photoURL ||
    livePlayer?.image ||
    hydratedPlayer?.photoURL ||
    hydratedPlayer?.image ||
    player?.photoURL ||
    player?.image;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div
        className={`relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh] transition-colors duration-300 ${theme.card} ${lightMode ? "border border-gray-200" : "border border-white/10"}`}
      >
        {/* --- LEFT: PROFILE & AUCTION --- */}
        <div
          className={`w-full md:w-5/12 p-5 flex flex-col items-center border-r relative overflow-y-auto custom-scrollbar ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}
        >
          <div className="relative mb-4 group">
            <PlayerAvatar
              player={displayData}
              playerId={displayData.originalPlayerId || displayData.id}
              photoURL={finalPhotoURL} // 🟢 Using the ultra-forced photo URL
              tournamentId={tournamentId}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-white/10 shadow-2xl z-10"
            />
            {(displayData.isIcon || displayData.role === "Captain") && (
              <div className="absolute -top-2 -right-2 z-20 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-md rotate-12 border border-white/20 flex items-center gap-1">
                <Crown size={8} /> {displayData.isIcon ? "ICON" : "CAPT"}
              </div>
            )}
          </div>

          <h2
            className={`text-lg font-black uppercase italic tracking-tighter text-center leading-none mb-1 ${theme.text}`}
          >
            {displayData.name}
          </h2>
          <p
            className={`font-bold uppercase tracking-widest text-[9px] mb-2 ${lightMode ? "text-teal-600" : "text-teal-500"}`}
          >
            {displayData.role || "Player"}
          </p>

          {/* 🟢 NEW: SYNC BUTTON FOR THIS SPECIFIC PLAYER */}
          {/* <button
            onClick={forceSyncPhoto}
            disabled={isSyncing}
            className={`mb-6 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${lightMode ? "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100" : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"}`}
          >
            <RefreshCw
              size={10}
              className={isSyncing ? "animate-spin text-teal-500" : ""}
            />
            {isSyncing ? "Syncing..." : "Sync Global Photo"}
          </button> */}

          {isAuctionEnabled && (
            <>
              <div className="w-full space-y-2 relative z-10 mb-6">
                <div
                  className={`flex justify-between items-center p-2 rounded-lg border ${lightMode ? "bg-white border-gray-200" : "bg-white/5 border-white/5"}`}
                >
                  <span
                    className={`text-[9px] font-bold uppercase ${theme.sub}`}
                  >
                    Status
                  </span>
                  <span
                    className={`text-xs font-black ${finalPrice > 0 ? (lightMode ? "text-teal-600" : "text-teal-400") : theme.sub}`}
                  >
                    {finalPrice > 0 ? "SOLD" : "UNSOLD"}
                  </span>
                </div>
                <div
                  className={`flex justify-between items-center p-2 rounded-lg border ${lightMode ? "bg-white border-gray-200" : "bg-white/5 border-white/5"}`}
                >
                  <span
                    className={`text-[9px] font-bold uppercase ${theme.sub}`}
                  >
                    Price
                  </span>
                  <span
                    className={`text-sm font-mono font-black ${theme.text}`}
                  >
                    ₹{" "}
                    {finalPrice > 0
                      ? finalPrice.toLocaleString()
                      : displayData.basePrice?.toLocaleString() || "0"}
                  </span>
                </div>
              </div>

              {/* BID HISTORY */}
              <div
                className={`w-full border-t pt-4 text-left flex-1 ${lightMode ? "border-gray-200" : "border-white/5"}`}
              >
                <h3
                  className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${theme.sub}`}
                >
                  <Gavel size={12} /> Bid History
                </h3>
                <div
                  className={`space-y-4 relative before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px ${lightMode ? "before:bg-gray-200" : "before:bg-white/10"}`}
                >
                  <div className="relative pl-5">
                    <div
                      className={`absolute left-0 top-1 w-4 h-4 rounded-full z-10 flex items-center justify-center border-2 ${lightMode ? "bg-teal-500 border-white text-white" : "bg-teal-600 border-[#161920]"}`}
                    >
                      <span className="text-[8px]">✓</span>
                    </div>
                    <p
                      className={`text-[9px] font-bold leading-none ${lightMode ? "text-teal-600" : "text-teal-500"}`}
                    >
                      Sold
                    </p>
                    <p className={`text-[10px] ${theme.sub}`}>
                      ₹{finalPrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="max-h-[100px] overflow-y-auto no-scrollbar space-y-4">
                    {displayData.bidHistory?.length > 0 ? (
                      [...displayData.bidHistory]
                        .reverse()
                        .map((entry, idx) => (
                          <div key={idx} className="relative pl-5">
                            <div
                              className={`absolute left-1 top-1.5 w-1.5 h-1.5 rounded-full z-10 ${lightMode ? "bg-gray-300" : "bg-white/20"}`}
                            ></div>
                            <div className="flex justify-between w-full">
                              <span
                                className={`text-[9px] font-bold truncate w-20 ${theme.sub}`}
                              >
                                {entry.bidderName}
                              </span>
                              <span
                                className={`text-[9px] font-mono ${theme.text}`}
                              >
                                ₹{entry.bid?.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="relative pl-5">
                        <p className={`text-[9px] italic ${theme.sub}`}>
                          No Bids
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* --- RIGHT: PURE STATS DASHBOARD --- */}
        <div
          className={`flex-1 p-5 overflow-y-auto custom-scrollbar ${lightMode ? "bg-white" : "bg-[#1C2128]"}`}
        >
          <div className="flex justify-between items-center mb-6">
            <h3
              className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.sub}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Tournament Stats
            </h3>
            <button
              onClick={onClose}
              className={`w-6 h-6 flex items-center justify-center rounded-full transition-all text-xs ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-500" : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"}`}
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            <StatBox
              label="Mat"
              value={stats.matches}
              lightMode={lightMode}
              theme={theme}
            />
            <StatBox
              label="Runs"
              value={stats.runs}
              color={lightMode ? "text-teal-600" : "text-teal-400"}
              lightMode={lightMode}
              theme={theme}
            />
            <StatBox
              label="Wkts"
              value={stats.wickets}
              color={lightMode ? "text-purple-600" : "text-purple-400"}
              lightMode={lightMode}
              theme={theme}
            />
            <StatBox
              label="HS"
              value={stats.highScore}
              lightMode={lightMode}
              theme={theme}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div
              className={`border rounded-xl p-4 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#13161a] border-white/5"}`}
            >
              <h4
                className={`text-[9px] font-black uppercase mb-3 flex items-center gap-2 ${theme.sub}`}
              >
                <Zap size={10} /> Batting Performance
              </h4>
              <div className="grid grid-cols-3 gap-y-4">
                <MiniStat label="Average" val={stats.avg} theme={theme} />
                <MiniStat label="Strike Rate" val={stats.sr} theme={theme} />
                <MiniStat
                  label="Boundaries (4s/6s)"
                  val={`${stats.fours} / ${stats.sixes}`}
                  theme={theme}
                />
              </div>
            </div>

            {(stats.wickets > 0 || parseFloat(stats.economy) > 0) && (
              <div
                className={`border rounded-xl p-4 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#13161a] border-white/5"}`}
              >
                <h4
                  className={`text-[9px] font-black uppercase mb-3 flex items-center gap-2 ${theme.sub}`}
                >
                  <Target size={10} /> Bowling Performance
                </h4>
                <div className="grid grid-cols-2 gap-y-4">
                  <MiniStat label="Economy" val={stats.economy} theme={theme} />
                  <MiniStat
                    label="Balls Bowled"
                    val={stats.ballsBowled}
                    theme={theme}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, theme, lightMode }) {
  const finalColor = color || theme.text;
  return (
    <div
      className={`p-2 rounded-xl border text-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#13161a] border-white/5"}`}
    >
      <p className={`text-[8px] font-bold uppercase ${theme.sub}`}>{label}</p>
      <p className={`text-lg font-black italic leading-tight ${finalColor}`}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, val, theme }) {
  return (
    <div>
      <p className={`text-[8px] uppercase tracking-wide mb-0.5 ${theme.sub}`}>
        {label}
      </p>
      <p className={`text-sm font-bold ${theme.text}`}>{val}</p>
    </div>
  );
}
