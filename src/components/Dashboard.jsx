import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { subscribeTournaments } from "../utils/firestore";

export default function Dashboard() {
  const { user } = useAuth();
  const [allTournaments, setAllTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' or 'mine'

  // 1. Fetch All Tournaments Real-time
  useEffect(() => {
    const unsub = subscribeTournaments((data) => {
      setAllTournaments(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, []);

  // 2. Filter "My Tournaments" locally
  const myTournaments = useMemo(() => {
    if (!user) return [];
    return allTournaments.filter(
      (t) =>
        t.ownerId === user.uid || (t.scorers && t.scorers.includes(user.uid))
    );
  }, [allTournaments, user]);

  // 3. Determine which list to show
  const currentList = activeTab === "mine" ? myTournaments : allTournaments;

  // --- Helper: Status Badge ---
  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "ongoing" || s === "active" || s === "live") {
      return (
        <span className="flex items-center gap-1.5 px-2 py-1 bg-red-900/30 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase rounded-full shadow-[0_0_8px_rgba(239,68,68,0.2)]">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          Live
        </span>
      );
    }
    if (s === "upcoming")
      return (
        <span className="px-2 py-1 bg-blue-900/30 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase rounded-full">
          Upcoming
        </span>
      );
    if (s === "completed" || s === "finished")
      return (
        <span className="px-2 py-1 bg-green-900/30 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase rounded-full">
          Completed
        </span>
      );
    return (
      <span className="px-2 py-1 bg-gray-700/50 border border-gray-600 text-gray-400 text-[10px] font-bold uppercase rounded-full">
        {status || "Draft"}
      </span>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen">
      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              Tournament
            </span>{" "}
            Arena
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Discover leagues or manage your own.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {user && (
            <Link
              to="/create-tournament"
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-2 rounded-lg font-bold transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2">
              <span>+</span>{" "}
              <span className="hidden sm:inline">Create Tournament</span>
            </Link>
          )}
        </div>
      </div>

      {/* --- TABS --- */}
      {user && (
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-cyan-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            All Tournaments
          </button>
          <button
            onClick={() => setActiveTab("mine")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "mine"
                ? "border-purple-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            My Tournaments
            <span className="bg-gray-800 text-sm px-1.5 py-0.5 rounded-full text-gray-400">
              {myTournaments.length}
            </span>
          </button>
        </div>
      )}

      {/* --- LOADING --- */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* --- EMPTY STATES --- */}
      {!loading && currentList.length === 0 && (
        <div className="text-center py-20 bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl">
          <div className="text-6xl mb-4 opacity-50">🏏</div>
          <h3 className="text-xl font-bold text-gray-300">
            {activeTab === "mine"
              ? "No Managed Tournaments"
              : "No Tournaments Found"}
          </h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            {activeTab === "mine"
              ? "You haven't created any tournaments yet. Click 'Create Tournament' to get started!"
              : "There are no active tournaments in the arena right now."}
          </p>
          {activeTab === "mine" && (
            <Link
              to="/create-tournament"
              className="mt-4 inline-block text-cyan-400 hover:underline">
              Start one now
            </Link>
          )}
        </div>
      )}

      {/* --- GRID LIST --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentList.map((t) => (
          <Link
            key={t.id}
            to={`/tournaments/${t.id}`}
            className="group relative block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-900/10">
            {/* Top Gradient Line */}
            <div
              className={`absolute top-0 left-0 w-full h-1 transition-all duration-300 ${
                t.ownerId === user?.uid
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 h-1.5"
                  : "bg-gradient-to-r from-blue-600 to-cyan-400 group-hover:h-1.5"
              }`}></div>

            <div className="p-5">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <h5 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1 pr-2">
                  {t.name}
                </h5>
                {getStatusBadge(t.status)}
              </div>

              {/* Role Badge (If Mine) */}
              {user && t.ownerId === user.uid && (
                <div className="mb-3">
                  <span className="text-[10px] font-bold bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                    👑 OWNER
                  </span>
                </div>
              )}

              {/* Details */}
              <div className="space-y-3">
                {/* Organizer */}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-purple-400">
                    <span className="text-lg">👤</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-600 font-bold tracking-wider">
                      Organizer
                    </div>
                    <div className="font-medium text-gray-300 line-clamp-1">
                      {t.organizer || "Unknown"}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-blue-400">
                    <span className="text-lg">📍</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-600 font-bold tracking-wider">
                      Location
                    </div>
                    <div className="font-medium text-gray-300 line-clamp-1">
                      {t.location || "TBA"}
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-cyan-400">
                    <span className="text-lg">📅</span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-600 font-bold tracking-wider">
                      Start Date
                    </div>
                    <div className="font-medium text-gray-300">
                      {t.startDate || "TBA"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-5 pt-4 border-t border-gray-800 flex justify-between items-center group-hover:border-gray-700 transition-colors">
                <span className="text-sm font-mono text-gray-500">
                  {t.format || "T20"}
                </span>
                <span className="text-sm font-bold text-cyan-500 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Arena <span>→</span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
