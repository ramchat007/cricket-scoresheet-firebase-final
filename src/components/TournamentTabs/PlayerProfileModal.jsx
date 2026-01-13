import React from "react";

export default function PlayerProfileModal({ player, isOpen, onClose }) {
  if (!isOpen || !player) return null;

  // Mock stats - in a real app, these would come from player.stats
  const stats = player.stats || {
    matches: 0,
    runs: 0,
    wickets: 0,
    sr: 0,
    avg: 0,
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8 bg-[#0F1115]/95 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Close Background */}
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="relative bg-[#1C2128] border border-white/10 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Side: Identity & Image */}
        <div className="w-full md:w-2/5 bg-[#161920] p-8 flex flex-col items-center border-b md:border-b-0 md:border-r border-white/5">
          <div className="relative mb-6">
            <img
              src={
                player.photoURL ||
                `https://ui-avatars.com/api/?name=${player.name}`
              }
              className="w-40 h-40 md:w-48 md:h-48 rounded-[2.5rem] object-cover border-4 border-teal-500/20 shadow-2xl"
              alt={player.name}
            />
            {player.isIcon && (
              <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-xl rotate-12">
                ⭐ ICON
              </div>
            )}
          </div>

          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter text-center leading-tight">
            {player.name}
          </h2>
          <p className="text-teal-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">
            {player.role || "All-Rounder"}
          </p>

          <div className="mt-8 w-full space-y-3">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] font-black text-slate-500 uppercase">
                Auction Price
              </span>
              <span className="text-sm font-mono font-bold text-white">
                ₹{player.soldPrice?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] font-black text-slate-500 uppercase">
                Base Price
              </span>
              <span className="text-sm font-mono font-bold text-slate-400">
                ₹{player.basePrice?.toLocaleString() || "100"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Stats & History */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Career Analytics
            </h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors">
              ✕
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            {[
              { label: "Matches", val: stats.matches },
              { label: "Strike Rate", val: stats.sr, color: "text-orange-400" },
              { label: "Avg", val: stats.avg, color: "text-teal-400" },
              { label: "Runs", val: stats.runs },
            ].map((s, i) => (
              <div
                key={i}
                className="bg-[#0F1115] p-4 rounded-3xl border border-white/5">
                <p className="text-[9px] font-black text-slate-600 uppercase mb-1">
                  {s.label}
                </p>
                <p
                  className={`text-xl font-black italic tracking-tighter ${
                    s.color || "text-white"
                  }`}>
                  {s.val}
                </p>
              </div>
            ))}
          </div>

          {/* Auction History Timeline - Dynamic Version */}
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">
            Bidding Journey
          </h3>

          <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {/* 1. The Final Result (Top) */}
            <div className="relative pl-8">
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-teal-500 border-4 border-[#1C2128] z-10 flex items-center justify-center">
                <span className="text-[10px]">🔨</span>
              </div>
              <p className="text-[10px] font-black text-teal-500 uppercase">
                Hammer Price
              </p>
              <p className="text-sm font-bold text-slate-100">
                Sold for ₹{player.soldPrice?.toLocaleString()}
              </p>
            </div>

            {/* 2. The Bidding War (Middle) */}
            {player.bidHistory && player.bidHistory.length > 0 ? (
              [...player.bidHistory].reverse().map((entry, idx) => (
                <div key={idx} className="relative pl-8">
                  <div className="absolute left-2.5 top-2 w-1.5 h-1.5 rounded-full bg-white/20 z-10"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase">
                        {entry.bidderName || "Unknown Team"}
                      </p>
                      <p className="text-xs font-bold text-slate-400">
                        Raised to ₹{entry.bid?.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[8px] text-slate-700 font-mono">
                      #{player.bidHistory.length - idx}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="relative pl-8">
                <div className="absolute left-2.5 top-2 w-1.5 h-1.5 rounded-full bg-white/10 z-10"></div>
                <p className="text-xs italic text-slate-600">
                  No bidding war recorded.
                </p>
              </div>
            )}

            {/* 3. The Opening (Bottom) */}
            <div className="relative pl-8">
              <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-700 border-2 border-[#1C2128] z-10"></div>
              <p className="text-[10px] font-black text-slate-600 uppercase">
                Opening
              </p>
              <p className="text-xs font-bold text-slate-500">
                Base Price: ₹{player.basePrice?.toLocaleString() || "100"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
