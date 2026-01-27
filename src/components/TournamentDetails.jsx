import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  setDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";

import TournamentTabs from "./TournamentTabs";
import MatchScheduler from "./MatchScheduler";

// --- 🔴 SMART LIVE BUTTON COMPONENT ---
const LiveActionButton = ({ liveMatches = [], broadcastUrl, isAuctionLive, navigate, tournamentId }) => {
  
  // ✅ CHECK 1: If YouTube URL exists -> Show "YouTube Live"
  if (broadcastUrl) {
    // Check for match details just for the label
    const currentMatch = liveMatches.find(
      (m) =>
        (m.status || "").toLowerCase() === "in-progress" ||
        (m.status || "").toLowerCase() === "live"
    );

    return (
      <a
        href={broadcastUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-[#FF0000] hover:bg-red-700 text-white pl-4 pr-6 py-3 rounded-xl font-bold text-xs md:text-sm animate-pulse transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/50 uppercase tracking-widest"
      >
        <span className="text-xl">📺</span>
        <div className="flex flex-col leading-none text-left">
          <span>YouTube Live</span>
          {currentMatch && (
            <span className="text-[9px] opacity-80 normal-case tracking-normal">
              {currentMatch.teamA} vs {currentMatch.teamB}
            </span>
          )}
        </div>
      </a>
    );
  }

  // ✅ CHECK 2: If Auction is ACTIVE -> Show "Auction Live"
  if (isAuctionLive) {
    return (
      <button
        onClick={() => navigate(`/tournaments/${tournamentId}/auction`)}
        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-5 py-3 rounded-xl font-bold text-xs md:text-sm shadow-lg shadow-orange-900/40 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 uppercase tracking-widest"
      >
        <span className="text-lg">🔨</span>
        <span>Auction Live</span>
      </button>
    );
  }

  return null;
};

export default function TournamentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const auth = useAuth();
  const user = auth?.user || null;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("matches");

  const [tournamentData, setTournamentData] = useState(null);
  const [tournamentTeams, setTournamentTeams] = useState([]);
  const [tournamentName, setTournamentName] = useState("");
  const [matches, setMatches] = useState([]);
  
  // Added separate state for stream URL to ensure it updates
  const [streamUrl, setStreamUrl] = useState("");

  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Toggle for showing the scheduler
  const [showScheduler, setShowScheduler] = useState(false);

  /* --------------------------------------------
     Load tournament + permissions
     --------------------------------------------- */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Load Tournament Data
        const ref = doc(db, "tournaments", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          navigate("/404");
          return;
        }

        const data = snap.data();
        setTournamentData(data);
        setTournamentName(data.name);
        setStreamUrl(data.liveStreamUrl); // Set the URL from DB

        // 2. Check Permissions
        if (user) {
          let isGlobalAdmin = false;
          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data().isAdmin) {
              isGlobalAdmin = true;
            }
          } catch (err) {
            console.warn("Could not fetch global admin status", err);
          }

          const isCreator =
            data.ownerId === user.uid || data.createdBy === user.uid;
          const isScorer =
            Array.isArray(data.scorers) && data.scorers.includes(user.uid);
          const isTourneyAdmin =
            Array.isArray(data.admins) && data.admins.includes(user.uid);

          const calculatedIsOwner = isGlobalAdmin || isCreator;
          const calculatedCanEdit =
            calculatedIsOwner || isTourneyAdmin || isScorer;

          setIsOwner(calculatedIsOwner);
          setCanEdit(calculatedCanEdit);
        } else {
          setIsOwner(false);
          setCanEdit(false);
        }
      } catch (e) {
        console.error("Failed to load tournament data", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, user, navigate]);

  /* --------------------------------------------
     Load teams
     --------------------------------------------- */
  useEffect(() => {
    if (!id) return;
    const loadTeams = async () => {
      try {
        const snap = await getDocs(collection(db, "tournaments", id, "teams"));
        setTournamentTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error loading teams:", error);
      }
    };
    loadTeams();
  }, [id]);

  /* --------------------------------------------
     Load matches (Real-time)
     --------------------------------------------- */
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "tournaments", id, "matches"),
      orderBy("matchNo", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const liveData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(liveData);
      }, (error) => console.error("Error listening to matches:", error)
    );
    return () => unsubscribe();
  }, [id]);

  /* --------------------------------------------
     Toggle Auction Mode
     --------------------------------------------- */
  const isAuctionEnabled = !!tournamentData?.isAuction;
  
  // ✅ Using your existing variable
  const auctionInitialized =
    tournamentData?.auctionState === "READY" ||
    tournamentData?.auctionState === "ACTIVE";

  const toggleAuctionMode = async () => {
    if (!canEdit) return;
    const newStatus = !isAuctionEnabled;
    const action = newStatus ? "ENABLE" : "DISABLE";

    if (!window.confirm(`Are you sure you want to ${action} Auction Mode?`))
      return;

    try {
      const ref = doc(db, "tournaments", id);
      const updateData = { isAuction: newStatus };
      if (newStatus === false) updateData.auctionState = "PENDING";

      await updateDoc(ref, updateData);
      setTournamentData((prev) => ({ ...prev, ...updateData }));
    } catch (e) {
      console.error(e);
      alert("Failed to update tournament mode.");
    }
  };

  const handleInitializeAuction = async () => {
    if (!canEdit) return;
    if (!window.confirm("Initialize Auction? This will reset purses, empty rosters, and create the console.")) return;

    try {
      const batch = writeBatch(db);
      tournamentTeams.forEach((team) => {
        const ref = doc(db, "tournaments", id, "teams", team.id);
        batch.update(ref, {
          purse: team.purse ?? tournamentData.defaultPurse ?? 1000000,
          spent: 0,
          roster: [],
        });
      });
      batch.update(doc(db, "tournaments", id), { auctionState: "READY" });
      
      const auctionStateRef = doc(db, "tournaments", id, "auction", "state");
      batch.set(auctionStateRef, {
        status: "READY",
        currentPlayerId: null,
        currentBid: 0,
        currentBidderId: null,
        lastUpdate: Date.now(),
      });

      await batch.commit();
      alert("Auction Initialized! You can now enter the console.");
      window.location.reload();
    } catch (e) {
      console.error("Initialization failed", e);
      alert("Failed to initialize auction: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0F1115] text-teal-500 animate-pulse font-bold tracking-widest text-lg">
        LOADING...
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0F1115] text-slate-200 font-sans pb-20">
      
      {/* HERO SECTION */}
      <div className="relative bg-[#161920] border-b border-white/5 pt-10 pb-12 px-4 overflow-hidden shadow-2xl">
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          
          {/* TITLE & INFO */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isOwner && <span className="bg-red-900/30 text-red-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-red-500/30 uppercase tracking-widest">Admin Access</span>}
              {canEdit && !isOwner && <span className="bg-indigo-900/30 text-indigo-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-indigo-500/30 uppercase tracking-widest">Scorer Access</span>}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-100 uppercase tracking-tighter italic leading-none">
              {tournamentData?.name}
            </h1>
            <div className="text-sm font-bold text-slate-500 mt-3 flex items-center gap-3 uppercase tracking-wide">
              <span>{tournamentTeams.length} Teams</span>
              <span className="w-1.5 h-1.5 bg-slate-700 rounded-full"></span>
              <span>{matches.length} Matches</span>
            </div>
          </div>

          {/* ACTIONS AREA - RESTRUCTURED FOR UX */}
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            
            {/* ROW 1: PRIMARY ACTION BUTTONS (Public & Admin) */}
            <div className="flex flex-wrap gap-3 justify-end w-full">
              
              {/* 1. Public Live Button */}
              <LiveActionButton
                liveMatches={matches}
                broadcastUrl={streamUrl} // Using state variable
                isAuctionLive={tournamentData?.auctionState === "ACTIVE"}
                navigate={navigate}
                tournamentId={id}
              />

              {/* 2. Admin 'Enter Console' Button (Only if authorized) */}
              {canEdit && isAuctionEnabled && auctionInitialized && (
                <button
                  onClick={() => navigate(`/tournaments/${id}/auction`)}
                  className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  <span className="text-lg">⚙️</span>
                  <span>Enter Console</span>
                </button>
              )}
            </div>

            {/* ROW 2: ADMIN MANAGEMENT TOOLS (Grouped visually) */}
            {canEdit && (
              <div className="flex flex-wrap gap-2 justify-end p-2 bg-black/20 rounded-xl border border-white/5 backdrop-blur-sm">
                
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <span>{showScheduler ? "✕" : "➕"}</span> {showScheduler ? "Close" : "Schedule"}
                </button>

                {isAuctionEnabled ? (
                  <>
                    {!auctionInitialized && (
                      <button
                        onClick={handleInitializeAuction}
                        className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                      >
                        <span>🚀</span> Init Auction
                      </button>
                    )}
                    <button
                      onClick={toggleAuctionMode}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
                    >
                      Disable Auction
                    </button>
                  </>
                ) : (
                  <button
                    onClick={toggleAuctionMode}
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
                  >
                    Enable Auction
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* SCHEDULER SECTION */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-30 animate-in fade-in slide-in-from-top-4 duration-500">
        {showScheduler && (
          <div className="bg-[#1C2128] border border-white/10 rounded-[2rem] shadow-2xl p-2 mb-8">
            <MatchScheduler
              tournamentId={id}
              teams={tournamentTeams}
              onCancel={() => setShowScheduler(false)}
            />
          </div>
        )}
      </div>

      {/* TABS CONTAINER */}
      <div className={`max-w-7xl mx-auto px-4 relative z-20 ${showScheduler ? "mt-0" : "-mt-6"}`}>
        <TournamentTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tournamentId={id}
          tournament={tournamentData}
          tournamentName={tournamentName}
          tournamentTeams={tournamentTeams}
          matches={matches}
          canEdit={canEdit}
          isOwner={isOwner}
          isAuctionEnabled={isAuctionEnabled}
        />
      </div>
    </div>
  );
}