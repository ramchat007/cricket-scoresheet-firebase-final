import React, { useEffect, useState } from "react";
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
} from "lucide-react";

export default function RemoteControl() {
  const { streamId } = useParams();

  const [camCapabilities, setCamCapabilities] = useState(null);

  // Local UI State mapped to the Broadcaster
  const [remoteZoom, setRemoteZoom] = useState(1);
  const [remoteTorch, setRemoteTorch] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteLens, setRemoteLens] = useState("");
  const [remoteOled, setRemoteOled] = useState(false); // 🟢 OLED Sleep State
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!streamId) return;

    const streamDocRef = doc(db, "streams", streamId);

    const unsubscribe = onSnapshot(streamDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsLive(true);

        if (data.capabilities) setCamCapabilities(data.capabilities);

        // Auto-sync UI if the phone operator changes something manually
        if (data.currentState) {
          setRemoteZoom(data.currentState.zoom || 1);
          setRemoteTorch(data.currentState.torch || false);
          setRemoteMuted(data.currentState.isMuted || false);
          setRemoteLens(data.currentState.selectedCamera || "");
          setRemoteOled(data.currentState.oled || false); // Sync OLED state
        }
      } else {
        setIsLive(false);
        setCamCapabilities(null);
      }
    });

    return () => unsubscribe();
  }, [streamId]);

  // 🟢 BEAM COMMANDS TO PHONE
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

  const toggleRemoteMute = () => {
    const newVal = !remoteMuted;
    setRemoteMuted(newVal);
    sendCommand("mute", newVal);
  };

  const handleLensChange = (e) => {
    const val = e.target.value;
    setRemoteLens(val);
    sendCommand("lens", val);
  };

  // 🟢 TOGGLE OLED SLEEP
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
          <span className="text-cyan-500 font-mono">{streamId}</span> to go
          live...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">
              PTZ Remote
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              ID: {streamId}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-3 py-1 rounded-full animate-pulse">
            <Radio size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Live
            </span>
          </div>
        </div>

        {!camCapabilities ? (
          <div className="text-center py-10 text-gray-500 text-sm font-bold uppercase tracking-widest">
            Waiting for lens data...
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 🟢 NEW: CAMERA SCREEN OLED TOGGLE */}
            <div className="bg-gray-950 p-5 rounded-2xl border border-indigo-900/50 flex justify-between items-center shadow-inner">
              <label className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                {remoteOled ? <Moon size={16} /> : <Sun size={16} />}
                Camera Screen
              </label>
              <button
                onClick={toggleOledSleep}
                className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 border ${
                  remoteOled
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                    : "bg-gray-800 text-gray-400 border-gray-700"
                }`}
              >
                {remoteOled ? "Sleeping" : "Awake"}
              </button>
            </div>

            {/* LENS SWITCHER */}
            {camCapabilities.cameras && camCapabilities.cameras.length > 0 && (
              <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-3">
                  <Video size={16} className="text-cyan-500" /> Active Lens
                </label>
                <select
                  value={remoteLens}
                  onChange={handleLensChange}
                  className="w-full bg-gray-800 border border-gray-700 text-white font-bold text-sm rounded-xl px-4 py-3 outline-none focus:border-cyan-500"
                >
                  {camCapabilities.cameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Lens ${cam.deviceId.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* AUDIO MUTE TOGGLE */}
            <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                {remoteMuted ? (
                  <MicOff size={16} className="text-red-500" />
                ) : (
                  <Mic size={16} className="text-emerald-500" />
                )}
                Microphone
              </label>
              <button
                onClick={toggleRemoteMute}
                className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                  remoteMuted
                    ? "bg-red-500/20 text-red-500 border border-red-500/50"
                    : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50"
                }`}
              >
                {remoteMuted ? "Muted" : "Active"}
              </button>
            </div>

            {/* ZOOM CONTROL */}
            {camCapabilities.zoom && (
              <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <ZoomIn size={16} className="text-cyan-500" /> Optical Zoom
                  </label>
                  <span className="text-cyan-500 font-mono font-bold text-sm">
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
                  className="w-full accent-cyan-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* TORCH CONTROL */}
            {camCapabilities.torch && (
              <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Flashlight size={16} className="text-amber-500" /> Camera
                  Flash
                </label>
                <button
                  onClick={toggleRemoteTorch}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                    remoteTorch
                      ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                      : "bg-gray-800 text-gray-400 border border-gray-700"
                  }`}
                >
                  {remoteTorch ? (
                    <Flashlight size={24} />
                  ) : (
                    <ZapOff size={24} />
                  )}
                </button>
              </div>
            )}

            {/* MASTER KILL SWITCH */}
            <button
              onClick={handleKillStream}
              className="w-full mt-4 py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Power size={16} /> Kill Stream
            </button>
          </div>
        )}
      </div>
    </div>
  );
}