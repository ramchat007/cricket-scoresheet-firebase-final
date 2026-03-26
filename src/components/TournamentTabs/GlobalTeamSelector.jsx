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
  // 🟢 Removed lightMode, using pure theme object
  const { theme } = useTheme();

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
        // 🟢 Pure theme card styling
        className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-colors ${theme?.card || "bg-black/80 border border-white/10"}`}>
        {/* HEADER */}
        <div className={`p-6 border-b border-current/10 bg-current/5`}>
          <div className="flex justify-between items-center">
            <div>
              <h3
                className={`text-xl font-black uppercase tracking-tight italic flex items-center gap-2 ${theme?.text || "text-white"}`}>
                <Globe size={20} className="text-teal-500" /> Import Global
                Teams
              </h3>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest ${theme?.sub || "text-gray-400"}`}>
                Select from database
              </p>
            </div>
            <button
              onClick={onClose}
              // 🟢 Adapts perfectly to text color
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-current/10 text-inherit opacity-70 hover:opacity-100 hover:bg-current/20`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className={`p-4 border-b border-current/10 bg-current/5`}>
          <div className="relative">
            <Search
              className={`absolute left-4 top-3.5 ${theme?.sub || "text-gray-400"}`}
              size={16}
            />
            <input
              type="text"
              placeholder="Search global teams..."
              // 🟢 Input inherits text color and uses transparency for backgrounds
              className={`w-full rounded-xl px-4 py-3 pl-11 outline-none transition-all font-bold text-sm border focus:border-teal-500 bg-current/5 border-current/10 text-inherit placeholder:opacity-50 focus:bg-current/10`}
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
            <div
              className={`text-center mt-10 italic text-sm ${theme?.sub || "text-gray-400"}`}>
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
                    // 🟢 Replaced hardcoded selections with vibrant accents and transparent borders
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all duration-200 active:scale-95 group ${
                      isSelected
                        ? "bg-teal-500/20 border-teal-500 shadow-lg shadow-teal-500/20"
                        : "bg-current/5 border-current/10 hover:border-teal-500/50 hover:bg-current/10"
                    }`}>
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className={`w-10 h-10 rounded-xl object-cover shadow-sm border bg-current/5 border-current/10`}
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${
                            isSelected
                              ? "bg-teal-500 text-white border-teal-400"
                              : "bg-current/5 text-inherit opacity-70 border-current/10"
                          }`}>
                          <Shield size={18} />
                        </div>
                      )}
                      <div>
                        <div
                          className={`font-bold text-sm ${
                            isSelected
                              ? "text-teal-500"
                              : theme?.text || "text-white"
                          }`}>
                          {team.name}
                        </div>
                        <div
                          className={`text-[10px] font-bold uppercase tracking-wider ${theme?.sub || "text-gray-400"}`}>
                          {team.players ? team.players.length : 0} Players
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        className={`p-1 rounded-full bg-teal-500/20 text-teal-500`}>
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
          className={`p-6 border-t flex justify-end gap-3 bg-current/5 border-current/10`}>
          <button
            onClick={onClose}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors text-inherit opacity-70 hover:opacity-100 hover:bg-current/10 border-transparent`}>
            Cancel
          </button>
          <button
            disabled={selectedTeams.length === 0}
            onClick={handleImport}
            // 🟢 Uses the actual theme gradient if available, falls back to a clean teal!
            className={`px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
              selectedTeams.length > 0
                ? `bg-gradient-to-r ${theme?.gradient || "from-teal-500 to-emerald-600"} transform active:scale-95`
                : `cursor-not-allowed bg-current/10 text-inherit opacity-50`
            }`}>
            <Download size={16} /> Import {selectedTeams.length} Teams
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalTeamSelector;
