import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addTournament } from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext"; // ✅ Added Theme Hook
import { Trophy, Plus, Calendar, MapPin, Shield } from "lucide-react"; // ✅ For UI consistency

export default function CreateTournament() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, lightMode } = useTheme(); // ✅ Consume global theme

  const [name, setName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState("league");

  // Auction Constraint States (Removed basePrice and bidIncrement)
  const [minSquadSize, setMinSquadSize] = useState(11);
  const [maxSquadSize, setMaxSquadSize] = useState(15);
  const [maxPlayers, setMaxPlayers] = useState("");

  // Redirect if not logged in
  if (!user) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[60vh] text-center ${theme.bg}`}>
        <div className="text-4xl mb-4">🔒</div>
        <h2 className={`text-xl font-bold ${theme.text}`}>Login Required</h2>
        <button
          onClick={() => navigate("/login")}
          className="mt-4 text-cyan-400 underline">
          Go to Login
        </button>
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);

    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const newId = `${slug}`;

      await addTournament(
        newId,
        {
          name,
          organizer,
          location,
          date,
          format,
          status: "upcoming",
          minSquadSize: Number(minSquadSize),
          maxSquadSize: Number(maxSquadSize),
          // ✅ Values now handled by global defaults or auction-specific settings later
          maxPlayers: maxPlayers ? Number(maxPlayers) : null,
          createdAt: new Date().toISOString(),
        },
        user.uid,
      );

      navigate(`/tournaments/${newId}`);
    } catch (err) {
      console.error(err);
      alert("Error creating tournament");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Themed Dynamic Classes
  const inputClass = `w-full border rounded-xl px-4 py-3 focus:outline-none transition-all font-bold text-sm ${
    lightMode
      ? "bg-white border-gray-200 text-gray-900 focus:border-cyan-500"
      : "bg-black/20 border-white/10 text-white focus:border-cyan-500"
  }`;

  const labelClass = `block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${theme.sub}`;

  return (
    <div
      className={`min-h-screen pt-10 pb-20 px-4 transition-colors duration-300 ${theme.bg}`}>
      <div
        className={`max-w-2xl mx-auto ${theme.card} border ${lightMode ? "border-gray-200" : "border-white/5"} rounded-3xl p-8 shadow-2xl relative overflow-hidden`}>
        {/* Decorative Header Accent */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 via-cyan-500 to-blue-500"></div>

        <h2
          className={`text-3xl font-black ${theme.text} mb-8 uppercase italic tracking-tighter flex items-center gap-3`}>
          <span className="p-2 rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
            <Trophy size={24} />
          </span>
          Create Tournament
        </h2>

        <form onSubmit={handleCreate} className="space-y-8">
          {/* SECTION 1: BASIC INFO */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Plus size={14} className="text-cyan-500" />
              <h3
                className={`text-[11px] font-black uppercase tracking-widest ${theme.sub}`}>
                Basic Information
              </h3>
            </div>

            <div>
              <label className={labelClass}>Tournament Name</label>
              <input
                className={inputClass}
                placeholder="e.g. Winter T20 League 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Organizer Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. City Cricket Club"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Start Date</label>
                <div className="relative">
                  <input
                    type="date"
                    className={inputClass}
                    style={{ colorScheme: lightMode ? "light" : "dark" }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Location / City</label>
              <div className="relative">
                <input
                  className={inputClass}
                  placeholder="e.g. Dombivali, Mumbai"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Max Registrations (Limit)</label>
              <div className="relative">
                <input
                  type="number"
                  className={inputClass}
                  placeholder="e.g. 80 (Leave blank for unlimited)"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 🟢 NEW SECTION: TOURNAMENT FORMAT */}
          <div className="space-y-5 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={14} className="text-cyan-500" />
              <h3
                className={`text-[11px] font-black uppercase tracking-widest ${theme.sub}`}>
                Tournament Format
              </h3>
            </div>

            <div className="flex gap-4">
              {["league", "knockout"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${
                    format === f
                      ? "bg-cyan-600 border-cyan-500 text-white shadow-lg"
                      : lightMode
                        ? "bg-white border-gray-200 text-gray-400"
                        : "bg-white/5 border-white/10 text-slate-500"
                  }`}>
                  {f === "league" ? "Round Robin / League" : "Knockout Series"}
                </button>
              ))}
            </div>
            <p className={`text-[9px] italic font-bold ${theme.sub}`}>
              *{" "}
              {format === "league"
                ? "Points Table will be used. Abandoned matches share 1 point each."
                : "Winner advances to next round. Abandoned matches require a manual walkover."}
            </p>
          </div>

          {/* SECTION 2: SQUAD RULES */}
          <div className="space-y-5 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-cyan-500" />
              <h3
                className={`text-[11px] font-black uppercase tracking-widest ${theme.sub}`}>
                Squad Constraints
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Min Players</label>
                <input
                  type="number"
                  className={inputClass}
                  value={minSquadSize}
                  onChange={(e) => setMinSquadSize(e.target.value)}
                />
                <p className={`text-[9px] mt-2 italic font-bold ${theme.sub}`}>
                  Required per team.
                </p>
              </div>
              <div>
                <label className={labelClass}>Max Players</label>
                <input
                  type="number"
                  className={inputClass}
                  value={maxSquadSize}
                  onChange={(e) => setMaxSquadSize(e.target.value)}
                />
                <p className={`text-[9px] mt-2 italic font-bold ${theme.sub}`}>
                  Squad capacity limit.
                </p>
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
            {loading ? "Initializing..." : "Launch Tournament 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}
