import React, { useEffect, useState, useLayoutEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { collection, query, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { Users, Zap, Activity, AlertTriangle } from "lucide-react";

import ScoreTicker from "./ScoreTicker";
import BroadcastSummaryCard from "./BroadcastSummaryCard";
// 🔥 IMPORT YOUR APP'S ACTUAL TOURNAMENT BANNER
import TournamentBanner from "./TournamentBanner";

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
    <div className="absolute top-[250px] left-1/2 -translate-x-1/2 z-[300] animate-in zoom-in duration-300">
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

const TV_CARD_BASE =
  "bg-[#0B1120] text-white shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in duration-300";

export default function BroadcastLayer() {
  const { tournamentId, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournamentName, setTournamentName] = useState("Tournament");
  const [scale, setScale] = useState(1);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState("SUMMARY");
  const [animationType, setAnimationType] = useState(null);

  const [overlayState, setOverlayState] = useState({
    activeViews: [],
    showTicker: false,
    hideBottomScoreTicker: false,
    sponsors: [],
    fullScreenBanners: [],
    spotlightPlayerId: "",
  });

  const prevTimelineLength = useRef(0);
  const prevOver = useRef(0);
  const timerRef = useRef(null);

  useLayoutEffect(() => {
    const handleResize = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    getDoc(doc(db, "tournaments", tournamentId)).then((s) => {
      if (s.exists()) setTournamentName(s.data().name || "Tournament");
    });
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    const isAutoMode = !matchId || matchId === "active";
    let unsubscribe;

    const applyData = (docsArray) => {
      const getStatus = (m) =>
        (m.status || m.meta?.status || "").toLowerCase().trim();
      let activeMatch = docsArray.find((m) =>
        [
          "live",
          "ongoing",
          "in-progress",
          "started",
          "active",
          "playing",
        ].includes(getStatus(m)),
      );
      if (!activeMatch)
        activeMatch = docsArray
          .filter((m) =>
            ["upcoming", "scheduled", "pending", "not started", ""].includes(
              getStatus(m),
            ),
          )
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0];
      if (!activeMatch)
        activeMatch = docsArray
          .filter((m) =>
            ["finished", "completed", "ended"].includes(getStatus(m)),
          )
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];

      if (activeMatch) {
        setMatch(activeMatch);
        const data = activeMatch.meta?.overlay || {};
        if (data.activeView && !data.activeViews)
          data.activeViews = [data.activeView];
        if (!data.sponsors) data.sponsors = [];
        if (!data.fullScreenBanners) data.fullScreenBanners = [];
        setOverlayState({
          activeViews: [],
          showTicker: false,
          hideBottomScoreTicker: false,
          sponsors: [],
          fullScreenBanners: [],
          ...data,
        });
      } else {
        setMatch(null);
      }
      setLoading(false);
      setError(null);
    };

    if (isAutoMode) {
      unsubscribe = onSnapshot(
        query(collection(db, "tournaments", tournamentId, "matches")),
        (snapshot) => {
          applyData(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          );
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        },
      );
    } else {
      unsubscribe = onSnapshot(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        (docSnap) => {
          if (docSnap.exists())
            applyData([{ id: docSnap.id, ...docSnap.data() }]);
          else setLoading(false);
        },
      );
    }
    return () => unsubscribe && unsubscribe();
  }, [tournamentId, matchId]);

  const isActive = (viewName) => overlayState.activeViews?.includes(viewName);
  const currentInn = match?.innings?.[match?.currentInnings || 0];

  const isChasing = match?.currentInnings === 1;
  const target =
    match?.meta?.target ||
    (match?.innings?.[0] ? match.innings[0].score + 1 : 0);
  const hasWon = isChasing && currentInn?.score >= target;
  const isMatchFinished =
    ["completed", "finished"].includes(
      (match?.status || match?.meta?.status || "").toLowerCase(),
    ) ||
    match?.result ||
    hasWon;
  const isPlayStarted =
    currentInn && (currentInn.over > 0 || currentInn.overBallCount > 0);
  const isInningsBreak =
    match?.currentInnings === 1 && !isPlayStarted && !isMatchFinished;

  let viewMode = "LOADING";
  if (loading) viewMode = "LOADING";
  else if (error) viewMode = "ERROR_DB";
  else if (!match) viewMode = "NOT_FOUND";
  else if (isMatchFinished) viewMode = "RESULT";
  else if (isInningsBreak) viewMode = "INNINGS_BREAK";
  else if ((match?.toss?.winner || match?.meta?.toss?.winner) && !isPlayStarted)
    viewMode = "TOSS";
  else if (!currentInn) viewMode = "WAITING";
  else viewMode = "LIVE";

  // --- MANUAL & AUTO EVENTS ---
  useEffect(() => {
    if (overlayState.manualAnimation && overlayState.manualAnimationTrigger) {
      if (Date.now() - overlayState.manualAnimationTrigger < 5000) {
        const lastBall =
          currentInn?.timeline?.length > 0
            ? currentInn.timeline[currentInn.timeline.length - 1]
            : null;
        let isValid = false;
        if (lastBall) {
          if (overlayState.manualAnimation === "FOUR" && lastBall.runs === 4)
            isValid = true;
          if (overlayState.manualAnimation === "SIX" && lastBall.runs === 6)
            isValid = true;
          if (overlayState.manualAnimation === "WICKET" && lastBall.isWicket)
            isValid = true;
        }
        if (isValid) {
          setAnimationType(overlayState.manualAnimation);
          const timer = setTimeout(() => setAnimationType(null), 3500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [
    overlayState.manualAnimationTrigger,
    overlayState.manualAnimation,
    currentInn,
  ]);

  useEffect(() => {
    if (viewMode !== "LIVE" || !currentInn) return;
    const timeline = currentInn.timeline || [];
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
        currentInn.overBallCount === 0 &&
        currentInn.over > 0 &&
        currentInn.over !== prevOver.current
      ) {
        setTimeout(() => {
          setPopupType("SUMMARY");
          setShowPopup(true);
          setTimeout(() => setShowPopup(false), 9000);
        }, 1000);
        prevOver.current = currentInn.over;
      }
      prevTimelineLength.current = timeline.length;
    }
  }, [currentInn, viewMode]);

  // --- COMPONENTS ---

  // 🔥 UPDATED: Sponsor Bug with Optional Phone Number
  const SponsorBug = () => {
    const sponsors = overlayState.sponsors || [];
    const [idx, setIdx] = useState(0);

    useEffect(() => {
      if (sponsors.length <= 1) return;
      const int = setInterval(
        () => setIdx((prev) => (prev + 1) % sponsors.length),
        6000,
      );
      return () => clearInterval(int);
    }, [sponsors.length]);

    if (sponsors.length === 0) return null;
    const current = sponsors[idx];

    return (
      <div className="flex items-center bg-[#0B1120]/95 border border-white/10 rounded-full pr-8 pl-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-8">
        {/* Left Side: Logo */}
        <div className="w-20 h-20 bg-white rounded-full border-4 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
          <img
            key={`img-${idx}`}
            src={current.image}
            alt={current.name}
            className="w-full h-full object-contain animate-in fade-in duration-500"
          />
        </div>

        {/* Right Side: Text details */}
        <div
          key={`text-${idx}`}
          className="ml-5 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-500 pr-2">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-0.5 drop-shadow-md">
            Tournament Partner
          </span>
          <span className="text-white font-black text-2xl uppercase tracking-wider drop-shadow-lg truncate max-w-[280px] leading-none">
            {current.name}
          </span>

          {/* 🔥 Phone Number Block */}
          {current.phone && (
            <span className="text-teal-300 font-mono font-bold text-sm tracking-widest drop-shadow-md mt-1">
              📞 {current.phone}
            </span>
          )}
        </div>
      </div>
    );
  };

  const SponsorsFullscreen = () => {
    const sponsors = overlayState.sponsors || [];
    return (
      <div className="absolute inset-0 z-[500] bg-[#0B1120] flex flex-col items-center justify-center animate-in fade-in duration-500">
        <h2 className="text-6xl font-black uppercase text-amber-400 mb-16 italic tracking-widest drop-shadow-[0_0_30px_rgba(251,191,36,0.4)]">
          Tournament Partners
        </h2>
        <div className="flex flex-wrap justify-center gap-10 max-w-[1500px]">
          {sponsors.length > 0 ? (
            sponsors.map((s, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center w-[350px] h-[260px] border-4 border-white/10 gap-3">
                <img
                  src={s.image}
                  alt={s.name}
                  className="max-w-full h-28 object-contain drop-shadow-md"
                />
                <div className="text-xl font-black uppercase text-slate-800 text-center tracking-widest truncate w-full leading-tight">
                  {s.name}
                </div>

                {/* 🔥 Phone Number on Full Screen Grid */}
                {s.phone && (
                  <div className="text-sm font-bold text-slate-500 font-mono tracking-widest">
                    📞 {s.phone}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-white text-2xl font-black italic opacity-50">
              No Sponsors Added Yet
            </div>
          )}
        </div>
      </div>
    );
  };

  // 🔥 NEW: Slideshow for Full Screen Uploaded Ad Banners
  const CustomAdBannersFullscreen = () => {
    const banners = overlayState.fullScreenBanners || [];
    const [idx, setIdx] = useState(0);

    useEffect(() => {
      if (banners.length <= 1) return;
      const int = setInterval(
        () => setIdx((prev) => (prev + 1) % banners.length),
        4000,
      ); // Change banner every 8s
      return () => clearInterval(int);
    }, [banners.length]);

    if (banners.length === 0) return null;

    return (
      <div className="absolute inset-0 z-[500] bg-black flex flex-col items-center justify-center animate-in fade-in duration-500">
        {/* Changed object-cover to object-contain, ensuring full width/height bounds */}
        <img
          key={idx}
          src={banners[idx].image}
          alt="Sponsor Banner"
          className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-700 p-8"
        />
      </div>
    );
  };

  const CustomAlert = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 animate-in fade-in duration-500 z-[500]">
      <div className="bg-[#0f172a] border-y-8 border-teal-500 py-16 px-24 w-full text-center shadow-[0_0_100px_rgba(20,184,166,0.3)] transform scale-100">
        <h1 className="text-8xl font-black uppercase text-white mb-6 italic tracking-tighter drop-shadow-2xl">
          {overlayState.customMessageTitle || "UPDATE"}
        </h1>
        <p className="text-4xl text-teal-300 font-black uppercase tracking-[0.2em] drop-shadow-lg">
          {overlayState.customMessageBody}
        </p>
      </div>
    </div>
  );

  const MiniScorebug = () => {
    if (!currentInn) return null;
    return (
      <div
        className={`flex flex-col rounded-xl border-l-8 border-blue-500 slide-in-from-top-8 ${TV_CARD_BASE}`}>
        <div className="bg-blue-600/20 px-4 py-1.5 flex justify-between items-center text-blue-100 text-[10px] font-bold tracking-wider uppercase border-b border-blue-500/20">
          <span>
            {match.name || "Match"} • {match.meta?.teamA} vs {match.meta?.teamB}
          </span>
          {isChasing && (
            <span className="text-amber-400 ml-5 font-black">
              Target: {target}
            </span>
          )}
        </div>
        <div className="flex">
          <div className="bg-blue-600 px-5 flex items-center justify-center border-r border-black/30">
            <Zap size={22} className="text-white" />
          </div>
          <div className="px-5 py-2 bg-[#0B1120] flex flex-col justify-center min-w-[180px]">
            <div className="text-[10px] text-slate-300 uppercase tracking-widest font-black">
              {currentInn.battingTeam}
            </div>
            <div className="text-3xl font-mono font-black text-white drop-shadow-lg">
              {currentInn.score}/{currentInn.wickets}{" "}
              <span className="text-lg text-slate-400 ml-1 font-bold">
                ({currentInn.over}.{currentInn.overBallCount})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OrganizerCard = () => (
    <div
      className={`flex rounded-xl border-l-8 border-purple-500 slide-in-from-left-8 ${TV_CARD_BASE}`}>
      <div className="bg-purple-600 px-4 flex items-center justify-center border-r border-black/30">
        <Users size={30} className="text-white" />
      </div>
      <div className="p-6 bg-[#0B1120] flex flex-col justify-center">
        <h2 className="text-3xl font-black uppercase text-white drop-shadow-lg">
          {overlayState.organizerName || "Organizer"}
        </h2>
        <p className="text-xs text-purple-300 uppercase tracking-widest font-black mt-1">
          Managing Committee
        </p>
      </div>
    </div>
  );

  const PartnershipCard = () => {
    if (!currentInn || !currentInn.striker || !currentInn.nonStriker)
      return null;
    let pRuns = 0;
    let pBalls = 0;
    const timeline = currentInn.timeline || [];
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].isWicket) break;
      pRuns += timeline[i].runs || 0;
      if (timeline[i].isWide || timeline[i].isNoBall) pRuns += 1;
      if (!timeline[i].isWide) pBalls += 1;
    }
    const sStats = currentInn.batsmenStats[currentInn.striker] || {
      runs: 0,
      balls: 0,
    };
    const nsStats = currentInn.batsmenStats[currentInn.nonStriker] || {
      runs: 0,
      balls: 0,
    };

    return (
      <div
        className={`w-[600px] flex flex-col rounded-xl border-l-8 border-amber-500 slide-in-from-left-8 ${TV_CARD_BASE}`}>
        <div className="bg-amber-500 text-black font-black text-sm px-6 py-2 uppercase tracking-widest flex items-center gap-2 shadow-md">
          <Activity size={18} /> Current Partnership
        </div>
        <div className="p-8 bg-[#0B1120] flex items-center justify-between">
          <div className="text-center w-1/3">
            <div className="text-xl font-black uppercase truncate text-white mb-1 drop-shadow-md">
              {currentInn.striker}
            </div>
            <div className="text-3xl font-mono font-black text-amber-300 drop-shadow-md">
              {sStats.runs}
              <span className="text-sm text-slate-300 ml-2">
                ({sStats.balls})
              </span>
            </div>
          </div>
          <div className="w-1/3 flex flex-col items-center justify-center border-x border-white/20 px-4">
            <div className="text-[10px] text-slate-200 uppercase tracking-widest font-black mb-1">
              Total Added
            </div>
            <div className="text-5xl font-mono font-black text-white drop-shadow-lg">
              {pRuns}
            </div>
            <div className="text-sm text-slate-300 font-bold mt-1">
              {pBalls} Balls
            </div>
          </div>
          <div className="text-center w-1/3">
            <div className="text-xl font-black uppercase truncate text-white mb-1 drop-shadow-md">
              {currentInn.nonStriker}
            </div>
            <div className="text-3xl font-mono font-black text-amber-300 drop-shadow-md">
              {nsStats.runs}
              <span className="text-sm text-slate-300 ml-2">
                ({nsStats.balls})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PlayerSpotlight = () => {
    const allPlayers = [
      ...(match.teamASquad || []),
      ...(match.teamBSquad || []),
    ];
    const player = allPlayers.find(
      (p) => p.id === overlayState.spotlightPlayerId,
    );
    if (!player) return null;

    const batStats = currentInn?.batsmenStats?.[player.name];
    const bowlStats = currentInn?.bowlerStats?.[player.name];
    const hasLiveStats = batStats || bowlStats;

    return (
      <div
        className={`flex rounded-xl border-l-8 border-teal-400 slide-in-from-left-8 ${TV_CARD_BASE}`}>
        <div className="w-48 bg-gradient-to-b from-slate-800 to-[#0B1120] flex flex-col items-center justify-center relative shadow-inner border-r border-white/10 p-4 pt-6">
          <img
            src={
              player.photoURL ||
              "https://cdn-icons-png.flaticon.com/512/847/847969.png"
            }
            alt=""
            className="w-28 h-28 object-cover rounded-full border-4 border-white/20 shadow-lg mb-4"
          />
          <div className="absolute bottom-0 w-full bg-teal-500 text-black text-center font-black text-[10px] py-1.5 uppercase tracking-widest">
            Player Profile
          </div>
        </div>
        <div className="p-6 min-w-[350px] flex flex-col justify-center bg-[#0B1120]">
          <h2 className="text-4xl font-black uppercase italic leading-none mb-1 drop-shadow-lg text-white">
            {player.name}
          </h2>
          <p className="text-teal-300 font-bold uppercase tracking-[0.2em] text-xs mb-4 drop-shadow-md">
            {player.role || "Squad Member"}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {!hasLiveStats && (
              <>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                    Batting Style
                  </div>
                  <div className="text-sm font-bold text-white">
                    {player.battingStyle || "N/A"}
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                    Bowling Style
                  </div>
                  <div className="text-sm font-bold text-white">
                    {player.bowlingStyle || "N/A"}
                  </div>
                </div>
              </>
            )}
            {batStats && (
              <div className="bg-teal-500/10 p-3 rounded-lg border border-teal-500/20">
                <div className="text-[10px] text-teal-300 uppercase tracking-widest font-black mb-1">
                  Live Batting
                </div>
                <div className="text-3xl font-mono font-black text-white drop-shadow-lg">
                  {batStats.runs}
                  <span className="text-sm text-slate-300 font-bold ml-1">
                    ({batStats.balls})
                  </span>
                </div>
              </div>
            )}
            {bowlStats && (
              <div className="bg-teal-500/10 p-3 rounded-lg border border-teal-500/20">
                <div className="text-[10px] text-teal-300 uppercase tracking-widest font-black mb-1">
                  Live Bowling
                </div>
                <div className="text-3xl font-mono font-black text-white drop-shadow-lg">
                  {bowlStats.wickets}
                  <span className="text-sm text-slate-300 font-bold ml-1">
                    -{bowlStats.runs}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SquadCard = ({ teamSide }) => {
    const isTeamA = teamSide === "A";
    const teamName = isTeamA ? match.meta.teamA : match.meta.teamB;
    const squad = isTeamA ? match.teamASquad : match.teamBSquad;
    const color = isTeamA ? "border-blue-500" : "border-rose-500";
    const headerColor = isTeamA ? "bg-blue-600" : "bg-rose-600";

    return (
      <div
        className={`w-[400px] flex flex-col rounded-xl border-r-8 ${color} slide-in-from-right-8 ${TV_CARD_BASE}`}>
        <div
          className={`${headerColor} text-white font-black text-lg px-6 py-4 uppercase tracking-widest flex justify-between items-center shadow-md`}>
          <span>Playing XI</span>
          <span className="truncate max-w-[180px] text-right drop-shadow-md">
            {teamName}
          </span>
        </div>
        <div className="p-6 bg-[#0B1120]">
          <ul className="space-y-3">
            {squad?.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-400 font-mono font-black text-lg w-8">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <span className="font-black text-lg uppercase text-white truncate drop-shadow-md">
                  {p.name}
                </span>
                {p.role && (
                  <span className="text-[10px] bg-white/20 px-2 py-1 rounded text-white ml-auto font-bold uppercase shadow-sm">
                    {p.role.slice(0, 3)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // --- RENDER ---
  const containerStyle = {
    width: 1920,
    height: 1080,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
  };

  if (viewMode === "LOADING")
    return <div className="bg-transparent w-screen h-screen"></div>;
  if (viewMode === "ERROR_DB")
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0B1120]/90 text-white font-sans">
        <div className="text-center bg-red-500/10 border border-red-500/30 p-8 rounded-3xl">
          <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
            Database Error
          </h1>
          <p className="text-red-300 font-mono">{error}</p>
        </div>
      </div>
    );

  if (viewMode === "NOT_FOUND" || viewMode === "WAITING") {
    return (
      <div
        className="flex items-center justify-center overflow-hidden bg-slate-900"
        style={{ width: 1920, height: 1080 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 opacity-90"></div>
        <div
          style={containerStyle}
          className="relative z-10 flex flex-col items-center justify-center">
          <div className="bg-teal-500/10 border border-teal-500/30 px-10 py-3 rounded-full mb-10 backdrop-blur-md">
            <h2 className="text-teal-400 text-4xl font-black uppercase tracking-[0.4em] drop-shadow-md">
              {tournamentName}
            </h2>
          </div>
          <h1 className="text-white text-[10rem] font-black uppercase drop-shadow-2xl italic tracking-tighter flex items-center gap-16">
            <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] text-slate-100">
              {match?.meta?.teamA || "Team A"}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 text-9xl font-serif italic transform -skew-x-12">
              VS
            </span>
            <span className="drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] text-slate-100">
              {match?.meta?.teamB || "Team B"}
            </span>
          </h1>
          <div className="mt-24 bg-gradient-to-r from-teal-800 to-slate-800 px-16 py-5 rounded-full text-white text-5xl animate-pulse font-black border-4 border-teal-500/50 shadow-[0_0_50px_rgba(20,184,166,0.3)] tracking-widest uppercase">
            {viewMode === "NOT_FOUND" ? "Standby..." : "Starting Soon..."}
          </div>
        </div>
      </div>
    );
  }

  // Pre-game / Innings Break / Result Default views (if no manual overrides are active)
  if (["TOSS", "INNINGS_BREAK", "RESULT"].includes(viewMode)) {
    return (
      <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent">
        <div
          style={containerStyle}
          className="relative bg-transparent font-sans pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <BroadcastSummaryCard
              tournamentName={tournamentName}
              match={match}
              type={viewMode}
            />
          </div>
          {currentInn && !overlayState.hideBottomScoreTicker && (
            <div className="absolute bottom-[50px] w-full z-10 flex justify-center">
              <ScoreTicker match={match} />
            </div>
          )}
        </div>
      </div>
    );
  }

  const isSummaryCardShowing = showPopup || isActive("SUMMARY_CARD");
  const hideTicker =
    isSummaryCardShowing ||
    overlayState.hideBottomScoreTicker ||
    isActive("APP_TOURNAMENT_BANNER") ||
    isActive("CUSTOM_AD_BANNERS");

  return (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent pointer-events-none">
      <div
        style={containerStyle}
        className="relative bg-transparent font-sans w-[1920px] h-[1080px]">
        {/* 🔥 1. YOUR APP'S TOURNAMENT BANNER */}
        <div
          className={`absolute inset-0 z-[500] transition-all duration-500 ${isActive("APP_TOURNAMENT_BANNER") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20 pointer-events-none"}`}>
          {/* We wrap it in a div that catches pointer events if needed, but usually we just let it render full screen */}
          <div className="w-full h-full bg-[#0B1120]">
            {isActive("APP_TOURNAMENT_BANNER") && (
              <TournamentBanner tournamentId={tournamentId} match={match} />
            )}
          </div>
        </div>

        {/* 🔥 2. UPLOADED AD BANNERS SLIDESHOW */}
        {isActive("CUSTOM_AD_BANNERS") && <CustomAdBannersFullscreen />}

        {/* OTHER FULL SCREEN ALERTS */}
        {isActive("CUSTOM_MSG") && <CustomAlert />}

        <EventAnimation type={animationType} />

        <div
          className={`absolute inset-0 z-[60] flex items-center justify-center transition-all duration-500 ${showPopup && !isActive("SUMMARY_CARD") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20 pointer-events-none"}`}>
          <BroadcastSummaryCard
            tournamentName={tournamentName}
            match={match}
            type={popupType}
          />
        </div>
        <div
          className={`absolute inset-0 z-[60] flex items-center justify-center transition-all duration-500 ${isActive("SUMMARY_CARD") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20 pointer-events-none"}`}>
          <BroadcastSummaryCard
            tournamentName={tournamentName}
            match={match}
            type="SUMMARY"
          />
        </div>

        <div
          className={`absolute bottom-[50px] w-full z-10 flex justify-center transition-all duration-500 ${hideTicker ? "translate-y-[200px] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}>
          <ScoreTicker match={match} />
        </div>

        {/* TOP LEFT */}
        <div className="absolute top-[30px] left-[50px] flex flex-col gap-6 items-start z-40">
          {isActive("MINI_SCORE") && <MiniScorebug />}
        </div>

        {/* TOP RIGHT */}
        <div className="absolute top-[30px] right-[50px] flex flex-col gap-6 items-end z-40">
          {isActive("SPONSOR_BUG") && <SponsorBug />}
          {isActive("SQUAD_A") && <SquadCard teamSide="A" />}
          {isActive("SQUAD_B") && <SquadCard teamSide="B" />}
        </div>

        {/* BOTTOM LEFT */}
        <div className="absolute bottom-[250px] left-[50px] flex flex-col justify-end gap-6 items-start z-40">
          {isActive("ORGANIZER") && <OrganizerCard />}
          {isActive("PARTNERSHIP") && <PartnershipCard />}
          {isActive("SPOTLIGHT") && <PlayerSpotlight />}
        </div>

        {/* BOTTOM TICKER */}
        {overlayState.showTicker && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#0B1120] border-t-2 border-teal-500 flex z-[80] shadow-[0_-5px_30px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-5">
            <div className="bg-teal-600 text-white font-black text-base px-8 flex items-center uppercase tracking-widest shrink-0 z-10 shadow-xl">
              Updates
            </div>
            <div className="flex-1 relative overflow-hidden flex items-center">
              <div className="whitespace-nowrap animate-marquee text-white font-black text-lg uppercase tracking-wider drop-shadow-md">
                {overlayState.tickerText ||
                  "Welcome to the Live Stream! Stay tuned for match updates."}
                <span className="mx-16 text-teal-400">◆</span>
                {match.name} • {tournamentName}
                <span className="mx-16 text-teal-400">◆</span>
                {overlayState.tickerText}
              </div>
            </div>
          </div>
        )}
        <style>{`
          .animate-marquee { animation: marquee 20s linear infinite; }
          @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        `}</style>
      </div>
    </div>
  );
}
