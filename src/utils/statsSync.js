import {
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  doc,
} from "firebase/firestore";
import { db } from "../utils/firebase";

// Helper to normalize names for loose matching
const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();

/**
 * ------------------------------------------------------------------
 * 1. SYNC STATS (Match -> Global Player Profile)
 * Fix: Separates Batting Runs vs Bowling Runs to fix Orange Cap bug.
 * ------------------------------------------------------------------
 */
export async function syncMatchStatsToGlobalPlayers(
  tournamentId,
  matchId,
  match,
) {
  if (!match || !match.innings) return;

  const playerUpdates = {};

  // ✅ Helper: Accumulate stats with Type Safety
  const addUpdate = (rawName, stats, type) => {
    if (!rawName || rawName === "Unknown") return;
    const key = normalize(rawName);

    if (!playerUpdates[key]) {
      playerUpdates[key] = {
        realName: rawName.trim(),
        batRuns: 0, // ONLY Batting
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        wickets: 0, // ONLY Bowling
        runsConceded: 0, // ONLY Bowling
      };
    }

    if (type === "batting") {
      playerUpdates[key].batRuns += parseInt(stats.runs || 0);
      playerUpdates[key].ballsFaced += parseInt(stats.balls || 0);
      playerUpdates[key].fours += parseInt(stats.fours || 0);
      playerUpdates[key].sixes += parseInt(stats.sixes || 0);
    } else if (type === "bowling") {
      playerUpdates[key].wickets += parseInt(stats.wickets || 0);
      playerUpdates[key].runsConceded += parseInt(stats.runs || 0); // Conceded
    }
  };

  // --- AGGREGATE ---
  match.innings.forEach((inn) => {
    // 🏏 Batting Loop
    Object.entries(inn.batsmenStats || {}).forEach(([name, s]) => {
      if (s.balls > 0 || s.out) addUpdate(name, s, "batting");
    });
    // 🥎 Bowling Loop
    Object.entries(inn.bowlerStats || {}).forEach(([name, s]) => {
      if (s.balls > 0) addUpdate(name, s, "bowling");
    });
  });

  // --- UPDATE DB ---
  try {
    const playersCol = collection(db, "players");
    const allGlobalPlayersSnap = await getDocs(playersCol);
    const globalPlayersMap = {};

    // Pre-fetch all players
    allGlobalPlayersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.name) {
        globalPlayersMap[normalize(data.name)] = { id: doc.id, data };
      }
    });

    await runTransaction(db, async (transaction) => {
      for (const [key, stats] of Object.entries(playerUpdates)) {
        const playerNode = globalPlayersMap[key];

        if (playerNode) {
          const playerRef = doc(db, "players", playerNode.id);
          const current = playerNode.data.stats || {};

          const newStats = {
            matches: (current.matches || 0) + 1,
            // 🔒 SECURITY: Only add batRuns to global runs
            runs: (current.runs || 0) + stats.batRuns,
            wickets: (current.wickets || 0) + stats.wickets,
            highestScore: Math.max(current.highestScore || 0, stats.batRuns),
            bestBowling: current.bestBowling || "0/0",
          };

          transaction.update(playerRef, { stats: newStats });
        } else {
          console.warn(
            `Skipping sync: '${stats.realName}' not found in Global DB.`,
          );
        }
      }
    });
    console.log("✅ Global stats synced successfully (Strict Mode).");
  } catch (error) {
    console.error("❌ Error syncing global stats:", error);
  }
}

/**
 * ---------------------------------------------------------
 * 2. REVERT LOGIC (Undo Stats)
 * Fix: Ensures we subtract correct values when deleting a match.
 * ---------------------------------------------------------
 */

async function revertPlayerStats(match) {
  if (!match || !match.innings) return;

  const playerUpdates = {};

  // ✅ Helper: Same Strict Separation
  const addUpdate = (rawName, stats, type) => {
    if (!rawName || rawName === "Unknown") return;
    const name = rawName.trim();

    if (!playerUpdates[name]) {
      playerUpdates[name] = {
        batRuns: 0,
        wickets: 0,
      };
    }

    if (type === "batting") {
      playerUpdates[name].batRuns += parseInt(stats.runs || 0);
    } else if (type === "bowling") {
      playerUpdates[name].wickets += parseInt(stats.wickets || 0);
    }
  };

  match.innings.forEach((inn) => {
    Object.entries(inn.batsmenStats || {}).forEach(([name, s]) => {
      addUpdate(name, s, "batting");
    });
    Object.entries(inn.bowlerStats || {}).forEach(([name, s]) => {
      addUpdate(name, s, "bowling");
    });
  });

  try {
    await runTransaction(db, async (transaction) => {
      const playersCol = collection(db, "players");

      for (const [name, statsToRemove] of Object.entries(playerUpdates)) {
        const q = query(playersCol, where("name", "==", name));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const playerDoc = snapshot.docs[0];
          const playerRef = doc(db, "players", playerDoc.id);
          const currentStats = playerDoc.data().stats || {};

          const newStats = {
            matches: Math.max(0, (currentStats.matches || 1) - 1),
            // 🔒 SECURITY: Only subtract batting runs
            runs: Math.max(0, (currentStats.runs || 0) - statsToRemove.batRuns),
            wickets: Math.max(
              0,
              (currentStats.wickets || 0) - statsToRemove.wickets,
            ),
            highestScore: currentStats.highestScore,
            bestBowling: currentStats.bestBowling,
          };

          transaction.update(playerRef, { stats: newStats });
        }
      }
    });
    console.log("✅ Global player stats reverted successfully.");
  } catch (error) {
    console.error("❌ Error reverting global stats:", error);
  }
}

