import React from "react";

export default function MatchInfo({ match }) {
  if (!match) return null;

  const meta = match.meta || {};
  const currentInn = match.innings?.[match.currentInnings || 0] || {};

  // --- 1. UTILITIES ---
  const formatDate = (dateStr) => {
    if (!dateStr) return "Date TBA";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? dateStr
      : date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  };

  const cleanName = (p) => (typeof p === "object" ? p.name : p) || "Unknown";

  // ✅ Get playing status for squad members
  const getPlayerBadge = (name) => {
    const n = cleanName(name);
    if (
      n === cleanName(currentInn.striker) ||
      n === cleanName(currentInn.nonStriker)
    ) {
      return (
        <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded border border-teal-500/20 font-black ml-auto">
          ON FIELD
        </span>
      );
    }
    const stats = currentInn.batsmenStats?.[n];
    if (stats?.out) {
      return (
        <span className="text-[8px] bg-red-500/10 text-red-400/60 px-1.5 py-0.5 rounded border border-red-500/10 font-bold ml-auto uppercase">
          Out
        </span>
      );
    }
    return null;
  };

  const InfoRow = ({ label, value, icon }) => (
    <div className="flex items-center justify-between p-4 bg-[#161920] rounded-xl border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex items-center gap-3">
        <span className="text-xl opacity-60 group-hover:scale-110 transition-transform">
          {icon}
        </span>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300">
          {label}
        </span>
      </div>
      <div className="text-slate-200 font-bold text-right text-sm tracking-tight">
        {value || "N/A"}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20 px-2 sm:px-0">
      {/* 1. MATCH ARCHIVE CARD */}
      <div className="bg-[#1C2128] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
          <span className="text-xl">📋</span>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            General Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow
            label="Series"
            value={meta.tournament?.name || "Exhibition"}
            icon="🏆"
          />
          <InfoRow
            label="Fixture Date"
            value={formatDate(match.date || meta.date)}
            icon="📅"
          />
          <InfoRow
            label="Match Format"
            value={`${meta.overs || "?"} Overs`}
            icon="🏏"
          />
          <InfoRow
            label="Arena"
            value={meta.location || meta.venue || "Neutral Ground"}
            icon="📍"
          />
          <InfoRow
            label="The Toss"
            value={
              meta.toss
                ? `${meta.toss.winner} (Chose to ${meta.toss.decision})`
                : "Yet to happen"
            }
            icon="🪙"
          />
          <InfoRow
            label="Match Level"
            value={meta.matchType || "Standard"}
            icon="⚡"
          />
        </div>
      </div>

      {/* 2. SQUADS & STATUS CARD */}
      <div className="bg-[#1C2128] border border-white/5 rounded-3xl p-6 shadow-2xl relative">
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
          <span className="text-xl">⚔️</span>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Active Playing Squads
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TEAM A */}
          <div className="space-y-4">
            <div className="bg-teal-500/10 p-3 rounded-xl border border-teal-500/20 flex justify-between items-center">
              <span className="text-teal-400 font-black uppercase text-xs tracking-tighter">
                {meta.teamA}
              </span>
              <span className="text-[10px] text-teal-600 font-bold uppercase">
                {match.teamASquad?.length || 0} Players
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(match.teamASquad || []).map((p, i) => (
                <div
                  key={i}
                  className="bg-black/20 p-3 rounded-lg flex items-center border border-white/5 hover:bg-black/40 transition-colors group">
                  <span className="text-slate-600 text-[10px] font-mono w-5">
                    {i + 1}
                  </span>
                  <span className="text-slate-300 text-sm font-semibold group-hover:text-white transition-colors">
                    {cleanName(p)}
                  </span>
                  {getPlayerBadge(p)}
                </div>
              ))}
            </div>
          </div>

          {/* TEAM B */}
          <div className="space-y-4">
            <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 flex justify-between items-center">
              <span className="text-indigo-400 font-black uppercase text-xs tracking-tighter">
                {meta.teamB}
              </span>
              <span className="text-[10px] text-indigo-600 font-bold uppercase">
                {match.teamBSquad?.length || 0} Players
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(match.teamBSquad || []).map((p, i) => (
                <div
                  key={i}
                  className="bg-black/20 p-3 rounded-lg flex items-center border border-white/5 hover:bg-black/40 transition-colors group">
                  <span className="text-slate-600 text-[10px] font-mono w-5">
                    {i + 1}
                  </span>
                  <span className="text-slate-300 text-sm font-semibold group-hover:text-white transition-colors">
                    {cleanName(p)}
                  </span>
                  {getPlayerBadge(p)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MATCH OFFICIALS (Optional High-End Addition) */}
      {(meta.umpires || meta.referee) && (
        <div className="bg-[#161920] border border-white/5 rounded-2xl p-5 flex flex-wrap gap-6 justify-center shadow-lg">
          {meta.umpires && (
            <div className="text-center">
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                Umpires
              </div>
              <div className="text-xs text-slate-300 font-bold">
                {meta.umpires}
              </div>
            </div>
          )}
          {meta.referee && (
            <div className="text-center">
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                Match Referee
              </div>
              <div className="text-xs text-slate-300 font-bold">
                {meta.referee}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
