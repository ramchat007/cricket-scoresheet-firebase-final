import React, { useState, useEffect, useRef } from "react";
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
  RefreshCw,
  Info,
  Plus,
  Minus,
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
  const [remoteExposure, setRemoteExposure] = useState(0);
  const [isLive, setIsLive] = useState(false);

  const lastZoomTime = useRef(0);
  const zoomIntervalRef = useRef(null); // 🔥 For Smooth Remote Rocker

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
          if (Date.now() - lastZoomTime.current > 1000) {
            setRemoteZoom(data.currentState.zoom || 1);
          }
          setRemoteTorch(data.currentState.torch || false);
          setRemoteMuted(data.currentState.isMuted || false);
          setRemoteLens(data.currentState.selectedCamera || "");
          setRemoteOled(data.currentState.oled || false);
          setRemoteExposure(data.currentState.exposure || 0);
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
    } catch (err) {}
  };

  // --- ZOOM CONTROLS ---
  const handleRemoteZoom = (e) => {
    const val = Number(e.target.value);
    setRemoteZoom(val);
    const now = Date.now();
    if (now - lastZoomTime.current > 150) {
      sendCommand("zoom", val);
      lastZoomTime.current = now;
    }
  };

  const handleZoomRelease = () => sendCommand("zoom", remoteZoom);

  // 🔥 NEW: Remote Smooth Rocker
  const startSmoothZoom = (direction) => {
    if (!camCapabilities?.zoom) return;
    const stepSpeed =
      (camCapabilities.zoom.max - camCapabilities.zoom.min) * 0.015;

    zoomIntervalRef.current = setInterval(() => {
      setRemoteZoom((prevZoom) => {
        let newZoom = prevZoom + stepSpeed * direction;
        if (newZoom >= camCapabilities.zoom.max)
          newZoom = camCapabilities.zoom.max;
        if (newZoom <= camCapabilities.zoom.min)
          newZoom = camCapabilities.zoom.min;

        sendCommand("zoom", newZoom);
        lastZoomTime.current = Date.now();
        return newZoom;
      });
    }, 50); // Send command every 50ms for smooth glide
  };

  const stopSmoothZoom = () => {
    if (zoomIntervalRef.current) clearInterval(zoomIntervalRef.current);
  };

  // 🔥 NEW: Remote Presets
  const snapZoom = (targetVal) => {
    if (!camCapabilities?.zoom) return;
    let clamped = targetVal;
    if (clamped > camCapabilities.zoom.max) clamped = camCapabilities.zoom.max;
    if (clamped < camCapabilities.zoom.min) clamped = camCapabilities.zoom.min;

    setRemoteZoom(clamped);
    sendCommand("zoom", clamped);
  };

  // --- EXPOSURE CONTROLS ---
  const handleExposureChange = (e) => {
    const val = Number(e.target.value);
    setRemoteExposure(val);
    sendCommand("exposure", val);
  };

  // --- OTHER CONTROLS ---
  const handleSwapLens = () => {
    if (!camCapabilities?.cameras || camCapabilities.cameras.length <= 1)
      return;
    const currentIndex = camCapabilities.cameras.findIndex(
      (c) => c.deviceId === remoteLens,
    );
    const nextIndex = (currentIndex + 1) % camCapabilities.cameras.length;
    const nextCamId = camCapabilities.cameras[nextIndex].deviceId;

    setRemoteLens(nextCamId);
    sendCommand("switch_camera", nextCamId); // 🔥 Fixed command name!
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
        "🚨 WARNING: This instantly kills the broadcast from the phone. Are you sure?",
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

  const currentLensName =
    camCapabilities?.cameras?.find((c) => c.deviceId === remoteLens)?.label ||
    "Default Camera";

  let networkStatus = "GOOD";
  let networkColor = "text-emerald-500";
  let networkTip =
    "Connection is stable. Phone and Laptop are communicating perfectly.";

  if (deviceHealth) {
    if (deviceHealth.fps < 20) {
      networkStatus = "THERMAL THROTTLING";
      networkColor = "text-red-500";
      networkTip =
        "Phone is overheating! Frame rate has dropped. Turn on 'Screen Off' mode or shade the device.";
    } else if (deviceHealth.latency > 300) {
      networkStatus = "HIGH LATENCY";
      networkColor = "text-red-500";
      networkTip = `Delay is ${deviceHealth.latency}ms. Phone is too far from Laptop hotspot, or there is heavy WiFi interference.`;
    } else if (deviceHealth.latency > 150) {
      networkStatus = "FAIR";
      networkColor = "text-amber-500";
      networkTip =
        "Latency is rising. Ensure clear line-of-sight between laptop and phone. Use 5GHz hotspot if possible.";
    } else if (deviceHealth.bitrate < 1000 && deviceHealth.bitrate > 0) {
      networkStatus = "LOW BANDWIDTH";
      networkColor = "text-amber-500";
      networkTip =
        "Video quality is dropping. Move the phone closer to the laptop hotspot.";
    }
  }

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
          <>
            <div className="flex justify-between bg-gray-950 rounded-xl border border-gray-800 p-3 mb-2">
              <div
                className="flex items-center gap-2 px-4 border-r border-gray-800 last:border-0"
                title="Phone Battery">
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
              <div
                className="flex items-center gap-2 px-4 border-r border-gray-800 last:border-0"
                title="Cam -> Laptop Delay">
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
              <div
                className="flex items-center gap-2 px-4 border-r border-gray-800 last:border-0"
                title="Frames Per Second">
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
              <div
                className="flex items-center gap-2 px-4"
                title="Video Quality (kbps)">
                <Zap size={16} className="text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                  {deviceHealth.bitrate
                    ? `${deviceHealth.bitrate} kbps`
                    : "N/A"}
                </span>
              </div>
            </div>

            {/* NETWORK DIAGNOSTICS */}
            <div className="bg-black/30 border border-gray-800 rounded-lg p-3 mb-6 flex items-start gap-3">
              <Info size={16} className={`mt-0.5 shrink-0 ${networkColor}`} />
              <div>
                <p
                  className={`text-xs font-black tracking-widest uppercase mb-1 ${networkColor}`}>
                  {networkStatus}
                </p>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  {networkTip}
                </p>
              </div>
            </div>
          </>
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* LEFT COLUMN: System Controls (Takes up 5 cols) */}
            <div className="md:col-span-5 space-y-4">
              {camCapabilities.cameras &&
                camCapabilities.cameras.length > 0 && (
                  <div className="bg-gray-950 p-3.5 rounded-xl border border-gray-800 flex justify-between items-center shadow-lg">
                    <div className="flex flex-col overflow-hidden pr-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-1">
                        <Video size={14} className="text-cyan-500" /> Active
                        Lens
                      </label>
                      <span className="text-xs text-white font-bold truncate max-w-[120px]">
                        {currentLensName}
                      </span>
                    </div>
                    <button
                      onClick={handleSwapLens}
                      disabled={camCapabilities.cameras.length <= 1}
                      className={`p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${camCapabilities.cameras.length > 1 ? "bg-gray-800 text-white hover:bg-gray-700 hover:text-cyan-400 active:scale-90 border border-gray-700" : "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed"}`}
                      title="Swap Camera">
                      <RefreshCw size={18} />
                    </button>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={toggleRemoteMute}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-widest transition-all border shadow-lg ${remoteMuted ? "bg-red-500/20 text-red-500 border-red-500/50" : "bg-gray-950 text-emerald-500 border-gray-800 hover:bg-gray-900"}`}>
                  {remoteMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  {remoteMuted ? "Muted" : "Mic Active"}
                </button>

                <button
                  onClick={toggleOledSleep}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-widest transition-all border shadow-lg ${remoteOled ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)]" : "bg-gray-950 text-indigo-400 border-gray-800 hover:bg-gray-900"}`}>
                  {remoteOled ? <Moon size={18} /> : <Sun size={18} />}
                  {remoteOled ? "Screen Off" : "Screen On"}
                </button>
              </div>

              {camCapabilities.torch && (
                <button
                  onClick={toggleRemoteTorch}
                  className={`w-full p-4 rounded-xl flex items-center justify-center gap-3 font-bold text-[10px] uppercase tracking-widest transition-all border shadow-lg ${remoteTorch ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]" : "bg-gray-950 text-amber-500 border-gray-800 hover:bg-gray-900"}`}>
                  {remoteTorch ? (
                    <Flashlight size={16} />
                  ) : (
                    <ZapOff size={16} />
                  )}
                  {remoteTorch ? "Torch is ON" : "Turn On Torch"}
                </button>
              )}
            </div>

            {/* RIGHT COLUMN: Camera Hardware Controls (Takes up 7 cols) */}
            <div className="md:col-span-7 space-y-4 flex flex-col">
              {camCapabilities.zoom && (
                <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 flex-1 flex flex-col shadow-lg relative overflow-hidden">
                  {/* Framing Presets (Top) */}
                  <div className="flex justify-between gap-2 mb-6">
                    <button
                      onClick={() => snapZoom(camCapabilities.zoom.min)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black text-[10px] py-2.5 rounded-lg border border-gray-700 shadow active:scale-95 uppercase tracking-widest transition-all">
                      Wide
                    </button>
                    <button
                      onClick={() =>
                        snapZoom(
                          camCapabilities.zoom.min +
                            (camCapabilities.zoom.max -
                              camCapabilities.zoom.min) *
                              0.3,
                        )
                      }
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black text-[10px] py-2.5 rounded-lg border border-gray-700 shadow active:scale-95 uppercase tracking-widest transition-all">
                      Pitch
                    </button>
                    <button
                      onClick={() => snapZoom(camCapabilities.zoom.max)}
                      className="flex-1 bg-gray-800 hover:bg-cyan-900/50 text-cyan-400 border border-gray-700 hover:border-cyan-500/50 font-black text-[10px] py-2.5 rounded-lg shadow active:scale-95 uppercase tracking-widest transition-all">
                      Tight
                    </button>
                  </div>

                  {/* Main Zoom Slider & Rocker */}
                  <div className="flex items-center gap-6 mt-auto">
                    {/* Rocker Buttons */}
                    <div className="flex flex-col gap-1 shrink-0 bg-gray-900 p-1 rounded-xl border border-gray-800">
                      <button
                        onMouseDown={() => startSmoothZoom(1)}
                        onMouseUp={stopSmoothZoom}
                        onMouseLeave={stopSmoothZoom}
                        onTouchStart={() => startSmoothZoom(1)}
                        onTouchEnd={stopSmoothZoom}
                        className="w-14 h-12 bg-gray-800 hover:bg-gray-700 active:bg-cyan-600 rounded-t-lg flex items-center justify-center text-white transition-colors">
                        <Plus size={20} strokeWidth={3} />
                      </button>
                      <button
                        onMouseDown={() => startSmoothZoom(-1)}
                        onMouseUp={stopSmoothZoom}
                        onMouseLeave={stopSmoothZoom}
                        onTouchStart={() => startSmoothZoom(-1)}
                        onTouchEnd={stopSmoothZoom}
                        className="w-14 h-12 bg-gray-800 hover:bg-gray-700 active:bg-cyan-600 rounded-b-lg flex items-center justify-center text-white transition-colors">
                        <Minus size={20} strokeWidth={3} />
                      </button>
                    </div>

                    {/* Slider */}
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                          <ZoomIn size={14} className="text-cyan-500" /> Zoom
                          Level
                        </label>
                        <span className="text-cyan-500 font-mono font-black text-sm bg-cyan-500/10 px-2 py-0.5 rounded">
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
                        className="w-full accent-cyan-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Exposure Slider */}
              {camCapabilities.exposure && (
                <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                      <Sun size={14} className="text-amber-500" /> Exposure (EV)
                    </label>
                    <span className="text-amber-500 font-mono font-black text-xs">
                      {remoteExposure > 0 ? "+" : ""}
                      {remoteExposure}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-gray-600">
                      -
                    </span>
                    <input
                      type="range"
                      min={camCapabilities.exposure.min}
                      max={camCapabilities.exposure.max}
                      step={camCapabilities.exposure.step}
                      value={remoteExposure}
                      onChange={handleExposureChange}
                      className="flex-1 accent-amber-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[10px] font-black text-gray-600">
                      +
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MASTER KILL SWITCH */}
        <button
          onClick={handleKillStream}
          className="w-full mt-6 py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg">
          <Power size={16} /> Emergency Kill Stream
        </button>
      </div>
    </div>
  );
}
