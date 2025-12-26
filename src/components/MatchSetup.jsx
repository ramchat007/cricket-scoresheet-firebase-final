// src/components/MatchSetup.jsx
import React, { useState, useEffect } from "react";
import {
  addTeam,
  addTournament,
  subscribeTournaments,
  listTournamentTeams,
} from "../utils/firestore.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { getFirestore, writeBatch, doc, collection } from "firebase/firestore";

const db = getFirestore();

export default function MatchSetup({
  onCreate,
  tournamentId: initialTournament,
  allTeams = [],
  availableTournaments: initialAvailableTournaments = [],
}) {
  const { user } = useAuth();

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState("single"); // "single" or "auto"

  // --- DATA STATE ---
  const [teams, setTeams] = useState(allTeams || []);
  const [isTournamentSpecific, setIsTournamentSpecific] = useState(false);
  const [availableTournaments, setAvailableTournaments] = useState(
    initialAvailableTournaments || []
  );

  // --- TOURNAMENT SETTINGS (Shared) ---
  const [tournament, setTournament] = useState(initialTournament || "");
  const [tournamentDate, setTournamentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [tournamentFormat, setTournamentFormat] = useState("T20");
  const [tournamentLocation, setTournamentLocation] = useState("");
  const [tournamentOrganizer, setTournamentOrganizer] = useState("");

  // --- SINGLE MATCH STATE ---
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [overs, setOvers] = useState(4);
  const [batsmenText, setBatsmenText] = useState(""); // Team A Players
  const [bowlersText, setBowlersText] = useState(""); // Team B Players
  const [captainA, setCaptainA] = useState("");
  const [captainB, setCaptainB] = useState("");
  const [umpiresText, setUmpiresText] = useState("");

  // --- AUTO SCHEDULE STATE ---
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());

  // 1. Sync Props
  useEffect(() => {
    setTournament(initialTournament || "");
    setAvailableTournaments(initialAvailableTournaments || []);
  }, [initialTournament, initialAvailableTournaments]);

  // 2. Subscribe to Tournaments
  useEffect(() => {
    const unsub = subscribeTournaments(setAvailableTournaments);
    return () => unsub && unsub();
  }, []);

  // 3. Smart Team Fetching
  useEffect(() => {
    async function loadTeams() {
      if (!tournament) {
        setTeams(allTeams);
        setIsTournamentSpecific(false);
        return;
      }
      const specificTeams = await listTournamentTeams(tournament);
      if (specificTeams && specificTeams.length > 0) {
        setTeams(specificTeams);
        setIsTournamentSpecific(true);
      } else {
        setTeams(allTeams);
        setIsTournamentSpecific(false);
      }
    }
    loadTeams();
  }, [tournament, allTeams]);

  // --- HELPERS ---
  function parseList(text) {
    return (text || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const getTeamFromList = (teamName) => {
    if (!teamName) return null;
    return teams.find(
      (t) =>
        String(t.id).toLowerCase() === teamName.toLowerCase() ||
        t.name.toLowerCase() === teamName.toLowerCase()
    );
  };

  // --- HANDLERS: SINGLE MATCH ---
  const handleTeamAChange = (e) => {
    const newTeamName = e.target.value;
    setTeamA(newTeamName);
    const team = getTeamFromList(newTeamName);
    // Auto-fill players if team exists, else clear for new entry
    if (team) setBatsmenText((team.players || []).join(", "));
    else setBatsmenText(""); 
  };

  const handleTeamBChange = (e) => {
    const newTeamName = e.target.value;
    setTeamB(newTeamName);
    const team = getTeamFromList(newTeamName);
    if (team) setBowlersText((team.players || []).join(", "));
    else setBowlersText("");
  };

  const saveTeamsAndTournament = async () => {
    if (!tournament.trim()) return false;

    // A. Check/Create Teams (If not specific to a tournament already)
    if (!isTournamentSpecific) {
      const team1Players = parseList(batsmenText);
      const team2Players = parseList(bowlersText);
      try {
        // If entered name doesn't exist in list, create it
        if (teamA && !getTeamFromList(teamA))
          await addTeam(teamA.trim(), team1Players);
        if (teamB && !getTeamFromList(teamB))
          await addTeam(teamB.trim(), team2Players);
      } catch (e) {
        console.error("Error saving global teams:", e);
      }
    }

    // B. Check/Create Tournament
    const tournamentExists = availableTournaments.some(
      (t) => String(t.id) === String(tournament.trim())
    );
    if (!tournamentExists) {
      try {
        await addTournament(tournament.trim(), {
          name: tournament.trim(),
          startDate: tournamentDate,
          location: tournamentLocation.trim(),
          format: tournamentFormat,
          organizer: tournamentOrganizer.trim(),
          createdAt: new Date().toISOString(),
          status: "upcoming",
        });
      } catch (e) {
        console.error("Error creating tournament:", e);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!user || !tournament || !teamA || !teamB)
      return alert("Missing fields.");
    if (teamA === teamB) return alert("Teams must be different.");

    const success = await saveTeamsAndTournament();
    if (!success) return alert("Failed to save.");

    const team1Players = parseList(batsmenText);
    const team2Players = parseList(bowlersText);
    const umps = parseList(umpiresText);

    const payload = {
      meta: {
        tournament: tournament.trim(),
        teamA: teamA.trim(),
        teamB: teamB.trim(),
        overs: Number(overs) || 0,
        captains: { teamA: captainA.trim(), teamB: captainB.trim() },
        toss: null,
        umpires: umps,
        createdAt: new Date().toISOString(),
        format: tournamentFormat,
        status: "upcoming",
        date: tournamentDate,
      },
      teamASquad: team1Players,
      teamBSquad: team2Players,
      innings: [],
      date: tournamentDate,
    };

    if (onCreate) await onCreate({ payload, tournament: tournament.trim() });

    // Reset Form
    setTeamA("");
    setTeamB("");
    setBatsmenText("");
    setBowlersText("");
    setCaptainA("");
    setCaptainB("");
  };

  // --- HANDLERS: AUTO SCHEDULE ---
  const toggleTeamSelection = (teamId) => {
    const newSet = new Set(selectedTeamIds);
    if (newSet.has(teamId)) newSet.delete(teamId);
    else newSet.add(teamId);
    setSelectedTeamIds(newSet);
  };

  const selectAllTeams = () => {
    if (selectedTeamIds.size === teams.length) setSelectedTeamIds(new Set());
    else setSelectedTeamIds(new Set(teams.map((t) => t.id)));
  };

  const handleAutoSchedule = async () => {
    if (!user) return alert("Login required.");
    if (!tournament) return alert("Please select a tournament.");
    if (selectedTeamIds.size < 2) return alert("Select at least 2 teams.");

    if (
      !window.confirm(
        `Generate smart Round Robin schedule for the ${selectedTeamIds.size} selected teams?`
      )
    )
      return;

    const tSuccess = await saveTeamsAndTournament();
    if (!tSuccess) return alert("Failed to initialize tournament.");

    try {
      const batch = writeBatch(db);
      let participants = teams.filter((t) => selectedTeamIds.has(t.id));

      if (participants.length % 2 !== 0) {
        participants.push(null); // Dummy for Bye
      }

      const numRounds = participants.length - 1;
      const halfSize = participants.length / 2;
      let count = 0;

      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
          const t1 = participants[i];
          const t2 = participants[participants.length - 1 - i];

          if (t1 && t2) {
            const matchRef = doc(
              collection(db, "tournaments", tournament.trim(), "matches")
            );
            const createdTime = new Date();
            createdTime.setMinutes(createdTime.getMinutes() + count);

            batch.set(matchRef, {
              meta: {
                tournament: tournament.trim(),
                teamA: t1.name || t1.id,
                teamB: t2.name || t2.id,
                overs: Number(overs),
                status: "upcoming",
                createdAt: createdTime.toISOString(),
                toss: null,
                roundNumber: round + 1,
              },
              teamASquad: t1.players || [],
              teamBSquad: t2.players || [],
              innings: [],
              date: tournamentDate,
            });
            count++;
          }
        }
        const last = participants.pop();
        participants.splice(1, 0, last);
      }

      await batch.commit();
      alert(`Successfully scheduled ${count} matches across ${numRounds} rounds!`);
      setSelectedTeamIds(new Set());
    } catch (e) {
      console.error(e);
      alert("Error generating schedule: " + e.message);
    }
  };

  // --- STYLES ---
  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-3 text-base focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder-gray-500";
  const labelClass =
    "block text-gray-400 text-sm font-bold mb-1 uppercase tracking-wider";

  return (
    <div className="max-w-4xl mx-auto mb-10">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl relative overflow-hidden">
        
        {/* TOP GRADIENT BAR */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 via-blue-500 to-transparent"></div>

        {/* 1. HEADER & MODE TABS */}
        <div className="bg-gray-950 p-1 flex border-b border-gray-800">
            <button
            onClick={() => setActiveTab("single")}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === "single"
                ? "bg-gray-800 text-white shadow-md"
                : "text-gray-500 hover:text-gray-300"
            }`}
            >
            Single Match
            </button>
            <button
            onClick={() => setActiveTab("auto")}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === "auto"
                ? "bg-cyan-900/20 text-cyan-400 shadow-md"
                : "text-gray-500 hover:text-gray-300"
            }`}
            >
            Auto Scheduler
            </button>
        </div>

        <div className="p-6">
            
            {/* 2. SHARED TOURNAMENT SETTINGS */}
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-cyan-400">⚙️</span> Tournament Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-1 md:col-span-1">
                <label className={labelClass}>Tournament Name</label>
                <input
                value={tournament}
                onChange={(e) => setTournament(e.target.value)}
                className={inputClass}
                list="tournamentList"
                placeholder="e.g. IPL 2025"
                />
                <datalist id="tournamentList">
                {availableTournaments.map((t) => (
                    <option key={t.id || t} value={t.id || t}>
                    {t.name || t.id || t}
                    </option>
                ))}
                </datalist>
            </div>
            <div>
                <label className={labelClass}>Date</label>
                <input
                type="date"
                value={tournamentDate}
                onChange={(e) => setTournamentDate(e.target.value)}
                className={inputClass}
                />
            </div>
            <div>
                <label className={labelClass}>Format</label>
                <select
                value={tournamentFormat}
                onChange={(e) => setTournamentFormat(e.target.value)}
                className={inputClass}
                >
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
                </select>
            </div>
            </div>

            <div className="border-t border-gray-800 my-6"></div>

            {/* 3. SHOW/HIDE CONTENT BASED ON TAB */}

            {/* === TAB A: SINGLE MATCH === */}
            {activeTab === "single" && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                    Create Manual Match (Existing or New Teams)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* TEAM A */}
                        <div>
                            <label className={`${labelClass} text-cyan-400`}>Team A</label>
                            <input
                                value={teamA}
                                onChange={handleTeamAChange}
                                className={inputClass}
                                list="teamAList"
                                placeholder="Select or Type New Name..."
                            />
                            {/* Datalist allows selection OR free typing */}
                            <datalist id="teamAList">
                                {teams.map((t) => (
                                <option key={t.id} value={t.name}>
                                    {t.name}
                                </option>
                                ))}
                            </datalist>
                            <textarea
                                value={batsmenText}
                                onChange={(e) => setBatsmenText(e.target.value)}
                                className={`${inputClass} h-24 mt-2`}
                                placeholder="Team A Players (comma separated)..."
                            />
                        </div>

                        {/* TEAM B */}
                        <div>
                            <label className={`${labelClass} text-green-400`}>Team B</label>
                            <input
                                value={teamB}
                                onChange={handleTeamBChange}
                                className={inputClass}
                                list="teamBList"
                                placeholder="Select or Type New Name..."
                            />
                            <datalist id="teamBList">
                                {teams.map((t) => (
                                <option key={t.id} value={t.name}>
                                    {t.name}
                                </option>
                                ))}
                            </datalist>
                            <textarea
                                value={bowlersText}
                                onChange={(e) => setBowlersText(e.target.value)}
                                className={`${inputClass} h-24 mt-2`}
                                placeholder="Team B Players (comma separated)..."
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className={labelClass}>Overs</label>
                        <input
                            type="number"
                            value={overs}
                            onChange={(e) => setOvers(Number(e.target.value))}
                            className={inputClass}
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!user || !teamA || !teamB}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-lg shadow-lg uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        + Add Single Match
                    </button>
                </div>
            )}

            {/* === TAB B: AUTO SCHEDULER === */}
            {activeTab === "auto" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                        Bulk Schedule (Round Robin)
                    </h3>

                    {teams.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 border border-gray-800 rounded-lg border-dashed">
                            No teams found for this tournament. Switch to "Single Match" to create teams first.
                        </div>
                    ) : (
                        <div
                            className={`mb-8 p-4 rounded-xl border ${
                                isTournamentSpecific
                                ? "bg-cyan-900/10 border-cyan-500/30"
                                : "bg-gray-800/30 border-gray-700/50"
                            }`}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                                    {isTournamentSpecific ? "Tournament Teams" : "Global Teams"}
                                </h3>
                                </div>
                                <button
                                onClick={selectAllTeams}
                                className="text-sm text-cyan-400 hover:text-white font-bold"
                                >
                                {selectedTeamIds.size === teams.length
                                    ? "Deselect All"
                                    : "Select All"}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {teams.map((t) => (
                                <label
                                    key={t.id}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-all ${
                                    selectedTeamIds.has(t.id)
                                        ? "bg-cyan-900/40 border-cyan-500/50 text-white"
                                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                                    }`}
                                >
                                    <input
                                    type="checkbox"
                                    className="accent-cyan-500 w-4 h-4"
                                    checked={selectedTeamIds.has(t.id)}
                                    onChange={() => toggleTeamSelection(t.id)}
                                    />
                                    <span className="text-sm font-bold truncate">{t.name}</span>
                                </label>
                                ))}
                            </div>
                            
                            <div className="mt-4">
                                <label className={labelClass}>Overs per match</label>
                                <input
                                    type="number"
                                    value={overs}
                                    onChange={(e) => setOvers(Number(e.target.value))}
                                    className={inputClass}
                                />
                            </div>

                            <button
                                onClick={handleAutoSchedule}
                                disabled={!user || !tournament || selectedTeamIds.size < 2}
                                className="mt-4 w-full bg-purple-900/50 hover:bg-purple-800 text-purple-300 border border-purple-700/50 font-bold py-3 rounded-lg uppercase tracking-widest transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>⚡ Generate Fair Schedule</span>
                                <span className="opacity-70 normal-case">
                                ({selectedTeamIds.size} Selected • Round Robin)
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
}