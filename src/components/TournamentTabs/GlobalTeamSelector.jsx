import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";

const GlobalTeamSelector = ({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1115]/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#1C2128] border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* HEADER */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1C2128]">
          <div>
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight italic">Import Global Teams</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select from database</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            ✕
          </button>
        </div>

        {/* SEARCH */}
        <div className="p-4 bg-[#161920] border-b border-white/5">
          <input
            type="text"
            placeholder="Search global teams..."
            className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:border-teal-500/50 outline-none transition-all placeholder:text-slate-600 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="text-center text-teal-500 animate-pulse mt-4 font-black text-xs uppercase tracking-widest">
              Loading Global Database...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center text-slate-600 mt-10 italic text-sm">
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
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all duration-200 active:scale-95 ${
                      isSelected
                        ? "bg-teal-500/10 border-teal-500/50 shadow-lg shadow-teal-900/20"
                        : "bg-[#0F1115] border-white/5 hover:border-white/20 hover:bg-white/5"
                    }`}>
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-10 h-10 rounded-xl object-cover bg-black shadow-sm border border-white/10"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border border-white/5 ${isSelected ? 'bg-teal-500 text-black' : 'bg-[#161920] text-slate-500'}`}>
                          🛡️
                        </div>
                      )}
                      <div>
                        <div className={`font-bold text-sm ${isSelected ? 'text-teal-400' : 'text-slate-200'}`}>
                          {team.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {team.players ? team.players.length : 0} Players
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-teal-400 text-xl font-black">✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-white/5 bg-[#161920] flex justify-end gap-3 rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors text-xs font-black uppercase tracking-widest border border-transparent hover:border-white/10">
            Cancel
          </button>
          <button
            disabled={selectedTeams.length === 0}
            onClick={handleImport}
            className={`px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
              selectedTeams.length > 0
                ? "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 shadow-teal-900/20 transform active:scale-95"
                : "bg-[#0F1115] border border-white/5 text-slate-600 cursor-not-allowed"
            }`}>
            Import {selectedTeams.length} Teams
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalTeamSelector;