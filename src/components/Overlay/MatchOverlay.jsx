import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { getDatabase, ref, push, set, onDisconnect, serverTimestamp } from "firebase/database";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";

// --- ANIMATION COMPONENT ---
const EventAnimation = ({ type }) => {
  if (!type) return null;
  const styles = {
    FOUR: { bg: "bg-green-600", border: "border-green-400", text: "4", sub: "BOUNDARY" },
    SIX: { bg: "bg-[#e91e63]", border: "border-pink-400", text: "6", sub: "MAXIMUM" },
    WICKET: { bg: "bg-red-600", border: "border-red-400", text: "OUT", sub: "WICKET" },
  };
  const current = styles[type];

  return (
    <div className="absolute top-[200px] left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in duration-300">
      <div className={`relative ${current.bg} border-4 ${current.border} shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-[3rem] px-24 py-6 flex flex-col items-center`}>
        <div className="text-white font-black text-[12rem] leading-none drop-shadow-lg text-center">
          {current.text}
        </div>
        <div className="absolute -bottom-6 bg-white text-slate-900 px-10 py-2 font-black text-3xl uppercase tracking-[0.3em] rounded-full border-4 border-slate-200 shadow-lg whitespace-nowrap">
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

  // Refs
  const prevOverRef = useRef(0);
  const prevTimelineLength = useRef(0);
  const matchEndTriggered = useRef(false);
  const tossShownRef = useRef(false); // Track if we showed toss at start of match

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
            // console.log("Overlay Data:", data); // ✅ Debug: Check console for 'toss' object
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
    // If it's the very first ball (0.0) and we haven't shown toss yet
    const isFirstOver = currentInn.over === 0 && currentInn.overBallCount === 0;
    if (isFirstOver && match.toss && !tossShownRef.current) {
        setPopupType("TOSS");
        setShowPopup(true);
        tossShownRef.current = true; // Mark as shown so it doesn't pop up again
        // Keep toss visible for a while or until manually closed? 
        // For now, let's keep it up until the first ball is bowled (handled by End of Over logic overwriting it) or timeout
        setTimeout(() => setShowPopup(false), 20000); // Hide after 20s
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
    
    // Only trigger end of over if it's NOT the start of the match (0.0)
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
        // ... (Animation logic same as before) ...
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

  // --- VIEWS ---

  if (loading) return <div className="bg-transparent w-screen h-screen"></div>;
  if (!match) return <div className="bg-black/80 text-white w-screen h-screen flex items-center justify-center">Match Not Found</div>;

  // 🔴 PRE-MATCH SCREEN (No Innings yet)
  if (!currentInn) {
    // ✅ FIX: Relaxed check. If 'toss' exists in DB, show the card.
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

    // Still waiting for toss
    return (
      <div className="flex items-center justify-center overflow-hidden bg-[#1a1b4b]" style={{ width: 1920, height: 1080, overflow: 'hidden' }}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "center center" }} className="relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1b4b]/95">
            <h2 className="text-[#00bcd4] text-4xl font-black uppercase tracking-[0.5em] mb-6">Upcoming Match</h2>
            <h1 className="text-white text-9xl font-black uppercase drop-shadow-2xl">
              {match.meta?.teamA || "Team A"} <span className="text-white/30 text-7xl align-middle px-4">vs</span> {match.meta?.teamB || "Team B"}
            </h1>
            <div className="mt-12 bg-white/10 px-8 py-3 rounded-full text-white/80 text-3xl animate-pulse font-bold border border-white/20">
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
          <BroadcastSummaryCard match={match} type={popupType} />
        </div>

        {/* TICKER LAYER */}
        <div className={`absolute bottom-[50px] w-full z-10 flex justify-center transition-all duration-500 ${showPopup ? "translate-y-[200px] opacity-0" : "translate-y-0 opacity-100"}`}>
          <ScoreTicker match={match} />
        </div>
      </div>
    </div>
  );
}