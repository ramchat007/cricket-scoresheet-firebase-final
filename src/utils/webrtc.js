import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  getDocs
} from "firebase/firestore";
// 🌐 1. STUN SERVERS
export const rtcConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

// 📱 2. CREATE STREAM (Broadcaster)
export const createStreamOffer = async (streamId, peerConnection) => {
  const streamDocRef = doc(db, "streams", streamId);
  const callerCandidatesCollection = collection(streamDocRef, "callerCandidates");

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate && peerConnection.signalingState !== "closed") {
      addDoc(callerCandidatesCollection, event.candidate.toJSON()).catch(e => console.warn(e));
    }
  });

  const offer = await peerConnection.createOffer();
  
  if (peerConnection.signalingState === "closed") return;
  await peerConnection.setLocalDescription(offer);

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
    createdAt: new Date().toISOString(),
  };
  
  await setDoc(streamDocRef, roomWithOffer);

  // Listen for OBS Answer
  onSnapshot(streamDocRef, (snapshot) => {
    if (peerConnection.signalingState === "closed") return;
    
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data && data.answer) {
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      peerConnection.setRemoteDescription(rtcSessionDescription).catch(e => console.warn(e));
    }
  });

  // Listen for OBS ICE candidates
  const calleeCandidatesCollection = collection(streamDocRef, "calleeCandidates");
  onSnapshot(calleeCandidatesCollection, (snapshot) => {
    if (peerConnection.signalingState === "closed") return;
    
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        if (peerConnection.signalingState === "closed") return; // 🟢 Triple check!
        let data = change.doc.data();
        peerConnection.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.warn(e));
      }
    });
  });

  return streamDocRef;
};

// 💻 3. JOIN STREAM (OBS Receiver)
export const joinStreamAnswer = async (streamId, peerConnection) => {
  const streamDocRef = doc(db, "streams", streamId);
  const streamSnapshot = await getDoc(streamDocRef);

  if (peerConnection.signalingState === "closed") return;

  if (!streamSnapshot.exists() || !streamSnapshot.data().offer) {
    throw new Error("Stream offer not found.");
  }

  const calleeCandidatesCollection = collection(streamDocRef, "calleeCandidates");
  const callerCandidatesCollection = collection(streamDocRef, "callerCandidates");

  // Save OBS ICE candidates to Firebase
  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate && peerConnection.signalingState !== "closed") {
      addDoc(calleeCandidatesCollection, event.candidate.toJSON()).catch(e => console.warn(e));
    }
  });

  const offer = streamSnapshot.data().offer;
  
  if (peerConnection.signalingState === "closed") return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  if (peerConnection.signalingState === "closed") return;
  const answer = await peerConnection.createAnswer();
  
  if (peerConnection.signalingState === "closed") return;
  await peerConnection.setLocalDescription(answer);

  const roomWithAnswer = {
    answer: {
      type: answer.type,
      sdp: answer.sdp,
    },
  };
  await updateDoc(streamDocRef, roomWithAnswer);

  // 🟢 SAFETY FIX: Listen for Broadcaster ICE Candidates
  onSnapshot(callerCandidatesCollection, (snapshot) => {
    // If the connection was closed while we were waiting for the snapshot, abort immediately!
    if (peerConnection.signalingState === "closed") return;
    
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        // Double check state inside the loop
        if (peerConnection.signalingState === "closed") return; 
        
        let data = change.doc.data();
        peerConnection.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.warn("Ignored stale ICE candidate:", e));
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