
import { collection, getDocs, query, where, doc, setDoc } from "firebase/firestore";
import { db } from "./firestore.config";

export async function updateTournamentLeaders(tournamentId) {
  const q = query(collection(db, "tournamentPlayerStats"), where("tournamentId", "==", tournamentId));
  const snap = await getDocs(q);

  let orangeCap = null;
  let purpleCap = null;

  snap.forEach(d => {
    const p = d.data();
    if (!orangeCap || p.runs > orangeCap.runs) orangeCap = p;
    if (!purpleCap || (p.wickets || 0) > (purpleCap?.wickets || 0)) purpleCap = p;
  });

  await setDoc(doc(db, "tournamentLeaders", tournamentId), { orangeCap, purpleCap });
}
