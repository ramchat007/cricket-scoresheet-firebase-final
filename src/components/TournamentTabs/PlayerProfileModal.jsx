import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { doc, collection, onSnapshot, getDocs } from "firebase/firestore";
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
} from "lucide-react";

export default function PlayerProfileModal({
  player,
  isOpen,
  onClose,
  matches: propMatches,
  isAuctionEnabled,
}) {
  const { tournamentId } = useParams();

  // 🟢 1. Extract theme purely (no lightMode)
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";

  const [livePlayer, setLivePlayer] = useState(null);
  const [fetchedMatches, setFetchedMatches] = useState([]);

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

  // 2. CALCULATE STATS (Aggregated Only)
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
        // Batting
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
        // Bowling
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

  if (!isOpen || !player) return null;

  const displayData = livePlayer || player || {};
  const finalPrice = displayData.soldPrice || displayData.price || 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* ✅ COMPACT CONTAINER - Unified Glassmorphism Theme */}
      <div
        className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh] transition-colors duration-300 ${theme?.card || "bg-black/90 border border-white/10"}`}>
        {/* --- LEFT: PROFILE & AUCTION --- */}
        <div
          // 🟢 Dynamic background adapts perfectly via bg-current/5
          className={`w-full md:w-5/12 p-5 flex flex-col items-center border-r border-current/10 relative overflow-y-auto custom-scrollbar bg-current/5`}>
          {/* PHOTO & NAME */}
          <div className="relative mb-4 group">
            <PlayerAvatar
              player={player}
              playerId={player.id || player.originalId}
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
            className={`text-lg font-black uppercase italic tracking-tighter text-center leading-none mb-1 ${textMain}`}>
            {displayData.name}
          </h2>
          <p
            className={`font-bold uppercase tracking-widest text-[9px] ${isAuctionEnabled ? "mb-6" : "mb-2"} text-teal-500`}>
            {displayData.role || "Player"}
          </p>

          {/* 🔥 AUCTION SECTION: ONLY show if auction is enabled */}
          {isAuctionEnabled && (
            <>
              <div className="w-full space-y-2 relative z-10 mb-6">
                <div
                  className={`flex justify-between items-center p-2 rounded-lg border border-current/10 bg-current/5`}>
                  <span className={`text-[9px] font-bold uppercase ${textSub}`}>
                    Status
                  </span>
                  <span
                    className={`text-xs font-black ${finalPrice > 0 ? "text-teal-500" : textSub}`}>
                    {finalPrice > 0 ? "SOLD" : "UNSOLD"}
                  </span>
                </div>
                <div
                  className={`flex justify-between items-center p-2 rounded-lg border border-current/10 bg-current/5`}>
                  <span className={`text-[9px] font-bold uppercase ${textSub}`}>
                    Price
                  </span>
                  <span className={`text-sm font-mono font-black ${textMain}`}>
                    ₹{" "}
                    {finalPrice > 0
                      ? finalPrice.toLocaleString()
                      : displayData.basePrice?.toLocaleString() || "0"}
                  </span>
                </div>
              </div>

              {/* BID HISTORY */}
              <div
                className={`w-full border-t pt-4 text-left flex-1 border-current/10`}>
                <h3
                  className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${textSub}`}>
                  <Gavel size={12} /> Bid History
                </h3>
                <div
                  className={`space-y-4 relative before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-current/20`}>
                  <div className="relative pl-5">
                    <div
                      className={`absolute left-0 top-1 w-4 h-4 rounded-full z-10 flex items-center justify-center border-2 bg-teal-500 border-transparent text-white shadow-md`}>
                      <span className="text-[8px]">✓</span>
                    </div>
                    <p
                      className={`text-[9px] font-bold leading-none text-teal-500`}>
                      Sold
                    </p>
                    <p className={`text-[10px] ${textSub}`}>
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
                              className={`absolute left-1 top-1.5 w-1.5 h-1.5 rounded-full z-10 bg-current/30`}></div>
                            <div className="flex justify-between w-full">
                              <span
                                className={`text-[9px] font-bold truncate w-20 ${textSub}`}>
                                {entry.bidderName}
                              </span>
                              <span
                                className={`text-[9px] font-mono ${textMain}`}>
                                ₹{entry.bid?.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="relative pl-5">
                        <p className={`text-[9px] italic ${textSub}`}>
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
          className={`flex-1 p-5 overflow-y-auto custom-scrollbar bg-transparent`}>
          <div className="flex justify-between items-center mb-6">
            <h3
              className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${textSub}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Tournament Stats
            </h3>
            <button
              onClick={onClose}
              // 🟢 Smart hover states adapted for all themes
              className={`w-6 h-6 flex items-center justify-center rounded-full transition-all text-xs bg-current/10 hover:bg-current/20 text-inherit opacity-70 hover:opacity-100`}>
              <X size={14} />
            </button>
          </div>

          {/* 1. KEY METRICS */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <StatBox label="Mat" value={stats.matches} theme={theme} />
            <StatBox
              label="Runs"
              value={stats.runs}
              color="text-teal-500"
              theme={theme}
            />
            <StatBox
              label="Wkts"
              value={stats.wickets}
              color="text-purple-500"
              theme={theme}
            />
            <StatBox label="HS" value={stats.highScore} theme={theme} />
          </div>

          <div className="flex flex-col gap-4">
            {/* 2. BATTING CARD */}
            <div
              className={`border rounded-2xl p-4 bg-current/5 border-current/10`}>
              <h4
                className={`text-[9px] font-black uppercase mb-3 flex items-center gap-2 ${textSub}`}>
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

            {/* 3. BOWLING CARD (Conditional) */}
            {(stats.wickets > 0 || parseFloat(stats.economy) > 0) && (
              <div
                className={`border rounded-2xl p-4 bg-current/5 border-current/10`}>
                <h4
                  className={`text-[9px] font-black uppercase mb-3 flex items-center gap-2 ${textSub}`}>
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

// Compact Stat Box (Removed lightMode)
function StatBox({ label, value, color, theme }) {
  const finalColor = color || theme?.text || "text-white";
  return (
    <div
      className={`p-2 rounded-xl border border-current/10 text-center bg-current/5`}>
      <p
        className={`text-[8px] font-bold uppercase ${theme?.sub || "text-gray-400"}`}>
        {label}
      </p>
      <p className={`text-lg font-black italic leading-tight ${finalColor}`}>
        {value}
      </p>
    </div>
  );
}

// Mini Stat Row
function MiniStat({ label, val, theme }) {
  return (
    <div>
      <p
        className={`text-[8px] uppercase tracking-wide mb-0.5 ${theme?.sub || "text-gray-400"}`}>
        {label}
      </p>
      <p className={`text-sm font-bold ${theme?.text || "text-white"}`}>
        {val}
      </p>
    </div>
  );
}
