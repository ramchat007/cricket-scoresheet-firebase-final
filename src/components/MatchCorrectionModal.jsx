import React, { useState, useMemo, useEffect } from "react";
import { modifyMatchTimeline, updateMatch } from "../utils/matchService";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
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
  Wrench,
  RotateCcw, // Added for the reset/delete innings icon
} from "lucide-react";

const MatchCorrectionModal = ({ match, tournamentId, onClose }) => {
  const { theme } = useTheme();
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

  const handleSafeUndo = () => {
    if (currentTimeline.length === 0) return;
    handleTimelineDelete(currentTimeline.length - 1);
  };

  const handleSyncSquads = async () => {
    if (
      !window.confirm(
        "This will fetch the latest rosters from the tournament teams and update this match. Continue?",
      )
    )
      return;

    setLoading(true);
    try {
      // 1. Fetch all teams in this tournament
      const teamsRef = collection(db, "tournaments", tournamentId, "teams");
      const teamsSnap = await getDocs(teamsRef);
      const allTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 2. Find Team A and Team B data
      const teamAData = allTeams.find((t) => t.name === match.meta.teamA);
      const teamBData = allTeams.find((t) => t.name === match.meta.teamB);

      if (!teamAData || !teamBData) {
        throw new Error(
          "Could not find team definitions in tournament records.",
        );
      }

      // 3. Prepare the update
      await updateMatch(tournamentId, match.id, {
        teamASquad: teamAData.roster || [],
        teamBSquad: teamBData.roster || [],
      });

      alert("✅ Squads synced successfully! Dropdowns should now be full.");
    } catch (e) {
      console.error("Sync Error:", e);
      alert("Sync Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NEW ACTION: Delete an entire innings (for accidental 2nd innings starts)
  const handleDeleteInnings = async () => {
    const isSecondInnings = currentInningIndex === 1;
    const warningMsg = isSecondInnings
      ? "🚨 DANGER: Are you sure you want to completely DELETE the 2nd Innings? This will revert the match to the 1st Innings so you can make corrections."
      : "🚨 DANGER: Are you sure you want to completely DELETE this innings?";

    if (!window.confirm(warningMsg)) return;
    if (
      !window.confirm(
        "FINAL WARNING: This cannot be undone. Are you absolutely sure?",
      )
    )
      return;

    setLoading(true);
    try {
      if (isSecondInnings) {
        // 🔥 Deep clone the first innings and strictly force completed to false
        const firstInningsReverted = { ...match.innings[0], completed: false };

        await updateMatch(tournamentId, match.id, {
          currentInnings: 0,
          innings: [firstInningsReverted], // Reset array to just the active 1st innings
          "meta.matchStatus": "ongoing",
          "meta.result": null,
          "meta.target": null, // Remove the target so it doesn't trigger "Run Chase" logic
        });
        alert("2nd Innings Deleted. Reverted to 1st Innings.");
        onClose();
      } else {
        alert(
          "Deleting the 1st innings is not currently supported via this button. Please clear the timeline instead.",
        );
      }
    } catch (e) {
      alert("Error deleting innings: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 🟢 ADMIN RESOLUTION PANEL ---

  const resolveMatchManually = async (
    resolutionType,
    winnerId = null,
    winnerName = null,
  ) => {
    const msg =
      resolutionType === "WALKOVER"
        ? `Award walkover to ${winnerName}?`
        : "Abandon match and share points?";

    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      // 🟢 GET TOURNAMENT FORMAT FIRST
      const tSnap = await getDoc(doc(db, "tournaments", tournamentId));
      const tData = tSnap.data();
      const isKnockout = tData?.format === "knockout";

      let updateData = {
        status: "finished",
        isCancelled: true,
        lastUpdate: Date.now(),
        "meta.matchStatus": "finished",
      };

      if (resolutionType === "WALKOVER") {
        updateData.winner = winnerName;
        updateData.winnerId = winnerId;
        updateData.resultType = "walkover";
        updateData["meta.result"] = `${winnerName} won by Walkover`;

        // If it's a league, give 2 points, otherwise just advance them in bracket
        if (!isKnockout) {
          updateData.pointsAwarded = {
            teamA: winnerId === match.meta?.teamAId ? 2 : 0,
            teamB: winnerId === match.meta?.teamBId ? 2 : 0,
          };
        }
      } else {
        // ABANDONED
        updateData.winner = "No Result";
        updateData.resultType = "abandoned";
        updateData["meta.result"] = "Match Abandoned";

        // 🟢 SHARP LOGIC: Leagues get 1 point each. Knockouts stay stuck until a Walkover is decided.
        if (!isKnockout) {
          updateData.pointsAwarded = { teamA: 1, teamB: 1 };
          updateData["meta.result"] += " (Points Shared)";
        } else {
          updateData["meta.result"] += " (No Advance)";
        }
      }

      await updateMatch(tournamentId, match.id, updateData);
      alert("✅ Match resolved successfully.");
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // UI inside the Modal:
  <div className="space-y-4 p-4 border-t border-white/10">
    <h3 className="text-sm font-black uppercase text-orange-500">
      Emergency Match Resolution
    </h3>

    <div className="grid grid-cols-1 gap-3">
      {/* 1. Progress Team A (Walkover) */}
      <button
        onClick={() =>
          resolveMatchManually("WALKOVER", match.meta.teamAId, match.meta.teamA)
        }
        className="py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-teal-500/20 hover:border-teal-500 transition-all">
        Award Walkover to {match.meta.teamA}
      </button>

      {/* 2. Progress Team B (Walkover) */}
      <button
        onClick={() =>
          resolveMatchManually("WALKOVER", match.meta.teamBId, match.meta.teamB)
        }
        className="py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-teal-500/20 hover:border-teal-500 transition-all">
        Award Walkover to {match.meta.teamB}
      </button>

      {/* 3. Abandon (Split Points) */}
      <button
        onClick={() => resolveMatchManually("ABANDONED")}
        className="py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all">
        Abandon Match (Split Points)
      </button>
    </div>
  </div>;

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
          <div className="flex gap-2 mt-4 px-4 no-scrollbar">
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

              {/* 🔥 NEW FEATURE: Delete Entire 2nd Innings (Rewind) */}
              {currentInningIndex === 1 && (
                <div
                  className={`p-4 rounded-xl border flex flex-col gap-3 ${lightMode ? "bg-red-50 border-red-200" : "bg-red-900/10 border-red-500/20"}`}>
                  <div className="flex gap-3 items-start">
                    <RotateCcw
                      className={`shrink-0 ${lightMode ? "text-red-600" : "text-red-400"}`}
                      size={20}
                    />
                    <div className="text-xs">
                      <strong
                        className={lightMode ? "text-red-800" : "text-red-300"}>
                        Accidental 2nd Innings Start?
                      </strong>
                      <p
                        className={`mt-1 ${lightMode ? "text-red-700" : "text-red-400/80"}`}>
                        If you accidentally ended the 1st innings and started
                        the 2nd innings, you can delete this entire 2nd innings
                        to return to the 1st innings for corrections.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteInnings}
                    disabled={loading}
                    className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-md flex justify-center items-center gap-2">
                    {loading ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Wipe 2nd Innings & Rewind
                  </button>
                </div>
              )}

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
                className={`p-4 rounded-xl border border-dashed ${lightMode ? "bg-orange-50 border-orange-300" : "bg-orange-950/20 border-orange-500/30"}`}>
                <label className="text-[10px] font-black uppercase text-orange-500 block mb-3 tracking-widest">
                  Quick Match Resolution (Walkovers / Rain)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() =>
                      resolveMatchManually(
                        "WALKOVER",
                        match.meta?.teamAId,
                        match.meta?.teamA,
                      )
                    }
                    disabled={loading}
                    className="py-2.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase hover:bg-teal-600 hover:text-white transition-all">
                    Award Walkover to {match.meta?.teamA || "Team A"}
                  </button>
                  <button
                    onClick={() =>
                      resolveMatchManually(
                        "WALKOVER",
                        match.meta?.teamBId,
                        match.meta?.teamB,
                      )
                    }
                    disabled={loading}
                    className="py-2.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase hover:bg-teal-600 hover:text-white transition-all">
                    Award Walkover to {match.meta?.teamB || "Team B"}
                  </button>
                  <button
                    onClick={() => resolveMatchManually("ABANDONED")}
                    disabled={loading}
                    className="py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-bold uppercase text-red-500 hover:bg-red-600 hover:text-white transition-all">
                    Abandon Match (Shared Points)
                  </button>
                </div>
                <p className="text-[9px] mt-3 opacity-60 italic leading-tight">
                  * Use this for matches that won't be played. It will set
                  status to "finished" and declare a result immediately.
                </p>
              </div>
              <div
                className={`p-4 rounded-xl border ${lightMode ? "bg-purple-50 border-purple-200" : "bg-purple-900/10 border-purple-500/20"}`}>
                <label
                  className={`text-[10px] font-black uppercase block mb-3 ${lightMode ? "text-purple-700" : "text-purple-400"}`}>
                  Data Maintenance
                </label>
                <button
                  onClick={handleSyncSquads}
                  disabled={loading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md">
                  {loading ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Force Sync Squads from Tournament
                </button>
                <p className="text-[9px] mt-2 opacity-60 italic text-center">
                  Use this if your player dropdowns are empty.
                </p>
              </div>
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
                )}
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
