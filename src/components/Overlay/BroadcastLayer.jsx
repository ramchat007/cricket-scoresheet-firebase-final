import React, { useEffect, useState, useLayoutEffect } from "react";
import { useParams } from "react-router-dom";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { Users, Award, Zap, Activity } from "lucide-react";

const TV_CARD_BASE =
  "bg-[#0f172a]/95 text-white border-l-4 border-teal-500 shadow-2xl rounded-r-xl overflow-hidden animate-in slide-in-from-left-8 duration-500 fade-in";

export default function BroadcastLayer() {
  const { tournamentId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overlayState, setOverlayState] = useState({
    activeView: "NONE",
    showTicker: false,
    spotlightPlayerId: "",
  });
  const [scale, setScale] = useState(1);

  // --- 1. TV SCALING ---
  useLayoutEffect(() => {
    const handleResize = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- 2. AUTO-FETCH LIVE MATCH ---
  useEffect(() => {
    if (!tournamentId) return;

    const q = query(collection(db, "tournaments", tournamentId, "matches"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const getStatus = (m) =>
        (m.status || m.meta?.status || "").toLowerCase().trim();

      let activeMatch = matches.find((m) =>
        ["live", "ongoing", "in-progress"].includes(getStatus(m)),
      );

      if (!activeMatch) {
        const upcoming = matches
          .filter((m) =>
            ["upcoming", "scheduled", "pending", ""].includes(getStatus(m)),
          )
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        if (upcoming.length > 0) activeMatch = upcoming[0];
      }

      if (activeMatch) {
        setMatch(activeMatch);
        if (activeMatch.meta?.overlay) {
          setOverlayState(activeMatch.meta.overlay);
        } else {
          setOverlayState({ activeView: "NONE", showTicker: false });
        }
      } else {
        setMatch(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tournamentId]);

  const containerStyle = {
    width: 1920,
    height: 1080,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
  };

  if (loading) return <div className="w-screen h-screen bg-transparent"></div>;
  if (!match) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-900/80">
        <div
          style={containerStyle}
          className="flex items-center justify-center">
          <div className="text-white font-black text-4xl uppercase tracking-widest opacity-50 border-4 border-white/20 p-10 rounded-3xl">
            Broadcast Layer Standby
            <div className="text-sm text-center mt-2 font-bold tracking-widest text-teal-400">
              WAITING FOR ACTIVE MATCH
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentInn = match.innings?.[match.currentInnings || 0];

  // --- SUB-COMPONENTS ---

  // 1. SMART PLAYER SPOTLIGHT
  const PlayerSpotlight = () => {
    const allPlayers = [
      ...(match.teamASquad || []),
      ...(match.teamBSquad || []),
    ];
    const player = allPlayers.find(
      (p) => p.id === overlayState.spotlightPlayerId,
    );

    if (!player) return null;

    // Use player.name to map to current innings stats (if they are playing right now)
    const batStats = currentInn?.batsmenStats?.[player.name];
    const bowlStats = currentInn?.bowlerStats?.[player.name];

    return (
      <div
        className={`absolute bottom-[200px] left-[100px] flex ${TV_CARD_BASE} border-l-8 border-teal-400`}>
        <div className="w-56 bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center relative shadow-inner border-r border-white/10">
          <Users size={100} className="text-slate-600 drop-shadow-md" />
          <div className="absolute bottom-0 w-full bg-teal-500 text-black text-center font-black text-sm py-1.5 uppercase tracking-widest">
            Player Focus
          </div>
        </div>
        <div className="p-8 min-w-[400px] flex flex-col justify-center bg-slate-900/95">
          <h2 className="text-5xl font-black uppercase italic leading-none mb-2 drop-shadow-lg text-white">
            {player.name}
          </h2>
          <p className="text-teal-400 font-bold uppercase tracking-[0.2em] text-sm mb-8">
            {player.role}
          </p>

          <div className="grid grid-cols-2 gap-8">
            {batStats && (
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                  Batting
                </div>
                <div className="text-5xl font-mono font-black text-white drop-shadow-md">
                  {batStats.runs}
                  <span className="text-2xl text-slate-500 font-bold ml-1">
                    ({batStats.balls})
                  </span>
                </div>
              </div>
            )}
            {bowlStats && (
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                  Bowling
                </div>
                <div className="text-5xl font-mono font-black text-white drop-shadow-md">
                  {bowlStats.wickets}
                  <span className="text-2xl text-slate-500 font-bold ml-1">
                    -{bowlStats.runs}
                  </span>
                </div>
              </div>
            )}
            {!batStats && !bowlStats && (
              <div className="col-span-2 text-slate-500 italic text-lg font-bold">
                No active stats in current innings.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 2. PARTNERSHIP CARD
  const PartnershipCard = () => {
    if (!currentInn || !currentInn.striker || !currentInn.nonStriker)
      return null;

    // Dynamically calculate current partnership since last wicket
    let pRuns = 0;
    let pBalls = 0;
    const timeline = currentInn.timeline || [];
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].isWicket) break;
      pRuns += timeline[i].runs || 0;
      if (timeline[i].isWide || timeline[i].isNoBall) pRuns += 1;
      if (!timeline[i].isWide) pBalls += 1;
    }

    const strikerStats = currentInn.batsmenStats[currentInn.striker] || {
      runs: 0,
      balls: 0,
    };
    const nonStrikerStats = currentInn.batsmenStats[currentInn.nonStriker] || {
      runs: 0,
      balls: 0,
    };

    return (
      <div
        className={`absolute bottom-[200px] left-[100px] w-[600px] ${TV_CARD_BASE} border-l-8 border-amber-500 flex flex-col`}>
        <div className="bg-amber-500 text-black font-black text-sm px-6 py-2 uppercase tracking-widest flex items-center gap-2 shadow-md">
          <Activity size={18} /> Current Partnership
        </div>
        <div className="p-8 bg-slate-900/95 flex items-center justify-between">
          {/* Striker */}
          <div className="text-center w-1/3">
            <div className="text-xl font-bold uppercase truncate text-white mb-1">
              {currentInn.striker}
            </div>
            <div className="text-3xl font-mono font-black text-amber-400">
              {strikerStats.runs}
              <span className="text-sm text-slate-500 ml-1">
                ({strikerStats.balls})
              </span>
            </div>
          </div>
          {/* Partnership Total */}
          <div className="w-1/3 flex flex-col items-center justify-center border-x border-white/10 px-4">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
              Total Added
            </div>
            <div className="text-5xl font-mono font-black text-white drop-shadow-md">
              {pRuns}
            </div>
            <div className="text-sm text-slate-400 font-bold mt-1">
              {pBalls} Balls
            </div>
          </div>
          {/* Non-Striker */}
          <div className="text-center w-1/3">
            <div className="text-xl font-bold uppercase truncate text-white mb-1">
              {currentInn.nonStriker}
            </div>
            <div className="text-3xl font-mono font-black text-amber-400">
              {nonStrikerStats.runs}
              <span className="text-sm text-slate-500 ml-1">
                ({nonStrikerStats.balls})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. MINI SCOREBUG (Top Left Corner)
  const MiniScorebug = () => {
    if (!currentInn) return null;
    return (
      <div
        className={`absolute top-[50px] left-[50px] flex ${TV_CARD_BASE} border-l-8 border-blue-500 slide-in-from-top-8`}>
        <div className="bg-blue-600 px-6 flex items-center justify-center border-r border-black/20">
          <Zap size={24} className="text-white" />
        </div>
        <div className="px-6 py-3 bg-slate-900/95 flex flex-col justify-center min-w-[200px]">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            {currentInn.battingTeam}
          </div>
          <div className="text-4xl font-mono font-black text-white">
            {currentInn.score}/{currentInn.wickets}{" "}
            <span className="text-xl text-slate-400 ml-1">
              ({currentInn.over}.{currentInn.overBallCount})
            </span>
          </div>
        </div>
      </div>
    );
  };

  // 4. OTHER CARDS (Sponsor, Organizer, Squads, Alert)
  const SponsorCard = () => (
    <div
      className={`absolute bottom-[200px] right-[100px] flex flex-col items-end ${TV_CARD_BASE} border-amber-500 rounded-l-xl rounded-r-none border-r-4 border-l-0 slide-in-from-right-8`}>
      <div className="bg-amber-500 text-black font-black text-[12px] px-4 py-1.5 uppercase tracking-widest self-start w-full">
        Official Partner
      </div>
      <div className="p-8 flex items-center gap-6 bg-slate-900/95">
        {overlayState.sponsorText && (
          <h2 className="text-4xl font-black uppercase italic tracking-tighter drop-shadow-lg">
            {overlayState.sponsorText}
          </h2>
        )}
        <div className="w-24 h-24 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
          <Award size={50} className="text-amber-500 drop-shadow-md" />
        </div>
      </div>
    </div>
  );

  const OrganizerCard = () => (
    <div
      className={`absolute bottom-[200px] left-[100px] ${TV_CARD_BASE} border-purple-500`}>
      <div className="bg-purple-600 text-white font-black text-[12px] px-4 py-1.5 uppercase tracking-widest">
        Tournament Organizer
      </div>
      <div className="p-8 flex items-center gap-6 bg-slate-900/95">
        <div className="w-20 h-20 bg-purple-900 rounded-full flex items-center justify-center border-4 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
          <Users size={40} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black uppercase drop-shadow-lg">
            {overlayState.organizerName || "Organizer"}
          </h2>
          <p className="text-sm text-purple-200 uppercase tracking-widest font-bold">
            Managing Committee
          </p>
        </div>
      </div>
    </div>
  );

  const SquadCard = ({ teamSide }) => {
    const isTeamA = teamSide === "A";
    const teamName = isTeamA ? match.meta.teamA : match.meta.teamB;
    const squad = isTeamA ? match.teamASquad : match.teamBSquad;
    const color = isTeamA ? "border-blue-500" : "border-rose-500";
    const headerColor = isTeamA ? "bg-blue-600" : "bg-rose-600";

    return (
      <div
        className={`absolute top-[100px] right-[100px] w-[400px] ${TV_CARD_BASE} ${color} border-l-0 border-r-8 rounded-l-2xl rounded-r-none slide-in-from-right-8`}>
        <div
          className={`${headerColor} text-white font-black text-lg px-6 py-4 uppercase tracking-widest flex justify-between items-center shadow-md`}>
          <span>Playing XI</span>
          <span className="truncate max-w-[180px] text-right">{teamName}</span>
        </div>
        <div className="p-6 bg-slate-900/95">
          <ul className="space-y-3">
            {squad?.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-500 font-mono font-black text-lg w-8">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <span className="font-black text-lg uppercase text-white truncate drop-shadow-sm">
                  {p.name}
                </span>
                {p.role && (
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300 ml-auto font-bold uppercase">
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

  const CustomAlert = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-500 z-50">
      <div className="bg-[#0f172a] border-y-8 border-teal-500 py-16 px-24 w-full text-center shadow-[0_0_100px_rgba(20,184,166,0.3)] transform scale-100">
        <h1 className="text-7xl font-black uppercase text-white mb-6 italic tracking-tighter drop-shadow-2xl">
          {overlayState.customMessageTitle || "UPDATE"}
        </h1>
        <p className="text-4xl text-teal-400 font-bold uppercase tracking-[0.2em] drop-shadow-md">
          {overlayState.customMessageBody}
        </p>
      </div>
    </div>
  );

  // 🟢 RENDER ENGINE
  return (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent pointer-events-none">
      <div
        style={containerStyle}
        className="relative bg-transparent font-sans w-[1920px] h-[1080px]">
        {/* VIEW ROUTER */}
        {overlayState.activeView === "MINI_SCORE" && <MiniScorebug />}
        {overlayState.activeView === "PARTNERSHIP" && <PartnershipCard />}
        {overlayState.activeView === "SPONSOR" && <SponsorCard />}
        {overlayState.activeView === "ORGANIZER" && <OrganizerCard />}
        {overlayState.activeView === "SQUAD_A" && <SquadCard teamSide="A" />}
        {overlayState.activeView === "SQUAD_B" && <SquadCard teamSide="B" />}
        {overlayState.activeView === "SPOTLIGHT" && <PlayerSpotlight />}
        {overlayState.activeView === "CUSTOM_MSG" && <CustomAlert />}

        {/* BOTTOM TICKER */}
        {overlayState.showTicker && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#0f172a] border-t border-teal-500 flex z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-5">
            <div className="bg-teal-600 text-white font-black text-sm px-6 flex items-center uppercase tracking-widest shrink-0 z-10 shadow-lg">
              Updates
            </div>
            <div className="flex-1 relative overflow-hidden flex items-center">
              <div className="whitespace-nowrap animate-marquee text-white font-bold text-sm uppercase tracking-wider">
                {overlayState.tickerText ||
                  "Welcome to the Live Stream! Stay tuned for match updates."}
                <span className="mx-12 text-teal-500">◆</span>
                {match.name} • {match.meta?.tournamentName || tournamentId}
                <span className="mx-12 text-teal-500">◆</span>
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
