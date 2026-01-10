import React, { useState } from "react";
import { collection, doc, writeBatch, addDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

export default function MatchScheduler({ tournamentId, teams, onCancel }) {
  const [mode, setMode] = useState("single"); // 'single' | 'auto'
  const [creating, setCreating] = useState(false);

  // Single Match State
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [overs, setOvers] = useState(10);

  // Auto Schedule State
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [matchesPerDay, setMatchesPerDay] = useState(2);
  const [autoOvers, setAutoOvers] = useState(10);

  // Helper to keep match documents light
  const sanitizeSquad = (roster) => {
    if (!roster) return [];
    return roster.map((player) => {
      const { photoURL, statsSnapshot, ...lightweightPlayer } = player;
      return lightweightPlayer;
    });
  };

  // --- CREATE SINGLE MATCH ---
  const handleCreateMatch = async () => {
    if (!teamAId || !teamBId) return alert("Select both teams");
    if (teamAId === teamBId) return alert("Cannot play against same team");

    setCreating(true);
    try {
      const teamA = teams.find((t) => t.id === teamAId);
      const teamB = teams.find((t) => t.id === teamBId);

      const matchPayload = {
        meta: {
          tournament: tournamentId,
          teamA: teamA.name,
          teamB: teamB.name,
          teamAId: teamA.id,
          teamBId: teamB.id,
          overs: Number(overs),
          date: date,
          status: "upcoming",
          createdAt: new Date().toISOString(),
          format: "T20",
        },
        teamASquad: sanitizeSquad(teamA.roster),
        teamBSquad: sanitizeSquad(teamB.roster),
        innings: [],
        status: "upcoming",
        date: date,
        matchNo: Date.now(), // Simple unique ID for sorting if needed
      };

      await addDoc(
        collection(db, "tournaments", tournamentId, "matches"),
        matchPayload
      );
      alert("Match scheduled successfully!");
      setTeamAId("");
      setTeamBId("");
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  // --- AUTO SCHEDULE LOGIC ---
  const handleAutoSchedule = async () => {
    if (teams.length < 2) return alert("Need at least 2 teams.");
    if (
      !window.confirm(
        `Generate Round Robin schedule for ${teams.length} teams?`
      )
    )
      return;

    setCreating(true);
    try {
      const batch = writeBatch(db);
      const matchesCol = collection(db, "tournaments", tournamentId, "matches");

      let matchCount = 0;
      let dayOffset = 0;
      let matchesToday = 0;

      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const teamA = teams[i];
          const teamB = teams[j];

          const matchDate = new Date(startDate);
          matchDate.setDate(matchDate.getDate() + dayOffset);
          const dateString = matchDate.toISOString().slice(0, 10);

          const newMatchRef = doc(matchesCol);

          batch.set(newMatchRef, {
            meta: {
              tournament: tournamentId,
              teamA: teamA.name,
              teamB: teamB.name,
              teamAId: teamA.id,
              teamBId: teamB.id,
              overs: Number(autoOvers),
              date: dateString,
              status: "upcoming",
              createdAt: new Date().toISOString(),
              format: "League",
            },
            teamASquad: sanitizeSquad(teamA.roster),
            teamBSquad: sanitizeSquad(teamB.roster),
            innings: [],
            status: "upcoming",
            date: dateString,
            matchNo: matchCount + 1,
          });

          matchCount++;
          matchesToday++;

          if (matchesToday >= matchesPerDay) {
            dayOffset++;
            matchesToday = 0;
          }
        }
      }

      await batch.commit();
      alert(`Generated ${matchCount} matches!`);
      setMode("single");
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1";
  const inputClass = "w-full bg-[#0F1115] text-slate-200 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-teal-500/50 transition-all font-bold placeholder:text-slate-600";

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

        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors px-4 py-2 border border-transparent hover:border-white/10 rounded-lg">
            Cancel
          </button>
        )}
      </div>

      {/* Content */}
      {mode === "single" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 group-hover:text-slate-300">▼</div>
              </div>
            </div>
            <div>
              <label className={`${labelClass} text-indigo-400`}>Away Team</label>
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
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 group-hover:text-slate-300">▼</div>
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
          <button
            onClick={handleCreateMatch}
            disabled={creating || !teamAId || !teamBId}
            className="w-full bg-gradient-to-r from-teal-600 to-teal-800 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl hover:shadow-teal-900/30 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating ? "Scheduling..." : "Create Match"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-slate-500 text-xs font-medium italic border-l-2 border-teal-500 pl-3 py-1">
            Generates a round-robin schedule where every team plays every other team once.
          </p>
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
              <label className={labelClass}>Matches / Day</label>
              <input
                type="number"
                className={inputClass}
                value={matchesPerDay}
                onChange={(e) => setMatchesPerDay(e.target.value)}
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
          </div>
          <button
            onClick={handleAutoSchedule}
            disabled={creating || teams.length < 2}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-[0.15em] py-4 rounded-xl shadow-xl hover:shadow-indigo-900/30 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating ? "Generating..." : "Generate Schedule"}
          </button>
        </div>
      )}
    </div>
  );
}