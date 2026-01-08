import {
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  doc,
} from "firebase/firestore";
import { db } from "../utils/firebase"; // Checked path

// Helper to normalize names for loose matching
const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();

/**
 * SYNC STATS: Robust Version
 */
export async function syncMatchStatsToGlobalPlayers(
  tournamentId,
  matchId,
  match
) {
  if (!match || !match.innings) return;

  const playerUpdates = {};

  const addUpdate = (rawName, stats) => {
    if (!rawName || rawName === "Unknown") return;

    // We use the normalized name as the KEY temporarily to group stats
    const key = normalize(rawName);

    if (!playerUpdates[key]) {
      playerUpdates[key] = {
        realName: rawName, // Keep the original casing for display if needed
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
      };
    }

    if (stats.runs) playerUpdates[key].runs += stats.runs;
    if (stats.balls) playerUpdates[key].balls += stats.balls;
    if (stats.fours) playerUpdates[key].fours += stats.fours;
    if (stats.sixes) playerUpdates[key].sixes += stats.sixes;
    if (stats.wickets) playerUpdates[key].wickets += stats.wickets;
  };

  // --- AGGREGATE ---
  match.innings.forEach((inn) => {
    Object.entries(inn.batsmenStats || {}).forEach(([name, s]) => {
      addUpdate(name, s);
    });
    Object.entries(inn.bowlerStats || {}).forEach(([name, s]) => {
      addUpdate(name, s);
    });
  });

  // --- UPDATE DB ---
  try {
    const playersCol = collection(db, "players");
    const allGlobalPlayersSnap = await getDocs(playersCol);
    const globalPlayersMap = {}; // Map Normalized Name -> Doc Ref

    // Pre-fetch all players to avoid N+1 queries (Performance Fix)
    allGlobalPlayersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.name) {
        globalPlayersMap[normalize(data.name)] = { id: doc.id, data };
      }
    });

    await runTransaction(db, async (transaction) => {
      for (const [key, stats] of Object.entries(playerUpdates)) {
        // Robust Lookup: Check map instead of query
        const playerNode = globalPlayersMap[key];

        if (playerNode) {
          const playerRef = doc(db, "players", playerNode.id);
          const current = playerNode.data.stats || {};

          const newStats = {
            matches: (current.matches || 0) + 1,
            runs: (current.runs || 0) + stats.runs,
            wickets: (current.wickets || 0) + stats.wickets,
            highestScore: Math.max(current.highestScore || 0, stats.runs),
            bestBowling: current.bestBowling || "0/0", // Keep existing
            // Add history if you want (optional)
          };

          transaction.update(playerRef, { stats: newStats });
        } else {
          console.warn(
            `Skipping sync for ${stats.realName}: Player not found in Global Database.`
          );
        }
      }
    });
    console.log("Global stats synced successfully.");
  } catch (error) {
    console.error("Error syncing global stats:", error);
  }
}
/**
 * REVERT STATS: Subtracts the stats of a match from Global Players
 * Called before deleting a match.
 */
export async function revertMatchStatsFromGlobal(match) {
  if (!match || !match.innings) return;

  // We need to map player names to their Stats Objects to subtract
  const playerUpdates = {};

  // Helper to accumulate negative updates
  const addUpdate = (name, stats) => {
    if (!name || name === "Unknown") return;
    if (!playerUpdates[name]) {
      playerUpdates[name] = {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        matches: 0,
      };
    }
    playerUpdates[name].runs += stats.runs || 0;
    playerUpdates[name].balls += stats.balls || 0;
    playerUpdates[name].fours += stats.fours || 0;
    playerUpdates[name].sixes += stats.sixes || 0;
    playerUpdates[name].wickets += stats.wickets || 0;
    // We only subtract 1 match count per player later
  };

  // 1. Aggregate stats to subtract from both innings
  match.innings.forEach((inn) => {
    // Batting
    Object.entries(inn.batsmenStats || {}).forEach(([name, s]) => {
      addUpdate(name, {
        runs: s.runs,
        balls: s.balls,
        fours: s.fours,
        sixes: s.sixes,
      });
    });
    // Bowling
    Object.entries(inn.bowlerStats || {}).forEach(([name, s]) => {
      addUpdate(name, { wickets: s.wickets }); // We usually don't track bowling runs/balls globally for simplicity, but add if needed
    });
  });

  // 2. Execute Updates in a Transaction
  // (We search players by Name because Match data usually stores Names, not IDs)
  try {
    await runTransaction(db, async (transaction) => {
      const playersCol = collection(db, "players");

      for (const [name, statsToRemove] of Object.entries(playerUpdates)) {
        // Find player by name
        const q = query(playersCol, where("name", "==", name));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const playerDoc = snapshot.docs[0];
          const playerRef = doc(db, "players", playerDoc.id);
          const currentStats = playerDoc.data().stats || {};

          // Calculate new stats (Current - Match)
          // Ensure we don't go below zero
          const newStats = {
            matches: Math.max(0, (currentStats.matches || 1) - 1),
            runs: Math.max(0, (currentStats.runs || 0) - statsToRemove.runs),
            wickets: Math.max(
              0,
              (currentStats.wickets || 0) - statsToRemove.wickets
            ),
            highestScore: currentStats.highestScore, // Cannot easily revert HS without full history, ignore for now
            bestBowling: currentStats.bestBowling, // Cannot easily revert BB
          };

          transaction.update(playerRef, { stats: newStats });
        }
      }
    });
    console.log("Global stats reverted successfully.");
  } catch (error) {
    console.error("Error reverting global stats:", error);
    // We don't throw here to ensure the match deletion still proceeds
  }
}
