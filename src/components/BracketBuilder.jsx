import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useTheme } from "../context/ThemeContext";
import {
  Settings,
  Save,
  ArrowLeft,
  GripVertical,
  Shield,
  Calendar,
  Plus,
  Link as LinkIcon,
  Users,
  Trash2,
  Clock,
  MapPin,
  Edit3, // 🟢 Added Edit icon
} from "lucide-react";

// 🟢 Math Helper to perfectly calculate durations & rollover hours
const calculateNextTime = (baseDate, baseTime, duration, gap) => {
  if (!baseTime) return { date: baseDate, time: "" };

  const safeDate = baseDate || "2026-01-01";
  const dt = new Date(`${safeDate}T${baseTime}`);

  if (isNaN(dt.getTime())) return { date: baseDate, time: baseTime };

  dt.setMinutes(dt.getMinutes() + parseInt(duration || 0) + parseInt(gap || 0));

  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const nextDate = `${year}-${month}-${day}`;

  const hours = String(dt.getHours()).padStart(2, "0");
  const mins = String(dt.getMinutes()).padStart(2, "0");
  const nextTime = `${hours}:${mins}`;

  return { date: baseDate ? nextDate : "", time: nextTime };
};

export default function BracketBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);

  const groupedTeams = useMemo(() => {
    const groups = { Unassigned: [] };

    teams.forEach((team) => {
      const groupName = team.group
        ? `Group ${team.group.replace("Group", "").trim()}`
        : "Unassigned";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    if (groups["Unassigned"].length === 0) delete groups["Unassigned"];

    return groups;
  }, [teams]);

  // --- 🟢 DYNAMIC BRACKET STATE ---
  const [rounds, setRounds] = useState([
    { id: "r1", name: "Round 1" },
    { id: "r2", name: "Quarter Finals" },
  ]);

  const [matches, setMatches] = useState([]);
  const [matchCounter, setMatchCounter] = useState(1);
  const [activeConfigMatch, setActiveConfigMatch] = useState(null);
  const [showGlobalConfig, setShowGlobalConfig] = useState(false);

  // 🟢 ENHANCED GLOBAL SETTINGS
  const [globalSettings, setGlobalSettings] = useState({
    overs: 4,
    date: "",
    time: "",
    venue: "",
    label: "",
    matchDuration: 45,
    matchGap: 10,
  });

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const snap = await getDocs(collection(db, "tournaments", id, "teams"));
        setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const teamsSnap = await getDocs(
          collection(db, "tournaments", id, "teams"),
        );
        setTeams(teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const matchesSnap = await getDocs(
          collection(db, "tournaments", id, "matches"),
        );
        const activeDbMatchIds = new Set(matchesSnap.docs.map((d) => d.id));

        const tourneySnap = await getDoc(doc(db, "tournaments", id));
        if (tourneySnap.exists()) {
          const tData = tourneySnap.data();

          if (tData.bracketLayout) {
            const savedMatches = tData.bracketLayout.matches || [];

            const validMatches = savedMatches.filter((m) =>
              activeDbMatchIds.has(`BRACKET-${m.id}`),
            );

            const cleanedMatches = validMatches.map((m) => {
              let updatedMatch = { ...m };

              if (
                m.slotA.type === "link" &&
                !validMatches.find((v) => v.id === m.slotA.sourceMatchId)
              ) {
                updatedMatch.slotA = {
                  type: "team",
                  team: null,
                  sourceMatchId: "",
                };
              }
              if (
                m.slotB.type === "link" &&
                !validMatches.find((v) => v.id === m.slotB.sourceMatchId)
              ) {
                updatedMatch.slotB = {
                  type: "team",
                  team: null,
                  sourceMatchId: "",
                };
              }

              return updatedMatch;
            });

            const highestMatchNum = cleanedMatches.reduce((max, m) => {
              const num = parseInt(m.id.replace("M", "")) || 0;
              return num > max ? num : max;
            }, 0);

            setRounds(tData.bracketLayout.rounds || []);
            setMatches(cleanedMatches);
            setMatchCounter(highestMatchNum + 1);

            if (tData.bracketLayout.globalSettings) {
              setGlobalSettings(tData.bracketLayout.globalSettings);
            }
          }
        }
      } catch (e) {
        console.error("Error loading bracket data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // --- 🎯 ACTIONS ---
  const addRound = () => {
    const newId = `r${rounds.length + 1}`;
    setRounds([...rounds, { id: newId, name: `Round ${rounds.length + 1}` }]);
  };

  const addMatchToRound = (roundId) => {
    const matchPrefix = globalSettings.label.trim()
      ? globalSettings.label
      : "Match";

    let nextDate = globalSettings.date;
    let nextTime = globalSettings.time;

    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const result = calculateNextTime(
        lastMatch.settings?.date || globalSettings.date,
        lastMatch.settings?.time || globalSettings.time,
        globalSettings.matchDuration,
        globalSettings.matchGap,
      );
      nextDate = result.date;
      nextTime = result.time;
    }

    const newMatch = {
      id: `M${matchCounter}`,
      roundId,
      title: `${matchPrefix} ${matchCounter}`,
      slotA: { type: "team", team: null, sourceMatchId: "" },
      slotB: { type: "team", team: null, sourceMatchId: "" },
      settings: {
        date: nextDate,
        time: nextTime,
        venue: globalSettings.venue,
        overs: globalSettings.overs,
      },
    };

    setMatches([...matches, newMatch]);
    setMatchCounter(matchCounter + 1);
  };

  const updateMatchTitle = (matchId, title) => {
    setMatches(matches.map((m) => (m.id === matchId ? { ...m, title } : m)));
  };

  // 🟢 NEW: 3-Way Toggle for Slot Type (Manual -> Linked -> BYE -> Manual)
  const cycleSlotType = (matchId, slotKey) => {
    setMatches(
      matches.map((m) => {
        if (m.id === matchId) {
          const currentType = m[slotKey].type;
          const nextType =
            currentType === "team"
              ? "link"
              : currentType === "link"
                ? "bye"
                : "team";
          return {
            ...m,
            [slotKey]: {
              type: nextType,
              team: null,
              sourceMatchId: "",
            },
          };
        }
        return m;
      }),
    );
  };

  const updateSlotLink = (matchId, slotKey, sourceMatchId) => {
    setMatches(
      matches.map((m) =>
        m.id === matchId
          ? { ...m, [slotKey]: { ...m[slotKey], sourceMatchId } }
          : m,
      ),
    );
  };

  const handleDragStart = (e, team) => {
    e.dataTransfer.setData("teamObj", JSON.stringify(team));
  };
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e, matchId, slotKey) => {
    e.preventDefault();
    const teamData = e.dataTransfer.getData("teamObj");
    if (!teamData) return;

    const team = JSON.parse(teamData);
    setMatches(
      matches.map((m) => {
        if (m.id === matchId && m[slotKey].type === "team") {
          return { ...m, [slotKey]: { ...m[slotKey], team } };
        }
        return m;
      }),
    );
  };

  const removeTeamFromSlot = (matchId, slotKey) => {
    setMatches(
      matches.map((m) =>
        m.id === matchId
          ? { ...m, [slotKey]: { ...m[slotKey], team: null } }
          : m,
      ),
    );
  };

  const deleteMatch = (matchId) => {
    if (!window.confirm(`Are you sure you want to delete ${matchId}?`)) return;

    setMatches((prevMatches) => {
      const filteredMatches = prevMatches.filter((m) => m.id !== matchId);
      return filteredMatches.map((m) => {
        let updatedMatch = { ...m };
        if (m.slotA.type === "link" && m.slotA.sourceMatchId === matchId) {
          updatedMatch.slotA = { type: "team", team: null, sourceMatchId: "" };
        }
        if (m.slotB.type === "link" && m.slotB.sourceMatchId === matchId) {
          updatedMatch.slotB = { type: "team", team: null, sourceMatchId: "" };
        }
        return updatedMatch;
      });
    });
  };

  const handleSaveBracket = async () => {
    if (matches.length === 0) {
      alert("Add at least one match to save.");
      return;
    }
    if (
      !window.confirm(
        "Save and schedule these matches? This will update your tournament schedule.",
      )
    )
      return;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      const tourneyRef = doc(db, "tournaments", id);
      batch.update(tourneyRef, {
        bracketLayout: {
          rounds,
          matches,
          matchCounter,
          globalSettings,
          lastUpdated: Date.now(),
        },
      });

      matches.forEach((m, index) => {
        const matchRef = doc(
          db,
          "tournaments",
          id,
          "matches",
          `BRACKET-${m.id}`,
        );

        // 🟢 Handle the new BYE type securely
        let teamAName = "TBD";
        let teamAId = null;
        let teamALogo = null;
        if (m.slotA.type === "team" && m.slotA.team) {
          teamAName = m.slotA.team.name;
          teamAId = m.slotA.team.id;
          teamALogo = m.slotA.team.logo || m.slotA.team.logoUrl || null;
        } else if (m.slotA.type === "link" && m.slotA.sourceMatchId) {
          teamAName = `Winner of ${m.slotA.sourceMatchId}`;
        } else if (m.slotA.type === "bye") {
          teamAName = "BYE"; // 🟢 Assigns BYE
        }

        let teamBName = "TBD";
        let teamBId = null;
        let teamBLogo = null;
        if (m.slotB.type === "team" && m.slotB.team) {
          teamBName = m.slotB.team.name;
          teamBId = m.slotB.team.id;
          teamBLogo = m.slotB.team.logo || m.slotB.team.logoUrl || null;
        } else if (m.slotB.type === "link" && m.slotB.sourceMatchId) {
          teamBName = `Winner of ${m.slotB.sourceMatchId}`;
        } else if (m.slotB.type === "bye") {
          teamBName = "BYE"; // 🟢 Assigns BYE
        }

        const matchData = {
          matchNo: 100 + index,
          matchTitle: m.title,
          teamA: teamAName,
          teamB: teamBName,
          date: m.settings?.date || "",
          time: m.settings?.time || "",
          venue: m.settings?.venue || "",
          overs: m.settings?.overs || 4,
          status: "upcoming",
          createdAt: Date.now(),
          meta: {
            teamA: teamAName,
            teamB: teamBName,
            tournament: id,
            teamAId,
            teamBId,
            teamALogo,
            teamBLogo,
            matchTitle: m.title,
            isBracketMatch: true,
            bracketMatchId: m.id,
            sourceMatchA:
              m.slotA.type === "link" ? m.slotA.sourceMatchId : null,
            sourceMatchB:
              m.slotB.type === "link" ? m.slotB.sourceMatchId : null,
          },
        };

        batch.set(matchRef, matchData, { merge: true });
      });

      await batch.commit();
      alert("✅ Bracket Saved and Matches Scheduled!");
      navigate(`/tournaments/${id}`);
    } catch (e) {
      console.error("Error saving bracket:", e);
      alert("Failed to save bracket: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearEntireBracket = async () => {
    const msg =
      "🚨 DANGER: This will permanently delete ALL bracket matches from the board AND remove them from your live tournament schedule. Are you absolutely sure?";
    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const tourneyRef = doc(db, "tournaments", id);
      batch.update(tourneyRef, { bracketLayout: null });

      const matchesSnap = await getDocs(
        collection(db, "tournaments", id, "matches"),
      );
      matchesSnap.forEach((docSnap) => {
        if (docSnap.data().meta?.isBracketMatch) batch.delete(docSnap.ref);
      });

      await batch.commit();
      setMatches([]);
      setRounds([{ id: "r1", name: "Round 1" }]);
      setMatchCounter(1);
      setShowGlobalConfig(false);
      alert("🗑️ Bracket completely wiped!");
    } catch (e) {
      console.error("Error clearing bracket:", e);
      alert("Failed to clear bracket: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyChronologicalSettings = () => {
    if (
      !window.confirm(
        "Auto-Schedule ALL matches based on the Default Start Time, Duration, and Gap?",
      )
    )
      return;

    setMatches((prevMatches) => {
      let currentDateTime = null;

      if (globalSettings.date && globalSettings.time) {
        currentDateTime = new Date(
          `${globalSettings.date}T${globalSettings.time}`,
        );
      } else if (globalSettings.time) {
        currentDateTime = new Date(`2026-01-01T${globalSettings.time}`);
      }

      return prevMatches.map((m) => {
        let calcDate = globalSettings.date;
        let calcTime = globalSettings.time;

        if (currentDateTime && !isNaN(currentDateTime.getTime())) {
          const year = currentDateTime.getFullYear();
          const month = String(currentDateTime.getMonth() + 1).padStart(2, "0");
          const day = String(currentDateTime.getDate()).padStart(2, "0");

          calcDate = globalSettings.date ? `${year}-${month}-${day}` : "";

          const hours = String(currentDateTime.getHours()).padStart(2, "0");
          const mins = String(currentDateTime.getMinutes()).padStart(2, "0");
          calcTime = `${hours}:${mins}`;

          currentDateTime.setMinutes(
            currentDateTime.getMinutes() +
              parseInt(globalSettings.matchDuration || 0) +
              parseInt(globalSettings.matchGap || 0),
          );
        }

        return {
          ...m,
          settings: {
            ...m.settings,
            date: calcDate,
            time: calcTime,
          },
        };
      });
    });

    alert("✅ Matches chronologically scheduled!");
    setShowGlobalConfig(false);
  };

  const renderSlot = (match, slotKey) => {
    const slot = match[slotKey];

    return (
      <div className="relative mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[9px] font-black uppercase ${theme.sub}`}>
            {slotKey === "slotA" ? "Team 1" : "Team 2"}
          </span>
          {/* 🟢 3-Way Toggle Button */}
          <button
            onClick={() => cycleSlotType(match.id, slotKey)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border transition-colors ${
              slot.type === "link"
                ? "bg-purple-500/10 text-purple-500 border-purple-500/30"
                : slot.type === "bye"
                  ? "bg-gray-500/10 text-gray-500 border-gray-500/30"
                  : "bg-teal-500/10 text-teal-500 border-teal-500/30"
            }`}
          >
            {slot.type === "link"
              ? "Linked"
              : slot.type === "bye"
                ? "BYE / TBA"
                : "Manual"}
          </button>
        </div>

        {/* 🟢 Render BYE state */}
        {slot.type === "bye" ? (
          <div
            className={`h-10 rounded-lg border flex items-center justify-center ${lightMode ? "bg-gray-100 border-gray-200" : "bg-white/5 border-white/10"}`}
          >
            <span
              className={`text-[10px] font-black uppercase tracking-widest opacity-50 ${theme.sub}`}
            >
              BYE (Advances)
            </span>
          </div>
        ) : slot.type === "team" ? (
          <div
            onDrop={(e) => handleDrop(e, match.id, slotKey)}
            onDragOver={handleDragOver}
            className={`h-10 rounded-lg border flex items-center justify-center relative transition-colors ${
              slot.team
                ? lightMode
                  ? "bg-white border-teal-300 shadow-sm"
                  : "bg-teal-900/20 border-teal-500/30"
                : lightMode
                  ? "bg-gray-50 border-gray-200 border-dashed"
                  : "bg-black/20 border-white/10 border-dashed"
            }`}
          >
            {slot.team ? (
              <>
                <span className={`font-bold text-xs ${theme.text}`}>
                  {slot.team.name}
                </span>
                <button
                  onClick={() => removeTeamFromSlot(match.id, slotKey)}
                  className="absolute right-2 text-red-500 text-[10px] font-bold"
                >
                  X
                </button>
              </>
            ) : (
              <span
                className={`text-[10px] font-bold italic opacity-40 flex items-center gap-1 ${theme.text}`}
              >
                <Users size={12} /> Drag Team Here
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={`h-10 px-3 rounded-lg border flex-1 flex items-center gap-2 ${lightMode ? "bg-purple-50 border-purple-200" : "bg-purple-900/10 border-purple-500/30"}`}
            >
              <LinkIcon size={12} className="text-purple-500" />
              <select
                value={slot.sourceMatchId}
                onChange={(e) =>
                  updateSlotLink(match.id, slotKey, e.target.value)
                }
                className={`w-full bg-transparent text-xs font-bold outline-none ${lightMode ? "text-purple-900" : "text-purple-200"}`}
              >
                <option value="">Select Match Winner</option>
                {matches
                  .filter((m) => m.id !== match.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Winner of {m.id} ({m.title})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading)
    return <div className="text-center p-20 font-bold">Loading Builder...</div>;

  return (
    <div
      className={`h-screen flex flex-col ${theme.bg} ${theme.text} overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b flex justify-between items-center shrink-0 shadow-sm z-10 ${lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/10"}`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/20"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black uppercase tracking-widest italic flex items-center gap-2">
            <Shield className="text-cyan-500" /> Bracket Setup
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGlobalConfig(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest border transition-all ${
              lightMode
                ? "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            }`}
          >
            <Settings size={16} /> Global Defaults
          </button>

          <button
            onClick={handleSaveBracket}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-lg active:scale-95"
          >
            <Save size={16} /> Save Setup
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Available Teams Sidebar */}
        <div
          className={`w-64 border-r flex flex-col shrink-0 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}
        >
          <div
            className={`p-4 border-b z-10 shadow-sm ${lightMode ? "border-gray-200 bg-gray-50" : "border-white/5 bg-[#0F1115]"}`}
          >
            <h2
              className={`text-xs font-black uppercase tracking-widest ${theme.sub}`}
            >
              Available Teams
            </h2>
          </div>

          <div className="p-4 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {Object.entries(groupedTeams)
              .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
              .map(([groupName, groupTeams]) => (
                <div key={groupName} className="space-y-2">
                  <div
                    className={`flex items-center gap-2 mb-1 border-b pb-1 ${lightMode ? "border-gray-200" : "border-white/10"}`}
                  >
                    <Shield size={12} className="text-teal-500" />
                    <h3
                      className={`text-[10px] font-black uppercase tracking-widest ${theme.text}`}
                    >
                      {groupName}
                    </h3>
                    <span
                      className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lightMode ? "bg-gray-200 text-gray-600" : "bg-white/10 text-gray-400"}`}
                    >
                      {groupTeams.length}
                    </span>
                  </div>

                  {groupTeams.map((team) => (
                    <div
                      key={team.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, team)}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-all shadow-sm ${
                        lightMode
                          ? "bg-white border-gray-200 hover:border-cyan-400"
                          : "bg-[#1C2128] border-white/5 hover:border-cyan-500/50"
                      }`}
                    >
                      <GripVertical
                        size={14}
                        className="text-gray-400 opacity-50 shrink-0"
                      />
                      <span className="font-bold text-[11px] truncate leading-tight">
                        {team.name}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

            {teams.length === 0 && !loading && (
              <div className={`text-center text-xs italic py-10 ${theme.sub}`}>
                No teams found.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Horizontal Scrolling Canvas for Rounds */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex p-6 gap-6 custom-scrollbar bg-black/[0.02]">
          {rounds.map((round) => (
            <div key={round.id} className="w-80 flex flex-col shrink-0 h-full">
              {/* 🟢 UPGRADED Round Header (Now visually obvious it is editable) */}
              <div className="flex justify-between items-center mb-4 px-1 group relative">
                <input
                  value={round.name}
                  onChange={(e) =>
                    setRounds(
                      rounds.map((r) =>
                        r.id === round.id ? { ...r, name: e.target.value } : r,
                      ),
                    )
                  }
                  className={`font-black uppercase tracking-widest text-sm outline-none bg-transparent border-b border-transparent focus:border-cyan-500 transition-colors w-full pb-1 ${theme.text}`}
                  title="Click to edit round name"
                />
                <Edit3
                  size={14}
                  className={`absolute right-2 opacity-30 group-hover:opacity-100 transition-opacity ${theme.sub} pointer-events-none`}
                />
              </div>

              {/* Matches List for this Round */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-20">
                {matches
                  .filter((m) => m.roundId === round.id)
                  .map((match) => (
                    <div
                      key={match.id}
                      className={`p-3 rounded-xl border shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/10"}`}
                    >
                      {/* Match Header */}
                      <div className="flex justify-between items-center border-b pb-2 mb-2 border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                            {match.id}
                          </span>
                          <input
                            value={match.title}
                            onChange={(e) =>
                              updateMatchTitle(match.id, e.target.value)
                            }
                            className={`text-xs font-bold outline-none bg-transparent w-28 ${theme.text}`}
                            placeholder="Match Title"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setActiveConfigMatch(match.id)}
                            title="Match Settings"
                            className={`p-1.5 rounded-md transition-colors ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-600" : "bg-white/5 hover:bg-white/10 text-gray-400"}`}
                          >
                            <Settings size={14} />
                          </button>
                          <button
                            onClick={() => deleteMatch(match.id)}
                            title="Delete Match"
                            className={`p-1.5 rounded-md transition-colors ${lightMode ? "bg-red-50 hover:bg-red-100 text-red-500" : "bg-red-500/10 hover:bg-red-500/20 text-red-400"}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Slots */}
                      {renderSlot(match, "slotA")}
                      <div className="text-center text-[8px] font-black italic opacity-30 my-0.5">
                        VS
                      </div>
                      {renderSlot(match, "slotB")}
                    </div>
                  ))}

                {/* Add Match Button */}
                <button
                  onClick={() => addMatchToRound(round.id)}
                  className={`w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors ${
                    lightMode
                      ? "border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-cyan-600 hover:border-cyan-300"
                      : "border-white/20 text-gray-400 hover:bg-white/5 hover:text-cyan-400 hover:border-cyan-500/50"
                  }`}
                >
                  <Plus size={14} /> Add Match Here
                </button>
              </div>
            </div>
          ))}

          {/* Add New Round Column */}
          <div className="w-80 shrink-0 h-full">
            <button
              onClick={addRound}
              className={`w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-colors ${
                lightMode
                  ? "border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-cyan-600"
                  : "border-white/10 text-gray-500 hover:bg-white/5 hover:text-cyan-400"
              }`}
            >
              <Plus size={20} /> Add Next Round
            </button>
          </div>
        </div>
      </div>

      {/* 🔴 MATCH-LEVEL SETTINGS MODAL */}
      {activeConfigMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/10"}`}
          >
            <h3 className="text-lg font-black uppercase mb-4 text-cyan-500 flex items-center gap-2">
              <Calendar size={18} /> Match {activeConfigMatch} Settings
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                  >
                    Overs
                  </label>
                  <input
                    type="number"
                    value={
                      matches.find((m) => m.id === activeConfigMatch)?.settings
                        ?.overs || ""
                    }
                    onChange={(e) =>
                      setMatches(
                        matches.map((m) =>
                          m.id === activeConfigMatch
                            ? {
                                ...m,
                                settings: {
                                  ...m.settings,
                                  overs: e.target.value,
                                },
                              }
                            : m,
                        ),
                      )
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none font-bold text-sm ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                  >
                    Time
                  </label>
                  <input
                    type="time"
                    value={
                      matches.find((m) => m.id === activeConfigMatch)?.settings
                        ?.time || ""
                    }
                    onChange={(e) =>
                      setMatches(
                        matches.map((m) =>
                          m.id === activeConfigMatch
                            ? {
                                ...m,
                                settings: {
                                  ...m.settings,
                                  time: e.target.value,
                                },
                              }
                            : m,
                        ),
                      )
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none font-bold text-sm ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
              </div>

              <div>
                <label
                  className={`text-[10px] font-bold uppercase mb-1 block flex items-center gap-1 ${theme.sub}`}
                >
                  <Calendar size={10} /> Date
                </label>
                <input
                  type="date"
                  value={
                    matches.find((m) => m.id === activeConfigMatch)?.settings
                      ?.date || ""
                  }
                  onChange={(e) =>
                    setMatches(
                      matches.map((m) =>
                        m.id === activeConfigMatch
                          ? {
                              ...m,
                              settings: { ...m.settings, date: e.target.value },
                            }
                          : m,
                      ),
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border outline-none font-bold text-sm ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                />
              </div>

              <div>
                <label
                  className={`text-[10px] font-bold uppercase mb-1 block flex items-center gap-1 ${theme.sub}`}
                >
                  <MapPin size={10} /> Venue
                </label>
                <input
                  type="text"
                  placeholder="e.g. Center Court"
                  value={
                    matches.find((m) => m.id === activeConfigMatch)?.settings
                      ?.venue || ""
                  }
                  onChange={(e) =>
                    setMatches(
                      matches.map((m) =>
                        m.id === activeConfigMatch
                          ? {
                              ...m,
                              settings: {
                                ...m.settings,
                                venue: e.target.value,
                              },
                            }
                          : m,
                      ),
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border outline-none font-bold text-sm ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                />
              </div>
            </div>

            <button
              onClick={() => setActiveConfigMatch(null)}
              className="w-full mt-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 🟢 GLOBAL SETTINGS MODAL */}
      {showGlobalConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/10"}`}
          >
            <h3 className="text-lg font-black uppercase mb-1 text-cyan-500 flex items-center gap-2">
              <Settings size={18} /> Global Match Settings
            </h3>
            <p className={`text-[10px] uppercase font-bold mb-4 ${theme.sub}`}>
              These defaults will apply to all NEW matches you add.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block flex items-center gap-1 ${theme.sub}`}
                  >
                    <Calendar size={10} /> Starting Date
                  </label>
                  <input
                    type="date"
                    value={globalSettings.date}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        date: e.target.value,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block flex items-center gap-1 ${theme.sub}`}
                  >
                    <Clock size={10} /> Start Time
                  </label>
                  <input
                    type="time"
                    value={globalSettings.time}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        time: e.target.value,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                  >
                    Match Duration (Mins)
                  </label>
                  <input
                    type="number"
                    value={globalSettings.matchDuration}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        matchDuration: e.target.value,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-white border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                  >
                    Break Gap (Mins)
                  </label>
                  <input
                    type="number"
                    value={globalSettings.matchGap}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        matchGap: e.target.value,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-white border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                  >
                    Default Venue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Ground"
                    value={globalSettings.venue}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        venue: e.target.value,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
                <div>
                  <label
                    className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                  >
                    Overs
                  </label>
                  <input
                    type="number"
                    value={globalSettings.overs}
                    onChange={(e) =>
                      setGlobalSettings({
                        ...globalSettings,
                        overs: e.target.value,
                      })
                    }
                    className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={handleClearEntireBracket}
                className={`w-full py-3 mb-2 rounded-xl font-black uppercase tracking-widest text-[10px] border transition-all flex justify-center items-center gap-2 shadow-sm ${
                  lightMode
                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                    : "bg-red-900/20 text-red-500 border-red-500/30 hover:bg-red-900/40"
                }`}
              >
                <Trash2 size={14} /> Clear Entire Bracket
              </button>

              <button
                onClick={applyChronologicalSettings}
                className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] border transition-all ${
                  lightMode
                    ? "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                    : "bg-purple-900/20 text-purple-400 border-purple-500/30 hover:bg-purple-900/40"
                }`}
              >
                Auto-Schedule Current Matches
              </button>

              <button
                onClick={() => setShowGlobalConfig(false)}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                Save Defaults & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
