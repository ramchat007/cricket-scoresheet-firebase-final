/**
 * ✅ statsHelper.js
 * Centralized logic for Points Table and Player Stats calculation.
 * Fixes: Strict separation of Batting/Bowling runs & Robust NRR logic.
 */

// --- 1. POINTS TABLE CALCULATOR ---
export const calculatePointsTable = (matches = []) => {
  const table = {};
  const safeMatches = Array.isArray(matches) ? matches : [];

  safeMatches.forEach((match) => {
    // Only process finished matches
    if (
      !match ||
      (match.status !== "finished" && match.meta?.matchStatus !== "finished")
    )
      return;

    // 1. Normalize Team Names (Trim whitespace)
    const teamA = match.meta?.teamA?.trim();
    const teamB = match.meta?.teamB?.trim();

    if (!teamA || !teamB) return;

    // 2. Initialize Table Entries
    [teamA, teamB].forEach((t) => {
      if (!table[t]) {
        table[t] = {
          name: t,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          runsScored: 0,
          oversFaced: 0,
          runsConceded: 0,
          oversBowled: 0,
          nrr: 0,
        };
      }
    });

    // 3. Determine Winner Mathematically
    const inn1 = match.innings?.[0];
    const inn2 = match.innings?.[1];
    let calculatedWinner = null;

    if (inn1 && inn2) {
      if (inn1.score > inn2.score) {
        calculatedWinner = inn1.battingTeam?.trim();
      } else if (inn2.score > inn1.score) {
        calculatedWinner = inn2.battingTeam?.trim();
      } else {
        calculatedWinner = "TIE";
      }
    } else {
      calculatedWinner = match.winner || match.meta?.result?.winner;
    }

    // 4. Update Win/Loss/Tie Stats
    table[teamA].played++;
    table[teamB].played++;

    if (calculatedWinner === teamA) {
      table[teamA].won++;
      table[teamA].points += 2;
      table[teamB].lost++;
    } else if (calculatedWinner === teamB) {
      table[teamB].won++;
      table[teamB].points += 2;
      table[teamA].lost++;
    } else {
      // Tie or No Result
      table[teamA].points += 1;
      table[teamB].points += 1;
    }

    // 5. Update NRR Stats (Runs & Overs)
    const innings = Array.isArray(match.innings) ? match.innings : [];
    innings.forEach((inn) => {
      if (!inn) return;
      const battingTeam = inn.battingTeam?.trim();

      // Determine opponent (bowling team)
      const bowlingTeam = battingTeam === teamA ? teamB : teamA;

      if (table[battingTeam]) {
        table[battingTeam].runsScored += inn.score || 0;

        const balls = (inn.over || 0) * 6 + (inn.overBallCount || 0);
        // NRR Rule: If All Out, use full quota (e.g., 20 overs)
        const matchOvers = parseInt(match.meta?.overs || 20);
        const effectiveBalls =
          inn.wickets >= 10 || inn.isAllOut ? matchOvers * 6 : balls;

        table[battingTeam].oversFaced += effectiveBalls;
      }

      if (table[bowlingTeam]) {
        table[bowlingTeam].runsConceded += inn.score || 0;

        const balls = (inn.over || 0) * 6 + (inn.overBallCount || 0);
        // Same logic for bowling team (runs conceded against full quota if they bowled them out)
        const matchOvers = parseInt(match.meta?.overs || 20);
        const effectiveBalls =
          inn.wickets >= 10 || inn.isAllOut ? matchOvers * 6 : balls;

        table[bowlingTeam].oversBowled += effectiveBalls;
      }
    });
  });

  // 6. Final Calculation
  return Object.values(table)
    .map((t) => {
      const ballsFaced = t.oversFaced || 1;
      const ballsBowled = t.oversBowled || 1;
      // Standard NRR Formula: (Runs/Overs For) - (Runs/Overs Against)
      const runRateFor = (t.runsScored / ballsFaced) * 6;
      const runRateAgainst = (t.runsConceded / ballsBowled) * 6;
      return { ...t, nrr: (runRateFor - runRateAgainst).toFixed(3) };
    })
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr);
};

