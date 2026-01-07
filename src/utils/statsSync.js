import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Syncs the performance data of all players in a finished match
 * to their permanent Global Player Profile.
 */
export const syncMatchStatsToGlobalPlayers = async (
  tournamentId,
  matchId,
  matchData
) => {
  // 1. Gather all players who have a Global ID (originalId)
  const playersToSync = [];

  // Helper to extract players from squads
  const processSquad = (squad) => {
    if (!squad) return;
    squad.forEach((p) => {
      // We need the Global ID to find the document
      // We need the Match Name & Match ID to find their stats in the innings
      if (p.originalId || p.id) {
        playersToSync.push({
          globalId: p.originalId || p.id, // Use originalId if valid, else fallback to id
          matchName: p.name,
          matchIdRef: p.id,
        });
      }
    });
  };

  processSquad(matchData.teamASquad);
  processSquad(matchData.teamBSquad);

  if (playersToSync.length === 0) {
    console.log("No global players found to sync.");
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      // 2. Iterate through players
      for (const player of playersToSync) {
        let runs = 0;
        let wickets = 0;
        let didPlay = false;

        // Check stats across all innings
        if (matchData.innings && Array.isArray(matchData.innings)) {
          matchData.innings.forEach((inn) => {
            // --- BATTING CHECK ---
            // Try finding stats by ID first, then by Name (Robust check)
            const batStat =
              inn.batsmenStats?.[player.matchIdRef] ||
              inn.batsmenStats?.[player.matchName];

            if (batStat) {
              runs += Number(batStat.runs) || 0;
              didPlay = true;
            }

            // --- BOWLING CHECK ---
            const bowlStat =
              inn.bowlerStats?.[player.matchIdRef] ||
              inn.bowlerStats?.[player.matchName];

            if (bowlStat) {
              wickets += Number(bowlStat.wickets) || 0;
              didPlay = true;
            }
          });
        }

        // 3. Update Global Document (Only if they have a valid Global ID)
        if (player.globalId) {
          const playerRef = doc(db, "players", player.globalId);
          const playerSnap = await transaction.get(playerRef);

          if (playerSnap.exists()) {
            const data = playerSnap.data();
            const stats = data.stats || {};
            const history = stats.history || [];

            // Idempotency: Prevent duplicate entry for same match
            const alreadyExists = history.some((h) => h.matchId === matchId);

            if (!alreadyExists) {
              // Determine Opponent Name
              let opponent = "Opponent";
              const isInTeamA = matchData.teamASquad?.some(
                (p) => p.name === player.matchName
              );
              if (isInTeamA) opponent = matchData.meta?.teamB || "Team B";
              else opponent = matchData.meta?.teamA || "Team A";

              const newHistoryEntry = {
                tournamentId,
                matchId,
                date:
                  matchData.meta?.date || new Date().toISOString().slice(0, 10),
                opponent: opponent,
                runs: runs,
                wickets: wickets,
                result: matchData.meta?.result || "Played",
              };

              // Calculate New Totals
              const newMatches = (Number(stats.matches) || 0) + 1;
              const newRuns = (Number(stats.runs) || 0) + runs;
              const newWickets = (Number(stats.wickets) || 0) + wickets;
              const currentHS = Number(stats.highestScore) || 0;
              const newHS = runs > currentHS ? runs : currentHS;

              transaction.update(playerRef, {
                "stats.matches": newMatches,
                "stats.runs": newRuns,
                "stats.wickets": newWickets,
                "stats.highestScore": newHS,
                "stats.history": [newHistoryEntry, ...history], // Add new match to top
              });
            }
          }
        }
      }
    });
    console.log("Global stats synced successfully.");
  } catch (e) {
    console.error("Stats Sync Error:", e);
  }
};
