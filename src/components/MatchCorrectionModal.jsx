import React, { useState, useMemo, useEffect } from "react";
import { modifyMatchTimeline, updateMatch } from "../utils/matchService";

const MatchCorrectionModal = ({ match, tournamentId, onClose }) => {
  const [mode, setMode] = useState("timeline"); // 'timeline' | 'manual' | 'meta'
  const [activeTab, setActiveTab] = useState(0);

  // --- 1. SAFE DATA EXTRACTION ---
  const { safeInnings, validIndices } = useMemo(() => {
    if (!match || !match.innings) return { safeInnings: [], validIndices: [] };
    const rawInnings = match.innings;
    const indices = Object.keys(rawInnings)
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    const valid = indices.filter((idx) => {
      const inn = rawInnings[idx];
      return inn && (inn.battingTeam || inn.score !== undefined);
    });
    return {
      safeInnings: valid.map((idx) => rawInnings[idx]),
      validIndices: valid,
    };
  }, [match]);

  const currentInningIndex = validIndices[activeTab] ?? 0;
  const currentInningData = match?.innings?.[currentInningIndex] || {};
  const currentTimeline = currentInningData.timeline || [];

  // --- STATE FOR EDITORS ---
  const [editingBallIndex, setEditingBallIndex] = useState(null);
  const [editPayload, setEditPayload] = useState({});
  const [loading, setLoading] = useState(false);

  // --- STATE FOR MANUAL OVERWRITE ---
  const [manualScore, setManualScore] = useState(0);
  const [manualWickets, setManualWickets] = useState(0);
  const [manualOver, setManualOver] = useState(0);
  const [manualBall, setManualBall] = useState(0);
  const [manualStriker, setManualStriker] = useState("");
  const [manualNonStriker, setManualNonStriker] = useState("");
  const [manualBowler, setManualBowler] = useState("");

  useEffect(() => {
    setManualScore(currentInningData.score || 0);
    setManualWickets(currentInningData.wickets || 0);
    setManualOver(currentInningData.over || 0);
    setManualBall(currentInningData.overBallCount || 0);
    setManualStriker(currentInningData.striker || "");
    setManualNonStriker(currentInningData.nonStriker || "");
    setManualBowler(currentInningData.currentBowler || "");
  }, [currentInningIndex, currentInningData]);

  const [metaStatus, setMetaStatus] = useState(match?.status || "ongoing");
  const [metaWinner, setMetaWinner] = useState(match?.meta?.winner || "");

  // --- SQUAD LOGIC ---
  const { batSquad, bowlSquad } = useMemo(() => {
    const batTeam = currentInningData.battingTeam;
    if (!batTeam) return { batSquad: [], bowlSquad: [] };
    if (batTeam === match.meta?.teamA)
      return {
        batSquad: match.teamASquad || [],
        bowlSquad: match.teamBSquad || [],
      };
    if (batTeam === match.meta?.teamB)
      return {
        batSquad: match.teamBSquad || [],
        bowlSquad: match.teamASquad || [],
      };
    return { batSquad: [], bowlSquad: [] };
  }, [match, currentInningData]);

  const getPlayerName = (p) => (typeof p === "object" ? p.name : p) || "";

  const getBallDisplay = (ball) => {
    if (typeof ball !== "object")
      return {
        desc: `Legacy: ${ball}`,
        runs: parseInt(ball) || 0,
        isWicket: ball === "W",
      };
    return {
      desc: `${ball.bowler || "?"} to ${ball.batter || "?"}`,
      runs: ball.runs,
      isWicket: ball.isWicket,
      isWide: ball.isWide,
      isNoBall: ball.isNoBall,
    };
  };

  // --- 🚀 ACTIONS ---

  const handleEditClick = (index, ball) => {
    setEditingBallIndex(index);
    if (typeof ball !== "object") {
      // Legacy support
      setEditPayload({
        runs: parseInt(ball) || 0,
        isWicket: ball === "W",
        isWide: false,
        isNoBall: false,
      });
    } else {
      setEditPayload({ ...ball });
    }
  };

  const handleTimelineSave = async () => {
    setLoading(true);
    try {
      await modifyMatchTimeline(tournamentId, match.id, "EDIT_BALL", {
        inningsIndex: currentInningIndex,
        index: editingBallIndex,
        newBallData: editPayload,
      });
      setEditingBallIndex(null);
    } catch (error) {
      alert("Update failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimelineDelete = async (index) => {
    if (!window.confirm("Delete this ball? System will recalculate state."))
      return;
    setLoading(true);
    try {
      await modifyMatchTimeline(tournamentId, match.id, "DELETE_BALL", {
        inningsIndex: currentInningIndex,
        index: index,
      });
    } catch (error) {
      alert("Delete failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!window.confirm("This will force scoreboard values. Continue?")) return;
    setLoading(true);
    try {
      const updateData = {
        [`innings.${currentInningIndex}.score`]: parseInt(manualScore),
        [`innings.${currentInningIndex}.wickets`]: parseInt(manualWickets),
        [`innings.${currentInningIndex}.over`]: parseInt(manualOver),
        [`innings.${currentInningIndex}.overBallCount`]: parseInt(manualBall),
        [`innings.${currentInningIndex}.striker`]: manualStriker,
        [`innings.${currentInningIndex}.nonStriker`]: manualNonStriker,
        [`innings.${currentInningIndex}.currentBowler`]: manualBowler,
        [`innings.${currentInningIndex}.awaitingNewBatsman`]: false,
        [`innings.${currentInningIndex}.awaitingNewBowler`]: false,
      };
      await updateMatch(tournamentId, match.id, updateData);
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADDED: handleMetaSave Function
  const handleMetaSave = async () => {
    if (!window.confirm("Update match status and winner?")) return;
    setLoading(true);
    try {
      await updateMatch(tournamentId, match.id, {
        status: metaStatus,
        "meta.winner": metaWinner || null,
      });
      alert("Match Metadata Updated!");
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
      <div className="bg-[#111827] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* HEADER */}
        <div className="bg-white/5 p-5 flex justify-between items-center border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              🛠 Correction Console
            </h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
              Match ID: {match.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors">
            &times;
          </button>
        </div>

        {/* TOP NAV */}
        <div className="flex bg-black/40 p-1 mx-4 mt-4 rounded-xl border border-white/5">
          {["timeline", "manual", "meta"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === m ? "bg-cyan-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}>
              {m}
            </button>
          ))}
        </div>

        {/* INNINGS TABS */}
        {mode !== "meta" && (
          <div className="flex gap-2 mt-4 px-4">
            {safeInnings.map((inn, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex-1 py-3 text-[10px] font-bold uppercase border-b-2 transition-all ${activeTab === idx ? "border-cyan-500 text-cyan-500 bg-cyan-500/5" : "border-transparent text-gray-500"}`}>
                {inn.battingTeam || `Innings ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {mode === "timeline" && (
            <div className="space-y-2">
              {currentTimeline.length === 0 ? (
                <div className="text-center py-20 text-gray-600 italic text-sm">
                  Empty timeline...
                </div>
              ) : (
                [...currentTimeline].reverse().map((ball, revIdx) => {
                  const idx = currentTimeline.length - 1 - revIdx;
                  const display = getBallDisplay(ball);
                  const isEditing = editingBallIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${isEditing ? "bg-cyan-950/30 border-cyan-500/50" : "bg-white/5 border-white/5 hover:bg-white/10"}`}>
                      {!isEditing ? (
                        <div className="flex justify-between items-center">
                          <div className="flex gap-4 items-center">
                            <span className="text-gray-600 font-mono text-xs">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-gray-200">
                                {display.desc}
                              </p>
                              <div className="flex gap-2 mt-1">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${display.isWicket ? "bg-red-500/20 text-red-400" : "bg-white/5 text-gray-400"}`}>
                                  {display.isWicket
                                    ? "Wicket"
                                    : `${display.runs} Runs`}
                                </span>
                                {display.isWide && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-black uppercase">
                                    Wide
                                  </span>
                                )}
                                {display.isNoBall && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-black uppercase">
                                    NB
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditClick(idx, ball)}
                              className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg text-xs font-bold uppercase">
                              Edit
                            </button>
                            <button
                              onClick={() => handleTimelineDelete(idx)}
                              className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg text-xs font-bold uppercase">
                              Del
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-500 uppercase font-bold">
                                Batter
                              </label>
                              <input
                                className="w-full bg-black border border-white/10 p-2 text-sm rounded-lg text-white"
                                value={editPayload.batter || ""}
                                onChange={(e) =>
                                  setEditPayload({
                                    ...editPayload,
                                    batter: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-500 uppercase font-bold">
                                Bowler
                              </label>
                              <input
                                className="w-full bg-black border border-white/10 p-2 text-sm rounded-lg text-white"
                                value={editPayload.bowler || ""}
                                onChange={(e) =>
                                  setEditPayload({
                                    ...editPayload,
                                    bowler: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* NEW: Runs & Score Correction */}
                          <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">
                                Runs on this ball:
                              </span>
                              <input
                                type="number"
                                className="w-20 bg-black border border-cyan-500/30 p-1 text-center rounded font-bold text-cyan-400"
                                value={editPayload.runs}
                                onChange={(e) =>
                                  setEditPayload({
                                    ...editPayload,
                                    runs: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>

                            <div className="flex justify-around gap-2 pt-2 border-t border-white/5">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!editPayload.isWide}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      isWide: e.target.checked,
                                    })
                                  }
                                  className="accent-cyan-500"
                                />
                                <span className="text-[10px] uppercase font-bold text-gray-400">
                                  Wide
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!editPayload.isNoBall}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      isNoBall: e.target.checked,
                                    })
                                  }
                                  className="accent-cyan-500"
                                />
                                <span className="text-[10px] uppercase font-bold text-gray-400">
                                  No Ball
                                </span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!editPayload.isWicket}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      isWicket: e.target.checked,
                                    })
                                  }
                                  className="accent-red-500"
                                />
                                <span className="text-[10px] uppercase font-bold text-red-400">
                                  Wicket
                                </span>
                              </label>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingBallIndex(null)}
                              className="px-4 py-2 text-xs text-gray-500 font-bold uppercase">
                              Cancel
                            </button>
                            <button
                              onClick={handleTimelineSave}
                              disabled={loading}
                              className="px-6 py-2 bg-cyan-600 text-white rounded-lg text-xs font-black uppercase shadow-lg active:scale-95 transition-all">
                              {loading ? "Saving..." : "Update Ball"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block">
                    Scoreboard
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] text-gray-600 block uppercase">
                        Runs
                      </span>
                      <input
                        type="number"
                        className="w-full bg-black border border-white/10 p-2 rounded text-center text-lg font-bold"
                        value={manualScore}
                        onChange={(e) => setManualScore(e.target.value)}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-600 block uppercase">
                        Wkts
                      </span>
                      <input
                        type="number"
                        className="w-full bg-black border border-white/10 p-2 rounded text-center text-lg font-bold"
                        value={manualWickets}
                        onChange={(e) => setManualWickets(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block">
                    Overs
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] text-gray-600 block uppercase">
                        Over
                      </span>
                      <input
                        type="number"
                        className="w-full bg-black border border-white/10 p-2 rounded text-center text-lg"
                        value={manualOver}
                        onChange={(e) => setManualOver(e.target.value)}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-600 block uppercase">
                        Ball
                      </span>
                      <input
                        type="number"
                        max="5"
                        className="w-full bg-black border border-white/10 p-2 rounded text-center text-lg"
                        value={manualBall}
                        onChange={(e) => setManualBall(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 p-5 rounded-xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase">
                    Striker:
                  </span>
                  <select
                    className="bg-black border border-white/10 p-2 rounded w-48 text-xs text-white"
                    value={manualStriker}
                    onChange={(e) => setManualStriker(e.target.value)}>
                    <option value="">None</option>
                    {batSquad.map((p) => (
                      <option key={getPlayerName(p)} value={getPlayerName(p)}>
                        {getPlayerName(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase">
                    Non-Striker:
                  </span>
                  <select
                    className="bg-black border border-white/10 p-2 rounded w-48 text-xs text-white"
                    value={manualNonStriker}
                    onChange={(e) => setManualNonStriker(e.target.value)}>
                    <option value="">None</option>
                    {batSquad.map((p) => (
                      <option key={getPlayerName(p)} value={getPlayerName(p)}>
                        {getPlayerName(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase">
                    Bowler:
                  </span>
                  <select
                    className="bg-black border border-white/10 p-2 rounded w-48 text-xs text-white"
                    value={manualBowler}
                    onChange={(e) => setManualBowler(e.target.value)}>
                    <option value="">None</option>
                    {bowlSquad.map((p) => (
                      <option key={getPlayerName(p)} value={getPlayerName(p)}>
                        {getPlayerName(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleManualSave}
                disabled={loading}
                className="w-full bg-red-600 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95">
                Apply Overwrite
              </button>
            </div>
          )}

          {mode === "meta" && (
            <div className="p-4 space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                <label className="text-[10px] text-blue-400 font-black uppercase block mb-3">
                  Status Override
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["upcoming", "ongoing", "finished"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setMetaStatus(s)}
                      className={`py-3 rounded-lg text-[10px] font-black uppercase border transition-all ${metaStatus === s ? "bg-blue-600 border-blue-500 text-white shadow-lg" : "bg-black/20 border-white/5 text-gray-500"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">
                  Manual Winner
                </label>
                <input
                  className="w-full bg-black border border-white/10 p-3 rounded-lg text-sm text-white"
                  placeholder="Team Name"
                  value={metaWinner}
                  onChange={(e) => setMetaWinner(e.target.value)}
                />
              </div>
              <button
                onClick={handleMetaSave}
                disabled={loading}
                className="w-full bg-cyan-600 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95">
                Save Match State
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchCorrectionModal;
