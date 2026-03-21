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
  query,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";

// --- ANIMATION COMPONENT ---
const EventAnimation = ({ type }) => {
  if (!type) return null;
  const styles = {
    FOUR: {
      bg: "bg-gradient-to-br from-teal-400 to-teal-600",
      border: "border-teal-200",
      text: "4",
      sub: "BOUNDARY",
      shadow: "shadow-[0_0_60px_rgba(45,212,191,0.6)]",
    },
    SIX: {
      bg: "bg-gradient-to-br from-amber-300 to-orange-500",
      border: "border-yellow-100",
      text: "6",
      sub: "MAXIMUM",
      shadow: "shadow-[0_0_60px_rgba(251,191,36,0.6)]",
    },
    WICKET: {
      bg: "bg-gradient-to-br from-red-400 to-red-700",
      border: "border-red-200",
      text: "OUT",
      sub: "WICKET",
      shadow: "shadow-[0_0_60px_rgba(248,113,113,0.6)]",
    },
  };
  const current = styles[type];
  return (
    <div className="absolute top-[200px] left-1/2 -translate-x-1/2 z-[100] animate-in zoom-in duration-300">
      <div
        className={`relative ${current.bg} border-4 ${current.border} ${current.shadow} rounded-[3rem] px-24 py-10 flex flex-col items-center transform scale-110`}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-[2.8rem] pointer-events-none"></div>

        <div className="text-white font-black text-[14rem] leading-none drop-shadow-xl text-center italic tracking-tighter">
          {current.text}
        </div>
        <div className="absolute -bottom-8 bg-slate-900 text-white px-12 py-3 font-black text-4xl uppercase tracking-[0.3em] rounded-full border-4 border-white/20 shadow-2xl whitespace-nowrap">
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

  // 🟢 NEW STATE: Used for the 30-Second "Holding Pattern" Timer
  const [allMatches, setAllMatches] = useState([]);
  const [lockedResultMatch, setLockedResultMatch] = useState(null);
  const lastLiveMatchId = useRef(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState("SUMMARY");
  const [animationType, setAnimationType] = useState(null);
  const [scale, setScale] = useState(1);
  const [tournamentName, setTournamentName] = useState("Tournament");

  const prevTimelineLength = useRef(0);
  const prevOver = useRef(0);
  const timerRef = useRef(null);

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
    if (!matchId || !tournamentId || matchId === "active") return;

    let viewerDocId = null;
    const trackViewer = async () => {
      try {
        const docRef = await addDoc(
          collection(db, "tournaments", tournamentId, "matches", matchId, "viewers"),
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
          doc(db, "tournaments", tournamentId, "matches", matchId, "viewers", viewerDocId),
        ).catch((e) => {});
    };
  }, [matchId, tournamentId]);

  // --- 3. FETCH TOURNAMENT NAME ---
  useEffect(() => {
    if (!tournamentId) return;
    getDoc(doc(db, "tournaments", tournamentId)).then((s) => {
      if (s.exists()) setTournamentName(s.data().name || "Tournament");
    });
  }, [tournamentId]);

  // --- 4. FETCH ALL MATCH DATA ---
  useEffect(() => {
    if (!tournamentId) return;

    let unsubscribe;
    const isAutoMode = !matchId || matchId === "active";

    if (isAutoMode) {
      const q = query(collection(db, "tournaments", tournamentId, "matches"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const matchesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllMatches(matchesData);
      });
    } else {
      unsubscribe = onSnapshot(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        (docSnap) => {
          if (docSnap.exists()) {
            setMatch({ id: docSnap.id, ...docSnap.data() });
          }
          setLoading(false);
        },
      );
    }

    return () => unsubscribe && unsubscribe();
  }, [tournamentId, matchId]);

  // --- 4.5 🤖 THE AUTOMATED HOLDING PATTERN (30s Timer) ---
  useEffect(() => {
    const isAutoMode = !matchId || matchId === "active";
    if (!isAutoMode || allMatches.length === 0) return;

    const getStatus = (m) => (m.status || m.meta?.status || "").toLowerCase().trim();

    const liveMatches = allMatches.filter((m) => ["live", "ongoing", "in-progress"].includes(getStatus(m)));
    const upcomingMatches = allMatches
      .filter((m) => ["upcoming", "scheduled", "pending", ""].includes(getStatus(m)))
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const finishedMatches = allMatches
      .filter((m) => ["finished", "completed", "ended"].includes(getStatus(m)))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    let selectedMatch = null;

    // A. Is there a locked result screen right now? Keep showing it!
    if (lockedResultMatch) {
      selectedMatch = allMatches.find(m => m.id === lockedResultMatch.id) || lockedResultMatch;
    }
    // B. Did the match we were JUST watching finish?
    else if (lastLiveMatchId.current && finishedMatches.some(m => m.id === lastLiveMatchId.current)) {
      const justFinishedMatch = finishedMatches.find(m => m.id === lastLiveMatchId.current);
      setLockedResultMatch(justFinishedMatch);
      selectedMatch = justFinishedMatch;

      // ⏳ The Magic 30 Second Timer!
      setTimeout(() => {
        setLockedResultMatch(null);
        lastLiveMatchId.current = null; // Wipe memory so it moves to next match
      }, 30000);
    }
    // C. Normal Logic: Find Live Match
    else if (liveMatches.length > 0) {
      selectedMatch = liveMatches[0];
      lastLiveMatchId.current = selectedMatch.id; // Remember what we are watching!
    }
    // D. Normal Logic: Find Upcoming Match
    else if (upcomingMatches.length > 0) {
      selectedMatch = upcomingMatches[0];
      lastLiveMatchId.current = null;
    }
    // E. Normal Logic: Fallback to Last Finished Match
    else if (finishedMatches.length > 0) {
      selectedMatch = finishedMatches[0];
      lastLiveMatchId.current = null;
    }

    setMatch(selectedMatch);
    setLoading(false);
  }, [allMatches, lockedResultMatch, matchId]);

  // --- 5. VIEW MODE CALCULATIONS ---
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  const isChasing = match?.currentInnings === 1;
  const inn1 = match?.innings?.[0];

  // 🛡️ Added safety fix to prevent false Match Over lock
  const target = match?.meta?.target || (inn1 && inn1.score !== undefined ? inn1.score + 1 : null);
  const hasWon = isChasing && target !== null && currentInn?.score >= target;

  const rawStatus = (match?.status || match?.meta?.status || "").toLowerCase();
  const hasValidResultStr = match?.result && match.result.trim() !== "";
  const isMatchFinished =
    rawStatus === "completed" ||
    rawStatus === "finished" ||
    hasValidResultStr ||
    hasWon;

  const tossData = match?.toss || match?.meta?.toss;
  const hasToss = tossData && tossData.winner;

  const isPlayStarted = currentInn && (currentInn.over > 0 || currentInn.overBallCount > 0);
  const isInningsBreak = match?.currentInnings === 1 && !isPlayStarted && !isMatchFinished;

  let autoViewMode = "LOADING";
  if (loading) autoViewMode = "LOADING";
  else if (!match) autoViewMode = "ERROR";
  else if (isMatchFinished) autoViewMode = "RESULT";
  else if (isInningsBreak) autoViewMode = "INNINGS_BREAK";
  else if (hasToss && !isPlayStarted) autoViewMode = "TOSS";
  else if (!currentInn && !hasToss) autoViewMode = "WAITING";
  else autoViewMode = "LIVE";

  // 🟢 APPLY CONTROLLER VIEWS (Win Predictor, Scorebug, etc.)
  const config = match?.meta?.overlay || {};
  const activeViews = config.activeViews || [];
  let viewMode = autoViewMode;

  if (activeViews.includes("RESULT_CARD")) {
    viewMode = "RESULT";
  } else if (activeViews.includes("INNINGS_BREAK_CARD")) {
    viewMode = "INNINGS_BREAK";
  } else if (activeViews.includes("TOSS_CARD")) {
    viewMode = "TOSS";
  } else if (activeViews.includes("SUMMARY_CARD")) {
    viewMode = "SUMMARY";
  }

  // --- 6. EVENT AUTOMATION ---
  useEffect(() => {
    if (viewMode !== "LIVE" || !currentInn) return;

    const timeline = currentInn.timeline || [];
    const currentBalls = currentInn.overBallCount || 0;
    const currentOver = currentInn.over || 0;

    if (timeline.length > prevTimelineLength.current) {
      const lastBall = timeline[timeline.length - 1];
      let eventHandled = false;

      if (lastBall && lastBall.isWicket) {
        eventHandled = true;
        setAnimationType("WICKET");
        setShowPopup(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setAnimationType(null);
          setPopupType("WICKET");
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 9000);
        }, 2000);
      } else if (lastBall && (lastBall.runs === 4 || lastBall.runs === 6)) {
        setAnimationType(lastBall.runs === 4 ? "FOUR" : "SIX");
        setTimeout(() => setAnimationType(null), 2000);
      }

      if (
        !eventHandled &&
        currentBalls === 0 &&
        currentOver > 0 &&
        currentOver !== prevOver.current
      ) {
        setTimeout(() => {
          setPopupType("SUMMARY");
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 9000);
        }, 1000);
        prevOver.current = currentOver;
      }
      prevTimelineLength.current = timeline.length;
    }
  }, [currentInn, viewMode]);

  // --- 7. RENDER ---
  const containerStyle = {
    width: 1920,
    height: 1080,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
  };

  if (viewMode === "LOADING")
    return <div className="bg-transparent w-screen h-screen"></div>;

  if (viewMode === "ERROR") {
    if (!matchId || matchId === "active") {
      return (
        <div className="w-screen h-screen bg-slate-900 flex items-center justify-center">
          <div
            style={containerStyle}
            className="flex flex-col items-center justify-center text-white">
            <h1 className="text-6xl font-black uppercase tracking-widest text-teal-400">
              Tournament Standby
            </h1>
            <p className="text-2xl mt-4 text-slate-400 font-bold">
              Waiting for next match...
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-slate-900 text-white w-screen h-screen flex items-center justify-center font-black text-4xl">
        MATCH NOT FOUND
      </div>
    );
  }

  // 🔴 VIEW 1: WAITING (Scheduled but not started)
  if (viewMode === "WAITING") {
    return (
      <div
        className="flex items-center justify-center overflow-hidden bg-slate-900"
        style={{ width: 1920, height: 1080 }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 opacity-90"></div>

        <div
          style={containerStyle}
          className="relative z-10 flex flex-col items-center justify-center">
          <div className="bg-teal-500/10 border border-teal-500/30 px-10 py-3 rounded-full mb-10 backdrop-blur-md">
            <h2 className="text-teal-400 text-4xl font-black uppercase tracking-[0.4em] drop-shadow-md">
              {tournamentName}
            </h2>
          </div>

          <h4 className="text-white text-[6rem] font-black uppercase drop-shadow-2xl italic tracking-tighter flex items-center gap-16">
            <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] text-slate-100">
              {match.meta?.teamA || "Team A"}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 text-9xl font-serif italic transform -skew-x-12">
              VS
            </span>
            <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] text-slate-100">
              {match.meta?.teamB || "Team B"}
            </span>
          </h4>

          <div className="mt-24 bg-gradient-to-r from-teal-800 to-slate-800 px-16 py-5 rounded-full text-white text-3xl animate-pulse font-black border-4 border-teal-500/50 shadow-[0_0_50px_rgba(20,184,166,0.3)] tracking-widest uppercase">
            Starting Soon...
          </div>
        </div>
      </div>
    );
  }

  // 🟣 VIEW 2: FULL SCREEN CARDS (Toss, Break, Result)
  if (["TOSS", "INNINGS_BREAK", "RESULT"].includes(viewMode)) {
    return (
      <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
        <div
          style={containerStyle}
          className="relative bg-transparent font-sans pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center">
            <BroadcastSummaryCard
              tournamentName={tournamentName}
              match={match}
              type={viewMode}
            />
          </div>
          {currentInn && viewMode !== "RESULT" && (
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

        <div
          className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-500 ${showPopup ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}>
          <BroadcastSummaryCard
            tournamentName={tournamentName}
            match={match}
            type={popupType}
          />
        </div>

        <div
          className={`absolute bottom-[50px] w-full z-10 flex justify-center transition-all duration-500 ${showPopup ? "translate-y-[200px] opacity-0" : "translate-y-0 opacity-100"}`}>
          <ScoreTicker match={match} />
        </div>
      </div>
    </div>
  );
}