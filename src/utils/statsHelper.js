/**
 * ✅ statsHelper.js (ADVANCED VERSION)
 * Includes:
 * - Robust Points Table (NRR safe)
 * - Player Stats (strict separation)
 * - MVP + Advanced MOM logic (impact-based)
 */

// --- 1. POINTS TABLE CALCULATOR ---
export const calculatePointsTable = (matches = []) => {
  const table = {};
  const safeMatches = Array.isArray(matches) ? matches : [];

  safeMatches.forEach((match) => {
    if (
      !match ||
      (match.status !== "finished" && match.meta?.matchStatus !== "finished")
    )
      return;

    const teamA = match.meta?.teamA?.trim();
    const teamB = match.meta?.teamB?.trim();
    if (!teamA || !teamB) return;

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

    const inn1 = match.innings?.[0];
    const inn2 = match.innings?.[1];
    let winner = null;

    if (inn1 && inn2) {
      if (inn1.score > inn2.score) winner = inn1.battingTeam?.trim();
      else if (inn2.score > inn1.score) winner = inn2.battingTeam?.trim();
      else winner = "TIE";
    } else {
      winner = match.winner || match.meta?.result?.winner;
    }

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

    const innings = Array.isArray(match.innings) ? match.innings : [];
    innings.forEach((inn) => {
      if (!inn) return;

      const battingTeam = inn.battingTeam?.trim();
      const bowlingTeam = battingTeam === teamA ? teamB : teamA;

      const balls = (inn.over || 0) * 6 + (inn.overBallCount || 0);
      const matchOvers = parseInt(match.meta?.overs || 20);
      const fullBalls = matchOvers * 6;

      const effectiveBalls =
        inn.wickets >= 10 || inn.isAllOut ? fullBalls : balls;

      if (table[battingTeam]) {
        table[battingTeam].runsScored += inn.score || 0;
        table[battingTeam].oversFaced += effectiveBalls;
      }

      if (table[bowlingTeam]) {
        table[bowlingTeam].runsConceded += inn.score || 0;
        table[bowlingTeam].oversBowled += effectiveBalls;
      }
    });
  });

  return Object.values(table)
    .map((t) => {
      const faced = t.oversFaced || 1;
      const bowled = t.oversBowled || 1;

      const runRateFor = (t.runsScored / faced) * 6;
      const runRateAgainst = (t.runsConceded / bowled) * 6;

      return {
        ...t,
        nrr: Number(runRateFor - runRateAgainst).toFixed(3),
      };
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

      let bowlingTeam = "Unknown";
      if (match.meta?.teamA && match.meta?.teamB) {
        bowlingTeam =
          battingTeam === match.meta.teamA.trim()
            ? match.meta.teamB.trim()
            : match.meta.teamA.trim();
      }

      // 🏏 BATTING
      if (inn.batsmenStats) {
        Object.entries(inn.batsmenStats).forEach(([name, s]) => {
          const p = getPlayer(players, name, battingTeam);

          p.runs += num(s.runs);
          p.balls += num(s.balls);
          p.fours += num(s.fours);
          p.sixes += num(s.sixes);
        });
      }

      // 🥎 BOWLING
      if (inn.bowlerStats) {
        Object.entries(inn.bowlerStats).forEach(([name, s]) => {
          const p = getPlayer(players, name, bowlingTeam);

          p.wickets += num(s.wickets);
          p.runsConceded += num(s.runs);
          p.ballsBowled += num(s.balls);
          p.dotBalls += num(s.dotBalls); // ✅ NEW
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

    const mvpScore =
      p.runs + p.wickets * 20 + p.fours * 1 + p.sixes * 2 + p.dotBalls * 1;

    return { ...p, economy, strikeRate, mvpScore };
  });
};

// --- 3. ADVANCED MOM LOGIC ---
// ✅ ADDED: mustBeFromWinningTeam parameter (defaults to true)
export const getManOfTheMatch = (match, mustBeFromWinningTeam = true) => {
  if (!match) return null;

  const stats = calculatePlayerStats(match);
  if (!stats.length) return null;

  const context = buildMatchContext(match);
  let eligiblePlayers = stats;

  // ✅ FILTER: If true, remove all players from the losing team
  if (mustBeFromWinningTeam && context.winner && context.winner !== "TIE") {
    eligiblePlayers = stats.filter((p) => p.team === context.winner);
  }

  // If for some reason filtering left us with nobody (e.g. data mismatch), fallback to all players
  if (!eligiblePlayers.length) eligiblePlayers = stats;

  const scored = eligiblePlayers.map((p) => {
    let score = p.mvpScore;

    // 🔥 Impact Bonus
    if (context.winner === p.team) score += 5;
    if (p.runs >= context.targetRuns * 0.3 && context.targetRuns > 0)
      score += 10; // big contribution
    if (p.strikeRate >= 150 && p.runs > 20) score += 5;
    if (p.wickets >= 2) score += 10;
    if (Number(p.economy) <= 6 && p.ballsBowled >= 12) score += 5;

    return { ...p, momScore: score };
  });

  return scored.sort((a, b) => b.momScore - a.momScore)[0];
};

// --- HELPERS ---
const getPlayer = (players, name, team) => {
  const pName = name.trim();
  if (!players[pName]) {
    players[pName] = initPlayerObject(pName, team);
  }
  // Update team if it was previously unknown
  if (players[pName].team === "Unknown" && team !== "Unknown") {
    players[pName].team = team;
  }
  return players[pName];
};

const num = (v) => parseInt(v || 0);

const initPlayerObject = (name, team) => ({
  name,
  team,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  wickets: 0,
  runsConceded: 0,
  ballsBowled: 0,
  dotBalls: 0,
});

const buildMatchContext = (match) => {
  const inn1 = match.innings?.[0];
  const inn2 = match.innings?.[1];

  let winner = match.winner || match.meta?.result?.winner || null;

  // ✅ FIX: Accurately calculate the winner if it isn't explicitly saved yet
  if (!winner && inn1 && inn2) {
    if (inn1.score > inn2.score) winner = inn1.battingTeam?.trim();
    else if (inn2.score > inn1.score) winner = inn2.battingTeam?.trim();
    else winner = "TIE";
  }

  return {
    targetRuns: inn1?.score || 0,
    winner: winner,
  };
};

// --- CAREER STATS ---
export const aggregateCareerStats = (player) => {
  const history = player?.stats?.history || [];

  let runs = 0;
  let wickets = 0;
  let high = 0;

  history.forEach((h) => {
    runs += num(h.runs);
    wickets += num(h.wickets);
    if (h.runs > high) high = h.runs;
  });

  return {
    matches: history.length,
    runs,
    wickets,
    highestScore: high,
    history,
  };
};
