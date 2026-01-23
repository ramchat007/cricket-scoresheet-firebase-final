import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";

// --- ANIMATION COMPONENT (TV Style) ---
const EventAnimation = ({ type }) => {
  if (!type) return null;
  const styles = {
    FOUR: { bg: "bg-green-600", text: "4", sub: "BOUNDARY" },
    SIX: { bg: "bg-indigo-600", text: "6", sub: "MAXIMUM" },
    WICKET: { bg: "bg-red-600", text: "OUT", sub: "WICKET" },
  };
  const current = styles[type];

  return (
    <div className="absolute top-[200px] left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in duration-300">
      <div
        className={`relative ${current.bg} border-4 border-white shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform -skew-x-12 px-20 py-8`}>
        <div className="text-white font-black text-[10rem] leading-none italic drop-shadow-lg text-center skew-x-12">
          {current.text}
        </div>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-8 py-1 font-bold text-2xl uppercase tracking-[0.3em] skew-x-12 whitespace-nowrap border-2 border-white">
          {current.sub}
        </div>
      </div>
    </div>
  );
};

export default function MatchOverlay() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);

  // States
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState("SUMMARY");
  const [animationType, setAnimationType] = useState(null);
  const [scale, setScale] = useState(1);

  // Refs
  const prevOverRef = useRef(0);
  const prevWicketsRef = useRef(0);
  const prevTimelineLength = useRef(0);

  // 1. 📏 TV SCALING LOGIC (Crucial for Mobile View)
  useLayoutEffect(() => {
    const handleResize = () => {
      // Design Target: 1920x1080
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      // Fit to screen while maintaining aspect ratio
      setScale(Math.min(scaleX, scaleY));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 2. 📡 LIVE DATA
  useEffect(() => {
    if (!matchId || !tournamentId) return;
    const unsub = onSnapshot(
      doc(db, "tournaments", tournamentId, "matches", matchId),
      (doc) => {
        if (doc.exists()) setMatch({ id: doc.id, ...doc.data() });
      },
    );
    return () => unsub();
  }, [tournamentId, matchId]);

  // 3. 🤖 AUTOMATION LOGIC
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  useEffect(() => {
    if (!currentInn) return;

    // Auto Popup on Over End
    const over = currentInn.over || 0;
    const balls = currentInn.overBallCount || 0;
    if (balls === 0 && over > 0 && over !== prevOverRef.current) {
      setPopupType("SUMMARY");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 15000);
      prevOverRef.current = over;
    }

    // Auto Animation on Events
    const timeline = currentInn.timeline || [];
    if (timeline.length > prevTimelineLength.current) {
      const lastBall = timeline[timeline.length - 1];
      if (lastBall) {
        if (lastBall.isWicket) {
          setAnimationType("WICKET");
          setTimeout(() => setAnimationType(null), 4000);
          // Also show card
          setPopupType("WICKET");
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 12000);
        } else if (lastBall.runs === 4 && !lastBall.isWide) {
          setAnimationType("FOUR");
          setTimeout(() => setAnimationType(null), 3500);
        } else if (lastBall.runs === 6 && !lastBall.isWide) {
          setAnimationType("SIX");
          setTimeout(() => setAnimationType(null), 3500);
        }
      }
      prevTimelineLength.current = timeline.length;
    }
  }, [currentInn]);

  if (!match || !currentInn)
    return <div className="bg-black w-screen h-screen"></div>;

  return (
    <div className="w-screen h-screen overflow-hidden flex items-center justify-center">
      {/* 📺 SCALED 1920x1080 CONTAINER */}
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        className="relative bg-transparent font-sans">
        <EventAnimation type={animationType} />

        {/* POPUP LAYER */}
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-500 ${showPopup ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20 pointer-events-none"}`}>
          <BroadcastSummaryCard match={match} type={popupType} />
        </div>

        {/* BOTTOM TICKER (Hides when popup is open) */}
        <div
          className={`absolute bottom-[50px] left-0 right-0 z-10 transition-all duration-500 ${showPopup ? "translate-y-[200px]" : "translate-y-0"}`}>
          <div className="w-[1800px] mx-auto">
            <ScoreTicker match={match} />
          </div>
        </div>
      </div>
    </div>
  );
}
