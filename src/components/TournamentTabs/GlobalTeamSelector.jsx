import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";

export default GlobalTeamSelector = ({
  isOpen,
  onClose,
  onImport,
  existingTeamIds,
}) => {
  const [globalTeams, setGlobalTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchGlobal = async () => {
        setLoading(true);
        try {
          const snap = await getDocs(collection(db, "teams"));
          const teams = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          const available = teams.filter(
            (t) => !existingTeamIds.includes(t.id)
          );
          setGlobalTeams(available);
        } catch (error) {
          console.error("Error loading global teams:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchGlobal();
    }
  }, [isOpen, existingTeamIds]);

  const toggleSelection = (team) => {
    if (selectedTeams.find((t) => t.id === team.id)) {
      setSelectedTeams((prev) => prev.filter((t) => t.id !== team.id));
    } else {
      setSelectedTeams((prev) => [...prev, team]);
    }
  };

  const handleImport = () => {
    onImport(selectedTeams);
    setSelectedTeams([]);
    onClose();
  };

  if (!isOpen) return null;

  const filteredTeams = globalTeams.filter((t) =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h3 className="text-xl font-bold text-white">Import Global Teams</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <div className="p-4 bg-gray-900 border-b border-gray-800">
          <input
            type="text"
            placeholder="Search global teams..."
            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="text-center text-cyan-500 animate-pulse mt-4 font-mono text-sm">
              Loading Global Database...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center text-gray-500 mt-4 italic">
              No available teams found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTeams.map((team) => {
                const isSelected = !!selectedTeams.find(
                  (t) => t.id === team.id
                );
                return (
                  <div
                    key={team.id}
                    onClick={() => toggleSelection(team)}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                      isSelected
                        ? "bg-cyan-900/20 border-cyan-500 shadow-lg shadow-cyan-900/20"
                        : "bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750"
                    }`}>
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-10 h-10 rounded-full object-cover bg-black shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-lg shadow-sm">
                          🛡️
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-sm">
                          {team.name}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                          {team.players ? team.players.length : 0} Players
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-cyan-400 text-xl font-bold">✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors text-sm font-bold">
            Cancel
          </button>
          <button
            disabled={selectedTeams.length === 0}
            onClick={handleImport}
            className={`px-6 py-2 rounded-lg text-white font-bold text-sm transition-all shadow-lg ${
              selectedTeams.length > 0
                ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transform hover:scale-105"
                : "bg-gray-700 cursor-not-allowed opacity-50"
            }`}>
            Import {selectedTeams.length} Teams
          </button>
        </div>
      </div>
    </div>
  );
};
