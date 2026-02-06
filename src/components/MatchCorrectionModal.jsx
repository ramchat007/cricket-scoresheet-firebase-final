import React, { useState, useMemo, useEffect } from "react";
import { modifyMatchTimeline, updateMatch } from "../utils/matchService";
import { useTheme } from "../context/ThemeContext";
import {
  X,
  Save,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  History,
  Trophy,
  Activity,
  Loader2,
  Undo2,
  Wrench, // ✅ Added missing import
} from "lucide-react";

const MatchCorrectionModal = ({ match, tournamentId, onClose }) => {
  const { theme, lightMode } = useTheme();
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
        [`innings.${currentInningIndex}.score`]: parseInt(manualScore) || 0,
        [`innings.${currentInningIndex}.wickets`]: parseInt(manualWickets) || 0,
        [`innings.${currentInningIndex}.over`]: parseInt(manualOver) || 0,
        [`innings.${currentInningIndex}.overBallCount`]:
          parseInt(manualBall) || 0,
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

  // Safe Undo: Delete Last Ball
  const handleSafeUndo = () => {
    if (currentTimeline.length === 0) return;
    handleTimelineDelete(currentTimeline.length - 1);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-300 ${theme.card} ${lightMode ? "border-gray-200" : "border-white/10"}`}
        onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div
          className={`p-5 flex justify-between items-center border-b ${lightMode ? "bg-gray-50 border-gray-200" : "bg-white/5 border-white/5"}`}>
          <div>
            <h2
              className={`font-bold text-lg flex items-center gap-2 ${theme.text}`}>
              <Wrench size={20} className="text-cyan-500" /> Correction Console
            </h2>
            <p
              className={`text-[10px] uppercase tracking-widest mt-1 ${theme.sub}`}>
              Match ID: {match.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${lightMode ? "bg-gray-200 hover:bg-gray-300 text-gray-600" : "bg-white/5 hover:text-white text-gray-400"}`}>
            <X size={20} />
          </button>
        </div>

        {/* TOP NAV */}
        <div
          className={`flex p-1 mx-4 mt-4 rounded-xl border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-black/40 border-white/5"}`}>
          {["timeline", "manual", "meta"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 
                ${
                  mode === m
                    ? "bg-cyan-600 text-white shadow-lg"
                    : `${theme.sub} hover:text-cyan-500`
                }`}>
              {m === "timeline" && <History size={14} />}
              {m === "manual" && <Edit3 size={14} />}
              {m === "meta" && <Activity size={14} />}
              {m}
            </button>
          ))}
        </div>

        {/* INNINGS TABS */}
        {mode !== "meta" && (
          <div className="flex gap-2 mt-4 px-4 overflow-x-auto no-scrollbar">
            {safeInnings.map((inn, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex-1 py-3 px-4 text-[10px] font-bold uppercase border-b-2 transition-all whitespace-nowrap
                  ${
                    activeTab === idx
                      ? "border-cyan-500 text-cyan-500 bg-cyan-500/5"
                      : "border-transparent text-gray-500 hover:text-gray-400"
                  }`}>
                {inn.battingTeam || `Innings ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {mode === "timeline" && (
            <div className="space-y-4">
              {/* SAFE UNDO BUTTON */}
              {currentTimeline.length > 0 && (
                <div
                  className={`p-4 rounded-xl border flex justify-between items-center mb-4 ${lightMode ? "bg-orange-50 border-orange-200" : "bg-orange-900/10 border-orange-500/20"}`}>
                  <div>
                    <h4
                      className={`text-sm font-bold ${lightMode ? "text-orange-800" : "text-orange-400"}`}>
                      Quick Correction
                    </h4>
                    <p className={`text-xs ${theme.sub}`}>
                      Mistake on the last ball?
                    </p>
                  </div>
                  <button
                    onClick={handleSafeUndo}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-lg active:scale-95 disabled:opacity-50">
                    {loading ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Undo2 size={14} />
                    )}
                    Undo Last Ball
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {currentTimeline.length === 0 ? (
                  <div
                    className={`text-center py-20 italic text-sm ${theme.sub}`}>
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
                        className={`p-4 rounded-xl border transition-all 
                          ${
                            isEditing
                              ? "bg-cyan-900/10 border-cyan-500/50"
                              : lightMode
                                ? "bg-white border-gray-200 hover:border-cyan-300"
                                : "bg-white/5 border-white/5 hover:bg-white/10"
                          }`}>
                        {!isEditing ? (
                          <div className="flex justify-between items-center">
                            <div className="flex gap-4 items-center">
                              <span className="text-gray-500 font-mono text-xs">
                                #{idx + 1}
                              </span>
                              <div>
                                <p
                                  className={`text-sm font-bold ${theme.text}`}>
                                  {display.desc}
                                </p>
                                <div className="flex gap-2 mt-1">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-black uppercase 
                                      ${
                                        display.isWicket
                                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                          : lightMode
                                            ? "bg-gray-100 text-gray-600 border border-gray-200"
                                            : "bg-white/5 text-gray-400 border border-white/10"
                                      }`}>
                                    {display.isWicket
                                      ? "Wicket"
                                      : `${display.runs} Runs`}
                                  </span>
                                  {display.isWide && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase">
                                      Wide
                                    </span>
                                  )}
                                  {display.isNoBall && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase">
                                      NB
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditClick(idx, ball)}
                                className={`p-2 rounded-lg text-xs font-bold uppercase transition-colors ${lightMode ? "text-blue-600 hover:bg-blue-50" : "text-blue-400 hover:bg-blue-400/10"}`}>
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleTimelineDelete(idx)}
                                className={`p-2 rounded-lg text-xs font-bold uppercase transition-colors ${lightMode ? "text-red-600 hover:bg-red-50" : "text-red-400 hover:bg-red-400/10"}`}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label
                                  className={`text-[10px] uppercase font-bold ${theme.sub}`}>
                                  Batter
                                </label>
                                <input
                                  className={`w-full p-2 text-sm rounded-lg border outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black/50 border-white/10 text-white"}`}
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
                                <label
                                  className={`text-[10px] uppercase font-bold ${theme.sub}`}>
                                  Bowler
                                </label>
                                <input
                                  className={`w-full p-2 text-sm rounded-lg border outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black/50 border-white/10 text-white"}`}
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

                            {/* Runs & Score Correction */}
                            <div
                              className={`p-3 rounded-xl border space-y-3 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/40 border-white/5"}`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${theme.sub}`}>
                                  Runs on this ball:
                                </span>
                                <input
                                  type="number"
                                  className={`w-20 border p-1 text-center rounded font-bold text-cyan-500 outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300" : "bg-black border-white/10"}`}
                                  value={editPayload.runs}
                                  onChange={(e) =>
                                    setEditPayload({
                                      ...editPayload,
                                      runs: parseInt(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>

                              <div
                                className={`flex justify-around gap-2 pt-2 border-t ${lightMode ? "border-gray-200" : "border-white/5"}`}>
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
                                  <span
                                    className={`text-[10px] uppercase font-bold ${theme.sub}`}>
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
                                  <span
                                    className={`text-[10px] uppercase font-bold ${theme.sub}`}>
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
                                  <span className="text-[10px] uppercase font-bold text-red-500">
                                    Wicket
                                  </span>
                                </label>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingBallIndex(null)}
                                className={`px-4 py-2 text-xs font-bold uppercase ${theme.sub} hover:text-red-500`}>
                                Cancel
                              </button>
                              <button
                                onClick={handleTimelineSave}
                                disabled={loading}
                                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2">
                                {loading ? (
                                  <Loader2 className="animate-spin" size={14} />
                                ) : (
                                  <Save size={14} />
                                )}{" "}
                                Update
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-6">
              <div
                className={`p-4 rounded-xl border flex gap-3 items-start ${lightMode ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-amber-900/20 border-amber-500/20 text-amber-200"}`}>
                <AlertTriangle className="shrink-0" size={20} />
                <div className="text-xs">
                  <strong>Warning:</strong> Manual overwrites force values
                  directly into the database. This does not recalculate the
                  timeline history. Only use this if the timeline is irreparably
                  broken.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                  <label
                    className={`text-[10px] font-black uppercase mb-2 block ${theme.sub}`}>
                    Scoreboard
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span
                        className={`text-[9px] block uppercase ${theme.sub}`}>
                        Runs
                      </span>
                      <input
                        type="number"
                        className={`w-full border p-2 rounded text-center text-lg font-bold outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
                        value={manualScore}
                        onChange={(e) => setManualScore(e.target.value)}
                      />
                    </div>
                    <div>
                      <span
                        className={`text-[9px] block uppercase ${theme.sub}`}>
                        Wkts
                      </span>
                      <input
                        type="number"
                        className={`w-full border p-2 rounded text-center text-lg font-bold outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
                        value={manualWickets}
                        onChange={(e) => setManualWickets(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div
                  className={`p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                  <label
                    className={`text-[10px] font-black uppercase mb-2 block ${theme.sub}`}>
                    Overs
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span
                        className={`text-[9px] block uppercase ${theme.sub}`}>
                        Over
                      </span>
                      <input
                        type="number"
                        className={`w-full border p-2 rounded text-center text-lg font-bold outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
                        value={manualOver}
                        onChange={(e) => setManualOver(e.target.value)}
                      />
                    </div>
                    <div>
                      <span
                        className={`text-[9px] block uppercase ${theme.sub}`}>
                        Ball
                      </span>
                      <input
                        type="number"
                        max="5"
                        className={`w-full border p-2 rounded text-center text-lg font-bold outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
                        value={manualBall}
                        onChange={(e) => setManualBall(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`p-5 rounded-xl border space-y-4 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs uppercase ${theme.sub}`}>
                    Striker:
                  </span>
                  <select
                    className={`border p-2 rounded w-48 text-xs font-bold outline-none ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
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
                  <span className={`text-xs uppercase ${theme.sub}`}>
                    Non-Striker:
                  </span>
                  <select
                    className={`border p-2 rounded w-48 text-xs font-bold outline-none ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
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
                  <span className={`text-xs uppercase ${theme.sub}`}>
                    Bowler:
                  </span>
                  <select
                    className={`border p-2 rounded w-48 text-xs font-bold outline-none ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
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
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <AlertTriangle size={16} />
                )}{" "}
                Apply Overwrite
              </button>
            </div>
          )}

          {mode === "meta" && (
            <div className="p-4 space-y-6">
              <div
                className={`p-4 rounded-xl border ${lightMode ? "bg-blue-50 border-blue-200" : "bg-blue-900/10 border-blue-500/20"}`}>
                <label
                  className={`text-[10px] font-black uppercase block mb-3 ${lightMode ? "text-blue-700" : "text-blue-400"}`}>
                  Status Override
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["upcoming", "ongoing", "finished"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setMetaStatus(s)}
                      className={`py-3 rounded-lg text-[10px] font-black uppercase border transition-all 
                        ${
                          metaStatus === s
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                            : lightMode
                              ? "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
                              : "bg-black/20 border-white/5 text-gray-500 hover:text-white"
                        }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className={`p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-white/5 border-white/5"}`}>
                <label
                  className={`text-[10px] font-black uppercase block mb-2 ${theme.sub}`}>
                  Manual Winner
                </label>
                <div className="flex gap-2">
                  <Trophy
                    className={
                      lightMode ? "text-yellow-500" : "text-yellow-400"
                    }
                  />
                  <input
                    className={`w-full p-3 rounded-lg text-sm border outline-none focus:border-cyan-500 ${lightMode ? "bg-white border-gray-300 text-gray-900" : "bg-black border-white/10 text-white"}`}
                    placeholder="Team Name"
                    value={metaWinner}
                    onChange={(e) => setMetaWinner(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={handleMetaSave}
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}{" "}
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
