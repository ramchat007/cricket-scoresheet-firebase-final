import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { doc, collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../../utils/firebase";

export default function PlayerProfileModal({
  player,
  isOpen,
  onClose,
  matches: propMatches,
}) {
  const { tournamentId } = useParams();
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#0F1115]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* ✅ COMPACT CONTAINER */}
      <div className="relative bg-[#1C2128] border border-white/10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh]">
        {/* --- LEFT: PROFILE & AUCTION --- */}
        <div className="w-full md:w-5/12 bg-[#161920] p-5 flex flex-col items-center border-r border-white/5 relative overflow-y-auto custom-scrollbar">
          <div className="relative mb-4 group">
            <img
              src={
                displayData.photoURL ||
                `https://ui-avatars.com/api/?name=${displayData.name}&background=0F1115&color=fff`
              }
              className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover border-2 border-[#2d333b] shadow-xl z-10"
              alt={displayData.name}
            />
            {(displayData.isIcon || displayData.role === "Captain") && (
              <div className="absolute -top-2 -right-2 z-20 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-md rotate-12 border border-[#1C2128]">
                {displayData.isIcon ? "ICON" : "CAPT"}
              </div>
            )}
          </div>

          <h2 className="text-lg font-black text-white uppercase italic tracking-tighter text-center leading-none mb-1">
            {displayData.name}
          </h2>
          <p className="text-teal-500 font-bold uppercase tracking-widest text-[9px] mb-6">
            {displayData.role || "Player"}
          </p>

          <div className="w-full space-y-2 relative z-10 mb-6">
            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
              <span className="text-[9px] font-bold text-slate-500 uppercase">
                Status
              </span>
              <span
                className={`text-xs font-black ${finalPrice > 0 ? "text-teal-400" : "text-slate-400"}`}>
                {finalPrice > 0 ? "SOLD" : "UNSOLD"}
              </span>
            </div>
            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
              <span className="text-[9px] font-bold text-slate-500 uppercase">
                Price
              </span>
              <span className="text-sm font-mono font-black text-white">
                ₹
                {finalPrice > 0
                  ? finalPrice.toLocaleString()
                  : displayData.basePrice?.toLocaleString() || "0"}
              </span>
            </div>
          </div>

          {/* COMPACT AUCTION TIMELINE */}
          <div className="w-full border-t border-white/5 pt-4 text-left flex-1">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">
              Bid History
            </h3>
            <div className="space-y-4 relative before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-white/10">
              {/* Final */}
              <div className="relative pl-5">
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-teal-600 border-2 border-[#161920] z-10 flex items-center justify-center">
                  <span className="text-[8px]">🔨</span>
                </div>
                <p className="text-[9px] font-bold text-teal-500 leading-none">
                  Sold
                </p>
                <p className="text-[10px] text-slate-300">
                  ₹{finalPrice.toLocaleString()}
                </p>
              </div>

              {/* Bids */}
              <div className="max-h-[100px] overflow-y-auto no-scrollbar space-y-4">
                {displayData.bidHistory?.length > 0 ? (
                  [...displayData.bidHistory].reverse().map((entry, idx) => (
                    <div key={idx} className="relative pl-5">
                      <div className="absolute left-1 top-1.5 w-1.5 h-1.5 rounded-full bg-white/20 z-10"></div>
                      <div className="flex justify-between w-full">
                        <span className="text-[9px] font-bold text-slate-400 truncate w-20">
                          {entry.bidderName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">
                          ₹{entry.bid?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="relative pl-5">
                    <div className="absolute left-1 top-1.5 w-1.5 h-1.5 rounded-full bg-white/10 z-10"></div>
                    <p className="text-[9px] italic text-slate-600">No Bids</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT: PURE STATS DASHBOARD --- */}
        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-[#1C2128]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Tournament Stats
            </h3>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs">
              ✕
            </button>
          </div>

          {/* 1. KEY METRICS */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <StatBox label="Mat" value={stats.matches} />
            <StatBox label="Runs" value={stats.runs} color="text-teal-400" />
            <StatBox
              label="Wkts"
              value={stats.wickets}
              color="text-purple-400"
            />
            <StatBox label="HS" value={stats.highScore} />
          </div>

          <div className="flex flex-col gap-4">
            {/* 2. BATTING CARD */}
            <div className="bg-[#13161a] border border-white/5 rounded-xl p-4">
              <h4 className="text-[9px] font-black text-slate-600 uppercase mb-3">
                Batting Performance
              </h4>
              <div className="grid grid-cols-3 gap-y-4">
                <MiniStat label="Average" val={stats.avg} />
                <MiniStat label="Strike Rate" val={stats.sr} />
                <MiniStat
                  label="Boundaries (4s/6s)"
                  val={`${stats.fours} / ${stats.sixes}`}
                />
              </div>
            </div>

            {/* 3. BOWLING CARD (Conditional) */}
            {(stats.wickets > 0 || parseFloat(stats.economy) > 0) && (
              <div className="bg-[#13161a] border border-white/5 rounded-xl p-4">
                <h4 className="text-[9px] font-black text-slate-600 uppercase mb-3">
                  Bowling Performance
                </h4>
                <div className="grid grid-cols-2 gap-y-4">
                  <MiniStat label="Economy" val={stats.economy} />
                  <MiniStat label="Balls Bowled" val={stats.ballsBowled} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact Stat Box
function StatBox({ label, value, color = "text-white" }) {
  return (
    <div className="bg-[#13161a] p-2 rounded-xl border border-white/5 text-center">
      <p className="text-[8px] font-bold text-slate-600 uppercase">{label}</p>
      <p className={`text-lg font-black italic leading-tight ${color}`}>
        {value}
      </p>
    </div>
  );
}

// Mini Stat Row
function MiniStat({ label, val }) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-200">{val}</p>
    </div>
  );
}
