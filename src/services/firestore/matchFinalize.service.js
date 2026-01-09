
import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "./firestore.config";

export async function finalizeMatch({ tournamentId, innings }) {
  for (const inning of innings) {
    for (const [playerId, stats] of Object.entries(inning.batsmenStats || {})) {
      const ref = doc(db, "tournamentPlayerStats", `${tournamentId}_${playerId}`);
      await setDoc(ref, {
        tournamentId,
        playerId,
        matches: increment(1),
        runs: increment(stats.runs || 0),
        balls: increment(stats.balls || 0),
        fours: increment(stats.fours || 0),
        sixes: increment(stats.sixes || 0),
        wickets: increment(stats.wickets || 0),
      }, { merge: true });
    }
  }
}
