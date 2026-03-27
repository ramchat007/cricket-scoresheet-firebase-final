import React from "react";
import { Activity, PlayCircle, PlusCircle, Trophy, Users } from "lucide-react";
import TournamentSelector from "./TournamentSelector";
import MatchSelector from "./MatchSelector";
import { useNavigate } from "react-router-dom";

export default function AdminQuickActions({
  user,
  theme,
  lightMode,
  tournamentId,
  setTournamentId,
  availableTournaments,
  matchId,
  setMatchId,
  navigateToScoring,
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 mb-8">
      {/* 1. WELCOME & SELECTORS */}
      <div
        className={`${theme.card} rounded-3xl p-6 shadow-2xl border ${lightMode ? "border-gray-100" : "border-white/5"}`}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className={`text-2xl font-black ${theme.text} tracking-tight`}>
              Hello, {user?.firstName || user?.email?.split("@")[0]} 👋
            </h1>
            <p
              className={`text-xs mt-1 font-bold uppercase tracking-widest ${theme.sub}`}
            >
              Ready for the next ball?
            </p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Activity size={24} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 rounded-2xl bg-black/5 dark:bg-black/20">
          <TournamentSelector
            tournamentId={tournamentId}
            setTournamentId={setTournamentId}
            availableTournaments={availableTournaments}
          />
          <MatchSelector
            matchId={matchId}
            setMatchId={(id) => {
              setMatchId(id);
              if (id && id !== "new") navigateToScoring(tournamentId, id);
            }}
            tournamentId={tournamentId}
          />
        </div>
      </div>

      {/* 2. SMART ACTION TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() =>
            tournamentId && matchId && matchId !== "new"
              ? navigateToScoring(tournamentId, matchId)
              : alert("Select an active match first.")
          }
          className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group ${lightMode ? "bg-teal-50 border-teal-100 hover:bg-teal-100" : "bg-gradient-to-br from-teal-900/20 to-transparent border-teal-500/20 hover:border-teal-500/40"}`}
        >
          <div className="bg-teal-500 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <PlayCircle size={20} fill="currentColor" />
          </div>
          <div>
            <h3
              className={`font-black text-xs uppercase tracking-widest ${theme.text}`}
            >
              Resume
            </h3>
            <p className="text-[10px] text-teal-500 font-bold opacity-80 uppercase">
              Active Match
            </p>
          </div>
        </button>

        <button
          onClick={() => {
            if (!tournamentId) return alert("Select a tournament first.");
            setMatchId("new");
            navigate("/");
          }}
          className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group ${lightMode ? "bg-cyan-50 border-cyan-100 hover:bg-cyan-100" : "bg-gradient-to-br from-cyan-900/20 to-transparent border-cyan-500/20 hover:border-cyan-500/40"}`}
        >
          <div className="bg-cyan-500 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <PlusCircle size={20} />
          </div>
          <div>
            <h3
              className={`font-black text-xs uppercase tracking-widest ${theme.text}`}
            >
              Create
            </h3>
            <p className="text-[10px] text-cyan-500 font-bold opacity-80 uppercase">
              New Match
            </p>
          </div>
        </button>

        <button
          onClick={() =>
            tournamentId
              ? navigate(`/tournaments/${tournamentId}`)
              : alert("Select a tournament first.")
          }
          className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group ${lightMode ? "bg-indigo-50 border-indigo-100 hover:bg-indigo-100" : "bg-gradient-to-br from-indigo-900/20 to-transparent border-indigo-500/20 hover:border-indigo-500/40"}`}
        >
          <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Trophy size={20} />
          </div>
          <div>
            <h3
              className={`font-black text-xs uppercase tracking-widest ${theme.text}`}
            >
              Rankings
            </h3>
            <p className="text-[10px] text-indigo-500 font-bold opacity-80 uppercase">
              View Table
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate(`/teams`)}
          className={`flex flex-col gap-3 p-5 rounded-3xl transition-all active:scale-95 text-left border shadow-xl group ${lightMode ? "bg-orange-50 border-orange-100 hover:bg-orange-100" : "bg-gradient-to-br from-orange-900/20 to-transparent border-orange-500/20 hover:border-orange-500/40"}`}
        >
          <div className="bg-orange-500 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Users size={20} />
          </div>
          <div>
            <h3
              className={`font-black text-xs uppercase tracking-widest ${theme.text}`}
            >
              Squads
            </h3>
            <p className="text-[10px] text-orange-500 font-bold opacity-80 uppercase">
              Edit Players
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
