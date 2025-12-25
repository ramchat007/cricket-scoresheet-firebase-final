// utils/resetMatch.js
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firestore";

// Reset batsmen & bowlers for a match
export async function resetMatchStats(matchId, innings = 1) {
  try {
    const matchRef = doc(db, "matches", matchId);

    await updateDoc(matchRef, {
      [`innings.${innings - 1}.batting`]: [],
      [`innings.${innings - 1}.bowling`]: [],
      [`innings.${innings - 1}.currentBatsmen`]: [],
      [`innings.${innings - 1}.currentBowler`]: null,
      [`innings.${innings - 1}.overs`]: [],
      [`innings.${innings - 1}.extras`]: {
        wides: 0,
        noBalls: 0,
        byes: 0,
        legByes: 0,
      },
      [`innings.${innings - 1}.score`]: 0,
      [`innings.${innings - 1}.wickets`]: 0,
    });

    console.log(`✅ Reset stats for match ${matchId}, innings ${innings}`);
  } catch (err) {
    console.error("❌ Failed to reset match stats:", err);
  }
}
