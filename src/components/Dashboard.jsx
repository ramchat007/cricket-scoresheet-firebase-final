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
import { Helmet } from "react-helmet-async";

export default function Dashboard() {
  const { user } = useAuth();
  const { theme, lightMode } = useTheme();

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

  // --- Helper: Status Badge (Corrected logic) ---
  const getStatusBadge = (tournament) => {
    let actualStatus = (tournament.status || "").toLowerCase();

    // 🟢 Fetch the correct date field (checking both just in case of old data)
    const tournamentDate = (
      tournament.startDate ||
      tournament.date ||
      ""
    ).slice(0, 10);
    const today = localDateString();

    const totalMatches = tournament.stats?.totalMatches || 0;
    const playedMatches = tournament.stats?.matchesPlayed || 0;
    const allMatchesFinished =
      totalMatches > 0 && playedMatches >= totalMatches;

    // 1. Highest Priority: Is it completely finished?
    if (
      ["completed", "finished"].includes(actualStatus) ||
      allMatchesFinished
    ) {
      actualStatus = "completed";
    }
    // 2. Second Priority: Resolve Live vs Upcoming
    else {
      if (playedMatches > 0) {
        // If a match has actually been scored, it's Live (even if they started a day early)
        actualStatus = "live";
      } else if (tournamentDate && tournamentDate > today) {
        // 🟢 STRICT CHECK: If NO matches are played AND the date is in the future, it is Upcoming
        actualStatus = "upcoming";
      } else if (tournamentDate && tournamentDate <= today) {
        // If the start date is today or in the past, it's Live
        actualStatus = "live";
      }
    }

    // --- Render Badge UI ---
    if (["ongoing", "active", "live", "in-progress"].includes(actualStatus)) {
      return (
        <span
          className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${
            lightMode
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-red-900/30 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
          }`}
        >
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          Live
        </span>
      );
    }

    if (actualStatus === "upcoming") {
      return (
        <span
          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${
            lightMode
              ? "bg-blue-50 text-blue-600 border-blue-200"
              : "bg-blue-900/30 text-blue-400 border-blue-500/30"
          }`}
        >
          Upcoming
        </span>
      );
    }

    if (actualStatus === "completed") {
      return (
        <span
          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${
            lightMode
              ? "bg-green-50 text-green-600 border-green-200"
              : "bg-green-900/30 text-green-400 border-green-500/30"
          }`}
        >
          Completed
        </span>
      );
    }

    return (
      <span
        className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${
          lightMode
            ? "bg-gray-100 text-gray-500 border-gray-200"
            : "bg-gray-800 text-gray-400 border-gray-700"
        }`}
      >
        {actualStatus || "Draft"}
      </span>
    );
  };

  return (
    <>
      <Helmet>
        <title>Tournament Arena | CricSync</title>
        <meta
          name="description"
          content="Discover and manage cricket tournaments in the Tournament Arena. Explore active leagues, create your own, and stay updated with live scores and rankings. Join the action today!"
        />
      </Helmet>
      <div
        className={`w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen transition-colors duration-300 ${theme.bg}`}
      >
        {/* ... Header and Tabs stay the same ... */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="text-center md:text-left">
            <h2
              className={`text-3xl font-black uppercase tracking-tight flex items-center justify-center md:justify-start gap-3 ${theme.text}`}
            >
              <span
                className={`p-2 rounded-xl ${
                  lightMode
                    ? "bg-purple-100 text-purple-600"
                    : "bg-purple-500/10 text-purple-400"
                }`}
              >
                <Trophy size={28} />
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-500">
                Tournament
              </span>{" "}
              Arena
            </h2>
            <p className={`text-sm mt-1 font-medium ${theme.sub}`}>
              Discover leagues or manage your own.
            </p>
          </div>

          <div className="flex gap-3">
            {user && (
              <Link
                to="/create-tournament"
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2 active:scale-95"
              >
                <Plus size={18} strokeWidth={3} />
                <span className="hidden sm:inline uppercase tracking-wider text-xs">
                  Create Tournament
                </span>
              </Link>
            )}
          </div>
        </div>

        {user && (
          <div
            className={`flex gap-6 mb-8 border-b ${
              lightMode ? "border-gray-200" : "border-gray-800"
            }`}
          >
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "all"
                  ? "border-cyan-500 text-cyan-500"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <LayoutGrid size={16} /> All Tournaments
            </button>
            <button
              onClick={() => setActiveTab("mine")}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "mine"
                  ? "border-purple-500 text-purple-500"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <ListFilter size={16} /> My Tournaments
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  lightMode
                    ? "bg-gray-100 text-gray-600"
                    : "bg-gray-800 text-gray-300"
                }`}
              >
                {myTournaments.length}
              </span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            <p
              className={`text-xs font-black uppercase tracking-widest ${theme.sub}`}
            >
              Loading Arena...
            </p>
          </div>
        )}

        {!loading && currentList.length === 0 && (
          <div
            className={`text-center py-20 border border-dashed rounded-3xl ${
              lightMode
                ? "bg-gray-50 border-gray-300"
                : "bg-gray-900/50 border-gray-800"
            }`}
          >
            <div className="text-6xl mb-4 opacity-50 grayscale">🏏</div>
            <h3 className={`text-xl font-bold ${theme.text}`}>
              {activeTab === "mine"
                ? "No Managed Tournaments"
                : "No Tournaments Found"}
            </h3>
            <p className={`mt-2 max-w-md mx-auto text-sm ${theme.sub}`}>
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
              className={`group relative block border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                lightMode
                  ? "bg-white border-gray-200 hover:border-cyan-300 hover:shadow-cyan-100"
                  : "bg-[#1C2128] border-white/5 hover:border-cyan-500/30 hover:shadow-cyan-900/20"
              }`}
            >
              <div
                className={`absolute top-0 left-0 w-full h-1 transition-all duration-300 ${
                  t.ownerId === user?.uid
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 h-1.5"
                    : "bg-gradient-to-r from-cyan-600 to-blue-500 group-hover:h-1.5"
                }`}
              ></div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <h5
                    className={`text-lg font-bold line-clamp-1 pr-2 transition-colors ${
                      lightMode
                        ? "text-gray-900 group-hover:text-cyan-600"
                        : "text-white group-hover:text-cyan-400"
                    }`}
                  >
                    {t.name}
                  </h5>
                  {/* 🔥 Updated Call */}
                  {getStatusBadge(t)}
                </div>

                {/* ... Rest of card details remain same ... */}
                {user && t.ownerId === user.uid && (
                  <div className="mb-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${
                        lightMode
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-purple-900/40 text-purple-300 border-purple-500/30"
                      }`}
                    >
                      👑 Owner
                    </span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        lightMode
                          ? "bg-purple-50 text-purple-600"
                          : "bg-gray-800 text-purple-400"
                      }`}
                    >
                      <User size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <div
                        className={`text-[9px] uppercase font-bold tracking-wider ${theme.sub}`}
                      >
                        Organizer
                      </div>
                      <div
                        className={`font-bold text-xs truncate ${theme.text}`}
                      >
                        {t.organizer || "Unknown"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        lightMode
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-800 text-blue-400"
                      }`}
                    >
                      <MapPin size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <div
                        className={`text-[9px] uppercase font-bold tracking-wider ${theme.sub}`}
                      >
                        Location
                      </div>
                      {/* 🟢 Ensures it catches updates from the Settings page */}
                      <div
                        className={`font-bold text-xs truncate ${theme.text}`}
                      >
                        {t.location || "TBA"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        lightMode
                          ? "bg-cyan-50 text-cyan-600"
                          : "bg-gray-800 text-cyan-400"
                      }`}
                    >
                      <Calendar size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <div
                        className={`text-[9px] uppercase font-bold tracking-wider ${theme.sub}`}
                      >
                        Start Date
                      </div>
                      {/* 🟢 Safely checks both the old "date" and the new "startDate" */}
                      <div
                        className={`font-bold text-xs truncate ${theme.text}`}
                      >
                        {formatDate(t.startDate || t.date)}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-5 pt-4 border-t flex justify-between items-center transition-colors ${
                    lightMode
                      ? "border-gray-100 group-hover:border-gray-200"
                      : "border-gray-800 group-hover:border-gray-700"
                  }`}
                >
                  <span className={`text-xs font-mono font-bold ${theme.sub}`}>
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
    </>
  );
}
