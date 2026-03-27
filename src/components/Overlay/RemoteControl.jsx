import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import {
  ZoomIn,
  Flashlight,
  ZapOff,
  Radio,
  AlertCircle,
  Mic,
  MicOff,
  Video,
  Power,
  Moon,
  Sun,
  Battery,
  BatteryCharging,
  Wifi,
  Activity,
  Zap,
  RefreshCw, // <-- The icon for our Swap button
} from "lucide-react";

export default function RemoteControl() {
  const { streamId } = useParams();

  const [camCapabilities, setCamCapabilities] = useState(null);
  const [deviceHealth, setDeviceHealth] = useState(null);

  const [remoteZoom, setRemoteZoom] = useState(1);
  const [remoteTorch, setRemoteTorch] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteLens, setRemoteLens] = useState("");
  const [remoteOled, setRemoteOled] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Throttle Reference for Smooth Zooming
  const lastZoomTime = useRef(0);

  useEffect(() => {
    if (!streamId) return;

    const streamDocRef = doc(db, "streams", streamId);

    const unsubscribe = onSnapshot(streamDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsLive(true);

        if (data.capabilities) setCamCapabilities(data.capabilities);
        if (data.health) setDeviceHealth(data.health);

        if (data.currentState) {
          // Only update UI from Firebase if we aren't actively zooming
          if (Date.now() - lastZoomTime.current > 1000) {
            setRemoteZoom(data.currentState.zoom || 1);
          }
          setRemoteTorch(data.currentState.torch || false);
          setRemoteMuted(data.currentState.isMuted || false);
          setRemoteLens(data.currentState.selectedCamera || "");
          setRemoteOled(data.currentState.oled || false);
        }
      } else {
        setIsLive(false);
        setCamCapabilities(null);
        setDeviceHealth(null);
      }
    });

    return () => unsubscribe();
  }, [streamId]);

  const sendCommand = async (type, value) => {
    try {
      await updateDoc(doc(db, "streams", streamId), {
        remoteCommand: { type, value, timestamp: Date.now() },
      });
    } catch (err) {
      console.error("Failed to send command", err);
    }
  };

  // 🟢 SMOOTH ZOOM LOGIC
  const handleRemoteZoom = (e) => {
    const val = Number(e.target.value);
    setRemoteZoom(val);

    const now = Date.now();
    if (now - lastZoomTime.current > 150) {
      sendCommand("zoom", val);
      lastZoomTime.current = now;
    }
  };

  const handleZoomRelease = () => {
    sendCommand("zoom", remoteZoom);
  };

  // 🟢 NEW: SINGLE BUTTON LENS SWAP
  const handleSwapLens = () => {
    if (!camCapabilities?.cameras || camCapabilities.cameras.length <= 1)
      return;

    // Find current index and calculate the next one in the array
    const currentIndex = camCapabilities.cameras.findIndex(
      (c) => c.deviceId === remoteLens,
    );
    const nextIndex = (currentIndex + 1) % camCapabilities.cameras.length;
    const nextCamId = camCapabilities.cameras[nextIndex].deviceId;

    // Update local UI immediately for a snappy feel, then beam to phone
    setRemoteLens(nextCamId);
    sendCommand("lens", nextCamId);
  };

  const toggleRemoteTorch = () => {
    const newVal = !remoteTorch;
    setRemoteTorch(newVal);
    sendCommand("torch", newVal);
  };

  const toggleRemoteMute = () => {
    const newVal = !remoteMuted;
    setRemoteMuted(newVal);
    sendCommand("mute", newVal);
  };

  const toggleOledSleep = () => {
    const newVal = !remoteOled;
    setRemoteOled(newVal);
    sendCommand("oled", newVal);
  };

  const handleKillStream = () => {
    if (
      window.confirm(
        "🚨 WARNING: This will instantly kill the live broadcast from the phone. Are you sure?",
      )
    ) {
      sendCommand("stop", true);
    }
  };

  if (!isLive) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center text-white font-sans">
        <AlertCircle size={48} className="text-amber-500 mb-4 animate-pulse" />
        <h1 className="text-2xl font-black uppercase tracking-widest">
          Stream Offline
        </h1>
        <p className="text-gray-400 mt-2">
          Waiting for camera{" "}
          <span className="text-cyan-500 font-mono">{streamId}</span>...
        </p>
      </div>
    );
  }

  // Find current lens name to display
  const currentLensName =
    camCapabilities?.cameras?.find((c) => c.deviceId === remoteLens)?.label ||
    "Default Camera";

  return (
    <div className="min-h-screen w-screen bg-gray-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-white">
              PTZ Remote
            </h1>
            <p className="text-[10px] text-gray-500 font-mono mt-1">
              ID: {streamId}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-3 py-1 rounded-full animate-pulse">
            <Radio size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Live
            </span>
          </div>
        </div>

        {/* TELEMETRY STRIP */}
        {deviceHealth ? (
          <div className="flex justify-between bg-gray-950 rounded-xl border border-gray-800 p-3 mb-6">
            <div className="flex items-center gap-2 px-4 border-r border-gray-800 last:border-0">
              {deviceHealth.isCharging ? (
                <BatteryCharging size={16} className="text-emerald-500" />
              ) : (
                <Battery
                  size={16}
                  className={
                    deviceHealth.batteryLevel <= 20
                      ? "text-red-500"
                      : "text-gray-400"
                  }
                />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                {deviceHealth.batteryLevel !== undefined
                  ? `${deviceHealth.batteryLevel}%`
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 border-r border-gray-800 last:border-0">
              <Wifi
                size={16}
                className={
                  deviceHealth.latency > 150
                    ? "text-amber-500"
                    : "text-cyan-500"
                }
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                {deviceHealth.latency !== undefined
                  ? `${deviceHealth.latency}ms`
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 border-r border-gray-800 last:border-0">
              <Activity
                size={16}
                className={
                  deviceHealth.fps < 20 ? "text-red-500" : "text-emerald-500"
                }
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                {deviceHealth.fps || 0} FPS
              </span>
            </div>
            <div className="flex items-center gap-2 px-4">
              <Zap size={16} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                {deviceHealth.bitrate ? `${deviceHealth.bitrate} kbps` : "N/A"}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2 mb-6 text-gray-600 text-[10px] font-bold uppercase tracking-widest bg-gray-950 rounded-xl border border-gray-800">
            Awaiting Telemetry Data...
          </div>
        )}

        {!camCapabilities ? (
          <div className="text-center py-10 text-gray-500 text-sm font-bold uppercase tracking-widest">
            Waiting for lens data...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT COLUMN: System Controls */}
            <div className="space-y-4">
              {/* 🟢 NEW: SWAP CAMERA BUTTON UI */}
              {camCapabilities.cameras &&
                camCapabilities.cameras.length > 0 && (
                  <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex justify-between items-center">
                    <div className="flex flex-col overflow-hidden pr-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-1">
                        <Video size={14} className="text-cyan-500" /> Active
                        Lens
                      </label>
                      <span className="text-xs text-white font-bold truncate">
                        {currentLensName}
                      </span>
                    </div>
                    <button
                      onClick={handleSwapLens}
                      disabled={camCapabilities.cameras.length <= 1}
                      className={`p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${
                        camCapabilities.cameras.length > 1
                          ? "bg-gray-800 text-white hover:bg-gray-700 hover:text-cyan-400 active:scale-90 cursor-pointer border border-gray-700"
                          : "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed"
                      }`}
                      title="Swap Camera"
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4">
                {/* Audio */}
                <button
                  onClick={toggleRemoteMute}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-widest transition-all border ${
                    remoteMuted
                      ? "bg-red-500/20 text-red-500 border-red-500/50"
                      : "bg-gray-950 text-emerald-500 border-gray-800"
                  }`}
                >
                  {remoteMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  {remoteMuted ? "Muted" : "Mic Active"}
                </button>

                {/* OLED */}
                <button
                  onClick={toggleOledSleep}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-widest transition-all border ${
                    remoteOled
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                      : "bg-gray-950 text-indigo-400 border-gray-800"
                  }`}
                >
                  {remoteOled ? <Moon size={18} /> : <Sun size={18} />}
                  {remoteOled ? "Screen Off" : "Screen On"}
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Camera Hardware Controls */}
            <div className="space-y-4 flex flex-col">
              {/* SMOOTH ZOOM SLIDER */}
              {camCapabilities.zoom && (
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                      <ZoomIn size={14} className="text-cyan-500" /> Optical
                      Zoom
                    </label>
                    <span className="text-cyan-500 font-mono font-bold text-xs">
                      {remoteZoom.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={camCapabilities.zoom.min}
                    max={camCapabilities.zoom.max}
                    step={camCapabilities.zoom.step}
                    value={remoteZoom}
                    onChange={handleRemoteZoom}
                    onPointerUp={handleZoomRelease}
                    onTouchEnd={handleZoomRelease}
                    className="w-full accent-cyan-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {/* TORCH CONTROL */}
              {camCapabilities.torch && (
                <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                    <Flashlight size={14} className="text-amber-500" />{" "}
                    Flashlight
                  </label>
                  <button
                    onClick={toggleRemoteTorch}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                      remoteTorch
                        ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                        : "bg-gray-800 text-gray-400 border border-gray-700"
                    }`}
                  >
                    {remoteTorch ? (
                      <Flashlight size={16} />
                    ) : (
                      <ZapOff size={16} />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MASTER KILL SWITCH */}
        <button
          onClick={handleKillStream}
          className="w-full mt-6 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <Power size={14} /> Emergency Kill Stream
        </button>
      </div>
    </div>
  );
}
