// src/utils/statsHelper.js

/**
 * Calculates the Points Table based on an array of matches.
 */
export const calculatePointsTable = (matches = []) => {
  const table = {};

  // Safety check: Ensure matches is an array
  const safeMatches = Array.isArray(matches) ? matches : [];

  safeMatches.forEach((match) => {
    // Skip if match is invalid
    if (
      !match ||
      (match.status !== "finished" && match.meta?.status !== "finished")
    )
      return;

    const teamA = match.meta?.teamA;
    const teamB = match.meta?.teamB;
    const winner =
      match.winner || match.meta?.result?.winner || match.result?.winner;

    // Initialize Team A
    if (teamA && !table[teamA]) {
      table[teamA] = {
        name: teamA,
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

    // Initialize Team B
    if (teamB && !table[teamB]) {
      table[teamB] = {
        name: teamB,
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

    if (teamA && teamB) {
      table[teamA].played++;
      table[teamB].played++;

      if (winner === teamA) {
        table[teamA].won++;
        table[teamA].points += 2;
        table[teamB].lost++;
      } else if (winner === teamB) {
        table[teamB].won++;
        table[teamB].points += 2;
        table[teamA].lost++;
      } else {
        table[teamA].points += 1;
        table[teamB].points += 1;
      }

      // NRR Calculation
      const innings = Array.isArray(match.innings) ? match.innings : [];
      innings.forEach((inn) => {
        if (!inn) return;
        const team = inn.battingTeam;
        if (table[team]) {
          table[team].runsScored += inn.score || 0;
          const balls = (inn.over || 0) * 6 + (inn.overBallCount || 0);
          table[team].oversFaced += balls;
        }

        const opponent = team === teamA ? teamB : teamA;
        if (table[opponent]) {
          table[opponent].runsConceded += inn.score || 0;
          const balls = (inn.over || 0) * 6 + (inn.overBallCount || 0);
          table[opponent].oversBowled += balls;
        }
      });
    }
  });

  return Object.values(table)
    .map((t) => {
      const ballsFaced = t.oversFaced || 1;
      const ballsBowled = t.oversBowled || 1;

      const runRateFor = (t.runsScored / ballsFaced) * 6;
      const runRateAgainst = (t.runsConceded / ballsBowled) * 6;

      return { ...t, nrr: (runRateFor - runRateAgainst).toFixed(3) };
    })
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr);
};

/**
 * Calculates Player Stats safely.
 */
export const calculatePlayerStats = (input) => {
  const players = {};
  // Handle single match vs array of matches
  const matches = Array.isArray(input) ? input : input ? [input] : [];

  matches.forEach((match) => {
    if (!match) return;

    // SAFETY CHECK: If innings is missing/corrupt, skip this match
    const innings = Array.isArray(match.innings) ? match.innings : [];

    innings.forEach((inn) => {
      if (!inn) return;
      const team = inn.battingTeam;

      // Batting
      if (inn.batsmenStats) {
        Object.entries(inn.batsmenStats).forEach(([name, s]) => {
          if (!players[name])
            players[name] = {
              name,
              team,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              wickets: 0,
              runsConceded: 0,
              ballsBowled: 0,
            };
          players[name].runs += s.runs || 0;
          players[name].balls += s.balls || 0;
          players[name].fours += s.fours || 0;
          players[name].sixes += s.sixes || 0;
        });
      }

      // Bowling
      if (inn.bowlerStats) {
        Object.entries(inn.bowlerStats).forEach(([name, s]) => {
          if (!players[name])
            players[name] = {
              name,
              team: "Unknown",
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              wickets: 0,
              runsConceded: 0,
              ballsBowled: 0,
            };
          players[name].wickets += s.wickets || 0;
          players[name].runsConceded += s.runs || 0;
          players[name].ballsBowled += s.balls || 0;
        });
      }
    });
  });

  return Object.values(players).map((p) => {
    const overs = Math.floor(p.ballsBowled / 6) + "." + (p.ballsBowled % 6);
    const economy =
      p.ballsBowled > 0
        ? (p.runsConceded / (p.ballsBowled / 6)).toFixed(2)
        : "0.00";
    const strikeRate =
      p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(2) : "0.00";
    const mvpScore = p.runs * 1 + p.wickets * 20 + p.fours * 1 + p.sixes * 2;

    return { ...p, overs, economy, strikeRate, mvpScore };
  });
};

export const getManOfTheMatch = (match) => {
  if (!match) return null;
  const stats = calculatePlayerStats(match);
  if (stats.length === 0) return null;
  const sorted = stats.sort((a, b) => b.mvpScore - a.mvpScore);
  return sorted[0];
};
