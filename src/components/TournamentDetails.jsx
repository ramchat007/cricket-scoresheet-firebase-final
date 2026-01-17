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
  onSnapshot, // ✅ Import onSnapshot for real-time updates
  query, // ✅ Import query
  orderBy, // ✅ Import orderBy
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";

import TournamentTabs from "./TournamentTabs";
import MatchScheduler from "./MatchScheduler";

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

        // 1. Load Tournament Data (Public Read)
        const ref = doc(db, "tournaments", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          navigate("/404");
          return;
        }

        const data = snap.data();
        setTournamentData(data);
        setTournamentName(data.name);

        // 2. Check Permissions (Only if Logged In)
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
          // Public User
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
      Load teams (One-time fetch is usually fine here)
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
      ✅ FIX: Load matches (REAL-TIME LISTENER)
     --------------------------------------------- */
  useEffect(() => {
    if (!id) return;

    // Use onSnapshot instead of getDocs so new matches appear instantly
    // Ordered by 'matchNo' so they stay consistent
    const q = query(
      collection(db, "tournaments", id, "matches"),
      orderBy("matchNo", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(liveData);
      },
      (error) => {
        console.error("Error listening to matches:", error);
      }
    );

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, [id]);

  /* --------------------------------------------
      Toggle Auction Mode
     --------------------------------------------- */
  const isAuctionEnabled = !!tournamentData?.isAuction;

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

      // Reset state to PENDING if disabling so we can re-init later
      if (newStatus === false) {
        updateData.auctionState = "PENDING";
      }

      await updateDoc(ref, updateData);

      // Update local state immediately
      setTournamentData((prev) => ({ ...prev, ...updateData }));
    } catch (e) {
      console.error(e);
      alert("Failed to update tournament mode.");
    }
  };

  const handleInitializeAuction = async () => {
    if (!canEdit) return;
    if (
      !window.confirm(
        "Initialize Auction? This will reset purses, empty rosters, and create the console."
      )
    )
      return;

    try {
      const batch = writeBatch(db);

      // 1. Reset Team Wallets
      tournamentTeams.forEach((team) => {
        const ref = doc(db, "tournaments", id, "teams", team.id);
        batch.update(ref, {
          purse: team.purse ?? tournamentData.defaultPurse ?? 1000000,
          spent: 0,
          roster: [],
        });
      });

      // 2. Set Tournament Level State
      batch.update(doc(db, "tournaments", id), {
        auctionState: "READY",
      });

      // 3. Create the Auction Console State Document
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
      <div className="relative bg-[#161920] border-b border-white/5 pt-10 pb-20 px-4 overflow-hidden shadow-2xl">
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {isOwner && (
                <span className="bg-red-900/30 text-red-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-red-500/30 uppercase tracking-widest">
                  Admin Access
                </span>
              )}
              {canEdit && !isOwner && (
                <span className="bg-indigo-900/30 text-indigo-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-indigo-500/30 uppercase tracking-widest">
                  Scorer Access
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-100 uppercase tracking-tighter italic">
              {tournamentData?.name}
            </h1>
            <div className="text-sm font-bold text-slate-500 mt-2 flex items-center gap-2 uppercase tracking-wide">
              <span>{tournamentTeams.length} Teams</span>
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span>{matches.length} Matches</span>
            </div>
          </div>

          {/* ACTIONS AREA */}
          <div className="flex flex-wrap gap-3">
            {/* 1. PUBLIC ACTION: WATCH LIVE */}
            {isAuctionEnabled && auctionInitialized && (
              <button
                onClick={() => navigate(`/tournaments/${id}/auction`)}
                className={`font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest ${
                  canEdit
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-orange-900/40 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                    : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-900/40 animate-pulse border border-red-500/50"
                }`}>
                <span>{canEdit ? "🔨" : "🔴"}</span>
                {canEdit ? "Enter Console" : "Watch Live"}
              </button>
            )}

            {/* 2. ADMIN ONLY ACTIONS */}
            {canEdit && (
              <>
                {/* SCHEDULER BUTTON */}
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest">
                  <span>{showScheduler ? "✕" : "➕"}</span>{" "}
                  {showScheduler ? "Hide Scheduler" : "Add Match / Schedule"}
                </button>

                {isAuctionEnabled ? (
                  <>
                    {!auctionInitialized && (
                      <button
                        onClick={handleInitializeAuction}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest">
                        <span>🔨</span> Init Auction
                      </button>
                    )}

                    <button
                      onClick={toggleAuctionMode}
                      className="bg-red-900/10 text-red-500 border border-red-500/20 hover:bg-red-900/20 font-bold px-4 py-3 rounded-xl transition-all text-xs uppercase tracking-widest">
                      Disable Auction
                    </button>
                  </>
                ) : (
                  <button
                    onClick={toggleAuctionMode}
                    className="bg-[#0F1115] text-slate-400 border border-white/10 hover:border-white/20 hover:text-white font-bold px-4 py-3 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center gap-2">
                    <span>⚙️</span> Enable Auction Mode
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* SCHEDULER SECTION */}
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-30 animate-in fade-in slide-in-from-top-4 duration-500">
        {showScheduler && (
          <div className="bg-[#1C2128] border border-white/10 rounded-[2rem] shadow-2xl p-2">
            <MatchScheduler
              tournamentId={id}
              teams={tournamentTeams}
              onCancel={() => setShowScheduler(false)}
            />
          </div>
        )}
      </div>

      {/* TABS CONTAINER */}
      <div
        className={`max-w-7xl mx-auto px-4 relative z-20 ${
          showScheduler ? "mt-8" : "-mt-10"
        }`}>
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