/**
 * 3. REVERT TOURNAMENT TEAMS (Points Table Correction)
 */
async function revertTeamStats(matchData) {
  if (!matchData || !matchData.id) return;

  const tournamentId = matchData.tournamentId || matchData.meta?.tournament;
  if (!tournamentId) return;

  const teamsColRef = collection(db, "tournaments", tournamentId, "teams");

  try {
    await runTransaction(db, async (transaction) => {
      const inn1 = matchData.innings?.[0];
      const inn2 = matchData.innings?.[1];
      if (!inn1 || !inn2) return;

      const t1Name = inn1.battingTeam;
      const t2Name = inn2.battingTeam;

      const q1 = query(teamsColRef, where("name", "==", t1Name));
      const q2 = query(teamsColRef, where("name", "==", t2Name));
      const [t1Snap, t2Snap] = await Promise.all([getDocs(q1), getDocs(q2)]);

      if (t1Snap.empty || t2Snap.empty) return;

      const t1Doc = t1Snap.docs[0];
      const t2Doc = t2Snap.docs[0];
      const t1Data = t1Doc.data();
      const t2Data = t2Doc.data();

      // NRR Calc
      const totalOvers = parseInt(matchData.meta?.overs || 20);
      const totalBallsQuota = totalOvers * 6;

      const t1BallsFaced =
        inn1.wickets >= 10 || inn1.isAllOut
          ? totalBallsQuota
          : inn1.over * 6 + inn1.overBallCount;
      const t2BallsFaced =
        inn2.wickets >= 10 || inn2.isAllOut
          ? totalBallsQuota
          : inn2.over * 6 + inn2.overBallCount;

      const reverseStats = (
        currentData,
        isWinner,
        isTie,
        runsFor,
        ballsFor,
        runsAgainst,
        ballsAgainst,
      ) => {
        const stats = currentData.stats || {};
        const history = currentData.history || [];

        stats.played = Math.max(0, (stats.played || 0) - 1);

        if (isWinner) {
          stats.won = Math.max(0, (stats.won || 0) - 1);
          stats.points = Math.max(0, (stats.points || 0) - 2);
        } else if (isTie) {
          stats.tied = Math.max(0, (stats.tied || 0) - 1);
          stats.points = Math.max(0, (stats.points || 0) - 1);
        } else {
          stats.lost = Math.max(0, (stats.lost || 0) - 1);
        }

        const newHistory = history.filter((h) => h.matchId !== matchData.id);

        stats.totalRuns = Math.max(0, (stats.totalRuns || 0) - runsFor);
        stats.totalBalls = Math.max(0, (stats.totalBalls || 0) - ballsFor);
        stats.totalRunsConceded = Math.max(
          0,
          (stats.totalRunsConceded || 0) - runsAgainst,
        );
        stats.totalBallsBowled = Math.max(
          0,
          (stats.totalBallsBowled || 0) - ballsAgainst,
        );

        const rf =
          stats.totalBalls > 0 ? (stats.totalRuns / stats.totalBalls) * 6 : 0;
        const ra =
          stats.totalBallsBowled > 0
            ? (stats.totalRunsConceded / stats.totalBallsBowled) * 6
            : 0;
        stats.nrr = (rf - ra).toFixed(3);

        return { stats, history: newHistory };
      };

      const winner = matchData.winner || matchData.meta?.winner;
      const isTie = winner === "Tie" || winner === "TIE";

      const t1Updates = reverseStats(
        t1Data,
        winner === t1Name,
        isTie,
        inn1.score,
        t1BallsFaced,
        inn2.score,
        t2BallsFaced,
      );
      const t2Updates = reverseStats(
        t2Data,
        winner === t2Name,
        isTie,
        inn2.score,
        t2BallsFaced,
        inn1.score,
        t1BallsFaced,
      );

      transaction.update(t1Doc.ref, {
        stats: t1Updates.stats,
        history: t1Updates.history,
      });
      transaction.update(t2Doc.ref, {
        stats: t2Updates.stats,
        history: t2Updates.history,
      });
    });
    console.log("✅ Tournament team stats reverted successfully.");
  } catch (error) {
    console.error("❌ Error reverting team stats:", error);
  }
}

/**
 * ✅ EXPORTED FUNCTION (Wrapper)
 */
export async function revertMatchStatsFromGlobal(matchData) {
  // 1. Revert Individual Player Profiles
  await revertPlayerStats(matchData);

  // 2. Revert Tournament Team Standings (Points Table)
  await revertTeamStats(matchData);
}
