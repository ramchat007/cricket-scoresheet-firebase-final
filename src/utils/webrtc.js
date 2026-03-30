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

// 🌐 1. RTC CONFIGURATION
export const rtcConfig = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
    { urls: ["stun:global.stun.twilio.com:3478"] },
  ],
  iceCandidatePoolSize: 2,
};

// 📱 2. CREATE STREAM (Broadcaster / Mobile Camera)
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

  // Monitor Connection State
  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      "📡 Broadcaster Connection State:",
      peerConnection.iceConnectionState,
    );
    if (
      peerConnection.iceConnectionState === "disconnected" ||
      peerConnection.iceConnectionState === "failed"
    ) {
      console.error("🚨 CAMERA DROPPED! Connection lost to OBS.");
    }
  };

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

  // Save unsubscribe functions to prevent memory leaks
  const unsubStream = onSnapshot(streamDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data?.answer) {
      console.log(
        "Broadcaster: Received Answer from Receiver! Setting Remote Description...",
      );
      const rtcSessionDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(rtcSessionDescription);

      while (candidateQueue.length > 0) {
        const candidate = candidateQueue.shift();
        peerConnection
          .addIceCandidate(candidate)
          .catch((e) => console.warn("ICE Error:", e));
      }
    }
  });

  const unsubCallee = onSnapshot(calleeCandidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (data && data.candidate) {
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

  // Return unsubs for React cleanup
  return { unsubStream, unsubCallee };
};

// 💻 3. JOIN STREAM (OBS Receiver / Laptop)
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

  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      "🖥️ Receiver Connection State:",
      peerConnection.iceConnectionState,
    );
    if (
      peerConnection.iceConnectionState === "disconnected" ||
      peerConnection.iceConnectionState === "failed"
    ) {
      console.error("🚨 STREAM FROZEN! Lost connection to Camera.");
    }
  };

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

  const unsubCaller = onSnapshot(callerCandidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (data && data.candidate) {
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

  return { unsubCaller };
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
