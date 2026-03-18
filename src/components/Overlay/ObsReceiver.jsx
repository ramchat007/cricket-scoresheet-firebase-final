import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { rtcConfig, joinStreamAnswer } from "../../utils/webrtc";

export default function ObsReceiver() {
  const { streamId } = useParams();
  
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  
  const [error, setError] = useState("Waiting for broadcaster...");
  const [connected, setConnected] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false); // 🟢 Autoplay Block State

  useEffect(() => {
    if (!streamId) {
      setError("No Stream ID provided in the URL.");
      return;
    }

    const streamDocRef = doc(db, "streams", streamId);
    let hasJoined = false; 

    const initializeReceiver = async () => {
      try {
        const peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = peerConnection;

        const remoteStream = new MediaStream();
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }

        peerConnection.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
        };

        peerConnection.addEventListener("connectionstatechange", () => {
          if (peerConnection.connectionState === "connected") {
            setConnected(true);
            setError("");
            
            // 🟢 Handle Browser Autoplay Policy
            if (videoRef.current) {
              videoRef.current.play().catch(err => {
                console.warn("Autoplay blocked by browser. User interaction needed.", err);
                setNeedsInteraction(true);
              });
            }

          } else if (
            peerConnection.connectionState === "disconnected" || 
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "closed"
          ) {
            setConnected(false);
            setError("Stream interrupted. Waiting to reconnect...");
            hasJoined = false; 
          }
        });

        await joinStreamAnswer(streamId, peerConnection);

      } catch (err) {
        console.error("Error joining stream:", err);
        setError("Failed to connect. Will retry automatically.");
        hasJoined = false;
      }
    };

    const unsubscribe = onSnapshot(streamDocRef, (snapshot) => {
      if (snapshot.exists() && snapshot.data().offer) {
        if (!hasJoined) {
          hasJoined = true;
          setError("Connecting to stream...");
          initializeReceiver();
        }
      } else {
        setConnected(false);
        setError("Waiting for camera operator to go live...");
        hasJoined = false;
        
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [streamId]);

  // 🟢 Allow manual playback if browser blocks autoplay during testing
  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setNeedsInteraction(false);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "black", margin: 0, padding: 0, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
      
      {/* STATUS OVERLAYS */}
      {!connected && (
        <div style={{ color: "white", fontFamily: "monospace", textAlign: "center", zIndex: 10 }}>
          <p style={{ fontSize: "24px", color: error.includes("Failed") ? "#ef4444" : "#f59e0b", fontWeight: "bold" }}>
            {error.includes("Failed") ? "🔴 " : "🟡 "}{error}
          </p>
          <p style={{ fontSize: "14px", opacity: 0.7, marginTop: "8px" }}>Stream ID: {streamId}</p>
        </div>
      )}

      {/* 🟢 BROWSER AUTOPLAY OVERLAY (Only shows if testing in Chrome/Safari tab) */}
      {connected && needsInteraction && (
        <div 
          onClick={handleManualPlay}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer", color: "white" }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>▶️</div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", fontFamily: "sans-serif" }}>Click to Unmute & Play</h2>
          <p style={{ opacity: 0.7, marginTop: "10px", fontFamily: "sans-serif" }}>(Browser security requires a click to play audio)</p>
        </div>
      )}

      {/* THE ACTUAL VIDEO STREAM */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: connected ? "block" : "none"
        }}
      />
    </div>
  );
}