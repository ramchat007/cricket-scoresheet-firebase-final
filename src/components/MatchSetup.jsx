import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import {
  subscribeTournaments,
  listTournamentTeams,
  listGlobalPlayers,
  addTournament,
  createMatch,
} from "../utils/firestore.js";
import { writeBatch, doc, collection } from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Swords,
  Shuffle,
  Search,
  X,
  Loader2,
} from "lucide-react";
// 1. IMPORT THEME HOOK
import { useTheme } from "../context/ThemeContext";

// --- 0. INTERNAL UI COMPONENTS (Toast & Loaders) ---

const NotificationToast = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 border backdrop-blur-md ${
        isError
          ? "bg-red-500/10 border-red-500/20 text-red-500 bg-white dark:bg-red-900/10"
          : "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-200 bg-white dark:bg-teal-900/10"
      }`}>
      {isError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      <div>
        <h4 className="font-bold text-sm uppercase tracking-wider">
          {isError ? "Error" : "Success"}
        </h4>
        <p className="text-xs opacity-90">{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
};

const LoadingOverlay = ({ message }) => (
  <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in rounded-[2rem]">
    <Loader2 size={48} className="text-white animate-spin mb-4" />
    <p className="text-white font-bold uppercase tracking-widest text-sm animate-pulse">
      {message}
    </p>
  </div>
);

// --- 1. PLAYER PICKER MODAL (Theme Aware) ---
const PlayerPickerModal = ({ isOpen, onClose, onSelect, title }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  // Consume Theme
  const { theme, lightMode } = useTheme();

  useEffect(() => {
    if (isOpen) {
      listGlobalPlayers().then(setPlayers).catch(console.error);
      setSelected([]);
      setSearch("");
    }
  }, [isOpen]);

  const toggle = (p) => {
    if (selected.find((s) => s.id === p.id)) {
      setSelected((prev) => prev.filter((s) => s.id !== p.id));
    } else {
      setSelected((prev) => [...prev, p]);
    }
  };

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300 border ${theme.card} ${theme.text}`}>
        {/* Header */}
        <div
          className={`p-6 border-b flex justify-between items-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <div>
            <h3
              className={`font-black uppercase tracking-tighter text-xl flex items-center gap-2 ${theme.text}`}>
              <Users size={18} className={theme.accent} /> {title}
            </h3>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${theme.sub}`}>
              Select from Global Database
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme.btnBase}`}>
            <X size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div
          className={`p-4 border-b sticky top-0 z-10 ${lightMode ? "bg-white border-gray-200" : "bg-[#161920]/90 border-white/5"}`}>
          <div className="relative">
            <Search
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.sub}`}
              size={18}
            />
            <input
              className={`w-full pl-12 pr-4 py-4 rounded-xl outline-none font-bold transition-all border ${lightMode ? "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-blue-500" : "bg-[#0F1115] border-white/10 text-slate-200 focus:border-teal-500/50"}`}
              placeholder="Search player name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className={`text-center py-10 italic ${theme.sub}`}>
              No players found
            </div>
          ) : (
            filtered.map((p) => {
              const isSel = selected.find((s) => s.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    isSel
                      ? `bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400`
                      : `${theme.btnBase} border-transparent shadow-none hover:border-gray-300 dark:hover:border-white/10`
                  }`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shadow-inner ${isSel ? "bg-teal-500 text-white" : `${lightMode ? "bg-gray-200 text-gray-600" : "bg-[#1C2128] text-slate-500"}`}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div
                        className={`text-sm font-bold uppercase tracking-tight transition-colors ${theme.text}`}>
                        {p.name}
                      </div>
                      <div className={`text-[10px] ${theme.sub}`}>
                        {p.role || "Player"}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSel ? "border-teal-500 bg-teal-500 text-white" : "border-gray-400 dark:border-slate-700"}`}>
                    {isSel && <CheckCircle2 size={14} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-6 border-t flex gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
          <button
            onClick={onClose}
            className={`flex-1 py-4 font-black uppercase tracking-widest text-xs rounded-xl transition-colors ${theme.btnBase}`}>
            Cancel
          </button>
          <button
            onClick={() => {
              onSelect(selected);
              onClose();
            }}
            disabled={selected.length === 0}
            className="flex-[2] py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-teal-900/20 disabled:opacity-20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            Confirm Selection{" "}
            <span className="bg-black/20 px-2 py-0.5 rounded text-[10px]">
              {selected.length}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 2. MAIN COMPONENT (Unified Logic) ---
export default function MatchSetup({ allTeams = [], initialTournament }) {
  const { user } = useAuth();

  // ✅ CONSUME GLOBAL THEME
  const { theme, lightMode } = useTheme();

  const [activeTab, setActiveTab] = useState("single");
  const [teams, setTeams] = useState(allTeams);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [tournament, setTournament] = useState(initialTournament || "");
  const [tournamentDate, setTournamentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [tournamentFormat, setTournamentFormat] = useState("T20");
  const [overs, setOvers] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification State
  const [notification, setNotification] = useState(null);

  // Single Match States
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [teamARoster, setTeamARoster] = useState([]);
  const [teamBRoster, setTeamBRoster] = useState([]);
  const [batsmenText, setBatsmenText] = useState("");
  const [bowlersText, setBowlersText] = useState("");

  // Auto Schedule States
  const [startTime, setStartTime] = useState("09:00");
  const [matchDuration, setMatchDuration] = useState(120);
  const [matchGap, setMatchGap] = useState(30);
  const [matchesPerDay, setMatchesPerDay] = useState(2);
  const [defaultVenue, setDefaultVenue] = useState("");

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState("A");

  // Auto Schedule Selection
  const [selectedTeams, setSelectedTeams] = useState(new Set());

  // ✅ HELPER: Sanitize Squad
  const sanitizeSquad = (roster) => {
    if (!roster) return [];
    return roster.map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role || "All-Rounder",
      photoURL:
        player.photoURL && player.photoURL.startsWith("data:image")
          ? ""
          : player.photoURL || "",
      isIcon: !!player.isIcon,
    }));
  };

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const unsub = subscribeTournaments(setAvailableTournaments);
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (!tournament) {
      setTeams(allTeams);
      return;
    }
    listTournamentTeams(tournament).then((t) => {
      setTeams(t.length ? t : allTeams);
    });
  }, [tournament, allTeams]);

  const handleTeamChange = (e, setTeamName, setText, setRoster) => {
    const val = e.target.value;
    setTeamName(val);
    const t = teams.find((t) => t.name === val || t.id === val);
    if (t) {
      const roster = t.roster?.length ? t.roster.map((p) => ({ ...p })) : [];
      setRoster(roster);
      setText(roster.map((p) => p.name).join(", "));
    } else {
      setRoster([]);
      setText("");
    }
  };

  const openPicker = (target) => {
    setModalTarget(target);
    setModalOpen(true);
  };

  const handlePlayersPicked = (pickedPlayers) => {
    const newRoster = pickedPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role || "Unknown",
      isOwner: false,
      isIcon: false,
      soldPrice: 0,
      originalId: p.id,
    }));

    if (modalTarget === "A") {
      setTeamARoster((prev) => [...prev, ...newRoster]);
      setBatsmenText((prev) =>
        prev
          ? prev + ", " + newRoster.map((p) => p.name).join(",")
          : newRoster.map((p) => p.name).join(","),
      );
    } else {
      setTeamBRoster((prev) => [...prev, ...newRoster]);
      setBowlersText((prev) =>
        prev
          ? prev + ", " + newRoster.map((p) => p.name).join(",")
          : newRoster.map((p) => p.name).join(","),
      );
    }
    showToast(`${newRoster.length} players added to squad`);
  };

  const getSmartSquad = (textInput, roster) => {
    const names = textInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return names.map((name) => {
      const existing = roster.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) return existing;
      return {
        id: crypto.randomUUID(),
        name,
        role: "Unknown",
        isOwner: false,
        isIcon: false,
        soldPrice: 0,
        originalId: "",
      };
    });
  };

  const handleSubmitSingle = async () => {
    if (!user || !tournament || !teamA || !teamB)
      return showToast("Please fill all required fields", "error");
    setIsSubmitting(true);

    try {
      if (!availableTournaments.find((t) => t.id === tournament)) {
        await addTournament(tournament, {
          name: tournament,
          createdAt: new Date().toISOString(),
          status: "upcoming",
        });
      }

      const teamAObj = teams.find((t) => t.name === teamA);
      const teamBObj = teams.find((t) => t.name === teamB);

      const squadA = sanitizeSquad(getSmartSquad(batsmenText, teamARoster));
      const squadB = sanitizeSquad(getSmartSquad(bowlersText, teamBRoster));
      const matchId = `match_${Date.now()}`;

      const startDateTime = new Date(`${tournamentDate}T${startTime}`);

      await createMatch(tournament, matchId, {
        meta: {
          teamAName: teamA,
          teamBName: teamB,
          teamAId: teamAObj?.id || "",
          teamBId: teamBObj?.id || "",
          teamALogo: teamAObj?.logoUrl || "",
          teamBLogo: teamBObj?.logoUrl || "",
          overs: Number(overs),
          date: tournamentDate,
          time: startTime,
          startAt: startDateTime.toISOString(),
          format: tournamentFormat,
          venue: defaultVenue || "TBA",
          matchTitle: "Friendly Match",
        },
        squads: { teamA: squadA, teamB: squadB },
      });
      showToast("Match created successfully!");
      setTeamA("");
      setTeamB("");
      setBatsmenText("");
      setBowlersText("");
    } catch (e) {
      console.error("Match Creation Error:", e);
      showToast(e.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeams((prev) => {
      const copy = new Set(prev);
      if (copy.has(teamId)) copy.delete(teamId);
      else copy.add(teamId);
      return copy;
    });
  };

  const handleAutoScheduleSubmit = async () => {
    if (selectedTeams.size < 2 || !tournament)
      return showToast("Select at least 2 teams and a tournament", "error");
    setIsSubmitting(true);

    try {
      if (!availableTournaments.find((t) => t.id === tournament)) {
        await addTournament(tournament, {
          name: tournament,
          createdAt: new Date().toISOString(),
          status: "upcoming",
        });
      }

      const selectedTeamObjs = teams.filter((t) => selectedTeams.has(t.id));

      let matchesToCreate = [];
      for (let i = 0; i < selectedTeamObjs.length; i++) {
        for (let j = i + 1; j < selectedTeamObjs.length; j++) {
          matchesToCreate.push({
            teamA: selectedTeamObjs[i],
            teamB: selectedTeamObjs[j],
          });
        }
      }

      let currentDateTime = new Date(`${tournamentDate}T${startTime}`);
      let matchesToday = 0;
      const matchesPayload = [];

      matchesToCreate.forEach((pair, index) => {
        if (matchesToday >= matchesPerDay) {
          currentDateTime.setDate(currentDateTime.getDate() + 1);
          const [h, m] = startTime.split(":");
          currentDateTime.setHours(h, m, 0, 0);
          matchesToday = 0;
        }

        const startIso = currentDateTime.toISOString();
        const dateStr = startIso.slice(0, 10);
        const timeStr = currentDateTime.toTimeString().slice(0, 5);

        const endDateTime = new Date(currentDateTime);
        endDateTime.setMinutes(
          endDateTime.getMinutes() + Number(matchDuration),
        );

        matchesPayload.push({
          meta: {
            tournament: tournament,
            teamAName: pair.teamA.name,
            teamBName: pair.teamB.name,
            teamAId: pair.teamA.id,
            teamBId: pair.teamB.id,
            teamALogo: pair.teamA.logoUrl || "",
            teamBLogo: pair.teamB.logoUrl || "",
            overs: Number(overs),
            date: dateStr,
            time: timeStr,
            startAt: startIso,
            endAt: endDateTime.toISOString(),
            format: tournamentFormat,
            venue: defaultVenue || "TBA",
            matchTitle: `League Match ${index + 1}`,
          },
          squads: {
            teamA: sanitizeSquad(pair.teamA.roster || []),
            teamB: sanitizeSquad(pair.teamB.roster || []),
          },
        });

        matchesToday++;
        currentDateTime.setMinutes(
          currentDateTime.getMinutes() +
            Number(matchDuration) +
            Number(matchGap),
        );
      });

      const batchSize = 50;
      const matchesCol = collection(db, "tournaments", tournament, "matches");

      for (let i = 0; i < matchesPayload.length; i += batchSize) {
        const chunk = matchesPayload.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach((payload) => {
          const newRef = doc(matchesCol);
          const docData = {
            meta: {
              ...payload.meta,
              status: "upcoming",
              createdAt: new Date().toISOString(),
            },
            squads: payload.squads,
            innings: [
              {
                battingTeam: "",
                score: 0,
                wickets: 0,
                over: 0,
                overBallCount: 0,
                ballsLog: [],
                timeline: [],
                striker: "",
                nonStriker: "",
                currentBowler: "",
                batsmenStats: {},
                bowlerStats: {},
                extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              },
              {
                battingTeam: "",
                score: 0,
                wickets: 0,
                over: 0,
                overBallCount: 0,
                ballsLog: [],
                timeline: [],
                striker: "",
                nonStriker: "",
                currentBowler: "",
                batsmenStats: {},
                bowlerStats: {},
                extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              },
            ],
            status: "upcoming",
            currentInnings: 0,
            undoStack: [],
          };
          batch.set(newRef, docData);
        });
        await batch.commit();
      }

      showToast(`${matchesPayload.length} matches generated successfully!`);
      setSelectedTeams(new Set());
    } catch (e) {
      console.error("Auto Schedule Error:", e);
      showToast(e.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Styles (Theme Aware) ---
  const inputClass = `w-full border rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all font-bold placeholder:font-normal
    ${
      lightMode
        ? "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white"
        : "bg-[#0F1115] border-white/10 text-slate-200 placeholder:text-slate-600 focus:bg-black"
    }`;

  const labelClass = `flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1 ${theme.sub}`;

  return (
    <div className="w-full pb-20 relative">
      <NotificationToast
        message={notification?.message}
        type={notification?.type}
        onClose={() => setNotification(null)}
      />
      <PlayerPickerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handlePlayersPicked}
        title={`SQUAD BUILDER`}
      />

      <div
        className={`border rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-md relative ${theme.card}`}>
        {isSubmitting && (
          <LoadingOverlay
            message={
              activeTab === "auto"
                ? "Generating Fixtures..."
                : "Setting up Match..."
            }
          />
        )}

        {/* TAB NAVIGATION */}
        <div
          className={`p-2 flex gap-2 border-b ${lightMode ? "bg-gray-100 border-gray-200" : "bg-[#161920]/80 border-white/5"}`}>
          {[
            { id: "single", label: "Single Match", icon: Swords },
            { id: "auto", label: "Auto League", icon: Shuffle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg"
                  : `${theme.sub} hover:bg-black/5 dark:hover:bg-white/5`
              }`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-10">
          {/* COMMON SETTINGS GRID */}
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 pb-10 border-b border-dashed ${lightMode ? "border-gray-200" : "border-white/5"}`}>
            <div className="md:col-span-1">
              <label className={labelClass}>
                <Trophy size={12} /> Tournament
              </label>
              <div className="relative">
                <input
                  value={tournament}
                  onChange={(e) => setTournament(e.target.value)}
                  className={inputClass}
                  placeholder="Select or Type League Name"
                  list="tList"
                />
                <datalist id="tList">
                  {availableTournaments.map((t) => (
                    <option key={t.id} value={t.id} />
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <label className={labelClass}>
                <Calendar size={12} /> Match Date
              </label>
              <input
                type="date"
                value={tournamentDate}
                onChange={(e) => setTournamentDate(e.target.value)}
                className={`${inputClass} uppercase`}
              />
            </div>
            <div>
              <label className={labelClass}>
                <MapPin size={12} /> Venue
              </label>
              <input
                value={defaultVenue}
                onChange={(e) => setDefaultVenue(e.target.value)}
                className={inputClass}
                placeholder="Stadium Name"
              />
            </div>
          </div>

          {/* SINGLE MATCH VIEW */}
          {activeTab === "single" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
                {/* VS Badge */}
                <div
                  className={`hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border rounded-full items-center justify-center font-black italic z-10 shadow-xl ${lightMode ? "bg-white border-gray-200 text-gray-400" : "bg-[#0F1115] border-white/10 text-slate-500"}`}>
                  VS
                </div>

                {/* Team A Card */}
                <div
                  className={`p-6 rounded-3xl border transition-all group ${lightMode ? "bg-gray-50 border-gray-200 hover:border-teal-500/50" : "bg-[#0F1115]/50 border-white/5 hover:border-teal-500/20"}`}>
                  <div className="flex justify-between items-start mb-4">
                    <label
                      className={`${labelClass} text-teal-600 dark:text-teal-500`}>
                      Home Team
                    </label>
                    <div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_10px_teal]"></div>
                  </div>
                  <input
                    value={teamA}
                    onChange={(e) =>
                      handleTeamChange(
                        e,
                        setTeamA,
                        setBatsmenText,
                        setTeamARoster,
                      )
                    }
                    className={inputClass}
                    placeholder="Team A Name"
                    list="teamList"
                  />

                  <div className="flex justify-between items-center mt-6 mb-2">
                    <label className={labelClass}>Squad List</label>
                    <button
                      onClick={() => openPicker("A")}
                      className="text-[9px] font-black text-teal-500 uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition-colors flex items-center gap-1">
                      <Users size={10} /> Picker
                    </button>
                  </div>
                  <textarea
                    value={batsmenText}
                    onChange={(e) => setBatsmenText(e.target.value)}
                    className={`${inputClass} h-40 text-xs leading-relaxed custom-scrollbar font-mono`}
                    placeholder="Player 1, Player 2..."
                  />
                </div>

                {/* Team B Card */}
                <div
                  className={`p-6 rounded-3xl border transition-all group ${lightMode ? "bg-gray-50 border-gray-200 hover:border-indigo-500/50" : "bg-[#0F1115]/50 border-white/5 hover:border-indigo-500/20"}`}>
                  <div className="flex justify-between items-start mb-4">
                    <label className={`${labelClass} text-indigo-500`}>
                      Away Team
                    </label>
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_indigo]"></div>
                  </div>
                  <input
                    value={teamB}
                    onChange={(e) =>
                      handleTeamChange(
                        e,
                        setTeamB,
                        setBowlersText,
                        setTeamBRoster,
                      )
                    }
                    className={inputClass}
                    placeholder="Team B Name"
                    list="teamList"
                  />

                  <div className="flex justify-between items-center mt-6 mb-2">
                    <label className={labelClass}>Squad List</label>
                    <button
                      onClick={() => openPicker("B")}
                      className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors flex items-center gap-1">
                      <Users size={10} /> Picker
                    </button>
                  </div>
                  <textarea
                    value={bowlersText}
                    onChange={(e) => setBowlersText(e.target.value)}
                    className={`${inputClass} h-40 text-xs leading-relaxed custom-scrollbar font-mono`}
                    placeholder="Player 1, Player 2..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                <div>
                  <label className={labelClass}>
                    <Clock size={12} /> Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Overs</label>
                  <input
                    type="number"
                    value={overs}
                    onChange={(e) => setOvers(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                onClick={handleSubmitSingle}
                disabled={!teamA || !teamB || isSubmitting}
                className="w-full py-5 bg-gradient-to-r from-teal-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-teal-900/40 active:scale-[0.98] transition-all disabled:opacity-50 hover:shadow-teal-900/60 flex items-center justify-center gap-3">
                <Swords size={16} /> Finalize Encounter
              </button>
            </div>
          )}

          {/* AUTO SCHEDULE VIEW */}
          {activeTab === "auto" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
              <div
                className={`p-6 rounded-3xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                <div className="flex justify-between items-center mb-4">
                  <h4
                    className={`font-black text-xs uppercase tracking-widest italic flex items-center gap-2 ${theme.sub}`}>
                    <Users size={14} /> Available Team Pool
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-1 rounded font-mono ${lightMode ? "bg-gray-200 text-gray-700" : "bg-white/10 text-slate-300"}`}>
                    {selectedTeams.size} Selected
                  </span>
                </div>

                {teams.length === 0 ? (
                  <div
                    className={`text-center py-10 border border-dashed rounded-xl ${theme.sub} ${lightMode ? "border-gray-300" : "border-white/10"}`}>
                    No Teams Found in Database
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        onClick={() => toggleTeamSelection(team.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border group relative overflow-hidden ${
                          selectedTeams.has(team.id)
                            ? "bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400 shadow-lg"
                            : `${theme.btnBase} border-transparent shadow-none hover:border-gray-300 dark:hover:border-white/10`
                        }`}>
                        {selectedTeams.has(team.id) && (
                          <div className="absolute right-0 top-0 w-10 h-10 bg-gradient-to-bl from-teal-500/20 to-transparent"></div>
                        )}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${selectedTeams.has(team.id) ? "bg-teal-500 border-teal-500" : "border-gray-400 dark:border-slate-700"}`}>
                          {selectedTeams.has(team.id) && (
                            <CheckCircle2 size={12} className="text-white" />
                          )}
                        </div>
                        <span className="text-xs font-black uppercase tracking-tight">
                          {team.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className={labelClass}>
                    <Clock size={12} /> Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Overs</label>
                  <input
                    type="number"
                    value={overs}
                    onChange={(e) => setOvers(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Matches/Day</label>
                  <input
                    type="number"
                    value={matchesPerDay}
                    onChange={(e) => setMatchesPerDay(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Gap (Min)</label>
                  <input
                    type="number"
                    value={matchGap}
                    onChange={(e) => setMatchGap(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div
                className={`pt-4 border-t ${lightMode ? "border-gray-200" : "border-white/5"}`}>
                <button
                  onClick={handleAutoScheduleSubmit}
                  disabled={selectedTeams.size < 2 || isSubmitting}
                  className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-purple-900/20 active:scale-[0.98] transition-all disabled:opacity-50 hover:shadow-purple-900/40 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Shuffle size={16} />
                  )}
                  {isSubmitting
                    ? "Generating..."
                    : `Generate ${(selectedTeams.size * (selectedTeams.size - 1)) / 2} Round Robin Fixtures`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Datalist for shared team lookup */}
      <datalist id="teamList">
        {teams.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
    </div>
  );
}
