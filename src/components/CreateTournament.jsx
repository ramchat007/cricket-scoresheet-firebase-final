import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addTournament } from "../utils/firestore"; 
import { useAuth } from "../hooks/useAuth";

export default function CreateTournament() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(""); // ✅ Added Date state
  const [loading, setLoading] = useState(false);

  // Auction Constraint States
  const [minSquadSize, setMinSquadSize] = useState(11);
  const [maxSquadSize, setMaxSquadSize] = useState(15);
  const [minBasePrice, setMinBasePrice] = useState(500);
  const [bidIncrement, setBidIncrement] = useState(100);

  // Redirect if not logged in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white">Login Required</h2>
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
          date, // ✅ Save Date to Firestore
          status: "upcoming",
          minSquadSize: Number(minSquadSize),
          maxSquadSize: Number(maxSquadSize),
          minBasePrice: Number(minBasePrice),
          bidIncrement: Number(bidIncrement),
          createdAt: Date.now(),
        },
        user.uid
      );

      navigate(`/tournaments/${newId}`);
    } catch (err) {
      console.error(err);
      alert("Error creating tournament");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors";

  const labelClass = "block text-sm font-bold text-gray-500 uppercase mb-2";

  return (
    <div className="max-w-2xl mx-auto mt-10 mb-20 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-6 uppercase flex items-center gap-2">
          <span className="text-cyan-500 text-3xl">+</span> Create Tournament
        </h2>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* TOURNAMENT INFO */}
          <div className="space-y-4">
            <h3 className="text-cyan-400 font-black uppercase tracking-widest text-xs border-b border-gray-800 pb-2">Basic Information</h3>
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
              {/* ✅ NEW: Tournament Date Field */}
              <div>
                <label className={labelClass}>Start Date</label>
                <input
                  type="date"
                  className={inputClass}
                  style={{ colorScheme: 'dark' }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Location / City</label>
              <input
                className={inputClass}
                placeholder="e.g. Dombivali, Mumbai"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>

          {/* AUCTION CONSTRAINTS SECTION */}
          <div className="space-y-4 pt-4">
            <h3 className="text-cyan-400 font-black uppercase tracking-widest text-xs border-b border-gray-800 pb-2">Auction & Squad Rules</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Min Squad Size</label>
                <input
                  type="number"
                  className={inputClass}
                  value={minSquadSize}
                  onChange={(e) => setMinSquadSize(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">Teams must buy at least this many.</p>
              </div>
              <div>
                <label className={labelClass}>Max Squad Size</label>
                <input
                  type="number"
                  className={inputClass}
                  value={maxSquadSize}
                  onChange={(e) => setMaxSquadSize(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">Hard limit for teams.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Base Price Slab (Min)</label>
                <input
                  type="number"
                  className={inputClass}
                  value={minBasePrice}
                  onChange={(e) => setMinBasePrice(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">Used for purse reserve calculation.</p>
              </div>
              <div>
                <label className={labelClass}>Bid Increment</label>
                <input
                  type="number"
                  className={inputClass}
                  value={bidIncrement}
                  onChange={(e) => setBidIncrement(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">Default price jump per bid.</p>
              </div>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-cyan-900/20 transition-all transform active:scale-95 mt-4">
            {loading ? "Creating..." : "Create Tournament 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}