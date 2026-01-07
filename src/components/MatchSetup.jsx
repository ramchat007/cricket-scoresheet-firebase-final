// src/components/MatchSetup.jsx
import React, { useState, useEffect } from "react";
import {
  addTeam,
  addTournament,
  subscribeTournaments,
  listTournamentTeams,
  listGlobalPlayers, // Imported Global Fetcher
} from "../utils/firestore.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { getFirestore, writeBatch, doc, collection } from "firebase/firestore";

const db = getFirestore();

// --- 1. REUSABLE PLAYER SELECTOR MODAL ---
const PlayerPickerModal = ({ isOpen, onClose, onSelect, title }) => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (isOpen) {
      listGlobalPlayers().then(setPlayers);
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
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400">
            ✕
          </button>
        </div>
        <div className="p-2 border-b border-gray-800">
          <input
            className="w-full bg-gray-800 text-white p-2 rounded outline-none"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((p) => {
            const isSel = selected.find((s) => s.id === p.id);
            return (
              <div
                key={p.id}
                onClick={() => toggle(p)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                  isSel
                    ? "bg-cyan-900/40 border border-cyan-500/50"
                    : "hover:bg-gray-800"
                }`}>
                <div className="text-sm font-bold text-gray-200">{p.name}</div>
                {isSel && <div className="text-cyan-400">✓</div>}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 font-bold text-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              onSelect(selected);
              onClose();
            }}
            className="px-4 py-2 bg-cyan-600 text-white font-bold rounded text-sm">
            Add {selected.length} Players
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MatchSetup({
  onCreate,
  tournamentId: initialTournament,
  allTeams = [],
  availableTournaments: initialAvailableTournaments = [],
}) {
  const { user } = useAuth();

  // --- STATE ---
  const [activeTab, setActiveTab] = useState("single");
  const [teams, setTeams] = useState(allTeams || []);
  const [isTournamentSpecific, setIsTournamentSpecific] = useState(false);
  const [availableTournaments, setAvailableTournaments] = useState(
    initialAvailableTournaments || []
  );

  const [tournament, setTournament] = useState(initialTournament || "");
  const [tournamentDate, setTournamentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [tournamentFormat, setTournamentFormat] = useState("T20");

  // Single Match
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [overs, setOvers] = useState(4);
  const [batsmenText, setBatsmenText] = useState("");
  const [bowlersText, setBowlersText] = useState("");

  // Hidden Roster (The Brains)
  const [teamARoster, setTeamARoster] = useState([]);
  const [teamBRoster, setTeamBRoster] = useState([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState("A"); // 'A' or 'B'

  // Auto Schedule
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());

  // --- EFFECTS ---
  useEffect(() => {
    setTournament(initialTournament || "");
    setAvailableTournaments(initialAvailableTournaments || []);
  }, [initialTournament, initialAvailableTournaments]);

  useEffect(() => {
    const unsub = subscribeTournaments(setAvailableTournaments);
    return () => unsub && unsub();
  }, []);

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

  // --- LOGIC ---
  const handleTeamChange = (e, setTeamName, setTextInput, setRosterState) => {
    const newName = e.target.value;
    setTeamName(newName);
    const team = teams.find((t) => t.name === newName || t.id === newName);

    if (team) {
      if (team.roster?.length > 0) {
        setRosterState(team.roster);
        setTextInput(team.roster.map((p) => p.name).join(", "));
      } else if (team.players?.length > 0) {
        setRosterState(team.players.map((n) => ({ id: `leg_${n}`, name: n })));
        setTextInput(team.players.join(", "));
      } else {
        setRosterState([]);
        setTextInput("");
      }
    } else {
      setRosterState([]);
      setTextInput("");
    }
  };

  const openPicker = (target) => {
    setModalTarget(target);
    setModalOpen(true);
  };

  const handlePlayersPicked = (pickedPlayers) => {
    const newRosterItems = pickedPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isGuest: false,
    }));

    if (modalTarget === "A") {
      const updatedRoster = [...teamARoster, ...newRosterItems];
      setTeamARoster(updatedRoster);
      // Append text
      const currentText = batsmenText ? batsmenText + ", " : "";
      setBatsmenText(currentText + pickedPlayers.map((p) => p.name).join(", "));
    } else {
      const updatedRoster = [...teamBRoster, ...newRosterItems];
      setTeamBRoster(updatedRoster);
      const currentText = bowlersText ? bowlersText + ", " : "";
      setBowlersText(currentText + pickedPlayers.map((p) => p.name).join(", "));
    }
  };

  const getSmartSquad = (textInput, roster) => {
    const names = textInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return names.map((name) => {
      const existing = roster.find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return existing;
      return {
        id: `guest_${Date.now()}_${Math.random()}`,
        name,
        isGuest: true,
      };
    });
  };

  const handleSubmit = async () => {
    if (!user || !tournament || !teamA || !teamB)
      return alert("Missing fields");

    // Create Tournament if needed
    const exists = availableTournaments.find((t) => t.id === tournament);
    if (!exists) {
      await addTournament(tournament, {
        name: tournament,
        createdAt: new Date().toISOString(),
        status: "upcoming",
      });
    }

    const squadA = getSmartSquad(batsmenText, teamARoster);
    const squadB = getSmartSquad(bowlersText, teamBRoster);

    const payload = {
      meta: {
        tournament,
        teamA,
        teamB,
        overs: Number(overs),
        createdAt: new Date().toISOString(),
        status: "upcoming",
        date: tournamentDate,
        format: tournamentFormat,
      },
      teamASquad: squadA,
      teamBSquad: squadB,
      innings: [],
    };

    if (onCreate) await onCreate({ payload, tournament });
  };

  // Styles
  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-3 focus:outline-none focus:border-cyan-500 transition-all";
  const labelClass =
    "block text-gray-400 text-sm font-bold mb-1 uppercase tracking-wider";

  return (
    <div className="max-w-4xl mx-auto mb-10">
      <PlayerPickerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handlePlayersPicked}
        title={`Add Players to Team ${modalTarget}`}
      />

      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 to-transparent"></div>

        {/* HEADER */}
        <div className="bg-gray-950 p-1 flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab("single")}
            className={`flex-1 py-3 text-sm font-bold uppercase ${
              activeTab === "single"
                ? "bg-gray-800 text-white"
                : "text-gray-500"
            }`}>
            Single Match
          </button>
          <button
            onClick={() => setActiveTab("auto")}
            className={`flex-1 py-3 text-sm font-bold uppercase ${
              activeTab === "auto"
                ? "bg-cyan-900/20 text-cyan-400"
                : "text-gray-500"
            }`}>
            Auto Schedule
          </button>
        </div>

        <div className="p-6">
          {/* SETTINGS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className={labelClass}>Tournament</label>
              <input
                list="tList"
                value={tournament}
                onChange={(e) => setTournament(e.target.value)}
                className={inputClass}
                placeholder="Select/Type Name"
              />
              <datalist id="tList">
                {availableTournaments.map((t) => (
                  <option key={t.id} value={t.id} />
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
              <label className={labelClass}>Overs</label>
              <input
                type="number"
                value={overs}
                onChange={(e) => setOvers(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {activeTab === "single" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
              {/* TEAM A */}
              <div>
                <label className={`${labelClass} text-cyan-400`}>
                  Team A Name
                </label>
                <input
                  value={teamA}
                  onChange={(e) =>
                    handleTeamChange(
                      e,
                      setTeamA,
                      setBatsmenText,
                      setTeamARoster
                    )
                  }
                  className={inputClass}
                  list="teamList"
                  placeholder="e.g. India"
                />
                <datalist id="teamList">
                  {teams.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>

                <div className="flex justify-between items-center mt-3 mb-1">
                  <label className={labelClass}>Squad</label>
                  <button
                    onClick={() => openPicker("A")}
                    className="text-xs bg-gray-800 px-2 py-1 rounded text-cyan-400 hover:text-white border border-gray-700">
                    🌍 Pick Players
                  </button>
                </div>
                <textarea
                  value={batsmenText}
                  onChange={(e) => setBatsmenText(e.target.value)}
                  className={`${inputClass} h-24 text-sm font-mono`}
                  placeholder="Type names (comma) or pick..."
                />
              </div>

              {/* TEAM B */}
              <div>
                <label className={`${labelClass} text-green-400`}>
                  Team B Name
                </label>
                <input
                  value={teamB}
                  onChange={(e) =>
                    handleTeamChange(
                      e,
                      setTeamB,
                      setBowlersText,
                      setTeamBRoster
                    )
                  }
                  className={inputClass}
                  list="teamList"
                  placeholder="e.g. Australia"
                />

                <div className="flex justify-between items-center mt-3 mb-1">
                  <label className={labelClass}>Squad</label>
                  <button
                    onClick={() => openPicker("B")}
                    className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400 hover:text-white border border-gray-700">
                    🌍 Pick Players
                  </button>
                </div>
                <textarea
                  value={bowlersText}
                  onChange={(e) => setBowlersText(e.target.value)}
                  className={`${inputClass} h-24 text-sm font-mono`}
                  placeholder="Type names (comma) or pick..."
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!teamA || !teamB}
                className="col-span-1 md:col-span-2 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 transition-all uppercase tracking-widest mt-4 disabled:opacity-50">
                + Create Match
              </button>
            </div>
          )}

          {/* Auto Schedule Placeholder (Simplified for brevity as logic is same) */}
          {activeTab === "auto" && (
            <div className="text-center py-10 text-gray-500">
              Auto-scheduler uses Team Manager teams. <br /> Please create teams
              in Dashboard first for bulk scheduling.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
