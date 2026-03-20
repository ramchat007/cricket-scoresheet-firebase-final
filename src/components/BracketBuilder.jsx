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
  Edit3,
  Wand2,
} from "lucide-react";

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

  const [rounds, setRounds] = useState([
    { id: "r1", name: "Round 1" },
    { id: "r2", name: "Quarter Finals" },
  ]);

  const [matches, setMatches] = useState([]);
  const [matchCounter, setMatchCounter] = useState(1);

  // 🟢 SETTINGS MODAL STATE
  const [activeConfigMatch, setActiveConfigMatch] = useState(null);
  const [tempMatchId, setTempMatchId] = useState(""); // Holds the ID while typing to prevent UI breaking

  const [showGlobalConfig, setShowGlobalConfig] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState("standard");
  const [wizardTeamsCount, setWizardTeamsCount] = useState(4);

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
            if (tData.bracketLayout.globalSettings)
              setGlobalSettings(tData.bracketLayout.globalSettings);
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

  const handleGenerateWizard = () => {
    if (matches.length > 0) {
      if (
        !window.confirm(
          "This will clear your current board and generate a brand new blueprint. Continue?",
        )
      )
        return;
    }

    if (wizardMode === "lots_12_8") {
      const newRounds = [
        { id: "r1", name: "Round 1 (Leg A & B)" },
        { id: "r2", name: "Quarter Finals" },
        { id: "r3", name: "Semi Finals & Eliminator" },
        { id: "r4", name: "Leg A Final" },
        { id: "r5", name: "Grand Final" },
      ];

      let newMatches = [];
      const pushM = (rId, mId, sA, sB, title) => {
        newMatches.push({
          id: mId,
          roundId: rId,
          title,
          slotA: sA,
          slotB: sB,
          settings: {
            date: globalSettings.date,
            time: "",
            venue: globalSettings.venue,
            overs: globalSettings.overs,
          },
        });
      };

      const man = { type: "team", team: null, sourceMatchId: "" };
      const bye = { type: "bye", team: null, sourceMatchId: "" };
      const link = (src) => ({ type: "link", team: null, sourceMatchId: src });

      for (let i = 1; i <= 6; i++)
        pushM("r1", `M${i}`, man, man, `Leg A - R1 M${i}`);
      for (let i = 7; i <= 10; i++)
        pushM("r1", `M${i}`, man, man, `Leg B - R1 M${i - 6}`);

      pushM("r2", "M11", link("M1"), link("M2"), "Leg A - QF 1");
      pushM("r2", "M12", link("M3"), link("M4"), "Leg A - QF 2");
      pushM("r2", "M13", link("M5"), link("M6"), "Leg A - QF 3");
      pushM("r2", "M14", link("M7"), link("M8"), "Leg B - SF 1");
      pushM("r2", "M15", link("M9"), link("M10"), "Leg B - SF 2");

      pushM("r3", "M16", link("M11"), link("M12"), "Leg A - Eliminator");
      pushM("r3", "M17", link("M13"), bye, "Leg A - BYE (Waiting)");
      pushM("r3", "M18", link("M14"), link("M15"), "Leg B - Final");

      pushM("r4", "M19", link("M16"), link("M17"), "Leg A - Final");
      pushM("r4", "M20", link("M18"), bye, "Leg B - BYE (Waiting)");

      pushM("r5", "M21", link("M19"), link("M20"), "Grand Final");

      setRounds(newRounds);
      setMatches(newMatches);
      setMatchCounter(22);
      setShowWizard(false);
      return;
    }

    const count = parseInt(wizardTeamsCount);
    if (isNaN(count) || count < 2)
      return alert("You need at least 2 teams to generate a bracket.");

    const totalRounds = Math.ceil(Math.log2(count));
    const bracketSize = Math.pow(2, totalRounds);
    const byesNeeded = bracketSize - count;

    let newRounds = [];
    let newMatches = [];
    let mCounter = 1;
    let previousRoundMatches = [];

    for (let r = 0; r < totalRounds; r++) {
      const roundId = `r${r + 1}`;
      const isFinal = r === totalRounds - 1;
      const isSemi = r === totalRounds - 2;
      const roundName = isFinal
        ? "Final"
        : isSemi
          ? "Semi-Finals"
          : `Round ${r + 1}`;

      newRounds.push({ id: roundId, name: roundName });

      const matchesInThisRound = bracketSize / Math.pow(2, r + 1);
      const currentRoundMatchIds = [];

      for (let m = 0; m < matchesInThisRound; m++) {
        const matchId = `M${mCounter}`;
        let slotA = { type: "team", team: null, sourceMatchId: "" };
        let slotB = { type: "team", team: null, sourceMatchId: "" };

        if (r === 0) {
          if (m >= matchesInThisRound - byesNeeded) {
            slotB = { type: "bye", team: null, sourceMatchId: "" };
          }
        } else {
          const prev1 = previousRoundMatches[m * 2];
          const prev2 = previousRoundMatches[m * 2 + 1];
          slotA = { type: "link", team: null, sourceMatchId: prev1 };
          slotB = { type: "link", team: null, sourceMatchId: prev2 };
        }

        newMatches.push({
          id: matchId,
          roundId,
          title: `Match ${mCounter}`,
          slotA,
          slotB,
          settings: {
            date: globalSettings.date,
            time: "",
            venue: globalSettings.venue,
            overs: globalSettings.overs,
          },
        });

        currentRoundMatchIds.push(matchId);
        mCounter++;
      }
      previousRoundMatches = currentRoundMatchIds;
    }

    setRounds(newRounds);
    setMatches(newMatches);
    setMatchCounter(mCounter);
    setShowWizard(false);
  };

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
            [slotKey]: { type: nextType, team: null, sourceMatchId: "" },
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
        if (m.id === matchId && m[slotKey].type === "team")
          return { ...m, [slotKey]: { ...m[slotKey], team } };
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
        if (m.slotA.type === "link" && m.slotA.sourceMatchId === matchId)
          updatedMatch.slotA = { type: "team", team: null, sourceMatchId: "" };
        if (m.slotB.type === "link" && m.slotB.sourceMatchId === matchId)
          updatedMatch.slotB = { type: "team", team: null, sourceMatchId: "" };
        return updatedMatch;
      });
    });
  };

  // 🟢 SMART MATCH ID CHANGER
  const handleCloseSettingsModal = () => {
    if (tempMatchId.trim() && tempMatchId !== activeConfigMatch) {
      const newId = tempMatchId.trim().toUpperCase();

      if (matches.some((m) => m.id === newId)) {
        alert(`Match ID "${newId}" already exists! Please choose a unique ID.`);
        return; // Stop the modal from closing
      }

      setMatches((prevMatches) =>
        prevMatches.map((m) => {
          // Update the match itself
          if (m.id === activeConfigMatch) {
            return { ...m, id: newId };
          }
          // Update any links pointing to this match!
          let updatedMatch = { ...m };
          if (
            updatedMatch.slotA.type === "link" &&
            updatedMatch.slotA.sourceMatchId === activeConfigMatch
          ) {
            updatedMatch.slotA.sourceMatchId = newId;
          }
          if (
            updatedMatch.slotB.type === "link" &&
            updatedMatch.slotB.sourceMatchId === activeConfigMatch
          ) {
            updatedMatch.slotB.sourceMatchId = newId;
          }
          return updatedMatch;
        }),
      );
    }
    setActiveConfigMatch(null);
  };

  const handleSaveBracket = async () => {
    if (matches.length === 0) return alert("Add at least one match to save.");
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

        let teamAName = "TBD";
        let teamAId = null;
        let teamALogo = null;
        if (m.slotA.type === "team" && m.slotA.team) {
          teamAName = m.slotA.team.name;
          teamAId = m.slotA.team.id;
          teamALogo = m.slotA.team.logo || m.slotA.team.logoUrl || null;
        } else if (m.slotA.type === "link" && m.slotA.sourceMatchId)
          teamAName = `Winner of ${m.slotA.sourceMatchId}`;
        else if (m.slotA.type === "bye") teamAName = "BYE";

        let teamBName = "TBD";
        let teamBId = null;
        let teamBLogo = null;
        if (m.slotB.type === "team" && m.slotB.team) {
          teamBName = m.slotB.team.name;
          teamBId = m.slotB.team.id;
          teamBLogo = m.slotB.team.logo || m.slotB.team.logoUrl || null;
        } else if (m.slotB.type === "link" && m.slotB.sourceMatchId)
          teamBName = `Winner of ${m.slotB.sourceMatchId}`;
        else if (m.slotB.type === "bye") teamBName = "BYE";

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
    if (
      !window.confirm(
        "🚨 DANGER: This will permanently delete ALL bracket matches from the board AND remove them from your live tournament schedule. Are you absolutely sure?",
      )
    )
      return;

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
      if (globalSettings.date && globalSettings.time)
        currentDateTime = new Date(
          `${globalSettings.date}T${globalSettings.time}`,
        );
      else if (globalSettings.time)
        currentDateTime = new Date(`2026-01-01T${globalSettings.time}`);

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
          settings: { ...m.settings, date: calcDate, time: calcTime },
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
            onClick={() => setShowWizard(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest border transition-all ${
              lightMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"
            }`}
          >
            <Wand2 size={16} /> Auto-Generate
          </button>

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

        <div className="flex-1 overflow-x-auto overflow-y-hidden flex p-6 gap-6 custom-scrollbar bg-black/[0.02]">
          {rounds.map((round) => (
            <div key={round.id} className="w-80 flex flex-col shrink-0 h-full">
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

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-20">
                {matches
                  .filter((m) => m.roundId === round.id)
                  .map((match) => (
                    <div
                      key={match.id}
                      className={`p-3 rounded-xl border shadow-sm ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/10"}`}
                    >
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
                            onClick={() => {
                              setActiveConfigMatch(match.id);
                              setTempMatchId(match.id); // 🟢 Setup temporary ID for editing
                            }}
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
                      {renderSlot(match, "slotA")}
                      <div className="text-center text-[8px] font-black italic opacity-30 my-0.5">
                        VS
                      </div>
                      {renderSlot(match, "slotB")}
                    </div>
                  ))}
                <button
                  onClick={() => addMatchToRound(round.id)}
                  className={`w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors ${lightMode ? "border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-cyan-600 hover:border-cyan-300" : "border-white/20 text-gray-400 hover:bg-white/5 hover:text-cyan-400 hover:border-cyan-500/50"}`}
                >
                  <Plus size={14} /> Add Match Here
                </button>
              </div>
            </div>
          ))}
          <div className="w-80 shrink-0 h-full">
            <button
              onClick={addRound}
              className={`w-full h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-colors ${lightMode ? "border-gray-300 text-gray-400 hover:bg-gray-50 hover:text-cyan-600" : "border-white/10 text-gray-500 hover:bg-white/5 hover:text-cyan-400"}`}
            >
              <Plus size={20} /> Add Next Round
            </button>
          </div>
        </div>
      </div>

      {/* 🟢 MAGIC WIZARD MODAL */}
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/10"}`}
          >
            <h3 className="text-lg font-black uppercase mb-4 text-indigo-500 flex items-center gap-2">
              <Wand2 size={18} /> Bracket Wizard
            </h3>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setWizardMode("standard")}
                className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${wizardMode === "standard" ? "bg-indigo-600 text-white border-indigo-600" : lightMode ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-black/20 text-gray-400 border-white/10"}`}
              >
                Standard
              </button>
              <button
                onClick={() => setWizardMode("lots_12_8")}
                className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${wizardMode === "lots_12_8" ? "bg-indigo-600 text-white border-indigo-600" : lightMode ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-black/20 text-gray-400 border-white/10"}`}
              >
                12+8 Custom
              </button>
            </div>

            {wizardMode === "standard" ? (
              <>
                <p className={`text-xs mb-4 ${theme.sub}`}>
                  Enter the number of teams. The wizard will automatically map
                  perfect powers of 2.
                </p>
                <label
                  className={`text-[10px] font-bold uppercase mb-2 block ${theme.sub}`}
                >
                  Total Teams
                </label>
                <input
                  type="number"
                  min="2"
                  value={wizardTeamsCount}
                  onChange={(e) => setWizardTeamsCount(e.target.value)}
                  className={`w-full p-4 rounded-xl border outline-none font-black text-xl mb-6 ${lightMode ? "bg-gray-50 border-gray-200 text-indigo-600" : "bg-black/40 border-white/10 text-indigo-400"}`}
                />
              </>
            ) : (
              <>
                <p className={`text-xs mb-4 ${theme.sub}`}>
                  Generates an asymmetrical bracket specifically for a 12-team
                  Leg merging with an 8-team Leg, including late-stage BYEs.
                </p>
                <div
                  className={`p-3 rounded-lg border mb-6 text-[10px] font-mono leading-relaxed ${lightMode ? "bg-indigo-50 border-indigo-100 text-indigo-700" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"}`}
                >
                  • Round 1: 10 Matches
                  <br />
                  • Quarter Finals: 5 Matches
                  <br />
                  • Semi Finals: 2 Matches + 1 BYE Bridge
                  <br />
                  • Leg A Final: 1 Match + 1 BYE Bridge
                  <br />• Grand Final: 1 Match
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowWizard(false)}
                className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${lightMode ? "bg-gray-200 text-gray-700" : "bg-white/10 text-white"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateWizard}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 MATCH-LEVEL SETTINGS MODAL */}
      {activeConfigMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/10"}`}
          >
            <h3 className="text-lg font-black uppercase mb-4 text-cyan-500 flex items-center gap-2">
              <Calendar size={18} /> Match Settings
            </h3>

            <div className="space-y-4">
              {/* 🟢 NEW: Edit Match ID Field */}
              <div>
                <label
                  className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}
                >
                  Match ID (Code)
                </label>
                <input
                  type="text"
                  value={tempMatchId}
                  onChange={(e) => setTempMatchId(e.target.value.toUpperCase())}
                  className={`w-full p-2.5 rounded-xl border outline-none font-black text-sm uppercase tracking-wider ${lightMode ? "bg-cyan-50 border-cyan-200 text-cyan-800" : "bg-cyan-900/20 border-cyan-500/30 text-cyan-400"}`}
                />
              </div>

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

            {/* 🟢 Trigger the Smart Change Handler */}
            <button
              onClick={handleCloseSettingsModal}
              className="w-full mt-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 🟢 GLOBAL SETTINGS MODAL (Fixed & Restored) */}
      {showGlobalConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/10"}`}>
            <h3 className="text-lg font-black uppercase mb-1 text-cyan-500 flex items-center gap-2"><Settings size={18} /> Global Match Settings</h3>
            <p className={`text-[10px] uppercase font-bold mb-4 ${theme.sub}`}>These defaults apply to all NEW matches and Auto-Schedules.</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`text-[10px] font-bold uppercase mb-1 block flex items-center gap-1 ${theme.sub}`}><Calendar size={10} /> Starting Date</label><input type="date" value={globalSettings.date} onChange={(e) => setGlobalSettings({ ...globalSettings, date: e.target.value })} className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`} /></div>
                <div><label className={`text-[10px] font-bold uppercase mb-1 block flex items-center gap-1 ${theme.sub}`}><Clock size={10} /> Start Time</label><input type="time" value={globalSettings.time} onChange={(e) => setGlobalSettings({ ...globalSettings, time: e.target.value })} className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`} /></div>
              </div>

              {/* 🟢 RESTORED VENUE FIELD */}
              <div>
                <label className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}>Default Venue</label>
                <input 
                  type="text" 
                  placeholder="e.g. Wankhede Stadium" 
                  value={globalSettings.venue} 
                  onChange={(e) => setGlobalSettings({ ...globalSettings, venue: e.target.value })} 
                  className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`} 
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                   <label className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}>Overs</label>
                   <input type="number" value={globalSettings.overs} onChange={(e) => setGlobalSettings({ ...globalSettings, overs: e.target.value })} className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`} />
                </div>
                <div className="col-span-1">
                  <label className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}>Duration (m)</label>
                  <input type="number" value={globalSettings.matchDuration} onChange={(e) => setGlobalSettings({ ...globalSettings, matchDuration: e.target.value })} className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`} />
                </div>
                <div className="col-span-1">
                  <label className={`text-[10px] font-bold uppercase mb-1 block ${theme.sub}`}>Gap (m)</label>
                  <input type="number" value={globalSettings.matchGap} onChange={(e) => setGlobalSettings({ ...globalSettings, matchGap: e.target.value })} className={`w-full p-2.5 rounded-xl border outline-none text-sm font-bold ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/10 text-white"}`} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <button onClick={handleClearEntireBracket} className={`w-full py-3 mb-2 rounded-xl font-black uppercase tracking-widest text-[10px] border transition-all flex justify-center items-center gap-2 shadow-sm ${lightMode ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-red-900/20 text-red-500 border-red-500/30 hover:bg-red-900/40"}`}><Trash2 size={14} /> Clear Entire Bracket</button>
              <button onClick={applyChronologicalSettings} className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] border transition-all ${lightMode ? "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100" : "bg-purple-900/20 text-purple-400 border-purple-500/30 hover:bg-purple-900/40"}`}>Auto-Schedule Current Matches</button>
              <button onClick={() => setShowGlobalConfig(false)} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95">Save Defaults & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
