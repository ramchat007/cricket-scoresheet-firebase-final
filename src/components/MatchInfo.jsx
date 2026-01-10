import React from "react";

export default function MatchInfo({ match }) {
  if (!match) return null;

  const meta = match.meta || {};

  // Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Date TBA";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const InfoRow = ({ label, value, icon }) => (
    <div className="flex items-center justify-between p-4 bg-[#161920] rounded-xl border border-white/5 hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-3">
        <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0">{icon}</span>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">
          {label}
        </span>
      </div>
      <div className="text-slate-200 font-medium text-right font-mono text-sm">
        {value || "N/A"}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-10">
      
      {/* 1. MATCH DETAILS CARD */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <span className="text-lg">ℹ️</span>
            <h3 className="text-lg font-bold text-slate-100">Match Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoRow
            label="Tournament"
            value={meta.tournament || "Friendly Match"}
            icon="🏆"
          />
          <InfoRow
            label="Date"
            value={formatDate(match.date || meta.date)}
            icon="📅"
          />
          <InfoRow
            label="Format"
            value={`${meta.overs || "?"} Overs`}
            icon="🏏"
          />
          <InfoRow
            label="Venue"
            value={meta.location || meta.venue || "TBA"}
            icon="📍"
          />
          <InfoRow
            label="Toss"
            value={
              meta.toss
                ? `${meta.toss.winner} opted to ${meta.toss.decision}`
                : "Pending"
            }
            icon="🪙"
          />
          <InfoRow
            label="Status"
            value={match.status || meta.status || "Scheduled"}
            icon="📊"
          />
        </div>
      </div>

      {/* 2. SQUADS CARD */}
      <div className="bg-[#1C2128] border border-white/5 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <span className="text-lg">👥</span>
            <h3 className="text-lg font-bold text-slate-100">Playing Squads</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Team A */}
          <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5">
            <div className="text-teal-400 font-black uppercase tracking-widest text-xs mb-4 border-l-4 border-teal-500 pl-3 py-1">
              {meta.teamA || "Team A"}
            </div>
            <ul className="space-y-2">
              {(match.teamASquad || []).map((p, i) => (
                <li key={i} className="text-slate-300 text-sm flex items-center gap-3 hover:bg-white/5 p-1.5 rounded transition-colors">
                  <span className="text-slate-600 text-[10px] font-mono w-4 text-right">{i + 1}.</span>
                  <span className="font-medium">{typeof p === "object" ? p.name : p}</span>
                </li>
              ))}
              {(!match.teamASquad || match.teamASquad.length === 0) && (
                <li className="text-slate-600 italic text-sm p-2">No squad listed</li>
              )}
            </ul>
          </div>

          {/* Team B */}
          <div className="bg-[#0F1115] p-4 rounded-xl border border-white/5">
            <div className="text-indigo-400 font-black uppercase tracking-widest text-xs mb-4 border-l-4 border-indigo-500 pl-3 py-1">
              {meta.teamB || "Team B"}
            </div>
            <ul className="space-y-2">
              {(match.teamBSquad || []).map((p, i) => (
                <li key={i} className="text-slate-300 text-sm flex items-center gap-3 hover:bg-white/5 p-1.5 rounded transition-colors">
                  <span className="text-slate-600 text-[10px] font-mono w-4 text-right">{i + 1}.</span>
                  <span className="font-medium">{typeof p === "object" ? p.name : p}</span>
                </li>
              ))}
              {(!match.teamBSquad || match.teamBSquad.length === 0) && (
                <li className="text-slate-600 italic text-sm p-2">No squad listed</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}