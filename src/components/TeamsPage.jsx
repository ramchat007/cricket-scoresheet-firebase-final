// src/components/TeamsView.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

export default function TeamsView() {
  const { tournamentId } = useParams(); // Ensure your route passes this
  const [teams, setTeams] = useState([]);
  const [tournamentName, setTournamentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Tournament Meta (for the name)
        const tourRef = doc(db, "tournaments", tournamentId);
        const tourSnap = await getDoc(tourRef);
        if (tourSnap.exists()) {
          setTournamentName(tourSnap.data().name || "Tournament");
        }

        // 2. Fetch Teams Subcollection
        // Assuming structure: tournaments/{id}/teams/{teamDoc}
        const teamsRef = collection(db, "tournaments", tournamentId, "teams");
        const snapshot = await getDocs(teamsRef);
        
        const teamsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setTeams(teamsData);
      } catch (err) {
        console.error("Error fetching teams:", err);
        setError("Failed to load teams. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent uppercase tracking-wider">
          {tournamentName}
        </h1>
        <p className="text-gray-400 mt-2 font-mono text-sm uppercase tracking-widest">
          Participating Squads
        </p>
      </div>

      {/* Teams Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-10 italic">
            No teams registered yet.
          </div>
        ) : (
          teams.map((team) => (
            <div 
              key={team.id} 
              className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/50 transition-all duration-300 group"
            >
              {/* Team Header */}
              <div className="bg-gray-900/50 p-4 border-b border-gray-700 flex justify-between items-center group-hover:bg-cyan-900/10 transition-colors">
                <div className="flex items-center gap-3">
                  {/* Team Avatar / Initial */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-lg font-bold shadow-inner">
                    {team.name ? team.name.charAt(0).toUpperCase() : "T"}
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {team.name || "Unknown Team"}
                  </h2>
                </div>
                <span className="text-xs font-bold bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                   {(team.players || []).length} Players
                </span>
              </div>

              {/* Players List */}
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(team.players) && team.players.length > 0 ? (
                    team.players.map((player, idx) => (
                      <div 
                        key={idx} 
                        className="bg-gray-900 hover:bg-gray-700 text-gray-300 hover:text-white text-sm px-3 py-1.5 rounded-full border border-gray-700 transition-colors cursor-default"
                      >
                        {player}
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-600 text-sm italic w-full text-center py-2">
                      No players added yet.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}