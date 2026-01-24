import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";

// --- ANIMATION COMPONENT (Capsule Style) ---
const EventAnimation = ({ type }) => {
  if (!type) return null;
  const styles = {
    FOUR: {
      bg: "bg-green-600",
      border: "border-green-400",
      text: "4",
      sub: "BOUNDARY",
    },
    SIX: {
      bg: "bg-[#e91e63]",
      border: "border-pink-400",
      text: "6",
      sub: "MAXIMUM",
    },
    WICKET: {
      bg: "bg-red-600",
      border: "border-red-400",
      text: "OUT",
      sub: "WICKET",
    },
  };
  const current = styles[type];

  return (
    <div className="absolute top-[200px] left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in duration-300">
      <div
        className={`relative ${current.bg} border-4 ${current.border} shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-[3rem] px-24 py-6 flex flex-col items-center`}>
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
  const prevWicketsRef = useRef(0);
  const prevTimelineLength = useRef(0);

  // 1. 📏 TV SCALING LOGIC
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

  // 2. 📡 LIVE DATA
  useEffect(() => {
    if (!matchId || !tournamentId) return;
    const unsub = onSnapshot(
      doc(db, "tournaments", tournamentId, "matches", matchId),
      (doc) => {
        if (doc.exists()) setMatch({ id: doc.id, ...doc.data() });
        setLoading(false);
      },
      (err) => {
        console.error("Firebase Error:", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tournamentId, matchId]);

  // 3. 🤖 AUTOMATION LOGIC
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  useEffect(() => {
    if (!currentInn) return;

    // Auto Popup
    const over = currentInn.over || 0;
    const balls = currentInn.overBallCount || 0;
    if (balls === 0 && over > 0 && over !== prevOverRef.current) {
      setPopupType("SUMMARY");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 15000);
      prevOverRef.current = over;
    }

    // Auto Animation
    const timeline = currentInn.timeline || [];
    if (timeline.length > prevTimelineLength.current) {
      const lastBall = timeline[timeline.length - 1];
      if (lastBall) {
        if (lastBall.isWicket) {
          setAnimationType("WICKET");
          setTimeout(() => setAnimationType(null), 4000);
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

  // --- VIEWS ---

  if (loading) return <div className="bg-black w-screen h-screen"></div>;
  if (!match)
    return (
      <div className="bg-black text-white w-screen h-screen flex items-center justify-center">
        Match Not Found
      </div>
    );

  // Pre-Match Screen
  if (!currentInn) {
    return (
      <div className="w-screen h-screen bg-slate-900/10 flex items-center justify-center overflow-hidden">
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
          className="relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1b4b]/95">
            <h2 className="text-[#00bcd4] text-4xl font-black uppercase tracking-[0.5em] mb-6">
              Upcoming Match
            </h2>
            <h1 className="text-white text-9xl font-black uppercase drop-shadow-2xl">
              {match.meta?.teamA || "Team A"}{" "}
              <span className="text-white/30 text-7xl align-middle px-4">
                vs
              </span>{" "}
              {match.meta?.teamB || "Team B"}
            </h1>
            <div className="mt-12 bg-white/10 px-8 py-3 rounded-full text-white/80 text-3xl animate-pulse font-bold border border-white/20">
              Waiting for Toss...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Live Overlay
  return (
    <div className="w-screen h-screen bg-slate-900/10 flex items-center justify-center overflow-hidden">
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

        {/* ✅ CENTERED TICKER LAYER */}
        {/* Changed from left-0/right-0 to w-full + flex justify-center */}
        <div
          className={`absolute bottom-[50px] w-full z-10 flex justify-center transition-all duration-500 ${showPopup ? "translate-y-[200px] opacity-0" : "translate-y-0 opacity-100"}`}>
          <ScoreTicker match={match} />
        </div>
      </div>
    </div>
  );
}
