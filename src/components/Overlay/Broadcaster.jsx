import React, { useState, useEffect, useRef } from "react";
import { Camera, Play, Square, Copy, AlertCircle, Check, User, Image as ImageIcon, Mic, MicOff, RefreshCw, Settings2, SwitchCamera, Maximize, Minimize } from "lucide-react";
import { rtcConfig, createStreamOffer, stopStream, clearStreamDatabase } from "../../utils/webrtc";

export default function Broadcaster() {
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  
  // 🟢 NEW: Hardware lock reference to survive React hot-reloads
  const activeStreamRef = useRef(null);

  const [streamId, setStreamId] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [facingMode, setFacingMode] = useState("environment");
  const [isMuted, setIsMuted] = useState(false); 
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    let savedId = localStorage.getItem("cricsync_stream_id");
    if (!savedId) {
      savedId = `cam-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem("cricsync_stream_id", savedId);
    }
    setStreamId(savedId);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      
      // 🟢 BUG FIX: Always use the Ref to cleanly kill the hardware on unmount!
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      }
      handleStopStream(savedId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isStreaming && localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
    }
  }, [isStreaming, localStream]);

  const handleClearDatabase = async () => {
    if (isStreaming) return alert("Please stop the live stream before resetting the database.");
    if (!window.confirm("This will wipe all connection data for this camera from the server. Continue?")) return;
    
    setIsClearing(true);
    await clearStreamDatabase(streamId);
    setIsClearing(false);
    alert("Server connection reset successfully!");
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !newState; 
      });
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen API failed, using CSS fallback", err);
      setIsFullscreen(!isFullscreen);
    }
  };

  const handleStartStream = async () => {
    try {
      setError("");
      
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await clearStreamDatabase(streamId);

      // 🟢 Reverted exactly to the strict hardware request that worked for you
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true, 
      });

      stream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
      
      // Update both state and the safety Ref
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
      if (err.name === "NotAllowedError") {
        setError("Permission Denied: Camera is locked by another app/tab, or browser blocked it.");
      } else {
        setError(`Camera failed: ${err.message}`);
      }
      
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      }
    }
  };

  const toggleCameraLive = async () => {
    if (!isStreaming || !peerConnectionRef.current) return;
    const newMode = facingMode === "environment" ? "user" : "environment";
    
    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
        await new Promise(resolve => setTimeout(resolve, 150)); 
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true 
      });

      newStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; });

      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
      
      if (videoSender) await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
      if (audioSender) await audioSender.replaceTrack(newStream.getAudioTracks()[0]);

      setLocalStream(newStream);
      activeStreamRef.current = newStream;
      setFacingMode(newMode);
      
    } catch (err) {
      console.error("Camera flip failed:", err);
      alert("Could not switch camera. Another app might be using it.");
    }
  };

  const handleStopStream = async (idToStop = streamId) => {
    setIsStreaming(false); 

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // 🟢 Clean kill
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
      setLocalStream(null);
    }
    
    await stopStream(idToStop);
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
            <h1 className="font-black uppercase tracking-widest text-sm md:text-lg italic">
              Broadcaster
            </h1>
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
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Stream Setup</h2>
              <p className="text-xs font-bold mt-1 text-gray-500">Configure your settings before going live</p>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">
                OBS Browser Source URL
              </label>
              <div className="flex items-center gap-2 border rounded-xl p-1.5 pl-3 bg-gray-50 border-gray-200">
                <span className="flex-1 text-xs text-teal-600 font-mono truncate select-all">{obsLink}</span>
                <button onClick={copyToClipboard} className="p-2 rounded-lg transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700">
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">Camera</label>
                <div className="flex p-1 rounded-xl border bg-gray-100 border-gray-200">
                  <button onClick={() => setFacingMode("environment")} className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${facingMode === "environment" ? "bg-teal-500 text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}>
                    <ImageIcon size={14} /> Back
                  </button>
                  <button onClick={() => setFacingMode("user")} className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${facingMode === "user" ? "bg-teal-500 text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}>
                    <User size={14} /> Front
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-gray-500">Microphone</label>
                <button onClick={toggleMute} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${isMuted ? "border-red-500 text-red-500 bg-red-50" : "border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100"}`}>
                  {isMuted ? <><MicOff size={16} /> Muted</> : <><Mic size={16} /> Active</>}
                </button>
              </div>
            </div>

            <button onClick={handleStartStream} className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2">
              <Play size={18} fill="currentColor" /> Start Camera & Go Live
            </button>

            <button onClick={handleClearDatabase} disabled={isClearing} className="w-full mt-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-700">
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
            className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />
          
          <div className="relative z-10 w-full p-4 md:p-6 pb-8 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center gap-2 sm:gap-4">
            
            <button onClick={toggleFullscreen} className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border border-white/20 bg-black/50 text-white backdrop-blur-md hover:bg-black/70">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            <button onClick={toggleCameraLive} className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border border-white/20 bg-black/50 text-white backdrop-blur-md hover:bg-black/70">
              <SwitchCamera size={18} />
            </button>

            <button onClick={toggleMute} className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border border-white/20 ${isMuted ? "bg-red-500 text-white" : "bg-black/50 text-white backdrop-blur-md hover:bg-black/70"}`}>
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button onClick={() => handleStopStream(streamId)} className="w-[130px] md:w-[200px] h-10 md:h-14 rounded-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 active:scale-95 transition-all text-[10px] md:text-sm">
              <Square size={14} fill="currentColor" /> Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}