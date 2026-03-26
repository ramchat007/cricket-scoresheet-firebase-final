import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  writeBatch,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useTheme } from "../context/ThemeContext";

export default function MatchScheduler({
  tournamentId,
  teams: propTeams = [],
  onCancel,
}) {
  const { theme } = useTheme();

  // --- STATE ---
  const [mode, setMode] = useState("single");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Local Teams State
  const [fetchedTeams, setFetchedTeams] = useState([]);

  // Match Form State
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [venue, setVenue] = useState("");
  const [overs, setOvers] = useState(5);
  const [matchLabel, setMatchLabel] = useState("");

  // Auto Schedule State
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [startTime, setStartTime] = useState("09:00");
  const [defaultVenue, setDefaultVenue] = useState("");
  const [matchDuration, setMatchDuration] = useState(30);
  const [matchGap, setMatchGap] = useState(0);
  const [matchesPerDay, setMatchesPerDay] = useState(25);
  const [autoOvers, setAutoOvers] = useState(5);
  const [leagueStageName, setLeagueStageName] = useState("League Match");
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  // --- 1. SMART TEAM LOADING ---
  useEffect(() => {
    if (propTeams.length > 0) return;
    if (!tournamentId) return;

    const q = query(
      collection(db, "tournaments", tournamentId, "teams"),
      orderBy("name", "asc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFetchedTeams(data);
    });

    return () => unsubscribe();
  }, [tournamentId, propTeams]);

  const activeTeams = propTeams.length > 0 ? propTeams : fetchedTeams;

  useEffect(() => {
    if (activeTeams.length > 0 && selectedTeamIds.length === 0) {
      setSelectedTeamIds(activeTeams.map((t) => t.id));
    }
  }, [activeTeams]);

  const toggleTeamSelection = (teamId) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    );
  };

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

  // --- 2. RESET SCHEDULE ---
  const handleResetSchedule = async () => {
    if (
      !window.confirm(
        "⚠️ Are you sure? This will delete all UNPLAYED/UPCOMING matches.",
      )
    )
      return;

    setResetting(true);
    try {
      const matchesCol = collection(db, "tournaments", tournamentId, "matches");
      const snapshot = await getDocs(matchesCol);
      const batch = writeBatch(db);
      let deleteCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const rootStatus = String(data.status || "").toLowerCase();
        const metaStatus = String(data.meta?.status || "").toLowerCase();
        const unplayedStatuses = ["upcoming", "pending", "scheduled", ""];

        if (
          unplayedStatuses.includes(rootStatus) ||
          unplayedStatuses.includes(metaStatus)
        ) {
          batch.delete(doc.ref);
          deleteCount++;
        }
      });

      if (deleteCount === 0) {
        alert("No upcoming or pending matches found to delete.");
        setResetting(false);
        return;
      }

      await batch.commit();
      alert(`Successfully deleted ${deleteCount} matches.`);
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  // --- 3. CREATE SINGLE MATCH ---
  const handleCreateMatch = async () => {
    if (!teamAId || !teamBId) return alert("Select both teams");
    if (teamAId === teamBId) return alert("Cannot play against same team");

    setCreating(true);
    try {
      const teamA = activeTeams.find((t) => t.id === teamAId);
      const teamB = activeTeams.find((t) => t.id === teamBId);
      const startDateTime = new Date(`${date}T${time}`);
      const finalMatchNo = matchLabel.trim() || Date.now();

      await addDoc(collection(db, "tournaments", tournamentId, "matches"), {
        meta: {
          tournament: tournamentId,
          teamA: teamA.name,
          teamB: teamB.name,
          teamAId: teamA.id,
          teamBId: teamB.id,
          teamALogo: teamA.logoUrl || teamA.logo || "",
          teamBLogo: teamB.logoUrl || teamB.logo || "",
          overs: Number(overs),
          date: date,
          time: time,
          venue: venue || "TBA",
          startAt: startDateTime.toISOString(),
          status: "upcoming",
          createdAt: new Date().toISOString(),
          format: "T20",
          matchTitle: matchLabel.trim(),
        },
        teamASquad: sanitizeSquad(teamA.roster),
        teamBSquad: sanitizeSquad(teamB.roster),
        innings: [],
        status: "upcoming",
        matchNo: finalMatchNo,
      });

      alert("Match scheduled!");
      setTeamAId("");
      setTeamBId("");
      setMatchLabel("");
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  // --- 4. AUTO SCHEDULE (Unified Pool for Selected Teams) ---
  const handleAutoSchedule = async () => {
    const teamsToSchedule = activeTeams.filter((t) =>
      selectedTeamIds.includes(t.id),
    );

    if (teamsToSchedule.length < 2)
      return alert("Need at least 2 teams selected.");
    if (
      !window.confirm(
        `Generate Round-Robin schedule for the ${teamsToSchedule.length} selected teams?`,
      )
    )
      return;

    setCreating(true);
    try {
      let generatedMatches = [];
      let pool = [...teamsToSchedule];

      // 🟢 FIX: unified round-robin pool prevents 3-team bug
      if (pool.length % 2 !== 0) pool.push({ id: "BYE", name: "BYE" });

      const numTeams = pool.length;
      const matchesPerRound = numTeams / 2;

      for (let round = 0; round < numTeams - 1; round++) {
        for (let match = 0; match < matchesPerRound; match++) {
          const team1 = pool[match];
          const team2 = pool[numTeams - 1 - match];
          if (team1.id !== "BYE" && team2.id !== "BYE") {
            generatedMatches.push({
              teamA: team1,
              teamB: team2,
              stageName: leagueStageName || "League Match",
            });
          }
        }
        pool.splice(1, 0, pool.pop()); // Rotate array
      }

      await writeScheduledMatchesToFirestore(generatedMatches);
      setMode("single");
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  // --- 5. AUTO SCHEDULE GROUPS (Strictly respects DB Groups) ---
  const handleAutoScheduleGroups = async () => {
    // 🟢 FIX: Uses activeTeams instead of propTeams
    const teamList = activeTeams || [];

    if (teamList.length < 2)
      return alert("Not enough teams to schedule matches.");
    if (
      !window.confirm(
        "Auto-generate Group Stage matches? This strictly schedules matches within assigned groups.",
      )
    )
      return;

    setCreating(true);
    try {
      const groupedTeams = {};
      let hasGroups = false;

      teamList.forEach((team) => {
        const groupName = team.group
          ? `Group ${team.group}`
          : "Unassigned League";
        if (team.group) hasGroups = true;
        if (!groupedTeams[groupName]) groupedTeams[groupName] = [];
        groupedTeams[groupName].push(team);
      });

      if (!hasGroups) {
        setCreating(false);
        return alert(
          "No groups found! Please assign groups (A, B, C) to your teams in the Team Manager first.",
        );
      }

      let generatedMatches = [];

      Object.entries(groupedTeams).forEach(([groupName, groupRoster]) => {
        let pool = [...groupRoster];
        if (pool.length < 2) return;

        if (pool.length % 2 !== 0) pool.push({ id: "BYE", name: "BYE" });
        const numTeams = pool.length;
        const matchesPerRound = numTeams / 2;

        for (let round = 0; round < numTeams - 1; round++) {
          for (let match = 0; match < matchesPerRound; match++) {
            const team1 = pool[match];
            const team2 = pool[numTeams - 1 - match];
            if (team1.id !== "BYE" && team2.id !== "BYE") {
              generatedMatches.push({
                teamA: team1,
                teamB: team2,
                stageName: groupName,
                roundIndex: round,
              });
            }
          }
          pool.splice(1, 0, pool.pop());
        }
      });

      // Interleave group matches (Match 1 Grp A, Match 1 Grp B, etc.)
      generatedMatches.sort((a, b) => a.roundIndex - b.roundIndex);

      await writeScheduledMatchesToFirestore(generatedMatches);
    } catch (error) {
      console.error(error);
      alert("Failed to generate group matches.");
    } finally {
      setCreating(false);
    }
  };

  // --- HELPER: WRITES BATCH MATCHES WITH TIME LOGIC AND PROPER SCHEMA ---
  const writeScheduledMatchesToFirestore = async (generatedMatches) => {
    if (generatedMatches.length === 0)
      throw new Error(
        "Could not generate matches. Make sure pools have at least 2 teams.",
      );

    let matchCount = 0;
    let currentDateTime = new Date(`${startDate}T${startTime}`);
    let matchesToday = 0;

    const batch = writeBatch(db);
    const matchesCol = collection(db, "tournaments", tournamentId, "matches");

    generatedMatches.forEach(({ teamA, teamB, stageName }) => {
      if (matchesToday >= matchesPerDay) {
        currentDateTime.setDate(currentDateTime.getDate() + 1);
        const [h, m] = startTime.split(":");
        currentDateTime.setHours(h, m, 0, 0);
        matchesToday = 0;
      }

      matchCount++;
      const endDateTime = new Date(currentDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + Number(matchDuration));

      // 🟢 FIX: Proper 'meta' nesting for names to show correctly
      const matchData = {
        meta: {
          tournament: tournamentId,
          teamA: teamA.name,
          teamB: teamB.name,
          teamAId: teamA.id,
          teamBId: teamB.id,
          teamALogo: teamA.logoUrl || teamA.logo || "",
          teamBLogo: teamB.logoUrl || teamB.logo || "",
          overs: Number(autoOvers),
          date: currentDateTime.toISOString().slice(0, 10),
          time: currentDateTime.toTimeString().slice(0, 5),
          venue: defaultVenue || "TBA",
          startAt: currentDateTime.toISOString(),
          endAt: endDateTime.toISOString(),
          status: "upcoming",
          createdAt: new Date().toISOString(),
          format: stageName,
          matchTitle: `Match ${matchCount} | ${stageName}`,
        },
        teamASquad: sanitizeSquad(teamA.roster),
        teamBSquad: sanitizeSquad(teamB.roster),
        innings: [],
        status: "upcoming",
        matchNo: matchCount,
      };

      batch.set(doc(matchesCol), matchData);

      matchesToday++;
      currentDateTime.setMinutes(
        currentDateTime.getMinutes() + Number(matchDuration) + Number(matchGap),
      );
    });

    await batch.commit();
    alert(`Successfully generated ${matchCount} matches!`);
  };

  // --- 6. GENERATE KNOCKOUTS ---
  const handleGenerateKnockouts = async () => {
    if (
      !window.confirm("Generate Knockout placeholders (Semi-Finals & Final)?")
    )
      return;

    const startNo =
      parseInt(
        window.prompt("Enter starting Match Number for Knockouts:", "13"),
      ) || 99;

    const knockoutMatches = [
      {
        // 🟢 FIX: Moved data inside the 'meta' object so names display properly
        meta: {
          tournament: tournamentId,
          teamA: "Winner Group A",
          teamB: "Runner-Up Group B",
          teamAId: "TBD",
          teamBId: "TBD",
          teamALogo: "",
          teamBLogo: "",
          date: "",
          time: "",
          venue: "TBD",
          status: "upcoming",
          format: "Knockout",
          matchTitle: "Semi-Final 1",
        },
        status: "upcoming",
        matchNo: startNo,
        teamASquad: [],
        teamBSquad: [],
        innings: [],
      },
      {
        meta: {
          tournament: tournamentId,
          teamA: "Winner Group B",
          teamB: "Runner-Up Group A",
          teamAId: "TBD",
          teamBId: "TBD",
          teamALogo: "",
          teamBLogo: "",
          date: "",
          time: "",
          venue: "TBD",
          status: "upcoming",
          format: "Knockout",
          matchTitle: "Semi-Final 2",
        },
        status: "upcoming",
        matchNo: startNo + 1,
        teamASquad: [],
        teamBSquad: [],
        innings: [],
      },
      {
        meta: {
          tournament: tournamentId,
          teamA: "Winner SF 1",
          teamB: "Winner SF 2",
          teamAId: "TBD",
          teamBId: "TBD",
          teamALogo: "",
          teamBLogo: "",
          date: "",
          time: "",
          venue: "TBD",
          status: "upcoming",
          format: "Knockout",
          matchTitle: "FINAL",
        },
        status: "upcoming",
        matchNo: startNo + 2,
        teamASquad: [],
        teamBSquad: [],
        innings: [],
      },
    ];

    try {
      const batch = writeBatch(db);
      knockoutMatches.forEach((match) => {
        const matchRef = doc(
          collection(db, `tournaments/${tournamentId}/matches`),
        );
        batch.set(matchRef, match);
      });
      await batch.commit();
      alert(
        "Knockout placeholders generated! You can edit them later once teams qualify.",
      );
    } catch (error) {
      console.error(error);
    }
  };

  // --- THEMED STYLES ---
  const labelClass = `block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ml-1 ${lightMode ? "text-gray-500" : "text-slate-500"}`;
  const inputClass = `w-full rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500/50 transition-all font-bold border ${lightMode ? "bg-white text-gray-900 border-gray-200 placeholder:text-gray-400" : "bg-[#303643] text-slate-200 border-white/10 placeholder:text-slate-600"}`;

  return (
    <div
      className={`border rounded-[2rem] p-6 shadow-2xl relative animate-in slide-in-from-top-5 mt-6 mb-8 backdrop-blur-md ${theme.card} ${lightMode ? "border-purple-100 shadow-purple-500/5" : "border-white/5"}`}>
      {/* --- MODE TABS --- */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div
          className={`flex rounded-xl p-1.5 shadow-inner border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-[#161920] border-white/5"}`}>
          {[
            { id: "single", label: "Single Match" },
            { id: "auto", label: "⚡ Auto Scheduler" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                mode === tab.id
                  ? lightMode
                    ? "bg-white text-teal-700 shadow-md border border-gray-200"
                    : "bg-[#0F1115] text-white shadow-md border border-white/5"
                  : lightMode
                    ? "text-gray-500 hover:text-gray-700"
                    : "text-slate-500 hover:text-slate-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={handleAutoScheduleGroups}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md">
            Auto-Schedule Groups
          </button>
          <button
            onClick={handleGenerateKnockouts}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md">
            Add Knockout Stages
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleResetSchedule}
            disabled={resetting}
            className={`text-xs font-black uppercase tracking-wider px-4 py-2 border rounded-lg ${lightMode ? "text-red-600 bg-red-50 border-red-200" : "text-red-500 bg-red-900/10 border-red-500/20"}`}>
            {resetting ? "Deleting..." : "🗑 Reset Upcoming"}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 border border-transparent rounded-lg ${lightMode ? "text-gray-500 hover:bg-gray-100" : "text-slate-500 hover:text-white hover:border-white/10"}`}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* --- SINGLE MATCH FORM --- */}
      {mode === "single" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`${labelClass} text-teal-500`}>
                Home Team ({activeTeams.length})
              </label>
              <div className="relative group">
                <select
                  className={`${inputClass} appearance-none cursor-pointer`}
                  value={teamAId}
                  onChange={(e) => setTeamAId(e.target.value)}
                  disabled={activeTeams.length === 0}>
                  <option value="">
                    {activeTeams.length === 0
                      ? "⚠️ No Teams Found"
                      : "-- Select Team A --"}
                  </option>
                  {activeTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div
                  className={`absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none ${lightMode ? "text-gray-400" : "text-slate-500"}`}>
                  ▼
                </div>
              </div>
            </div>

            <div>
              <label className={`${labelClass} text-indigo-400`}>
                Away Team
              </label>
              <div className="relative group">
                <select
                  className={`${inputClass} appearance-none cursor-pointer`}
                  value={teamBId}
                  onChange={(e) => setTeamBId(e.target.value)}
                  disabled={activeTeams.length === 0}>
                  <option value="">-- Select Team B --</option>
                  {activeTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div
                  className={`absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none ${lightMode ? "text-gray-400" : "text-slate-500"}`}>
                  ▼
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Time</label>
                <input
                  type="time"
                  className={inputClass}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Overs</label>
                <input
                  type="number"
                  className={inputClass}
                  value={overs}
                  onChange={(e) => setOvers(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Venue</label>
              <input
                type="text"
                className={inputClass}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Stadium Name"
              />
            </div>
            <div>
              <label className={labelClass}>Match Label</label>
              <input
                type="text"
                className={inputClass}
                value={matchLabel}
                onChange={(e) => setMatchLabel(e.target.value)}
                placeholder="e.g. Qualifier 1"
              />
            </div>
          </div>
          <button
            onClick={handleCreateMatch}
            disabled={creating || !teamAId || !teamBId}
            className="w-full bg-gradient-to-r from-teal-600 to-teal-800 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl hover:shadow-teal-900/30 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating ? "Scheduling..." : "Create Match"}
          </button>
        </div>
      ) : (
        /* --- AUTO SCHEDULE FORM --- */
        <div className="space-y-6">
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${lightMode ? "bg-indigo-50 border-indigo-100" : "bg-indigo-900/20 border-indigo-500/20"}`}>
            <span className="text-xl">🤖</span>
            <p
              className={`text-xs font-medium ${lightMode ? "text-indigo-700" : "text-slate-300"}`}>
              Generates a <strong>Round Robin</strong> schedule for{" "}
              {selectedTeamIds.length} selected teams.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${lightMode ? "bg-white border-gray-200" : "bg-black/20 border-white/5"}`}>
            <div className="flex justify-between items-center mb-3">
              <label className={labelClass}>
                Select Teams for this Group/Stage
              </label>
              <button
                onClick={() =>
                  setSelectedTeamIds(
                    selectedTeamIds.length === activeTeams.length
                      ? []
                      : activeTeams.map((t) => t.id),
                  )
                }
                className={`text-[10px] font-bold uppercase hover:underline ${theme.sub}`}>
                {selectedTeamIds.length === activeTeams.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {activeTeams.map((team) => {
                const isSelected = selectedTeamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeamSelection(team.id)}
                    className={`p-2 rounded-lg border text-xs font-bold truncate transition-all text-left flex items-center gap-2 ${isSelected ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 shadow-sm" : lightMode ? "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100" : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"}`}>
                    <div
                      className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${isSelected ? "border-teal-500 bg-teal-500" : "border-gray-400"}`}>
                      {isSelected && (
                        <span className="text-white text-[8px]">✓</span>
                      )}
                    </div>
                    <span className="truncate">{team.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-gray-500/30">
              <label className={labelClass}>Stage / Group Name</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Group A / Semi Finals"
                value={leagueStageName}
                onChange={(e) => setLeagueStageName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Start Date</label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>First Match Time</label>
              <input
                type="time"
                className={inputClass}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Matches Per Day</label>
              <input
                type="number"
                className={inputClass}
                value={matchesPerDay}
                onChange={(e) => setMatchesPerDay(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Duration (Mins)</label>
              <input
                type="number"
                className={inputClass}
                value={matchDuration}
                onChange={(e) => setMatchDuration(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Gap (Mins)</label>
              <input
                type="number"
                className={inputClass}
                value={matchGap}
                onChange={(e) => setMatchGap(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Overs</label>
              <input
                type="number"
                className={inputClass}
                value={autoOvers}
                onChange={(e) => setAutoOvers(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <label className={labelClass}>Default Venue</label>
              <input
                type="text"
                className={inputClass}
                value={defaultVenue}
                onChange={(e) => setDefaultVenue(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleAutoSchedule}
            disabled={creating || selectedTeamIds.length < 2}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl hover:shadow-indigo-900/30 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating
              ? "Generating..."
              : `Generate Schedule (${selectedTeamIds.length} Teams)`}
          </button>
        </div>
      )}
    </div>
  );
}
