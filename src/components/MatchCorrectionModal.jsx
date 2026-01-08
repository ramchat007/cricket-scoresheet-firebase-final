// src/components/MatchCorrectionModal.jsx
import React, { useState, useMemo } from "react";
import { modifyMatchTimeline, updateMatch } from "../utils/matchService"; // Ensure correct import

const MatchCorrectionModal = ({ match, tournamentId, onClose }) => {
  const [mode, setMode] = useState("timeline"); // 'timeline' or 'manual'
  const [activeTab, setActiveTab] = useState(0); // 0 = Innings 1, 1 = Innings 2

  // --- TIMELINE EDITOR STATE ---
  const [editingBallIndex, setEditingBallIndex] = useState(null);
  const [editPayload, setEditPayload] = useState({});

  // --- MANUAL OVERWRITE STATE ---
  const currentIdx = match?.currentInnings || 0;
  const inn = match?.innings?.[currentIdx] || {};
  const [manualScore, setManualScore] = useState(inn.score || 0);
  const [manualWickets, setManualWickets] = useState(inn.wickets || 0);
  const [manualOver, setManualOver] = useState(inn.over || 0);
  const [manualBall, setManualBall] = useState(inn.overBallCount || 0);
  const [manualStriker, setManualStriker] = useState(inn.striker || "");
  const [manualNonStriker, setManualNonStriker] = useState(
    inn.nonStriker || ""
  );
  const [manualBowler, setManualBowler] = useState(inn.currentBowler || "");
  const [loading, setLoading] = useState(false);

  if (!match || !match.innings) return null;

  // --- SQUAD LOGIC (For Manual Mode) ---
  const { batSquad, bowlSquad } = useMemo(() => {
    const batTeam = inn.battingTeam;
    if (batTeam === match.meta?.teamA)
      return { batSquad: match.teamASquad, bowlSquad: match.teamBSquad };
    if (batTeam === match.meta?.teamB)
      return { batSquad: match.teamBSquad, bowlSquad: match.teamASquad };
    // Fallback
    if (currentIdx === 0)
      return { batSquad: match.teamASquad, bowlSquad: match.teamBSquad };
    return { batSquad: match.teamBSquad, bowlSquad: match.teamASquad };
  }, [match, inn.battingTeam, currentIdx]);

  const getPlayerName = (p) => (typeof p === "object" ? p.name : p) || "";

  // --- HELPER: Normalize Ball Data ---
  const currentTimeline = match.innings[activeTab]?.timeline || [];
  const getBallDisplay = (ball) => {
    if (typeof ball !== "object") {
      return {
        desc: `Legacy Data: ${ball}`,
        runs: parseInt(ball) || 0,
        batter: "Unknown",
        bowler: "Unknown",
        isWicket: ball === "W",
        isLegacy: true,
      };
    }
    return {
      desc: `${ball.bowler || "Unknown"} to ${ball.batter || "Unknown"}`,
      runs: ball.runs,
      batter: ball.batter,
      bowler: ball.bowler,
      isWicket: ball.isWicket,
      isWide: ball.isWide,
      isNoBall: ball.isNoBall,
      isLegacy: false,
    };
  };

  // --- TIMELINE ACTIONS ---
  const handleEditClick = (index, ball) => {
    setEditingBallIndex(index);
    if (typeof ball !== "object") {
      setEditPayload({
        runs: parseInt(ball) || 0,
        isWicket: ball === "W",
        isWide: ball.includes("WD"),
        isNoBall: ball.includes("NB"),
        batter: "",
        bowler: "",
      });
    } else {
      setEditPayload({
        runs: ball.runs,
        isWicket: ball.isWicket || false,
        isWide: ball.isWide || false,
        isNoBall: ball.isNoBall || false,
        batter: ball.batter || "",
        bowler: ball.bowler || "",
      });
    }
  };

  const handleTimelineSave = async () => {
    try {
      await modifyMatchTimeline(tournamentId, match.id, "EDIT_BALL", {
        inningsIndex: activeTab,
        index: editingBallIndex,
        newBallData: editPayload,
      });
      setEditingBallIndex(null);
    } catch (error) {
      alert("Update failed: " + error.message);
    }
  };

  const handleTimelineDelete = async (index) => {
    if (!window.confirm("Delete this ball? This will shift overs.")) return;
    try {
      await modifyMatchTimeline(tournamentId, match.id, "DELETE_BALL", {
        inningsIndex: activeTab,
        index: index,
      });
    } catch (error) {
      alert("Delete failed: " + error.message);
    }
  };

  // --- MANUAL OVERWRITE ACTION ---
  const handleManualSave = async () => {
    if (
      !window.confirm(
        "Overwrite match state? This directly updates the database."
      )
    )
      return;
    setLoading(true);
    try {
      const updateData = {
        [`innings.${currentIdx}.score`]: parseInt(manualScore),
        [`innings.${currentIdx}.wickets`]: parseInt(manualWickets),
        [`innings.${currentIdx}.over`]: parseInt(manualOver),
        [`innings.${currentIdx}.overBallCount`]: parseInt(manualBall),
        [`innings.${currentIdx}.striker`]: manualStriker,
        [`innings.${currentIdx}.nonStriker`]: manualNonStriker,
        [`innings.${currentIdx}.currentBowler`]: manualBowler,

        // 🔥 CRITICAL FIX: FORCE CLEAR FLAGS
        [`innings.${currentIdx}.awaitingNewBatsman`]: false,
        [`innings.${currentIdx}.awaitingNewBowler`]: false,
        [`innings.${currentIdx}.completed`]: false,
      };

      await updateMatch(tournamentId, match.id, updateData);
      alert("Updated! Scoring unlocked.");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-2xl rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            🛠 Match Correction Console
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold px-2">
            &times;
          </button>
        </div>

        {/* MODE SWITCHER */}
        <div className="flex bg-gray-950 p-1 mx-4 mt-4 rounded-lg border border-gray-800">
          <button
            onClick={() => setMode("timeline")}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
              mode === "timeline"
                ? "bg-gray-800 text-white shadow"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            Timeline Editor
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
              mode === "manual"
                ? "bg-red-900/30 text-red-400 shadow"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            Manual Overwrite
          </button>
        </div>

        {/* === MODE A: TIMELINE EDITOR === */}
        {mode === "timeline" && (
          <>
            <div className="flex border-b border-gray-700 mt-4">
              <button
                onClick={() => setActiveTab(0)}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                  activeTab === 0
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-900 text-gray-500 hover:bg-gray-800"
                }`}>
                {match.innings[0]?.battingTeam || "Innings 1"}
              </button>
              {match.innings[1] && (
                <button
                  onClick={() => setActiveTab(1)}
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                    activeTab === 1
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-900 text-gray-500 hover:bg-gray-800"
                  }`}>
                  {match.innings[1]?.battingTeam || "Innings 2"}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-950/50">
              {currentTimeline.length === 0 ? (
                <div className="text-center text-gray-500 py-10 italic">
                  No balls bowled yet.
                </div>
              ) : (
                currentTimeline.map((ball, idx) => {
                  const display = getBallDisplay(ball);
                  return (
                    <div
                      key={idx}
                      className="bg-gray-800 p-3 rounded-lg flex items-center justify-between group border border-transparent hover:border-gray-600 transition-all">
                      {editingBallIndex !== idx ? (
                        <>
                          <div className="flex items-center gap-4">
                            <div className="text-gray-500 font-mono text-xs w-6 text-right">
                              {idx + 1}.
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">
                                {display.desc}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {display.isWicket ? (
                                  <span className="text-red-400 font-bold">
                                    WICKET
                                  </span>
                                ) : (
                                  <span>{display.runs} runs</span>
                                )}
                                {display.isWide && (
                                  <span className="text-yellow-500 ml-1">
                                    (Wide)
                                  </span>
                                )}
                                {display.isNoBall && (
                                  <span className="text-yellow-500 ml-1">
                                    (NB)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(idx, ball)}
                              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/50 text-xs rounded hover:bg-blue-600 hover:text-white transition-colors">
                              Edit
                            </button>
                            <button
                              onClick={() => handleTimelineDelete(idx)}
                              className="px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-500/50 text-xs rounded hover:bg-red-600 hover:text-white transition-colors">
                              Delete
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col gap-3 bg-gray-900 p-3 rounded border border-blue-500/50 animate-in fade-in">
                          <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                            Editing Ball #{idx + 1}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase">
                                Batter
                              </label>
                              <input
                                type="text"
                                value={editPayload.batter}
                                onChange={(e) =>
                                  setEditPayload({
                                    ...editPayload,
                                    batter: e.target.value,
                                  })
                                }
                                className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase">
                                Bowler
                              </label>
                              <input
                                type="text"
                                value={editPayload.bowler}
                                onChange={(e) =>
                                  setEditPayload({
                                    ...editPayload,
                                    bowler: e.target.value,
                                  })
                                }
                                className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-500 uppercase">
                                Runs
                              </label>
                              <input
                                type="number"
                                value={editPayload.runs}
                                onChange={(e) =>
                                  setEditPayload({
                                    ...editPayload,
                                    runs: Number(e.target.value),
                                  })
                                }
                                className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-3 pb-2">
                              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editPayload.isWicket}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      isWicket: e.target.checked,
                                    })
                                  }
                                  className="accent-red-500 w-4 h-4"
                                />{" "}
                                Wicket
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editPayload.isWide}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      isWide: e.target.checked,
                                    })
                                  }
                                  className="accent-yellow-500 w-4 h-4"
                                />{" "}
                                Wide
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editPayload.isNoBall}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      isNoBall: e.target.checked,
                                    })
                                  }
                                  className="accent-yellow-500 w-4 h-4"
                                />{" "}
                                NB
                              </label>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-1 border-t border-gray-800 pt-2">
                            <button
                              onClick={() => setEditingBallIndex(null)}
                              className="px-3 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600">
                              Cancel
                            </button>
                            <button
                              onClick={handleTimelineSave}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs rounded font-bold hover:bg-green-500">
                              Save Fix
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* === MODE B: MANUAL OVERWRITE === */}
        {mode === "manual" && (
          <div className="p-6 overflow-y-auto bg-gray-950/50 flex-1">
            <div className="bg-red-900/10 border border-red-500/30 rounded p-3 mb-6 text-xs text-red-300">
              ⚠️ <b>Warning:</b> This will forcibly overwrite the main
              scoreboard (runs, wickets, overs). Use this if the automatic
              calculation gets out of sync.
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">
                  Runs
                </label>
                <input
                  type="number"
                  className="w-full bg-black border border-gray-700 rounded p-3 text-white font-mono text-lg font-bold"
                  value={manualScore}
                  onChange={(e) => setManualScore(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-red-500 mb-1 uppercase">
                  Wickets
                </label>
                <input
                  type="number"
                  className="w-full bg-black border border-gray-700 rounded p-3 text-white font-mono text-lg font-bold"
                  value={manualWickets}
                  onChange={(e) => setManualWickets(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                  Overs Done
                </label>
                <input
                  type="number"
                  className="w-full bg-black border border-gray-700 rounded p-3 text-white font-mono text-lg"
                  value={manualOver}
                  onChange={(e) => setManualOver(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                  Ball Count (0-5)
                </label>
                <input
                  type="number"
                  max="6"
                  className="w-full bg-black border border-gray-700 rounded p-3 text-white font-mono text-lg"
                  value={manualBall}
                  onChange={(e) => setManualBall(e.target.value)}
                />
              </div>
            </div>

            <div className="h-px bg-gray-800 mb-6"></div>

            {/* PLAYER SELECTION */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-widest">
                Active Players (Override)
              </h4>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Striker
                </label>
                <select
                  className="w-full bg-gray-800 text-white p-2.5 rounded border border-gray-700"
                  value={manualStriker}
                  onChange={(e) => setManualStriker(e.target.value)}>
                  <option value="">Select Striker</option>
                  {(batSquad || []).map((p) => (
                    <option key={getPlayerName(p)} value={getPlayerName(p)}>
                      {getPlayerName(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Non-Striker
                </label>
                <select
                  className="w-full bg-gray-800 text-white p-2.5 rounded border border-gray-700"
                  value={manualNonStriker}
                  onChange={(e) => setManualNonStriker(e.target.value)}>
                  <option value="">Select Non-Striker</option>
                  {(batSquad || []).map((p) => (
                    <option key={getPlayerName(p)} value={getPlayerName(p)}>
                      {getPlayerName(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Current Bowler
                </label>
                <select
                  className="w-full bg-gray-800 text-white p-2.5 rounded border border-gray-700"
                  value={manualBowler}
                  onChange={(e) => setManualBowler(e.target.value)}>
                  <option value="">Select Bowler</option>
                  {(bowlSquad || []).map((p) => (
                    <option key={getPlayerName(p)} value={getPlayerName(p)}>
                      {getPlayerName(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-gray-800">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-lg font-bold text-gray-400 hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleManualSave}
                disabled={loading}
                className="flex-1 py-3 rounded-lg font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg transition-colors">
                {loading ? "Saving..." : "Force Overwrite & Unlock"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchCorrectionModal;
