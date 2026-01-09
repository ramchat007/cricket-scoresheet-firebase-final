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

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl relative animate-in slide-in-from-top-5 mt-6 mb-8">
      {/* Header / Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-1">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
              mode === "single"
                ? "bg-gray-700 text-white shadow"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            Single Match
          </button>
          <button
            onClick={() => setMode("auto")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
              mode === "auto"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            ⚡ Auto Scheduler
          </button>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white text-sm">
            Cancel
          </button>
        )}
      </div>

      {/* Content */}
      {mode === "single" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-cyan-400 uppercase mb-1 block">
                Home Team
              </label>
              <select
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-cyan-500 outline-none"
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}>
                <option value="">-- Select Team A --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-green-400 uppercase mb-1 block">
                Away Team
              </label>
              <select
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-green-500 outline-none"
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}>
                <option value="">-- Select Team B --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                Date
              </label>
              <input
                type="date"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-gray-500 outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                Overs
              </label>
              <input
                type="number"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-gray-500 outline-none"
                value={overs}
                onChange={(e) => setOvers(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={handleCreateMatch}
            disabled={creating || !teamAId || !teamBId}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg shadow-lg transition-all disabled:opacity-50">
            {creating ? "Scheduling..." : "Create Match"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400 text-xs mb-4">
            Generates a round-robin schedule (every team plays every other team
            once).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                Start Date
              </label>
              <input
                type="date"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-blue-500 outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                Matches / Day
              </label>
              <input
                type="number"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-blue-500 outline-none"
                value={matchesPerDay}
                onChange={(e) => setMatchesPerDay(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                Overs
              </label>
              <input
                type="number"
                className="w-full bg-black border border-gray-600 rounded-lg px-3 py-3 text-white focus:border-blue-500 outline-none"
                value={autoOvers}
                onChange={(e) => setAutoOvers(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={handleAutoSchedule}
            disabled={creating || teams.length < 2}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all disabled:opacity-50">
            {creating ? "Generating..." : "Generate Schedule"}
          </button>
        </div>
      )}
    </div>
  );
}
