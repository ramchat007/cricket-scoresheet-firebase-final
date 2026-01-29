import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  onSnapshot,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";

// --- ANIMATION COMPONENT ---
const EventAnimation = ({ type }) => {
  if (!type) return null;
  const styles = {
    FOUR: {
      bg: "bg-gradient-to-br from-[#00b4d8] to-[#0077b6]",
      border: "border-cyan-200",
      text: "4",
      sub: "BOUNDARY",
      shadow: "shadow-[0_0_50px_rgba(0,180,216,0.6)]",
    },
    SIX: {
      bg: "bg-gradient-to-br from-[#eab308] to-[#a16207]",
      border: "border-yellow-200",
      text: "6",
      sub: "MAXIMUM",
      shadow: "shadow-[0_0_50px_rgba(234,179,8,0.6)]",
    },
    WICKET: {
      bg: "bg-gradient-to-br from-[#ef4444] to-[#991b1b]",
      border: "border-red-200",
      text: "OUT",
      sub: "WICKET",
      shadow: "shadow-[0_0_50px_rgba(239,68,68,0.6)]",
    },
  };
  const current = styles[type];
  return (
    <div className="absolute top-[200px] left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in duration-300">
      <div
        className={`relative ${current.bg} border-4 ${current.border} ${current.shadow} rounded-[3rem] px-24 py-10 flex flex-col items-center transform scale-110`}>
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

  // Refs for Logic Tracking
  const prevTimelineLength = useRef(0);
  const prevOver = useRef(0);
  const timerRef = useRef(null); // To clear timeouts if needed

  // --- 1. TV SCALING ---
  useLayoutEffect(() => {
    const handleResize = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- 2. LIVE VIEWERS ---
  useEffect(() => {
    if (!matchId || !tournamentId) return;
    let viewerDocId = null;
    const trackViewer = async () => {
      try {
        const docRef = await addDoc(
          collection(
            db,
            "tournaments",
            tournamentId,
            "matches",
            matchId,
            "viewers",
          ),
          {
            timestamp: serverTimestamp(),
            type: "overlay",
            userAgent: navigator.userAgent,
          },
        );
        viewerDocId = docRef.id;
      } catch (err) {}
    };
    trackViewer();
    return () => {
      if (viewerDocId)
        deleteDoc(
          doc(
            db,
            "tournaments",
            tournamentId,
            "matches",
            matchId,
            "viewers",
            viewerDocId,
          ),
        ).catch((e) => {});
    };
  }, [matchId, tournamentId]);

  // --- 3. FETCH DATA ---
  useEffect(() => {
    if (!tournamentId) return;
    getDoc(doc(db, "tournaments", tournamentId)).then((s) => {
      if (s.exists()) setTournamentName(s.data().name || "Tournament");
    });
  }, [tournamentId]);

  useEffect(() => {
    if (!matchId || !tournamentId) return;
    const unsub = onSnapshot(
      doc(db, "tournaments", tournamentId, "matches", matchId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setMatch(data);
        }
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tournamentId, matchId]);

  // --- 4. VIEW MODE CALCULATIONS ---
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  // A. Match Status
  const isChasing = match?.currentInnings === 1;
  const inn1 = match?.innings?.[0];
  const target = match?.meta?.target || (inn1 ? inn1.score + 1 : 0);
  const hasWon = isChasing && currentInn?.score >= target;
  const isMatchFinished =
    match?.status === "completed" || match?.result || hasWon;

  // B. Toss Status (Checks both locations)
  const tossData = match?.toss || match?.meta?.toss;
  const hasToss = tossData && tossData.winner;

  // C. Play Status
  const isPlayStarted =
    currentInn && (currentInn.over > 0 || currentInn.overBallCount > 0);
  const isInningsBreak =
    match?.currentInnings === 1 && !isPlayStarted && !isMatchFinished;

  // --- DETERMINE MODE ---
  let viewMode = "LOADING";
  if (!match) viewMode = "ERROR";
  else if (isMatchFinished) viewMode = "RESULT";
  else if (isInningsBreak) viewMode = "INNINGS_BREAK";
  else if (hasToss && !isPlayStarted) viewMode = "TOSS";
  else if (!currentInn && !hasToss) viewMode = "WAITING";
  else viewMode = "LIVE";

  // --- 5. EVENT AUTOMATION (CONFLICT FREE) ---
  useEffect(() => {
    if (viewMode !== "LIVE" || !currentInn) return;

    const timeline = currentInn.timeline || [];
    const currentBalls = currentInn.overBallCount || 0;
    const currentOver = currentInn.over || 0;

    // Detect New Event (Ball Bowled)
    if (timeline.length > prevTimelineLength.current) {
      const lastBall = timeline[timeline.length - 1];
      let eventHandled = false;

      // 1. WICKET LOGIC (Highest Priority)
      if (lastBall && lastBall.isWicket) {
        eventHandled = true; // Mark handled so End of Over doesn't overlap immediately

        // Step A: Show Animation
        setAnimationType("WICKET");
        setShowPopup(false); // Hide any existing popup

        // Step B: Wait 3.5s, then Show Card
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setAnimationType(null); // Hide Anim
          setPopupType("WICKET");
          setShowPopup(true); // Show Card

          // Step C: Hide Card after 12s
          setTimeout(() => setShowPopup(false), 12000);
        }, 3500);
      }

      // 2. BOUNDARY LOGIC (4s / 6s)
      else if (lastBall && (lastBall.runs === 4 || lastBall.runs === 6)) {
        setAnimationType(lastBall.runs === 4 ? "FOUR" : "SIX");
        setTimeout(() => setAnimationType(null), 3500);
      }

      // 3. END OF OVER LOGIC (Only if NOT a wicket, to avoid overlap)
      // If a wicket happened on the last ball, the Wicket Card takes precedence.
      if (
        !eventHandled &&
        currentBalls === 0 &&
        currentOver > 0 &&
        currentOver !== prevOver.current
      ) {
        // Wait small delay so ball animation finishes if any
        setTimeout(() => {
          setPopupType("SUMMARY");
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 15000);
        }, 1000);
        prevOver.current = currentOver;
      }

      prevTimelineLength.current = timeline.length;
    }
  }, [currentInn, viewMode]);

  // --- 6. RENDER ---
  const containerStyle = {
    width: 1920,
    height: 1080,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
  };

  if (loading) return <div className="bg-transparent w-screen h-screen"></div>;
  if (!match)
    return (
      <div className="bg-black/90 text-white w-screen h-screen flex items-center justify-center font-black text-4xl">
        MATCH NOT FOUND
      </div>
    );

  // 🔴 VIEW 1: WAITING
  if (viewMode === "WAITING") {
    return (
      <div
        className="flex items-center justify-center overflow-hidden bg-[#0b0f19]"
        style={{ width: 1920, height: 1080 }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#002855] to-[#0b0f19] opacity-90"></div>
        <div
          style={containerStyle}
          className="relative z-10 flex flex-col items-center justify-center">
          <div className="bg-[#00b4d8]/10 border border-[#00b4d8]/30 px-8 py-2 rounded-full mb-8 backdrop-blur-md">
            <h2 className="text-[#00b4d8] text-3xl font-black uppercase tracking-[0.4em] drop-shadow-md">
              {tournamentName}
            </h2>
          </div>
          <h1 className="text-white text-9xl font-black uppercase drop-shadow-2xl italic tracking-tighter flex items-center gap-12">
            <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              {match.meta?.teamA || "Team A"}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 text-8xl font-serif italic transform -skew-x-12">
              VS
            </span>
            <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              {match.meta?.teamB || "Team B"}
            </span>
          </h1>
          <div className="mt-20 bg-gradient-to-r from-[#002855] to-[#004e9a] px-12 py-4 rounded-full text-white text-4xl animate-pulse font-black border-2 border-[#00b4d8] shadow-[0_0_40px_rgba(0,180,216,0.4)] tracking-widest uppercase">
            Waiting for Toss...
          </div>
        </div>
      </div>
    );
  }

  // 🟣 VIEW 2: FULL SCREEN CARDS (Toss / Break / Result)
  if (
    viewMode === "TOSS" ||
    viewMode === "INNINGS_BREAK" ||
    viewMode === "RESULT"
  ) {
    const cardType = viewMode;
    const matchData = { ...match, toss: tossData };

    return (
      <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
        <div
          style={containerStyle}
          className="relative bg-transparent font-sans pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center">
            <BroadcastSummaryCard
              tournamentName={tournamentName}
              match={matchData}
              type={cardType}
            />
          </div>
          {/* Show Ticker Context if Innings Initialized */}
          {currentInn && (
            <div
              className={`absolute bottom-[50px] w-full z-10 flex justify-center`}>
              <ScoreTicker match={match} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 🟢 VIEW 3: LIVE PLAY
  return (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
      <div
        style={containerStyle}
        className="relative bg-transparent font-sans pointer-events-none">
        <EventAnimation type={animationType} />

        {/* POPUP LAYER */}
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-500 ${showPopup ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}>
          <BroadcastSummaryCard
            tournamentName={tournamentName}
            match={match}
            type={popupType}
          />
        </div>

        {/* TICKER LAYER */}
        <div
          className={`absolute bottom-[50px] w-full z-10 flex justify-center transition-all duration-500 ${showPopup ? "translate-y-[200px] opacity-0" : "translate-y-0 opacity-100"}`}>
          <ScoreTicker match={match} />
        </div>
      </div>
    </div>
  );
}
