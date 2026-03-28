import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { rtcConfig, joinStreamAnswer } from "../../utils/webrtc";
import { ZoomIn, Flashlight, ZapOff } from "lucide-react";

export default function ObsReceiver() {
  const { streamId } = useParams();
  const location = useLocation();

  const videoRef = useRef(null);
  const audioRef = useRef(null); // 🟢 NEW: Dedicated Audio Player for OBS
  const peerConnectionRef = useRef(null);

  const [error, setError] = useState("Waiting for broadcaster...");
  const [connected, setConnected] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  // 🟢 REMOTE CONTROL STATE
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [camCapabilities, setCamCapabilities] = useState(null);
  const [remoteZoom, setRemoteZoom] = useState(1);
  const [remoteTorch, setRemoteTorch] = useState(false);

  useEffect(() => {
    // Check if ?control=true is in the URL
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("control") === "true") {
      setIsRemoteMode(true);
    }
  }, [location]);

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

        // 🟢 THE SPLIT STREAM TRICK
        peerConnection.ontrack = (event) => {
          if (event.streams && event.streams.length > 0) {
            // Send to Video Player (Muted for Autoplay)
            if (videoRef.current) {
              videoRef.current.srcObject = event.streams[0];
            }
            // Send to Audio Player (Unmuted for OBS Mixer)
            if (audioRef.current) {
              audioRef.current.srcObject = event.streams[0];
            }
          }
        };

        peerConnection.addEventListener("connectionstatechange", () => {
          if (peerConnection.connectionState === "connected") {
            setConnected(true);
            setError("");

            // Try to autoplay video
            if (videoRef.current) {
              videoRef.current.play().catch(() => setNeedsInteraction(true));
            }
            // Try to autoplay audio
            if (audioRef.current) {
              audioRef.current.play().catch(() => setNeedsInteraction(true));
            }
          } else if (
            peerConnection.connectionState === "disconnected" ||
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "closed"
          ) {
            setConnected(false);
            setError("Stream interrupted. Waiting to reconnect...");
            hasJoined = false;
            setCamCapabilities(null);
            if (peerConnectionRef.current) {
              peerConnectionRef.current.close();
              peerConnectionRef.current = null;
            }
          }
        });

        await joinStreamAnswer(streamId, peerConnection);
      } catch (err) {
        setError("Failed to connect. Will retry automatically.");
        hasJoined = false;
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }
    };

    const unsubscribe = onSnapshot(streamDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();

        // Listen for Camera Capabilities from Broadcaster
        if (data.capabilities) {
          setCamCapabilities(data.capabilities);
        }
        // Sync local remote UI with broadcaster's actual state
        if (data.currentState) {
          setRemoteZoom(data.currentState.zoom || 1);
          setRemoteTorch(data.currentState.torch || false);
        }

        if (data.offer && !hasJoined) {
          hasJoined = true;
          setError("Connecting to stream...");
          initializeReceiver();
        }
      } else {
        setConnected(false);
        setError("Waiting for camera operator to go live...");
        hasJoined = false;
        setCamCapabilities(null);
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (audioRef.current) {
          audioRef.current.srcObject = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [streamId]);

  const handleManualPlay = () => {
    if (videoRef.current) videoRef.current.play();
    if (audioRef.current) {
      audioRef.current.play();
      setNeedsInteraction(false);
    }
  };

  // 🟢 SEND COMMANDS TO FIREBASE (Only used if ?control=true)
  const sendCommand = async (type, value) => {
    try {
      await updateDoc(doc(db, "streams", streamId), {
        remoteCommand: { type, value, timestamp: Date.now() },
      });
    } catch (err) {
      console.error("Failed to send command", err);
    }
  };

  const handleRemoteZoom = (e) => {
    const val = Number(e.target.value);
    setRemoteZoom(val);
    sendCommand("zoom", val);
  };

  const toggleRemoteTorch = () => {
    const newVal = !remoteTorch;
    setRemoteTorch(newVal);
    sendCommand("torch", newVal);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "black",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {!connected && (
        <div style={{ color: "white", textAlign: "center", zIndex: 10 }}>
          <p
            style={{
              fontSize: "24px",
              color: error.includes("Failed") ? "#ef4444" : "#f59e0b",
              fontWeight: "bold",
            }}
          >
            {error.includes("Failed") ? "🔴 " : "🟡 "}
            {error}
          </p>
          <p style={{ fontSize: "14px", opacity: 0.7, marginTop: "8px" }}>
            Stream ID: {streamId}
          </p>
        </div>
      )}

      {connected && needsInteraction && (
        <div
          onClick={handleManualPlay}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            color: "white",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>▶️</div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>
            Click to Unmute & Play
          </h2>
          <p style={{ opacity: 0.7, marginTop: "10px", fontSize: "14px" }}>
            Right-click in OBS -&gt; Interact -&gt; Click here
          </p>
        </div>
      )}

      {/* 🟢 THE REMOTE CONTROL DASHBOARD (Only visible if ?control=true) */}
      {isRemoteMode && connected && camCapabilities && (
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0.1)",
            padding: "15px 30px",
            borderRadius: "50px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            zIndex: 100,
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "2px",
              opacity: 0.5,
              marginRight: "10px",
            }}
          >
            Remote PTZ
          </div>

          {camCapabilities.zoom && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "200px",
              }}
            >
              <ZoomIn size={20} color="white" />
              <input
                type="range"
                min={camCapabilities.zoom.min}
                max={camCapabilities.zoom.max}
                step={camCapabilities.zoom.step}
                value={remoteZoom}
                onChange={handleRemoteZoom}
                style={{ flex: 1, accentColor: "#14b8a6", cursor: "pointer" }}
              />
            </div>
          )}

          {camCapabilities.torch && (
            <button
              onClick={toggleRemoteTorch}
              style={{
                backgroundColor: remoteTorch
                  ? "#f59e0b"
                  : "rgba(255,255,255,0.1)",
                border: "none",
                width: "45px",
                height: "45px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: remoteTorch ? "black" : "white",
                transition: "0.2s",
              }}
            >
              {remoteTorch ? <Flashlight size={20} /> : <ZapOff size={20} />}
            </button>
          )}
        </div>
      )}

      {/* 🟢 THE INVISIBLE AUDIO ELEMENT */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* 🟢 THE MUTED VIDEO ELEMENT */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: connected ? "block" : "none",
        }}
      />
    </div>
  );
}
