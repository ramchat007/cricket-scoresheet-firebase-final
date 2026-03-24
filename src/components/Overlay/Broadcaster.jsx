import React, { useState, useEffect, useRef } from "react";
import { Camera, Play, Square, Copy, AlertCircle, Check, Mic, MicOff, RefreshCw, Settings2, Maximize, Minimize, Flashlight, ZapOff, ZoomIn, Video } from "lucide-react";
import { rtcConfig, createStreamOffer, stopStream, clearStreamDatabase } from "../../utils/webrtc";

export default function Broadcaster() {
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const activeStreamRef = useRef(null);

  const [streamId, setStreamId] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false); 
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  // 🟢 NEW: PRO CAMERA STATES
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [resolution, setResolution] = useState("720p");
  
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  
  const [zoomCap, setZoomCap] = useState(null); // { min, max, step }
  const [zoomLevel, setZoomLevel] = useState(1);

  // 1. Initialize and get camera list
  useEffect(() => {
    let savedId = localStorage.getItem("cricsync_stream_id");
    if (!savedId) {
      savedId = `cam-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem("cricsync_stream_id", savedId);
    }
    setStreamId(savedId);

    // 🟢 Ask for silent permission to unlock camera labels (Ultrawide, Telephoto, etc.)
    const loadCameras = async () => {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === "videoinput");
        setCameras(videoInputs);
        
        // Default to a "back" camera if available
        const backCam = videoInputs.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
        if (backCam) setSelectedCamera(backCam.deviceId);
        else if (videoInputs.length > 0) setSelectedCamera(videoInputs[0].deviceId);

        // Kill the temp stream
        tempStream.getTracks().forEach(t => t.stop());
      } catch (err) {
        console.warn("Could not load camera labels initially", err);
      }
    };
    
    loadCameras();

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (activeStreamRef.current) activeStreamRef.current.getTracks().forEach(t => t.stop());
      handleStopStream(savedId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isStreaming && localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [isStreaming, localStream]);

  // 🟢 NEW: Hardware Constraint Applier (for Zoom and Torch)
  const applyVideoConstraint = async (constraint) => {
    if (!activeStreamRef.current) return;
    const track = activeStreamRef.current.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        await track.applyConstraints({ advanced: [constraint] });
      } catch (err) {
        console.warn("Hardware constraint failed:", err);
      }
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

  const handleStartStream = async () => {
    try {
      setError("");
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await clearStreamDatabase(streamId);

      // Determine Resolution
      const width = resolution === "1080p" ? 1920 : 1280;
      const height = resolution === "1080p" ? 1080 : 720;

      // 🟢 Build specific camera request
      const videoConstraints = selectedCamera 
        ? { deviceId: { exact: selectedCamera }, width: { ideal: width }, height: { ideal: height } }
        : { facingMode: "environment", width: { ideal: width }, height: { ideal: height } };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true, 
      });

      stream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
      
      // 🟢 Extract Hardware Capabilities (Zoom & Torch)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        setTorchSupported(!!caps.torch);
        if (caps.zoom) {
          setZoomCap({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step });
          setZoomLevel(videoTrack.getSettings().zoom || caps.zoom.min);
        } else {
          setZoomCap(null);
        }
      }

      setLocalStream(stream);
      activeStreamRef.current = stream;

      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      await createStreamOffer(streamId, peerConnection);
      setIsStreaming(true);

    } catch (err) {
      console.error(err);
      setError(`Camera failed: ${err.message}`);
      if (activeStreamRef.current) activeStreamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  // 🟢 Live Camera Switcher (Change lenses without stopping the stream)
  const switchLiveCamera = async (newDeviceId) => {
    if (!isStreaming || !peerConnectionRef.current) return;
    try {
      setSelectedCamera(newDeviceId);
      
      const width = resolution === "1080p" ? 1920 : 1280;
      const height = resolution === "1080p" ? 1080 : 720;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: newDeviceId }, width: { ideal: width }, height: { ideal: height } },
        audio: true 
      });

      newStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });

      // Check new capabilities
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        setTorchSupported(!!caps.torch);
        setTorchOn(false); // resets on switch
        if (caps.zoom) {
          setZoomCap({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step });
          setZoomLevel(videoTrack.getSettings().zoom || caps.zoom.min);
        } else {
          setZoomCap(null);
        }
      }

      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
      
      if (videoSender) await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
      if (audioSender) await audioSender.replaceTrack(newStream.getAudioTracks()[0]);

      if (activeStreamRef.current) activeStreamRef.current.getTracks().forEach(t => t.stop());

      setLocalStream(newStream);
      activeStreamRef.current = newStream;
      
    } catch (err) {
      console.error("Lens switch failed:", err);
      alert("Could not switch to that lens. It might be locked.");
    }
  };

  const handleStopStream = async (idToStop = streamId) => {
    setIsStreaming(false); 
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    setIsFullscreen(false);
    setTorchOn(false);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
      setLocalStream(null);
    }
    
    await stopStream(idToStop);
  };

  const handleClearDatabase = async () => {
    if (isStreaming) return alert("Please stop the live stream before resetting.");
    if (!window.confirm("Wipe all connection data?")) return;
    setIsClearing(true);
    await clearStreamDatabase(streamId);
    setIsClearing(false);
    alert("Server connection reset successfully!");
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = !newState);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) { setIsFullscreen(!isFullscreen); }
  };

  const obsLink = `${window.location.origin}/obs/${streamId}`;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(obsLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-[100dvh] flex flex-col font-sans overflow-hidden bg-gray-50 text-gray-900">
      
      {!isFullscreen && (
        <div className="px-4 py-3 border-b flex justify-between items-center shrink-0 z-20 bg-white border-gray-200">
          <div className="flex items-center gap-2">
            <Camera className="text-teal-500" size={20} />
            <h1 className="font-black uppercase tracking-widest text-sm md:text-lg italic">Pro Cam</h1>
          </div>
          
          {isStreaming && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-1 rounded-full animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500 text-white text-xs font-bold p-3 text-center shrink-0 flex items-center justify-center gap-2 z-20 shadow-md">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!isStreaming ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto bg-gray-50">
          <div className="w-full max-w-md p-6 rounded-3xl border shadow-2xl bg-white border-gray-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Settings2 size={24} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Pro Setup</h2>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">OBS Browser Source URL</label>
              <div className="flex items-center gap-2 border rounded-xl p-1.5 pl-3 bg-gray-50 border-gray-200">
                <span className="flex-1 text-xs text-teal-600 font-mono truncate select-all">{obsLink}</span>
                <button onClick={copyToClipboard} className="p-2 rounded-lg transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700">
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {/* 🟢 NEW: Camera Dropdown */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">Select Lens</label>
                <select 
                  className="w-full border rounded-xl px-4 py-3 bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:border-teal-500"
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                >
                  {cameras.map(cam => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${cam.deviceId.substring(0,5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 🟢 NEW: Resolution Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">Resolution</label>
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
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">Microphone</label>
                  <button onClick={toggleMute} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${isMuted ? "border-red-500 text-red-500 bg-red-50" : "border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100"}`}>
                    {isMuted ? <><MicOff size={16} /> Muted</> : <><Mic size={16} /> Active</>}
                  </button>
                </div>
              </div>
            </div>

            <button onClick={handleStartStream} className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2">
              <Play size={18} fill="currentColor" /> Go Live
            </button>

            <button onClick={handleClearDatabase} disabled={isClearing} className="w-full mt-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex justify-center gap-2 text-gray-500 hover:bg-gray-100">
              <RefreshCw size={14} className={isClearing ? "animate-spin" : ""} /> Reset Server Connection
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
          
          {/* 🟢 NEW: Live On-Screen Controls */}
          <div className="relative z-10 w-full p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-4">
            
            {/* Live Zoom Slider (Only shows if phone supports it) */}
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
              
              {/* Live Lens Switcher Dropdown */}
              <div className="flex items-center gap-2 bg-black/50 border border-white/20 rounded-full px-3 py-2 backdrop-blur-md">
                <Video size={16} className="text-white" />
                <select 
                  className="bg-transparent text-white text-xs font-bold uppercase outline-none max-w-[100px] truncate"
                  value={selectedCamera}
                  onChange={(e) => switchLiveCamera(e.target.value)}
                >
                  {cameras.map(cam => (
                    <option key={cam.deviceId} value={cam.deviceId} className="text-black">
                      {cam.label || 'Camera'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {torchSupported && (
                  <button onClick={toggleTorch} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 border ${torchOn ? "bg-amber-500 border-amber-400 text-black" : "bg-black/50 border-white/20 text-white backdrop-blur-md"}`}>
                    {torchOn ? <Flashlight size={18} /> : <ZapOff size={18} />}
                  </button>
                )}

                <button onClick={toggleFullscreen} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 border border-white/20 bg-black/50 text-white backdrop-blur-md">
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>

                <button onClick={toggleMute} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 border border-white/20 ${isMuted ? "bg-red-500 text-white" : "bg-black/50 text-white backdrop-blur-md"}`}>
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button onClick={() => handleStopStream(streamId)} className="h-10 md:h-12 px-5 rounded-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 active:scale-95 text-[10px] md:text-sm">
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