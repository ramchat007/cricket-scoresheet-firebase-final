import { db } from "./firebase";
import { 
  collection, doc, setDoc, addDoc, onSnapshot, 
  updateDoc, deleteDoc, getDocs 
} from "firebase/firestore";

export const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
  iceCandidatePoolSize: 10,
};

// 📱 BROADCASTER LOGIC
export const createStreamOffer = async (streamId, peerConnection) => {
  const streamDocRef = doc(db, "streams", streamId);
  const callerCandidatesCollection = collection(streamDocRef, "callerCandidates");
  const calleeCandidatesCollection = collection(streamDocRef, "calleeCandidates");

  // 1. Push local ICE candidates to Firestore
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(callerCandidatesCollection, event.candidate.toJSON());
    }
  };

  // 2. Create and set Offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await setDoc(streamDocRef, {
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: new Date().toISOString(),
  });

  // 3. Listen for OBS Answer
  onSnapshot(streamDocRef, (snapshot) => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data?.answer) {
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  });

  // 4. Listen for OBS ICE candidates
  onSnapshot(calleeCandidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        peerConnection.addIceCandidate(new RTCIceCandidate(data)).catch(e => {});
      }
    });
  });
};

// 💻 OBS RECEIVER LOGIC
export const joinStreamAnswer = async (streamId, peerConnection) => {
  const streamDocRef = doc(db, "streams", streamId);
  
  // 1. Get the Offer from Broadcaster
  const streamSnapshot = await doc(db, "streams", streamId);
  
  onSnapshot(streamDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (data?.offer && !peerConnection.currentRemoteDescription) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      await updateDoc(streamDocRef, {
        answer: { type: answer.type, sdp: answer.sdp }
      });
    }
  });

  // 2. Handle ICE Candidates
  const calleeCandidatesCollection = collection(streamDocRef, "calleeCandidates");
  const callerCandidatesCollection = collection(streamDocRef, "callerCandidates");

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(calleeCandidatesCollection, event.candidate.toJSON());
    }
  };

  onSnapshot(callerCandidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        peerConnection.addIceCandidate(new RTCIceCandidate(data)).catch(e => {});
      }
    });
  });
};

// 🛑 4. STOP STREAM (Cleanup)
export const stopStream = async (streamId) => {
  if (!streamId) return;
  const streamDocRef = doc(db, "streams", streamId);
  await deleteDoc(streamDocRef).catch(e => console.log("Cleanup skipped", e));
};

// 🧹 5. DEEP CLEANUP (Wipe Database to save load)
export const clearStreamDatabase = async (streamId) => {
  if (!streamId) return;
  const streamDocRef = doc(db, "streams", streamId);
  
  try {
    // 1. Delete all caller candidates
    const callerSnap = await getDocs(collection(streamDocRef, "callerCandidates"));
    callerSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));

    // 2. Delete all callee candidates
    const calleeSnap = await getDocs(collection(streamDocRef, "calleeCandidates"));
    calleeSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));

    // 3. Delete main document
    await deleteDoc(streamDocRef);
    console.log("Database cleared for stream:", streamId);
  } catch (error) {
    console.error("Error clearing database:", error);
  }
};