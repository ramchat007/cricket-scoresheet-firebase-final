import React, { useState } from "react";
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  Scale,
  Gavel,
  AlertTriangle,
  Trash2,
  Save,
  Lock,
  ScrollText,
  Loader2,
  DatabaseZap, // 🟢 Added icon for the maintenance section
} from "lucide-react";

export default function SettingsTab({ tournament, canEdit }) {
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false); // 🟢 New state for the button

  // 1. Initialize State from Tournament Data
  const [tieRule, setTieRule] = useState(
    tournament?.rules?.tieRule || "COMPULSORY_CHASE",
  );

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const ref = doc(db, "tournaments", tournament.id);
      await updateDoc(ref, {
        "rules.tieRule": tieRule,
        updatedAt: new Date().toISOString(),
      });
      alert(
        "✅ Settings Updated! Please 'Sync Stats' in Points Table to apply changes.",
      );
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🟢 NEW FUNCTION: Recalculate Ghost Stats
  const handleRecalculateStats = async () => {
    if (!canEdit) return;

    const confirmMsg =
      "🔄 Are you sure? This will scan all existing completed matches and rebuild every player's stats from scratch to fix any ghost data.";
    if (!window.confirm(confirmMsg)) return;

    setIsRecalculating(true);
    try {
      const batch = writeBatch(db);
      const playerAggregates = {}; // Store tallies here: { "PlayerName": { runs: 10, wickets: 2... } }

      // 1. Fetch all matches for this tournament
      const matchesSnap = await getDocs(
        collection(db, "tournaments", tournament.id, "matches"),
      );

      // 2. Tally up stats ONLY from valid, completed matches
      matchesSnap.forEach((docSnap) => {
        const matchData = docSnap.data();
        const status = (
          matchData.status ||
          matchData.meta?.status ||
          ""
        ).toLowerCase();

        if (["completed", "finished"].includes(status) && matchData.innings) {
          matchData.innings.forEach((inn) => {
            // Aggregate Batting
            if (inn.batsmenStats) {
              Object.entries(inn.batsmenStats).forEach(
                ([playerName, stats]) => {
                  if (!playerAggregates[playerName])
                    playerAggregates[playerName] = {
                      runs: 0,
                      balls: 0,
                      fours: 0,
                      sixes: 0,
                      wickets: 0,
                      runsConceded: 0,
                      ballsBowled: 0,
                      matches: 0,
                    };
                  playerAggregates[playerName].runs += stats.runs || 0;
                  playerAggregates[playerName].fours += stats.fours || 0;
                  playerAggregates[playerName].sixes += stats.sixes || 0;
                  playerAggregates[playerName].balls += stats.balls || 0;
                  // Note: You can add logic to increment 'matches' count here if needed
                },
              );
            }
            // Aggregate Bowling
            if (inn.bowlerStats) {
              Object.entries(inn.bowlerStats).forEach(([playerName, stats]) => {
                if (!playerAggregates[playerName])
                  playerAggregates[playerName] = {
                    runs: 0,
                    balls: 0,
                    fours: 0,
                    sixes: 0,
                    wickets: 0,
                    runsConceded: 0,
                    ballsBowled: 0,
                    matches: 0,
                  };
                playerAggregates[playerName].wickets += stats.wickets || 0;
                playerAggregates[playerName].runsConceded += stats.runs || 0; // Runs conceded

                // Convert overs (e.g. 1.2) to total balls
                const oversStr = String(stats.overs || 0);
                const [fullOvers, extraBalls] = oversStr.split(".");
                playerAggregates[playerName].ballsBowled +=
                  parseInt(fullOvers || 0) * 6 + parseInt(extraBalls || 0);
              });
            }
          });
        }
      });

      // 3. Fetch all teams to apply the newly calculated stats
      const teamsSnap = await getDocs(
        collection(db, "tournaments", tournament.id, "teams"),
      );

      teamsSnap.forEach((teamDoc) => {
        const teamData = teamDoc.data();
        let needsUpdate = false;

        // Assuming your players are stored in a 'squad' array inside the team document
        if (teamData.squad && Array.isArray(teamData.squad)) {
          const updatedSquad = teamData.squad.map((player) => {
            const freshStats = playerAggregates[player.name] || {
              runs: 0,
              fours: 0,
              sixes: 0,
              wickets: 0,
              ballsBowled: 0,
              runsConceded: 0,
            };

            // Apply fresh stats, wiping out ghost data
            return {
              ...player,
              runs: freshStats.runs,
              fours: freshStats.fours,
              sixes: freshStats.sixes,
              wickets: freshStats.wickets,
              ballsBowled: freshStats.ballsBowled,
              runsConceded: freshStats.runsConceded,
            };
          });

          batch.update(teamDoc.ref, { squad: updatedSquad });
          needsUpdate = true;
        }
      });

      // 4. Commit the batch update
      await batch.commit();
      alert("✅ Player stats have been fully recalculated and synced!");
    } catch (e) {
      console.error("Recalculation Error:", e);
      alert("Error recalculating stats: " + e.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDeleteTournament = async () => {
    const confirmMsg = `⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to delete "${tournament.name}"?\nThis action cannot be undone and will delete all matches and teams.`;
    if (!window.confirm(confirmMsg)) return;

    // Double confirmation
    const input = window.prompt(`Type "DELETE" to confirm.`);
    if (input !== "DELETE") return;

    try {
      await deleteDoc(doc(db, "tournaments", tournament.id));
      navigate("/tournaments");
    } catch (e) {
      alert("Error deleting: " + e.message);
    }
  };

  if (!canEdit) {
    return (
      <div
        className={`p-8 text-center italic flex flex-col items-center gap-2 ${theme.sub}`}>
        <Lock size={24} />
        🔒 Only tournament admins can access settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* SECTION 1: RULES CONFIGURATION */}
      <div
        className={`border rounded-2xl p-6 shadow-xl ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <h3
          className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme.text}`}>
          <ScrollText size={20} className="text-teal-500" /> Tournament Rules
        </h3>

        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
            <label
              className={`block text-xs font-black uppercase tracking-widest mb-3 ${theme.sub}`}>
              Tie Breaker Rule
            </label>
            <div className="grid gap-3">
              {[
                {
                  id: "COMPULSORY_CHASE",
                  label: "Compulsory Chase (Defending Team Wins)",
                  desc: "If scores are tied, the team that batted first wins automatically.",
                  icon: Scale,
                },
                {
                  id: "SHARED_POINTS",
                  label: "Shared Points (Draw)",
                  desc: "Both teams get 1 point each. NRR remains neutral.",
                  icon: ScrollText,
                },
                {
                  id: "SUPER_OVER",
                  label: "Super Over (Manual Winner)",
                  desc: "Match shows as TIE until you manually set a winner in the match editor.",
                  icon: Gavel,
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = tieRule === opt.id;

                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? lightMode
                          ? "bg-teal-50 border-teal-200"
                          : "bg-teal-500/10 border-teal-500/50"
                        : lightMode
                          ? "bg-white border-gray-200 hover:bg-gray-50"
                          : "bg-transparent border-white/5 hover:bg-white/5"
                    }`}>
                    <input
                      type="radio"
                      name="tieRule"
                      value={opt.id}
                      checked={isSelected}
                      onChange={(e) => setTieRule(e.target.value)}
                      className="mt-1 accent-teal-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          size={14}
                          className={
                            isSelected ? "text-teal-500" : "text-slate-400"
                          }
                        />
                        <div
                          className={`text-sm font-bold ${
                            isSelected
                              ? lightMode
                                ? "text-teal-700"
                                : "text-teal-400"
                              : theme.text
                          }`}>
                          {opt.label}
                        </div>
                      </div>
                      <div
                        className={`text-[10px] leading-snug mt-1 ml-6 ${theme.sub}`}>
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20">
            {isSaving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* 🟢 NEW SECTION: DATA MAINTENANCE */}
      <div
        className={`border rounded-2xl p-6 shadow-xl transition-all ${
          lightMode
            ? "bg-indigo-50 border-indigo-200"
            : "bg-[#1C2128] border-indigo-500/20"
        }`}>
        <h3
          className={`text-lg font-bold mb-2 flex items-center gap-2 ${lightMode ? "text-indigo-700" : "text-indigo-400"}`}>
          <DatabaseZap size={20} /> Data Maintenance
        </h3>
        <p
          className={`text-xs mb-4 ${lightMode ? "text-indigo-600/70" : "text-slate-400"}`}>
          If you deleted a test match and players still have ghost runs/wickets,
          click below to wipe the leaderboard and recalculate everything from
          scratch based only on existing completed matches.
        </p>
        <button
          onClick={handleRecalculateStats}
          disabled={isRecalculating}
          className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            lightMode
              ? "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100 shadow-sm"
              : "bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-500/30"
          } disabled:opacity-50 disabled:cursor-not-allowed`}>
          {isRecalculating ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <DatabaseZap size={18} />
          )}
          {isRecalculating ? "Scanning Matches..." : "Recalculate Player Stats"}
        </button>
      </div>

      {/* SECTION 3: DANGER ZONE */}
      <div
        className={`border rounded-2xl p-6 shadow-xl transition-all ${
          lightMode
            ? "bg-red-50 border-red-200"
            : "bg-[#1C2128] border-red-500/20 opacity-90 hover:opacity-100"
        }`}>
        <h3
          className={`text-lg font-bold mb-2 flex items-center gap-2 ${lightMode ? "text-red-700" : "text-red-500"}`}>
          <AlertTriangle size={20} /> Danger Zone
        </h3>
        <p
          className={`text-xs mb-4 ${lightMode ? "text-red-600/70" : "text-slate-500"}`}>
          Actions here cannot be undone. Proceed with caution.
        </p>
        <button
          onClick={handleDeleteTournament}
          className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            lightMode
              ? "bg-white border border-red-200 text-red-600 hover:bg-red-100 shadow-sm"
              : "bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-500/30"
          }`}>
          <Trash2 size={18} /> Delete Tournament
        </button>
      </div>
    </div>
  );
}
