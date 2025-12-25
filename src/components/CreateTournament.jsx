// src/components/CreateTournament.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addTournament } from "../utils/firestore"; // Ensure you updated this function in previous step!
import { useAuth } from "../hooks/useAuth";

export default function CreateTournament() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

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
      // Generate a clean ID from the name (e.g., "my-tournament-2025")
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const newId = `${slug}`; //-${Date.now().toString().slice(-4)}

      // Create with Owner ID
      await addTournament(
        newId,
        {
          name,
          organizer,
          location,
          status: "upcoming",
        },
        user.uid
      );

      // Redirect to the new tournament's dashboard
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

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-6 uppercase flex items-center gap-2">
          <span className="text-cyan-500 text-3xl">+</span> Create Tournament
        </h2>

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
              Tournament Name
            </label>
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
              <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
                Organizer Name
              </label>
              <input
                className={inputClass}
                placeholder="e.g. City Cricket Club"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
                Location / City
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Mumbai"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-cyan-900/20 transition-all transform hover:-translate-y-1 mt-4">
            {loading ? "Creating..." : "Create Tournament 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}
