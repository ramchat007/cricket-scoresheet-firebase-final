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
  getDocs,
} from "firebase/firestore";

// 🌐 1. STUN SERVERS (Added fallback server for strict hotspots)
export const rtcConfig = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
    { urls: ["stun:global.stun.twilio.com:3478"] }, // Backup
  ],
  // Removed iceCandidatePoolSize to prevent early generation race conditions
};

// 📱 2. CREATE STREAM (Broadcaster)
export const createStreamOffer = async (streamId, peerConnection) => {
  const streamDocRef = doc(db, "streams", streamId);
  const callerCandidatesCollection = collection(
    streamDocRef,
    "callerCandidates",
  );
  const calleeCandidatesCollection = collection(
    streamDocRef,
    "calleeCandidates",
  );

  const candidateQueue = [];

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Broadcaster: Sending ICE candidate to Firebase");
      addDoc(callerCandidatesCollection, event.candidate.toJSON());
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log("Broadcaster: Created Offer and set Local Description");

  await setDoc(streamDocRef, {
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: new Date().toISOString(),
  });

  onSnapshot(streamDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data?.answer) {
      console.log(
        "Broadcaster: Received Answer from Receiver! Setting Remote Description...",
      );
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);

      // Process any queued candidates now that we are ready
      while (candidateQueue.length > 0) {
        const candidate = candidateQueue.shift();
        peerConnection
          .addIceCandidate(candidate)
          .catch((e) => console.warn("ICE Error:", e));
      }
    }
  });

  onSnapshot(calleeCandidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        // 🔥 Strict validation to prevent silent crash
        if (data && data.candidate) {
          console.log("Broadcaster: Received remote ICE candidate");
          const candidate = new RTCIceCandidate(data);
          if (!peerConnection.currentRemoteDescription) {
            candidateQueue.push(candidate);
          } else {
            peerConnection
              .addIceCandidate(candidate)
              .catch((e) => console.warn("ICE Error:", e));
          }
        }
      }
    });
  });
};

// 💻 3. JOIN STREAM (OBS Receiver)
export const joinStreamAnswer = async (streamId, peerConnection) => {
  const streamDocRef = doc(db, "streams", streamId);
  const callerCandidatesCollection = collection(
    streamDocRef,
    "callerCandidates",
  );
  const calleeCandidatesCollection = collection(
    streamDocRef,
    "calleeCandidates",
  );

  const candidateQueue = [];

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Receiver: Sending ICE candidate to Firebase");
      addDoc(calleeCandidatesCollection, event.candidate.toJSON());
    }
  };

  const streamSnapshot = await getDoc(streamDocRef);
  if (streamSnapshot.exists()) {
    const offer = streamSnapshot.data().offer;
    if (offer) {
      console.log("Receiver: Found Offer! Setting Remote Description...");
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("Receiver: Created Answer and set Local Description");

      await updateDoc(streamDocRef, {
        answer: { type: answer.type, sdp: answer.sdp },
      });

      while (candidateQueue.length > 0) {
        const candidate = candidateQueue.shift();
        peerConnection
          .addIceCandidate(candidate)
          .catch((e) => console.warn("ICE Error:", e));
      }
    }
  }

  onSnapshot(callerCandidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        // 🔥 Strict validation to prevent silent crash
        if (data && data.candidate) {
          console.log("Receiver: Received remote ICE candidate");
          const candidate = new RTCIceCandidate(data);
          if (!peerConnection.currentRemoteDescription) {
            candidateQueue.push(candidate);
          } else {
            peerConnection
              .addIceCandidate(candidate)
              .catch((e) => console.warn("ICE Error:", e));
          }
        }
      }
    });
  });
};

// 🛑 4. STOP STREAM (Cleanup)
export const stopStream = async (streamId) => {
  if (!streamId) return;
  const streamDocRef = doc(db, "streams", streamId);
  await deleteDoc(streamDocRef).catch((e) => console.log("Cleanup skipped", e));
};

// 🧹 5. DEEP CLEANUP (Wipe Database)
export const clearStreamDatabase = async (streamId) => {
  if (!streamId) return;
  const streamDocRef = doc(db, "streams", streamId);
  try {
    const callerSnap = await getDocs(
      collection(streamDocRef, "callerCandidates"),
    );
    callerSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));
    const calleeSnap = await getDocs(
      collection(streamDocRef, "calleeCandidates"),
    );
    calleeSnap.forEach((d) => deleteDoc(d.ref).catch(() => {}));
    await deleteDoc(streamDocRef);
    console.log("🧹 Stream database forcefully wiped.");
  } catch (error) {
    console.error("Error clearing database:", error);
  }
};
