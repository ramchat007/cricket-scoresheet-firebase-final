import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { subscribeTournaments } from "../utils/firestore";
import { useTheme } from "../context/ThemeContext";
import {
  Trophy,
  Plus,
  Calendar,
  MapPin,
  User,
  ArrowRight,
  LayoutGrid,
  ListFilter,
  Loader2,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  // 🟢 Natively extract theme
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-[#0F1115]/60 backdrop-blur-xl border border-white/10 shadow-xl";

  const [allTournaments, setAllTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Helper to get local YYYY-MM-DD for comparison
  const localDateString = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    const unsub = subscribeTournaments((data) => {
      setAllTournaments(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, []);

  const myTournaments = useMemo(() => {
    if (!user) return [];
    return allTournaments.filter(
      (t) =>
        t.ownerId === user.uid || (t.scorers && t.scorers.includes(user.uid)),
    );
  }, [allTournaments, user]);

  const currentList = activeTab === "mine" ? myTournaments : allTournaments;

  const formatDate = (dateString) => {
    if (!dateString) return "Date TBA";
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  // --- Helper: Status Badge (Now Theme-Adaptive) ---
  const getStatusBadge = (tournament) => {
    const storedStatus = (tournament.status || "").toLowerCase();
    const tournamentDate = tournament.date
      ? tournament.date.slice(0, 10)
      : null;
    const today = localDateString();

    const allMatchesFinished =
      tournament.stats?.matchesPlayed >= tournament.stats?.totalMatches;

    let actualStatus = storedStatus;

    if (storedStatus === "upcoming" && tournamentDate) {
      if (tournamentDate < today) {
        actualStatus = allMatchesFinished ? "finished" : "live";
      } else if (tournamentDate === today) {
        actualStatus = "live";
      }
    }

    // Render Badge UI with Glassmorphism highlights
    if (["ongoing", "active", "live", "in-progress"].includes(actualStatus)) {
      return (
        <span
          className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]`}>
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          Live
        </span>
      );
    }

    if (actualStatus === "upcoming") {
      return (
        <span
          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-blue-500/10 text-blue-500 border-blue-500/30`}>
          Upcoming
        </span>
      );
    }

    if (["completed", "finished"].includes(actualStatus)) {
      return (
        <span
          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-emerald-500/10 text-emerald-500 border-emerald-500/30`}>
          Completed
        </span>
      );
    }

    return (
      <span
        className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-current/10 text-inherit opacity-70 border-current/20`}>
        {actualStatus || "Draft"}
      </span>
    );
  };

  return (
    <div
      className={`w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen transition-colors duration-300 bg-transparent ${textMain}`}>
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h2
            className={`text-3xl font-black uppercase tracking-tight flex items-center justify-center md:justify-start gap-3 ${textMain}`}>
            <span
              className={`p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20`}>
              <Trophy size={28} />
            </span>
            <span
              className={`text-transparent bg-clip-text bg-gradient-to-r ${theme?.gradient || "from-purple-500 to-cyan-500"}`}>
              Tournament
            </span>{" "}
            Arena
          </h2>
          <p className={`text-sm mt-1 font-medium ${textSub}`}>
            Discover leagues or manage your own.
          </p>
        </div>

        <div className="flex gap-3">
          {user && (
            <Link
              to="/create-tournament"
              className={`bg-gradient-to-r ${theme?.gradient || "from-cyan-600 to-blue-600"} text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg hover:opacity-90 flex items-center gap-2 active:scale-95`}>
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline uppercase tracking-wider text-xs">
                Create Tournament
              </span>
            </Link>
          )}
        </div>
      </div>

      {user && (
        <div className={`flex gap-6 mb-8 border-b border-current/10`}>
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "border-cyan-500 text-cyan-500"
                : "border-transparent text-inherit opacity-50 hover:opacity-100 hover:border-current/20"
            }`}>
            <LayoutGrid size={16} /> All Tournaments
          </button>
          <button
            onClick={() => setActiveTab("mine")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "mine"
                ? "border-purple-500 text-purple-500"
                : "border-transparent text-inherit opacity-50 hover:opacity-100 hover:border-current/20"
            }`}>
            <ListFilter size={16} /> My Tournaments
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full bg-current/10 text-inherit`}>
              {myTournaments.length}
            </span>
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col justify-center items-center h-64 gap-3">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          <p
            className={`text-xs font-black uppercase tracking-widest ${textSub}`}>
            Loading Arena...
          </p>
        </div>
      )}

      {!loading && currentList.length === 0 && (
        <div
          className={`text-center py-20 border border-dashed rounded-3xl bg-current/5 border-current/10`}>
          <div className="text-6xl mb-4 opacity-50 grayscale">🏏</div>
          <h3 className={`text-xl font-bold ${textMain}`}>
            {activeTab === "mine"
              ? "No Managed Tournaments"
              : "No Tournaments Found"}
          </h3>
          <p className={`mt-2 max-w-md mx-auto text-sm ${textSub}`}>
            {activeTab === "mine"
              ? "You haven't created any tournaments yet. Click 'Create Tournament' to get started!"
              : "There are no active tournaments in the arena right now."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentList.map((t) => (
          <Link
            key={t.id}
            to={`/tournaments/${t.id}`}
            className={`group relative block rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-cyan-500/30 ${cardBg}`}>
            {/* Animated Top Line */}
            <div
              className={`absolute top-0 left-0 w-full h-1 transition-all duration-300 ${
                t.ownerId === user?.uid
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 h-1.5"
                  : "bg-gradient-to-r from-cyan-600 to-blue-500 group-hover:h-1.5"
              }`}></div>

            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <h5
                  className={`text-lg font-bold line-clamp-1 pr-2 transition-colors ${textMain} group-hover:text-cyan-500`}>
                  {t.name}
                </h5>
                {getStatusBadge(t)}
              </div>

              {user && t.ownerId === user.uid && (
                <div className="mb-4">
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider bg-purple-500/10 text-purple-400 border-purple-500/30`}>
                    👑 Owner
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400 border border-purple-500/20`}>
                    <User size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <div
                      className={`text-[9px] uppercase font-bold tracking-wider ${textSub}`}>
                      Organizer
                    </div>
                    <div className={`font-bold text-xs truncate ${textMain}`}>
                      {t.organizer || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                    <MapPin size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <div
                      className={`text-[9px] uppercase font-bold tracking-wider ${textSub}`}>
                      Location
                    </div>
                    <div className={`font-bold text-xs truncate ${textMain}`}>
                      {t.location || "TBA"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20`}>
                    <Calendar size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <div
                      className={`text-[9px] uppercase font-bold tracking-wider ${textSub}`}>
                      Start Date
                    </div>
                    <div className={`font-bold text-xs truncate ${textMain}`}>
                      {formatDate(t.date)}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`mt-5 pt-4 border-t border-current/10 group-hover:border-current/20 flex justify-between items-center transition-colors`}>
                <span className={`text-xs font-mono font-bold ${textSub}`}>
                  {t.format || "T20"} Format
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-cyan-500 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Arena <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
