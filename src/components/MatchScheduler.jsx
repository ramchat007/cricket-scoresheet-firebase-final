import React, { useState } from "react";
import {
  collection,
  doc,
  writeBatch,
  addDoc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";

export default function MatchScheduler({ tournamentId, teams, onCancel }) {
  const [mode, setMode] = useState("single");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Single Match State
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [venue, setVenue] = useState("");
  const [overs, setOvers] = useState(10);

  // Auto Schedule State
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState("09:00");
  const [defaultVenue, setDefaultVenue] = useState("");
  const [matchDuration, setMatchDuration] = useState(180);
  const [matchGap, setMatchGap] = useState(30);
  const [matchesPerDay, setMatchesPerDay] = useState(2);
  const [autoOvers, setAutoOvers] = useState(10);

  const sanitizeSquad = (roster) => {
    if (!roster) return [];
    return roster.map((player) => {
      const { photoURL, statsSnapshot, ...lightweightPlayer } = player;
      return lightweightPlayer;
    });
  };

  // --- 1. RESET SCHEDULE ---
  const handleResetSchedule = async () => {
    if (
      !window.confirm(
        "⚠️ DANGER: This will DELETE ALL matches in the schedule. Are you sure?"
      )
    )
      return;

    setResetting(true);
    try {
      const matchesCol = collection(db, "tournaments", tournamentId, "matches");
      const snapshot = await getDocs(matchesCol);

      if (snapshot.empty) {
        alert("No matches to delete.");
        return;
      }

      const chunks = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((doc) => {
        currentBatch.delete(doc.ref);
        count++;
        if (count >= 450) {
          chunks.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      });
      if (count > 0) chunks.push(currentBatch.commit());

      await Promise.all(chunks);
      alert("Schedule cleared successfully!");
    } catch (e) {
      console.error(e);
      alert("Reset failed: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  // --- 2. CREATE SINGLE MATCH ---
  const handleCreateMatch = async () => {
    if (!teamAId || !teamBId) return alert("Select both teams");
    if (teamAId === teamBId) return alert("Cannot play against same team");

    setCreating(true);
    try {
      const teamA = teams.find((t) => t.id === teamAId);
      const teamB = teams.find((t) => t.id === teamBId);

      const startDateTime = new Date(`${date}T${time}`);

      const matchPayload = {
        meta: {
          tournament: tournamentId,
          teamA: teamA.name,
          teamB: teamB.name,
          teamAId: teamA.id,
          teamBId: teamB.id,
          // ✅ NEW: Save Logos directly to Match Document
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
        },
        teamASquad: sanitizeSquad(teamA.roster),
        teamBSquad: sanitizeSquad(teamB.roster),
        innings: [],
        status: "upcoming",
        matchNo: Date.now(),
      };

      await addDoc(
        collection(db, "tournaments", tournamentId, "matches"),
        matchPayload
      );
      alert("Match scheduled successfully!");
      setTeamAId("");
      setTeamBId("");
      setVenue("");
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  // --- 3. AUTO SCHEDULE LOGIC ---
  const handleAutoSchedule = async () => {
    if (teams.length < 2) return alert("Need at least 2 teams.");
    if (
      !window.confirm(
        `Generate optimized schedule for ${teams.length} teams? (Avoids back-to-back games)`
      )
    )
      return;

    setCreating(true);
    try {
      const batch = writeBatch(db);
      const matchesCol = collection(db, "tournaments", tournamentId, "matches");

      let pool = [...teams];
      if (pool.length % 2 !== 0) {
        pool.push({ id: "BYE" });
      }

      const numTeams = pool.length;
      const numRounds = numTeams - 1;
      const matchesPerRound = numTeams / 2;
      let generatedMatches = [];

      for (let round = 0; round < numRounds; round++) {
        for (let match = 0; match < matchesPerRound; match++) {
          const team1 = pool[match];
          const team2 = pool[numTeams - 1 - match];

          if (team1.id !== "BYE" && team2.id !== "BYE") {
            generatedMatches.push({ teamA: team1, teamB: team2 });
          }
        }
        const fixedTeam = pool[0];
        const rotatedTeams = pool.slice(1);
        const lastTeam = rotatedTeams.pop();
        rotatedTeams.unshift(lastTeam);
        pool = [fixedTeam, ...rotatedTeams];
      }

      let matchCount = 0;
      let matchesToday = 0;
      let currentDateTime = new Date(`${startDate}T${startTime}`);

      generatedMatches.forEach(({ teamA, teamB }) => {
        if (matchesToday >= matchesPerDay) {
          currentDateTime.setDate(currentDateTime.getDate() + 1);
          const [h, m] = startTime.split(":");
          currentDateTime.setHours(h, m, 0, 0);
          matchesToday = 0;
        }

        const dateString = currentDateTime.toISOString().slice(0, 10);
        const timeString = currentDateTime.toTimeString().slice(0, 5);
        const startIso = currentDateTime.toISOString();

        const endDateTime = new Date(currentDateTime);
        endDateTime.setMinutes(
          endDateTime.getMinutes() + Number(matchDuration)
        );

        const newMatchRef = doc(matchesCol);

        batch.set(newMatchRef, {
          meta: {
            tournament: tournamentId,
            teamA: teamA.name,
            teamB: teamB.name,
            teamAId: teamA.id,
            teamBId: teamB.id,
            // ✅ NEW: Save Logos here too
            teamALogo: teamA.logoUrl || teamA.logo || "",
            teamBLogo: teamB.logoUrl || teamB.logo || "",
            overs: Number(autoOvers),
            date: dateString,
            time: timeString,
            venue: defaultVenue || "TBA",
            startAt: startIso,
            endAt: endDateTime.toISOString(),
            status: "upcoming",
            createdAt: new Date().toISOString(),
            format: "League",
          },
          teamASquad: sanitizeSquad(teamA.roster),
          teamBSquad: sanitizeSquad(teamB.roster),
          innings: [],
          status: "upcoming",
          matchNo: matchCount + 1,
        });

        matchCount++;
        matchesToday++;

        currentDateTime.setMinutes(
          currentDateTime.getMinutes() +
            Number(matchDuration) +
            Number(matchGap)
        );
      });

      await batch.commit();
      alert(`Generated ${matchCount} optimized matches!`);
      setMode("single");
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const labelClass =
    "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1";
  const inputClass =
    "w-full bg-[#0F1115] text-slate-200 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500/50 transition-all font-bold placeholder:text-slate-600";

  return (
    <div className="bg-[#1C2128] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative animate-in slide-in-from-top-5 mt-6 mb-8 backdrop-blur-md">
      {/* Header / Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex bg-[#161920] border border-white/5 rounded-xl p-1.5 shadow-inner">
          <button
            onClick={() => setMode("single")}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
              mode === "single"
                ? "bg-[#0F1115] text-white shadow-md border border-white/5"
                : "text-slate-500 hover:text-slate-300"
            }`}>
            Single Match
          </button>
          <button
            onClick={() => setMode("auto")}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
              mode === "auto"
                ? "bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md"
                : "text-slate-500 hover:text-slate-300"
            }`}>
            ⚡ Auto Scheduler
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleResetSchedule}
            disabled={resetting}
            className="text-red-500 hover:text-white bg-red-900/10 hover:bg-red-600/80 text-xs font-black uppercase tracking-wider transition-all px-4 py-2 border border-red-500/20 hover:border-transparent rounded-lg flex items-center gap-2">
            {resetting ? "Deleting..." : "🗑 Reset Schedule"}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors px-4 py-2 border border-transparent hover:border-white/10 rounded-lg">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === "single" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Selects... (Same as before) */}
            <div>
              <label className={`${labelClass} text-teal-500`}>Home Team</label>
              <div className="relative group">
                <select
                  className={`${inputClass} appearance-none cursor-pointer`}
                  value={teamAId}
                  onChange={(e) => setTeamAId(e.target.value)}>
                  <option value="">-- Select Team A --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 group-hover:text-slate-300">
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
                  onChange={(e) => setTeamBId(e.target.value)}>
                  <option value="">-- Select Team B --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 group-hover:text-slate-300">
                  ▼
                </div>
              </div>
            </div>

            {/* Date, Time & Venue */}
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

            {/* Venue Input for Single Match */}
            <div className="md:col-span-2">
              <label className={labelClass}>Venue</label>
              <input
                type="text"
                placeholder="e.g. Wankhede Stadium"
                className={inputClass}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
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
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-xl">
            <span className="text-xl">🤖</span>
            <p className="text-slate-300 text-xs font-medium">
              Generates a <strong>Round Robin</strong> schedule where every team
              plays every other team. Automatically calculates timings based on
              inputs below.
            </p>
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
              <label className={labelClass}>Gap Between (Mins)</label>
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

            {/* Venue Input for Auto Schedule */}
            <div className="md:col-span-3">
              <label className={labelClass}>Default Venue</label>
              <input
                type="text"
                placeholder="e.g. Lords Cricket Ground"
                className={inputClass}
                value={defaultVenue}
                onChange={(e) => setDefaultVenue(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={handleAutoSchedule}
            disabled={creating || teams.length < 2}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl hover:shadow-indigo-900/30 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating
              ? "Generating..."
              : `Generate Schedule (${teams.length} Teams)`}
          </button>
        </div>
      )}
    </div>
  );
}