// --- 2. PLAYER STATS CALCULATOR ---
export const calculatePlayerStats = (input) => {
  const players = {};
  const matches = Array.isArray(input) ? input : input ? [input] : [];

  matches.forEach((match) => {
    if (!match) return;
    const innings = Array.isArray(match.innings) ? match.innings : [];

    innings.forEach((inn) => {
      if (!inn) return;

      const battingTeam = inn.battingTeam?.trim();

      // Determine bowling team strictly
      let bowlingTeam = "Unknown";
      if (match.meta?.teamA && match.meta?.teamB) {
        bowlingTeam =
          battingTeam === match.meta.teamA.trim()
            ? match.meta.teamB.trim()
            : match.meta.teamA.trim();
      } else {
        bowlingTeam = inn.bowlingTeam?.trim() || "Unknown";
      }

      // 🏏 BATTING STATS (Only contributes to Batting Runs)
      if (inn.batsmenStats) {
        Object.entries(inn.batsmenStats).forEach(([name, s]) => {
          const pName = name.trim();
          if (!players[pName]) {
            players[pName] = initPlayerObject(pName, battingTeam);
          }

          const batRuns = parseInt(s.runs || 0);
          players[pName].runs += batRuns; // ✅ ONLY Batting Runs
          players[pName].balls += parseInt(s.balls || 0);
          players[pName].fours += parseInt(s.fours || 0);
          players[pName].sixes += parseInt(s.sixes || 0);
        });
      }

      // 🥎 BOWLING STATS (Contributes to Wickets & Runs Conceded)
      if (inn.bowlerStats) {
        Object.entries(inn.bowlerStats).forEach(([name, s]) => {
          const pName = name.trim();
          if (!players[pName]) {
            players[pName] = initPlayerObject(pName, bowlingTeam);
          }
          // If player exists but team was unknown, update it
          if (players[pName].team === "Unknown")
            players[pName].team = bowlingTeam;

          const wickets = parseInt(s.wickets || 0);
          const runsGiven = parseInt(s.runs || 0); // ✅ Runs Conceded

          players[pName].wickets += wickets;
          players[pName].runsConceded += runsGiven;
          players[pName].ballsBowled += parseInt(s.balls || 0);
        });
      }
    });
  });

  return Object.values(players).map((p) => {
    const economy =
      p.ballsBowled > 0
        ? (p.runsConceded / (p.ballsBowled / 6)).toFixed(2)
        : "0.00";
    const strikeRate =
      p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";

    // MVP Formula: 1pt/run + 20pts/wicket + boundary bonuses
    const mvpScore = p.runs * 1 + p.wickets * 20 + p.fours * 1 + p.sixes * 2;

    return { ...p, economy, strikeRate, mvpScore };
  });
};

// Helper to init player object
const initPlayerObject = (name, team) => ({
  name,
  team,
  runs: 0, // Batting Runs Only
  balls: 0, // Balls Faced
  fours: 0,
  sixes: 0,
  wickets: 0,
  runsConceded: 0, // Bowling Runs Only
  ballsBowled: 0,
});

export const getManOfTheMatch = (match) => {
  if (!match) return null;
  const stats = calculatePlayerStats(match);
  if (stats.length === 0) return null;
  const sorted = stats.sort((a, b) => b.mvpScore - a.mvpScore);
  return sorted[0];
};

/**
 * Aggregates a Global Player's history array into total stats.
 */
export const aggregateCareerStats = (player) => {
  const baseStats = player.stats || {};
  const history = baseStats.history || [];

  if (!Array.isArray(history) || history.length === 0) {
    return {
      matches: Number(baseStats.matches) || 0,
      runs: Number(baseStats.runs) || 0,
      wickets: Number(baseStats.wickets) || 0,
      highestScore: Number(baseStats.highestScore) || 0,
      history: [],
    };
  }

  let totalRuns = 0;
  let totalWickets = 0;
  let maxScore = Number(baseStats.highestScore) || 0;

  history.forEach((log) => {
    const r = Number(log.runs) || 0;
    const w = Number(log.wickets) || 0;
    totalRuns += r;
    totalWickets += w;
    if (r > maxScore) maxScore = r;
  });

  return {
    matches: history.length,
    runs: totalRuns,
    wickets: totalWickets,
    highestScore: maxScore,
    history: history,
  };
};
