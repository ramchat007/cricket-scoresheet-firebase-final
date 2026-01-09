// src/components/MatchSetup.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import {
  subscribeTournaments,
  listTournamentTeams,
  listGlobalPlayers,
  addTournament,
  createMatch, // ✅ New architecture
} from "../utils/firestore.js";

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

export default function MatchSetup({ allTeams = [], initialTournament }) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("single");
  const [teams, setTeams] = useState(allTeams);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [tournament, setTournament] = useState(initialTournament || "");
  const [tournamentDate, setTournamentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [tournamentFormat, setTournamentFormat] = useState("T20");
  const [overs, setOvers] = useState(4);

  // Single Match
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [teamARoster, setTeamARoster] = useState([]);
  const [teamBRoster, setTeamBRoster] = useState([]);
  const [batsmenText, setBatsmenText] = useState("");
  const [bowlersText, setBowlersText] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState("A");

  // Auto Schedule
  const [selectedTeams, setSelectedTeams] = useState(new Set());

  // Fetch tournaments
  useEffect(() => {
    const unsub = subscribeTournaments(setAvailableTournaments);
    return () => unsub && unsub();
  }, []);

  // Load teams for selected tournament
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
          : newRoster.map((p) => p.name).join(",")
      );
    } else {
      setTeamBRoster((prev) => [...prev, ...newRoster]);
      setBowlersText((prev) =>
        prev
          ? prev + ", " + newRoster.map((p) => p.name).join(",")
          : newRoster.map((p) => p.name).join(",")
      );
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

  // --- Submit Single Match ---
  const handleSubmitSingle = async () => {
    if (!user || !tournament || !teamA || !teamB)
      return alert("Missing fields");

    if (!availableTournaments.find((t) => t.id === tournament)) {
      await addTournament(tournament, {
        name: tournament,
        createdAt: new Date().toISOString(),
        status: "upcoming",
      });
    }

    const squadA = getSmartSquad(batsmenText, teamARoster);
    const squadB = getSmartSquad(bowlersText, teamBRoster);

    const matchId = `match_${Date.now()}`;
    await createMatch(tournament, matchId, {
      meta: {
        teamAName: teamA,
        teamBName: teamB,
        overs: Number(overs),
        date: tournamentDate,
        format: tournamentFormat,
      },
      squads: { teamA: squadA, teamB: squadB },
    });

    alert("Match created!");
  };

  // --- Auto Schedule ---
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
      return alert("Select at least 2 teams");

    if (!availableTournaments.find((t) => t.id === tournament)) {
      await addTournament(tournament, {
        name: tournament,
        createdAt: new Date().toISOString(),
        status: "upcoming",
      });
    }

    const selectedTeamObjs = teams.filter((t) => selectedTeams.has(t.id));

    for (let i = 0; i < selectedTeamObjs.length; i++) {
      for (let j = i + 1; j < selectedTeamObjs.length; j++) {
        const team1 = selectedTeamObjs[i];
        const team2 = selectedTeamObjs[j];
        const matchId = `match_${Date.now()}_${Math.random()}`;
        await createMatch(tournament, matchId, {
          meta: {
            teamAName: team1.name,
            teamBName: team2.name,
            overs: Number(overs),
            date: tournamentDate,
            format: tournamentFormat,
          },
          squads: { teamA: team1.roster || [], teamB: team2.roster || [] },
        });
      }
    }

    alert(
      `${(selectedTeams.size * (selectedTeams.size - 1)) / 2} matches created!`
    );
    setSelectedTeams(new Set());
  };

  // --- Styles ---
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
                value={tournament}
                onChange={(e) => setTournament(e.target.value)}
                className={inputClass}
                placeholder="Select/Type Name"
                list="tList"
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

          {/* SINGLE MATCH */}
          {activeTab === "single" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
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
                  placeholder="Team A"
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
                  placeholder="Type names or pick..."
                />
              </div>

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
                  placeholder="Team B"
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
                  placeholder="Type names or pick..."
                />
              </div>

              <button
                onClick={handleSubmitSingle}
                disabled={!teamA || !teamB}
                className="col-span-1 md:col-span-2 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 transition-all uppercase tracking-widest mt-4 disabled:opacity-50">
                + Create Match
              </button>
            </div>
          )}

          {/* AUTO SCHEDULE */}
          {activeTab === "auto" && (
            <div className="animate-in fade-in">
              <p className="text-gray-400 mb-4">
                Select teams to auto-generate matches (round-robin):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-80 overflow-y-auto mb-4 border-t border-gray-800 pt-2">
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTeams.has(team.id)}
                      onChange={() => toggleTeamSelection(team.id)}
                      className="accent-cyan-500"
                    />
                    <span className="text-white">{team.name}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
                <div>
                  <label className={labelClass}>Format</label>
                  <select
                    value={tournamentFormat}
                    onChange={(e) => setTournamentFormat(e.target.value)}
                    className={inputClass}>
                    <option value="T20">T20</option>
                    <option value="T10">T10</option>
                    <option value="ODI">ODI</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAutoScheduleSubmit}
                disabled={selectedTeams.size < 2}
                className="py-4 w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/20 transition-all uppercase tracking-widest disabled:opacity-50">
                Generate {(selectedTeams.size * (selectedTeams.size - 1)) / 2}{" "}
                Matches
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
