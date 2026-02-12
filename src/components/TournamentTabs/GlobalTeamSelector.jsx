import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import {
  X,
  Search,
  Shield,
  Check,
  Loader2,
  Download,
  Globe,
} from "lucide-react";

const GlobalTeamSelector = ({ isOpen, onClose, onImport, existingTeamIds }) => {
  const { theme, lightMode } = useTheme();
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
            (t) => !existingTeamIds.includes(t.id),
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
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-colors ${theme.card} ${lightMode ? "border border-gray-200" : "border border-white/10"}`}>
        {/* HEADER */}
        <div
          className={`p-6 border-b flex justify-between items-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#1C2128] border-white/5"}`}>
          <div>
            <h3
              className={`text-xl font-black uppercase tracking-tight italic flex items-center gap-2 ${theme.text}`}>
              <Globe size={20} className="text-teal-500" /> Import Global Teams
            </h3>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest ${theme.sub}`}>
              Select from database
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${lightMode ? "bg-gray-200 text-gray-500 hover:bg-gray-300" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"}`}>
            <X size={16} />
          </button>
        </div>

        {/* SEARCH */}
        <div
          className={`p-4 border-b ${lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <div className="relative">
            <Search
              className={`absolute left-4 top-3.5 ${theme.sub}`}
              size={16}
            />
            <input
              type="text"
              placeholder="Search global teams..."
              className={`w-full rounded-xl px-4 py-3 pl-11 outline-none transition-all font-bold text-sm border focus:border-teal-500 ${
                lightMode
                  ? "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white"
                  : "bg-[#0F1115] border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50"
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-teal-500 animate-pulse">
              <Loader2 size={32} className="animate-spin" />
              <div className="font-black text-xs uppercase tracking-widest">
                Loading Global Database...
              </div>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className={`text-center mt-10 italic text-sm ${theme.sub}`}>
              No available teams found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTeams.map((team) => {
                const isSelected = !!selectedTeams.find(
                  (t) => t.id === team.id,
                );
                return (
                  <div
                    key={team.id}
                    onClick={() => toggleSelection(team)}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all duration-200 active:scale-95 group ${
                      isSelected
                        ? lightMode
                          ? "bg-teal-50 border-teal-500 shadow-md"
                          : "bg-teal-500/10 border-teal-500/50 shadow-lg shadow-teal-900/20"
                        : lightMode
                          ? "bg-white border-gray-200 hover:border-teal-300 hover:shadow-sm"
                          : "bg-[#0F1115] border-white/5 hover:border-white/20 hover:bg-white/5"
                    }`}>
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className={`w-10 h-10 rounded-xl object-cover shadow-sm border ${lightMode ? "bg-white border-gray-200" : "bg-black border-white/10"}`}
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${
                            isSelected
                              ? lightMode
                                ? "bg-teal-100 text-teal-700 border-teal-200"
                                : "bg-teal-500 text-black border-teal-400"
                              : lightMode
                                ? "bg-gray-100 text-gray-400 border-gray-200"
                                : "bg-[#161920] text-slate-500 border-white/5"
                          }`}>
                          <Shield size={18} />
                        </div>
                      )}
                      <div>
                        <div
                          className={`font-bold text-sm ${
                            isSelected
                              ? lightMode
                                ? "text-teal-700"
                                : "text-teal-400"
                              : theme.text
                          }`}>
                          {team.name}
                        </div>
                        <div
                          className={`text-[10px] font-bold uppercase tracking-wider ${theme.sub}`}>
                          {team.players ? team.players.length : 0} Players
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        className={`p-1 rounded-full ${lightMode ? "bg-teal-100 text-teal-600" : "bg-teal-500/20 text-teal-400"}`}>
                        <Check size={16} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          className={`p-6 border-t flex justify-end gap-3 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <button
            onClick={onClose}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${
              lightMode
                ? "text-gray-500 hover:bg-gray-200 border-transparent hover:text-gray-700"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent hover:border-white/10"
            }`}>
            Cancel
          </button>
          <button
            disabled={selectedTeams.length === 0}
            onClick={handleImport}
            className={`px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
              selectedTeams.length > 0
                ? "bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 shadow-teal-900/20 transform active:scale-95"
                : `cursor-not-allowed ${lightMode ? "bg-gray-300 text-gray-500" : "bg-[#0F1115] border border-white/5 text-slate-600"}`
            }`}>
            <Download size={16} /> Import {selectedTeams.length} Teams
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalTeamSelector;
