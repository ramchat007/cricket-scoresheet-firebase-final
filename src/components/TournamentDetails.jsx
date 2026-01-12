import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  setDoc, // ✅ Added setDoc for auction init
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
      Load matches
    --------------------------------------------- */
  useEffect(() => {
    if (!id) return;
    const loadMatches = async () => {
      try {
        const snap = await getDocs(
          collection(db, "tournaments", id, "matches")
        );
        setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error loading matches:", error);
      }
    };
    loadMatches();
  }, [id]);

  /* --------------------------------------------
      Toggle Auction Mode
    --------------------------------------------- */
  const isAuctionEnabled = !!tournamentData?.isAuction;

  // ✅ Fixed Logic: Check explicit state OR if rosters have players
  const auctionInitialized =
    tournamentData?.auctionState === "READY" ||
    tournamentData?.auctionState === "ACTIVE" ||
    tournamentTeams.some((t) => Array.isArray(t.roster) && t.roster.length > 0);

  const toggleAuctionMode = async () => {
    if (!canEdit) return;
    const newStatus = !isAuctionEnabled;
    const action = newStatus ? "ENABLE" : "DISABLE";

    if (!window.confirm(`Are you sure you want to ${action} Auction Mode?`))
      return;

    try {
      const ref = doc(db, "tournaments", id);
      await updateDoc(ref, { isAuction: newStatus });
      setTournamentData((prev) => ({ ...prev, isAuction: newStatus }));
    } catch (e) {
      console.error(e);
      alert("Failed to update tournament mode.");
    }
  };

  const handleInitializeTournament = async () => {
    if (!canEdit) return;
    const confirmMsg = isAuctionEnabled
      ? "Initialize Auction? This will reset purses, empty rosters, and create the console."
      : "Generate Fixtures? This will create round-robin matches for all teams.";

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);
      if (isAuctionEnabled) {
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

        // 3. ✅ CRITICAL: Create the Auction Console State Document
        const auctionStateRef = doc(db, "tournaments", id, "auction", "state");
        // Use set() instead of update() to ensure creation
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
      } else {
        if (tournamentTeams.length < 2) {
          alert("Need at least 2 teams to generate fixtures.");
          return;
        }
        let counter = 1;
        for (let i = 0; i < tournamentTeams.length; i++) {
          for (let j = i + 1; j < tournamentTeams.length; j++) {
            const matchRef = doc(collection(db, "tournaments", id, "matches"));
            batch.set(matchRef, {
              matchNo: counter++,
              teamA: tournamentTeams[i].name,
              teamB: tournamentTeams[j].name,
              status: "upcoming",
              createdAt: Date.now(),
            });
          }
        }
        await batch.commit();
        window.location.reload();
      }
    } catch (e) {
      console.error("Initialization failed", e);
      alert("Failed to initialize tournament: " + e.message);
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

          {canEdit && (
            <div className="flex flex-wrap gap-3">
              {/* 1. ADD MATCH BUTTON (Always Visible) */}
              <button
                onClick={() => setShowScheduler(!showScheduler)}
                className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest">
                <span>{showScheduler ? "✕" : "➕"}</span>{" "}
                {showScheduler ? "Hide Scheduler" : "Add Match"}
              </button>

              {/* 2. MODE SPECIFIC ACTIONS */}
              {isAuctionEnabled ? (
                <>
                  {!auctionInitialized ? (
                    <button
                      onClick={handleInitializeTournament}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest">
                      <span>🔨</span> Init Auction
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/tournaments/${id}/auction`)}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-orange-900/40 flex items-center gap-2 transition-all border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 text-xs uppercase tracking-widest">
                      <span>🔨</span> Enter Auction Console
                    </button>
                  )}

                  <button
                    onClick={toggleAuctionMode}
                    className="bg-red-900/10 text-red-500 border border-red-500/20 hover:bg-red-900/20 font-bold px-4 py-3 rounded-xl transition-all text-xs uppercase tracking-widest">
                    Disable Auction
                  </button>
                </>
              ) : (
                <>
                  {matches.length === 0 && (
                    <button
                      onClick={handleInitializeTournament}
                      className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-teal-900/20 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest">
                      <span>📅</span> Auto Fixtures
                    </button>
                  )}

                  <button
                    onClick={toggleAuctionMode}
                    className="bg-[#0F1115] text-slate-400 border border-white/10 hover:border-white/20 hover:text-white font-bold px-4 py-3 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center gap-2">
                    <span>⚙️</span> Enable Auction Mode
                  </button>
                </>
              )}
            </div>
          )}
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
          tournamentData={tournamentData}
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
