import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Camera,
  Play,
  Square,
  Copy,
  AlertCircle,
  Check,
  Mic,
  MicOff,
  RefreshCw,
  Settings2,
  Maximize,
  Minimize,
  Flashlight,
  ZapOff,
  ZoomIn,
  Video,
  Moon,
} from "lucide-react";
import {
  rtcConfig,
  createStreamOffer,
  stopStream,
  clearStreamDatabase,
} from "../../utils/webrtc";
import { db } from "../../utils/firebase";

export default function Broadcaster() {
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const activeStreamRef = useRef(null);
  const wakeLockRef = useRef(null);
  const listenersRef = useRef(null); // 🔥 Holding the unsubs safely

  const [streamId, setStreamId] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOledSleep, setIsOledSleep] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [resolution, setResolution] = useState("720p");

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [zoomCap, setZoomCap] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {}
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    let savedId = localStorage.getItem("cricsync_stream_id");
    if (!savedId) {
      savedId = `cam-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem("cricsync_stream_id", savedId);
    }
    setStreamId(savedId);

    const loadCameras = async () => {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setCameras(videoInputs);

        const backCam = videoInputs.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("environment"),
        );
        if (backCam) setSelectedCamera(backCam.deviceId);
        else if (videoInputs.length > 0)
          setSelectedCamera(videoInputs[0].deviceId);

        tempStream.getTracks().forEach((t) => t.stop());
      } catch (err) {}
    };

    loadCameras();

    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (activeStreamRef.current)
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
      handleStopStream(savedId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isStreaming && localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [isStreaming, localStream]);

  // 🟢 AUTO-SYNC STATE TO FIREBASE
  useEffect(() => {
    if (isStreaming && streamId) {
      updateDoc(doc(db, "streams", streamId), {
        "currentState.isMuted": isMuted,
        "currentState.torch": torchOn,
        "currentState.zoom": zoomLevel,
        "currentState.selectedCamera": selectedCamera,
        "currentState.oled": isOledSleep,
      }).catch(() => {});
    }
  }, [
    isMuted,
    torchOn,
    zoomLevel,
    selectedCamera,
    isOledSleep,
    isStreaming,
    streamId,
  ]);

  // 🟢 LISTEN FOR REMOTE COMMANDS
  useEffect(() => {
    if (!isStreaming || !streamId) return;

    const unsub = onSnapshot(doc(db, "streams", streamId), (docSnap) => {
      const data = docSnap.data();
      if (data?.remoteCommand) {
        const cmd = data.remoteCommand;

        if (cmd.timestamp <= (activeStreamRef.current?.lastRemoteCommand || 0))
          return;
        activeStreamRef.current.lastRemoteCommand = cmd.timestamp;

        if (cmd.type === "zoom") {
          setZoomLevel(cmd.value);
          applyVideoConstraint({ zoom: cmd.value });
        } else if (cmd.type === "torch") {
          setTorchOn(cmd.value);
          applyVideoConstraint({ torch: cmd.value });
        } else if (cmd.type === "mute") {
          setIsMuted(cmd.value);
          if (activeStreamRef.current) {
            activeStreamRef.current
              .getAudioTracks()
              .forEach((t) => (t.enabled = !cmd.value));
          }
        } else if (cmd.type === "oled") {
          setIsOledSleep(cmd.value);
        } else if (cmd.type === "stop") {
          handleStopStream();
        }
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, streamId]);

  // 🟢 TELEMETRY ENGINE
  useEffect(() => {
    if (!isStreaming || !streamId || !peerConnectionRef.current) return;

    let lastBytesSent = 0;
    let lastTime = Date.now();

    const telemetryInterval = setInterval(async () => {
      const healthData = { timestamp: Date.now() };

      if (navigator.getBattery) {
        try {
          const battery = await navigator.getBattery();
          healthData.batteryLevel = Math.round(battery.level * 100);
          healthData.isCharging = battery.charging;
        } catch (e) {}
      }

      if (navigator.connection) {
        healthData.networkType = navigator.connection.effectiveType || "wifi";
        healthData.downlink = navigator.connection.downlink || 0;
      }

      try {
        const stats = await peerConnectionRef.current.getStats();
        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            healthData.fps = report.framesPerSecond || 0;
            const bytesSent = report.bytesSent;
            const now = Date.now();
            if (lastBytesSent > 0) {
              const bitrate =
                (8 * (bytesSent - lastBytesSent)) / (now - lastTime);
              healthData.bitrate = Math.round(bitrate);
            }
            lastBytesSent = bytesSent;
            lastTime = now;
          }
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            healthData.latency = report.currentRoundTripTime
              ? Math.round(report.currentRoundTripTime * 1000)
              : 0;
          }
        });
      } catch (e) {}

      updateDoc(doc(db, "streams", streamId), { health: healthData }).catch(
        () => {},
      );
    }, 3000);

    return () => clearInterval(telemetryInterval);
  }, [isStreaming, streamId]);

  const applyVideoConstraint = async (constraint) => {
    if (!activeStreamRef.current) return;
    const track = activeStreamRef.current.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        await track.applyConstraints({ advanced: [constraint] });
      } catch (err) {}
    }
  };

  const toggleTorch = async () => {
    const newState = !torchOn;
    await applyVideoConstraint({ torch: newState });
    setTorchOn(newState);
  };

  const handleZoomChange = async (e) => {
    const val = Number(e.target.value);
    setZoomLevel(val);
    await applyVideoConstraint({ zoom: val });
  };

  const handleCycleCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(
      (c) => c.deviceId === selectedCamera,
    );
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].deviceId;

    if (isStreaming) {
      switchLiveCamera(nextCamId);
    } else {
      setSelectedCamera(nextCamId);
    }
  };

  const handleStartStream = async () => {
    try {
      setError("");
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await clearStreamDatabase(streamId);

      const width = resolution === "1080p" ? 1920 : 1280;
      const height = resolution === "1080p" ? 1080 : 720;

      const videoConstraints = selectedCamera
        ? {
            deviceId: { exact: selectedCamera },
            width: { ideal: width },
            height: { ideal: height },
          }
        : {
            facingMode: "environment",
            width: { ideal: width },
            height: { ideal: height },
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true,
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });

      const videoTrack = stream.getVideoTracks()[0];
      let zoomData = null;

      if (videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        setTorchSupported(!!caps.torch);
        if (caps.zoom) {
          zoomData = {
            min: caps.zoom.min,
            max: caps.zoom.max,
            step: caps.zoom.step,
          };
          setZoomCap(zoomData);
          setZoomLevel(videoTrack.getSettings().zoom || caps.zoom.min);
        } else {
          setZoomCap(null);
        }
      }

      setLocalStream(stream);
      activeStreamRef.current = stream;

      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = peerConnection;

      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "failed"
        ) {
          setError(
            "⚠️ CONNECTION LOST! The network dropped. Please Stop and Go Live again.",
          );
        } else if (peerConnection.connectionState === "connected") {
          setError("");
        }
      };

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // 🔥 Saving the Listeners to the Ref here
      listenersRef.current = await createStreamOffer(streamId, peerConnection);

      const serializedCameras = cameras.map((c) => ({
        deviceId: c.deviceId,
        label: c.label || `Lens ${c.deviceId.substring(0, 5)}`,
      }));
      await updateDoc(doc(db, "streams", streamId), {
        capabilities: {
          torch: !!(
            videoTrack.getCapabilities && videoTrack.getCapabilities().torch
          ),
          zoom: zoomData,
          cameras: serializedCameras,
        },
        currentState: {
          zoom: zoomLevel,
          torch: false,
          isMuted: isMuted,
          selectedCamera: selectedCamera,
          oled: false,
        },
      });

      setIsStreaming(true);
      await requestWakeLock();
    } catch (err) {
      setError(`Camera failed: ${err.message}`);
      if (activeStreamRef.current)
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const switchLiveCamera = async (newDeviceId) => {
    if (!isStreaming || !peerConnectionRef.current) return;
    try {
      setSelectedCamera(newDeviceId);
      const width = resolution === "1080p" ? 1920 : 1280;
      const height = resolution === "1080p" ? 1080 : 720;
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: newDeviceId },
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: true,
      });

      newStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        setTorchSupported(!!caps.torch);
        setTorchOn(false);
        if (caps.zoom) {
          setZoomCap({
            min: caps.zoom.min,
            max: caps.zoom.max,
            step: caps.zoom.step,
          });
          setZoomLevel(videoTrack.getSettings().zoom || caps.zoom.min);
        } else {
          setZoomCap(null);
        }
      }

      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find(
        (s) => s.track && s.track.kind === "video",
      );
      const audioSender = senders.find(
        (s) => s.track && s.track.kind === "audio",
      );

      if (videoSender)
        await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
      if (audioSender)
        await audioSender.replaceTrack(newStream.getAudioTracks()[0]);

      if (activeStreamRef.current)
        activeStreamRef.current.getTracks().forEach((t) => t.stop());

      setLocalStream(newStream);
      activeStreamRef.current = newStream;
    } catch (err) {
      console.error("Lens switch failed:", err);
    }
  };

  const handleStopStream = async (idToStop = streamId) => {
    setIsStreaming(false);
    setIsOledSleep(false);
    releaseWakeLock();

    // 🔥 Memory Leak Cleanup!
    if (listenersRef.current) {
      if (listenersRef.current.unsubStream) listenersRef.current.unsubStream();
      if (listenersRef.current.unsubCallee) listenersRef.current.unsubCallee();
      listenersRef.current = null;
    }

    if (document.fullscreenElement && document.exitFullscreen)
      document.exitFullscreen().catch(() => {});
    setIsFullscreen(false);
    setTorchOn(false);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
      setLocalStream(null);
    }
    await stopStream(idToStop);
  };

  const handleClearDatabase = async () => {
    if (isStreaming) return alert("Please stop the stream before resetting.");
    if (!window.confirm("Wipe all connection data?")) return;
    setIsClearing(true);
    await clearStreamDatabase(streamId);
    setIsClearing(false);
    alert("Server connection reset successfully!");
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (localStream)
      localStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !newState));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      setIsFullscreen(!isFullscreen);
    }
  };

  const obsLink = `${window.location.origin}/obs/${streamId}`;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(obsLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentCameraLabel =
    cameras.find((c) => c.deviceId === selectedCamera)?.label ||
    "Default Camera";

  return (
    <div className="h-[100dvh] flex flex-col font-sans overflow-hidden bg-gray-50 text-gray-900">
      {!isFullscreen && (
        <div className="px-4 py-3 border-b flex justify-between items-center shrink-0 z-20 bg-white border-gray-200">
          <div className="flex items-center gap-2">
            <Camera className="text-teal-500" size={20} />
            <h1 className="font-black uppercase tracking-widest text-sm md:text-lg italic">
              Pro Cam
            </h1>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-1 rounded-full animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                Live
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500 text-white text-xs font-bold p-3 text-center shrink-0 flex items-center justify-center gap-2 z-20 shadow-md">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {isOledSleep && (
        <div
          onClick={() => setIsOledSleep(false)}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer"
        >
          <div className="flex flex-col items-center opacity-30">
            <Moon size={48} className="text-indigo-500 mb-4" />
            <p className="text-white text-xs font-black uppercase tracking-widest">
              OLED Sleep Mode
            </p>
            <p className="text-gray-500 text-[10px] mt-2">
              Tap anywhere to wake screen
            </p>
          </div>
        </div>
      )}

      {!isStreaming ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto bg-gray-50">
          <div className="w-full max-w-md p-6 rounded-3xl border shadow-2xl bg-white border-gray-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Settings2 size={24} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">
                Pro Setup
              </h2>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">
                OBS Browser Source URL
              </label>
              <div className="flex items-center gap-2 border rounded-xl p-1.5 pl-3 bg-gray-50 border-gray-200">
                <span className="flex-1 text-xs text-teal-600 font-mono truncate select-all">
                  {obsLink}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="p-2 rounded-lg transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  {copied ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">
                  Active Lens
                </label>
                <button
                  onClick={handleCycleCamera}
                  disabled={cameras.length <= 1}
                  className={`w-full flex items-center justify-between border rounded-xl px-4 py-3 text-xs font-bold outline-none transition-all ${
                    cameras.length > 1
                      ? "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 active:scale-95 cursor-pointer"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  }`}
                >
                  <span className="truncate pr-2">{currentCameraLabel}</span>
                  {cameras.length > 1 && (
                    <RefreshCw size={16} className="text-teal-500 shrink-0" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">
                    Resolution
                  </label>
                  <select
                    className="w-full border rounded-xl px-4 py-3 bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:border-teal-500"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  >
                    <option value="720p">720p (Smooth)</option>
                    <option value="1080p">1080p (FHD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">
                    Microphone
                  </label>
                  <button
                    onClick={toggleMute}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${isMuted ? "border-red-500 text-red-500 bg-red-50" : "border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100"}`}
                  >
                    {isMuted ? (
                      <>
                        <MicOff size={16} /> Muted
                      </>
                    ) : (
                      <>
                        <Mic size={16} /> Active
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartStream}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Play size={18} fill="currentColor" /> Go Live
            </button>

            <button
              onClick={handleClearDatabase}
              disabled={isClearing}
              className="w-full mt-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex justify-center gap-2 text-gray-500 hover:bg-gray-100"
            >
              <RefreshCw
                size={14}
                className={isClearing ? "animate-spin" : ""}
              />{" "}
              Reset Server Connection
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative bg-black flex flex-col justify-end overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="relative z-10 w-full p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-4">
            {zoomCap && (
              <div className="flex items-center gap-3 px-2 mb-2">
                <ZoomIn size={16} className="text-white drop-shadow-md" />
                <input
                  type="range"
                  min={zoomCap.min}
                  max={zoomCap.max}
                  step={zoomCap.step}
                  value={zoomLevel}
                  onChange={handleZoomChange}
                  className="flex-1 accent-teal-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            <div className="flex justify-between items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={handleCycleCamera}
                disabled={cameras.length <= 1}
                className={`flex items-center gap-2 border rounded-full px-4 py-2 backdrop-blur-md transition-all ${
                  cameras.length > 1
                    ? "bg-black/50 border-white/20 active:scale-95 cursor-pointer hover:bg-black/70"
                    : "bg-black/30 border-white/10 opacity-50 cursor-not-allowed"
                }`}
              >
                <Video
                  size={16}
                  className={
                    cameras.length > 1 ? "text-cyan-400" : "text-gray-500"
                  }
                />
                <span className="text-white text-[10px] font-bold uppercase truncate max-w-[100px]">
                  {currentCameraLabel}
                </span>
                {cameras.length > 1 && (
                  <RefreshCw size={14} className="text-white/70 ml-1" />
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {torchSupported && (
                  <button
                    onClick={toggleTorch}
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 border ${torchOn ? "bg-amber-500 border-amber-400 text-black" : "bg-black/50 border-white/20 text-white backdrop-blur-md"}`}
                  >
                    {torchOn ? <Flashlight size={18} /> : <ZapOff size={18} />}
                  </button>
                )}
                <button
                  onClick={toggleFullscreen}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 border border-white/20 bg-black/50 text-white backdrop-blur-md"
                >
                  {isFullscreen ? (
                    <Minimize size={18} />
                  ) : (
                    <Maximize size={18} />
                  )}
                </button>
                <button
                  onClick={toggleMute}
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 border border-white/20 ${isMuted ? "bg-red-500 text-white" : "bg-black/50 text-white backdrop-blur-md"}`}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => handleStopStream(streamId)}
                  className="h-10 md:h-12 px-5 rounded-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 active:scale-95 text-[10px] md:text-sm"
                >
                  <Square size={14} fill="currentColor" /> Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}