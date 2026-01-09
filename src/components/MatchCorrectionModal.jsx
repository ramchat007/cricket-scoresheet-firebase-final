import React, { useState, useMemo, useEffect } from "react";
import { modifyMatchTimeline, updateMatch } from "../utils/matchService"; 

const MatchCorrectionModal = ({ match, tournamentId, onClose }) => {
  const [mode, setMode] = useState("timeline"); // 'timeline' | 'manual' | 'meta'
  const [activeTab, setActiveTab] = useState(0); // 0 = Innings 1, 1 = Innings 2

  // --- 1. SAFE DATA EXTRACTION (Handles Map Structure & Ghost Innings) ---
  const { safeInnings, validIndices } = useMemo(() => {
    if (!match || !match.innings) return { safeInnings: [], validIndices: [] };

    // Handle Map (Object) or Array
    const rawInnings = match.innings;
    // Get keys, filter numeric ones, sort them
    const indices = Object.keys(rawInnings)
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
    
    // Filter out "Ghost" innings (empty data or null)
    const valid = indices.filter(idx => {
        const inn = rawInnings[idx];
        // Must have at least a batting team or some score data to be valid
        return inn && (inn.battingTeam || inn.score !== undefined);
    });

    return {
        safeInnings: valid.map(idx => rawInnings[idx]),
        validIndices: valid
    };
  }, [match]);

  // Determine the REAL index in the DB based on the active tab (0 or 1)
  // If no valid indices found, fallback to 0
  const currentInningIndex = validIndices[activeTab] ?? 0;
  const currentInningData = match?.innings?.[currentInningIndex] || {};
  const currentTimeline = currentInningData.timeline || [];

  // --- STATE FOR TIMELINE EDITOR ---
  const [editingBallIndex, setEditingBallIndex] = useState(null);
  const [editPayload, setEditPayload] = useState({});

  // --- STATE FOR MANUAL OVERWRITE ---
  // Initialize state when tab changes or modal opens
  const [manualScore, setManualScore] = useState(0);
  const [manualWickets, setManualWickets] = useState(0);
  const [manualOver, setManualOver] = useState(0);
  const [manualBall, setManualBall] = useState(0);
  const [manualStriker, setManualStriker] = useState("");
  const [manualNonStriker, setManualNonStriker] = useState("");
  const [manualBowler, setManualBowler] = useState("");
  
  // Sync manual state when inning changes
  useEffect(() => {
      setManualScore(currentInningData.score || 0);
      setManualWickets(currentInningData.wickets || 0);
      setManualOver(currentInningData.over || 0);
      setManualBall(currentInningData.overBallCount || 0);
      setManualStriker(currentInningData.striker || "");
      setManualNonStriker(currentInningData.nonStriker || "");
      setManualBowler(currentInningData.currentBowler || "");
  }, [currentInningIndex, currentInningData]); // Re-run when switching tabs

  // --- STATE FOR META FIXER ---
  const [metaStatus, setMetaStatus] = useState(match?.meta?.matchStatus || "ongoing");
  const [metaWinner, setMetaWinner] = useState(match?.meta?.winner || "");

  const [loading, setLoading] = useState(false);

  if (!match) return null;

  // --- SQUAD LOGIC (For Manual Mode) ---
  const { batSquad, bowlSquad } = useMemo(() => {
    const batTeam = currentInningData.battingTeam;
    // Default empty if missing
    if (!batTeam) return { batSquad: [], bowlSquad: [] };

    if (batTeam === match.meta?.teamA)
      return { batSquad: match.teamASquad || [], bowlSquad: match.teamBSquad || [] };
    if (batTeam === match.meta?.teamB)
      return { batSquad: match.teamBSquad || [], bowlSquad: match.teamASquad || [] };
    
    return { batSquad: [], bowlSquad: [] };
  }, [match, currentInningData]);

  const getPlayerName = (p) => (typeof p === "object" ? p.name : p) || "";

  // --- HELPER: Display Logic ---
  const getBallDisplay = (ball) => {
    if (typeof ball !== "object") {
      return {
        desc: `Legacy: ${ball}`,
        runs: parseInt(ball) || 0,
        isWicket: ball === "W",
      };
    }
    return {
      desc: `${ball.bowler || "?"} to ${ball.batter || "?"}`,
      runs: ball.runs,
      isWicket: ball.isWicket,
      isWide: ball.isWide,
      isNoBall: ball.isNoBall,
    };
  };

  // --- ACTIONS ---

  const handleEditClick = (index, ball) => {
    setEditingBallIndex(index);
    if (typeof ball !== "object") {
      setEditPayload({
        runs: parseInt(ball) || 0,
        isWicket: ball === "W",
        isWide: false,
        isNoBall: false,
        batter: "Unknown",
        bowler: "Unknown",
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
        inningsIndex: currentInningIndex, // Use the REAL index from map
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
        inningsIndex: currentInningIndex,
        index: index,
      });
    } catch (error) {
      alert("Delete failed: " + error.message);
    }
  };

  const handleManualSave = async () => {
    if (!window.confirm("Overwrite score? This forces the database values and clears waiting flags.")) return;
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
        
        // FORCE UNLOCK
        [`innings.${currentInningIndex}.awaitingNewBatsman`]: false,
        [`innings.${currentInningIndex}.awaitingNewBowler`]: false,
        [`innings.${currentInningIndex}.completed`]: false,
      };
      await updateMatch(tournamentId, match.id, updateData);
      alert("Updated!");
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaSave = async () => {
      if(!window.confirm("Update Match Status?")) return;
      try {
          await updateMatch(tournamentId, match.id, {
              "meta.matchStatus": metaStatus,
              status: metaStatus,
              "meta.winner": metaWinner || null,
              winner: metaWinner || null
          });
          alert("Match Metadata Updated.");
      } catch (e) {
          alert("Error: " + e.message);
      }
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-2xl rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            🛠 Match Correction Console
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
            &times;
          </button>
        </div>

        {/* NAVIGATION */}
        <div className="flex bg-gray-950 p-1 mx-4 mt-4 rounded-lg border border-gray-800">
          <button onClick={() => setMode("timeline")} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${mode === "timeline" ? "bg-gray-800 text-white shadow" : "text-gray-500"}`}>
            Timeline
          </button>
          <button onClick={() => setMode("manual")} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${mode === "manual" ? "bg-red-900/30 text-red-400 shadow" : "text-gray-500"}`}>
            Overwrite Score
          </button>
          <button onClick={() => setMode("meta")} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${mode === "meta" ? "bg-blue-900/30 text-blue-400 shadow" : "text-gray-500"}`}>
            Fix Status
          </button>
        </div>

        {/* INNINGS TABS (Only showing valid non-ghost innings) */}
        {mode !== 'meta' && (
            <div className="flex border-b border-gray-700 mt-4 mx-4">
            {safeInnings.map((inn, idx) => (
                <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === idx
                    ? "bg-cyan-600 text-white rounded-t-lg"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                >
                {inn.battingTeam || `Innings ${idx + 1}`}
                </button>
            ))}
            </div>
        )}

        {/* === MODE A: TIMELINE EDITOR === */}
        {mode === "timeline" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-950/50">
            {currentTimeline.length === 0 ? (
              <div className="text-center text-gray-500 py-10 italic">No balls bowled yet in this innings.</div>
            ) : (
              currentTimeline.map((ball, idx) => {
                const display = getBallDisplay(ball);
                return (
                  <div key={idx} className="bg-gray-800 p-3 rounded-lg flex items-center justify-between group border border-transparent hover:border-gray-600 transition-all">
                    {editingBallIndex !== idx ? (
                      <>
                        <div className="flex items-center gap-4">
                          <div className="text-gray-500 font-mono text-xs w-6 text-right">{idx + 1}.</div>
                          <div>
                            <div className="text-sm font-bold text-white">{display.desc}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {display.isWicket ? <span className="text-red-400 font-bold">WICKET</span> : <span>{display.runs} runs</span>}
                              {display.isWide && <span className="text-yellow-500 ml-1">(Wide)</span>}
                              {display.isNoBall && <span className="text-yellow-500 ml-1">(NB)</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditClick(idx, ball)} className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/50 text-xs rounded">Edit</button>
                          <button onClick={() => handleTimelineDelete(idx)} className="px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-500/50 text-xs rounded">Delete</button>
                        </div>
                      </>
                    ) : (
                      // EDIT MODE
                      <div className="flex-1 flex flex-col gap-3 bg-gray-900 p-3 rounded border border-blue-500/50">
                        <div className="text-xs text-blue-400 font-bold uppercase">Editing Ball #{idx + 1}</div>
                        <div className="grid grid-cols-2 gap-2">
                            <input className="bg-black p-2 text-white text-xs border border-gray-700 rounded" value={editPayload.batter} onChange={e => setEditPayload({...editPayload, batter: e.target.value})} placeholder="Batter" />
                            <input className="bg-black p-2 text-white text-xs border border-gray-700 rounded" value={editPayload.bowler} onChange={e => setEditPayload({...editPayload, bowler: e.target.value})} placeholder="Bowler" />
                        </div>
                        <div className="flex gap-3 items-center">
                            <div className="flex items-center gap-1"><label className="text-xs text-gray-400">Runs</label><input type="number" className="w-12 bg-black border border-gray-700 text-white rounded p-1" value={editPayload.runs} onChange={e => setEditPayload({...editPayload, runs: Number(e.target.value)})} /></div>
                            <label className="text-xs text-gray-300"><input type="checkbox" checked={editPayload.isWicket} onChange={e => setEditPayload({...editPayload, isWicket: e.target.checked})} /> Wicket</label>
                            <label className="text-xs text-gray-300"><input type="checkbox" checked={editPayload.isWide} onChange={e => setEditPayload({...editPayload, isWide: e.target.checked})} /> Wide</label>
                            <label className="text-xs text-gray-300"><input type="checkbox" checked={editPayload.isNoBall} onChange={e => setEditPayload({...editPayload, isNoBall: e.target.checked})} /> NB</label>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setEditingBallIndex(null)} className="text-xs text-gray-400 px-3 py-1">Cancel</button>
                            <button onClick={handleTimelineSave} className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold">Save</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* === MODE B: MANUAL OVERWRITE === */}
        {mode === "manual" && (
          <div className="p-6 overflow-y-auto bg-gray-950/50 flex-1">
            <div className="bg-red-900/10 border border-red-500/30 rounded p-3 mb-6 text-xs text-red-300">
              ⚠️ <b>Warning:</b> This directly overwrites the main scoreboard. Use only if calculations drift.
            </div>
            
            {/* Score Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><label className="text-xs font-bold text-gray-500 block mb-1">Runs</label><input type="number" className="w-full bg-black border border-gray-700 rounded p-3 text-white font-bold" value={manualScore} onChange={(e) => setManualScore(e.target.value)} /></div>
              <div><label className="text-xs font-bold text-gray-500 block mb-1">Wickets</label><input type="number" className="w-full bg-black border border-gray-700 rounded p-3 text-white font-bold" value={manualWickets} onChange={(e) => setManualWickets(e.target.value)} /></div>
              <div><label className="text-xs font-bold text-gray-500 block mb-1">Overs</label><input type="number" className="w-full bg-black border border-gray-700 rounded p-3 text-white" value={manualOver} onChange={(e) => setManualOver(e.target.value)} /></div>
              <div><label className="text-xs font-bold text-gray-500 block mb-1">Balls (0-5)</label><input type="number" max="6" className="w-full bg-black border border-gray-700 rounded p-3 text-white" value={manualBall} onChange={(e) => setManualBall(e.target.value)} /></div>
            </div>

            <div className="h-px bg-gray-800 mb-6"></div>

            {/* Players Grid */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Active Players Override</h4>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Striker</label>
                <select className="w-full bg-gray-800 text-white p-2.5 rounded border border-gray-700" value={manualStriker} onChange={(e) => setManualStriker(e.target.value)}>
                  <option value="">Select Striker</option>
                  {(batSquad || []).map((p) => <option key={getPlayerName(p)} value={getPlayerName(p)}>{getPlayerName(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Non-Striker</label>
                <select className="w-full bg-gray-800 text-white p-2.5 rounded border border-gray-700" value={manualNonStriker} onChange={(e) => setManualNonStriker(e.target.value)}>
                  <option value="">Select Non-Striker</option>
                  {(batSquad || []).map((p) => <option key={getPlayerName(p)} value={getPlayerName(p)}>{getPlayerName(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bowler</label>
                <select className="w-full bg-gray-800 text-white p-2.5 rounded border border-gray-700" value={manualBowler} onChange={(e) => setManualBowler(e.target.value)}>
                  <option value="">Select Bowler</option>
                  {(bowlSquad || []).map((p) => <option key={getPlayerName(p)} value={getPlayerName(p)}>{getPlayerName(p)}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button onClick={onClose} className="px-4 py-2 text-gray-400">Cancel</button>
                <button onClick={handleManualSave} disabled={loading} className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded">Force Overwrite & Unlock</button>
            </div>
          </div>
        )}

        {/* === MODE C: FIX STATUS (New!) === */}
        {mode === "meta" && (
            <div className="p-6 bg-gray-950/50 flex-1">
                <h3 className="text-white font-bold mb-4">Fix Match Status</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Match Status</label>
                        <select className="w-full bg-black border border-gray-700 text-white p-3 rounded" value={metaStatus} onChange={e => setMetaStatus(e.target.value)}>
                            <option value="upcoming">Upcoming</option>
                            <option value="ongoing">Ongoing (Live)</option>
                            <option value="finished">Finished</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Winner (Team Name)</label>
                        <input className="w-full bg-black border border-gray-700 text-white p-3 rounded" placeholder="e.g. Team A" value={metaWinner} onChange={e => setMetaWinner(e.target.value)} />
                    </div>
                    <button onClick={handleMetaSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded mt-4">Save Metadata</button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default MatchCorrectionModal;