import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { getDatabase, ref, push, set, onDisconnect, serverTimestamp } from "firebase/database";
import { useParams } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";

// --- ANIMATION COMPONENT (Updated Colors) ---
const EventAnimation = ({ type }) => {
  if (!type) return null;
  
  // New Broadcast Theme Colors
  const styles = {
    FOUR: { 
        bg: "bg-gradient-to-br from-[#00b4d8] to-[#0077b6]", 
        border: "border-cyan-200", 
        text: "4", 
        sub: "BOUNDARY",
        shadow: "shadow-[0_0_50px_rgba(0,180,216,0.6)]"
    },
    SIX: { 
        bg: "bg-gradient-to-br from-[#eab308] to-[#a16207]", 
        border: "border-yellow-200", 
        text: "6", 
        sub: "MAXIMUM",
        shadow: "shadow-[0_0_50px_rgba(234,179,8,0.6)]"
    },
    WICKET: { 
        bg: "bg-gradient-to-br from-[#ef4444] to-[#991b1b]", 
        border: "border-red-200", 
        text: "OUT", 
        sub: "WICKET",
        shadow: "shadow-[0_0_50px_rgba(239,68,68,0.6)]"
    },
  };
  const current = styles[type];

  return (
    <div className="absolute top-[200px] left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in duration-300">
      <div className={`relative ${current.bg} border-4 ${current.border} ${current.shadow} rounded-[3rem] px-24 py-10 flex flex-col items-center transform scale-110`}>
        {/* Glossy Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-[2.8rem] pointer-events-none"></div>
        
        <div className="text-white font-black text-[14rem] leading-none drop-shadow-xl text-center italic tracking-tighter">
          {current.text}
        </div>
        <div className="absolute -bottom-8 bg-[#0b0f19] text-white px-12 py-3 font-black text-4xl uppercase tracking-[0.3em] rounded-full border-4 border-white/20 shadow-2xl whitespace-nowrap">
          {current.sub}
        </div>
      </div>
    </div>
  );
};

export default function MatchOverlay() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // States
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState("SUMMARY");
  const [animationType, setAnimationType] = useState(null);
  const [scale, setScale] = useState(1);
  const [tournamentName, setTournamentName] = useState("Tournament");

  // Refs
  const prevOverRef = useRef(0);
  const prevTimelineLength = useRef(0);
  const matchEndTriggered = useRef(false);
  const tossShownRef = useRef(false); 

  // 2. LIVE VIEWERS TRACKING
  useEffect(() => {
    if (!matchId) return;
    const rtdb = getDatabase();
    const viewerRef = push(ref(rtdb, `match_viewers/${matchId}`));
    set(viewerRef, { timestamp: serverTimestamp(), type: 'overlay' });
    onDisconnect(viewerRef).remove();
    return () => set(viewerRef, null).catch(console.error);
  }, [matchId]);

  // 3. TV SCALING
  useLayoutEffect(() => {
    const handleResize = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setScale(Math.min(scaleX, scaleY));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 4. LIVE DATA LISTENER
  useEffect(() => {
    if (!matchId || !tournamentId) return;
    const unsub = onSnapshot(
      doc(db, "tournaments", tournamentId, "matches", matchId),
      (doc) => {
        if (doc.exists()) {
            const data = { id: doc.id, ...doc.data() };
            setMatch(data);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firebase Error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tournamentId, matchId]);

  // 5. AUTOMATION LOGIC
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  useEffect(() => {
    if (!currentInn) return;

    // --- A. START OF MATCH (Toss Popup) ---
    const isFirstOver = currentInn.over === 0 && currentInn.overBallCount === 0;
    if (isFirstOver && match.toss && !tossShownRef.current) {
        setPopupType("TOSS");
        setShowPopup(true);
        tossShownRef.current = true;
        setTimeout(() => setShowPopup(false), 20000); 
    }

    // --- B. MATCH END DETECTION ---
    const isChasing = match.currentInnings === 1;
    const inn1 = match.innings?.[0];
    const target = match.meta?.target || (inn1 ? inn1.score + 1 : 0);
    const hasWon = isChasing && currentInn.score >= target;
    const isCompleted = match.status === "completed" || match.result || hasWon;

    if (isCompleted && !matchEndTriggered.current) {
        setPopupType("RESULT");
        setShowPopup(true);
        matchEndTriggered.current = true;
        return;
    }

    // --- C. END OF OVER POPUP ---
    const over = currentInn.over || 0;
    const balls = currentInn.overBallCount || 0;
    
    if (balls === 0 && over > 0 && over !== prevOverRef.current) {
      if (!isCompleted) {
          setPopupType("SUMMARY");
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 15000);
          prevOverRef.current = over;
      }
    }

    // --- D. EVENT ANIMATIONS ---
    const timeline = currentInn.timeline || [];
    if (timeline.length > prevTimelineLength.current) {
      const lastBall = timeline[timeline.length - 1];
      if (lastBall) {
        if (lastBall.isWicket) {
          setAnimationType("WICKET");
          setTimeout(() => setAnimationType(null), 4000);
          if (!isCompleted) {
             setPopupType("WICKET");
             setShowPopup(true);
             setTimeout(() => setShowPopup(false), 12000);
          }
        } else if (lastBall.runs === 4) {
          setAnimationType("FOUR");
          setTimeout(() => setAnimationType(null), 3500);
        } else if (lastBall.runs === 6) {
          setAnimationType("SIX");
          setTimeout(() => setAnimationType(null), 3500);
        }
      }
      prevTimelineLength.current = timeline.length;
    }
  }, [currentInn, match]);

  useEffect(() => {
      if (!tournamentId) return;
      const fetchData = async () => {
        const tourRef = doc(db, "tournaments", tournamentId);
        const tourSnap = await getDoc(tourRef);
        if (tourSnap.exists()) {
          setTournamentName(tourSnap.data().name || "Tournament");
        }
      };
      fetchData();
    }, [tournamentId]);

  // --- VIEWS ---

  if (loading) return <div className="bg-transparent w-screen h-screen"></div>;
  if (!match) return <div className="bg-black/90 text-white w-screen h-screen flex items-center justify-center font-black text-4xl uppercase">Match Not Found</div>;

  // 🔴 PRE-MATCH SCREEN (Updated Design)
  if (!currentInn) {
    if (match.toss && match.toss.winner) {
        return (
            <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
                <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "center center" }} className="relative bg-transparent font-sans">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BroadcastSummaryCard match={match} type="TOSS" />
                    </div>
                </div>
            </div>
        );
    }

    // Still waiting for toss (NEW DESIGN)
    return (
      <div className="flex items-center justify-center overflow-hidden bg-[#0b0f19]" style={{ width: 1920, height: 1080, overflow: 'hidden' }}>
        {/* Background Texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#002855] to-[#0b0f19] opacity-90"></div>

        <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "center center" }} className="relative z-10">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            
            {/* Tournament Label */}
            <div className="bg-[#00b4d8]/10 border border-[#00b4d8]/30 px-8 py-2 rounded-full mb-8 backdrop-blur-md">
                <h2 className="text-[#00b4d8] text-3xl font-black uppercase tracking-[0.4em] drop-shadow-md">{tournamentName}</h2>
            </div>

            {/* Matchup */}
            <h1 className="text-white text-9xl font-black uppercase drop-shadow-2xl italic tracking-tighter flex items-center gap-12">
              <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">{match.meta?.teamA || "Team A"}</span> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 text-8xl font-serif italic transform -skew-x-12">VS</span> 
              <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">{match.meta?.teamB || "Team B"}</span>
            </h1>

            {/* Waiting Pill */}
            <div className="mt-20 bg-gradient-to-r from-[#002855] to-[#004e9a] px-12 py-4 rounded-full text-white text-4xl animate-pulse font-black border-2 border-[#00b4d8] shadow-[0_0_40px_rgba(0,180,216,0.4)] tracking-widest uppercase">
              Waiting for Toss...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ LIVE OVERLAY
  return (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
      <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "center center" }} className="relative bg-transparent font-sans pointer-events-none">
        
        <EventAnimation type={animationType} />

        {/* POPUP LAYER */}
        <div className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-500 ${showPopup ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}>
          <BroadcastSummaryCard tournamentName={tournamentName} match={match} type={popupType} />
        </div>

        {/* TICKER LAYER */}
        <div className={`absolute bottom-[50px] w-full z-10 flex justify-center transition-all duration-500 ${showPopup ? "translate-y-[200px] opacity-0" : "translate-y-0 opacity-100"}`}>
          <ScoreTicker match={match} />
        </div>
      </div>
    </div>
  );
}