import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";

import TournamentTabs from "../components/TournamentTabs";
import MatchScheduler from "../components/MatchScheduler";

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
  const auctionInitialized = tournamentTeams.some(
    (t) => Array.isArray(t.roster) && t.roster.length > 0
  );

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
      ? "Initialize Auction? This will reset purses and empty rosters."
      : "Generate Fixtures? This will create round-robin matches for all teams.";

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);
      if (isAuctionEnabled) {
        tournamentTeams.forEach((team) => {
          const ref = doc(db, "tournaments", id, "teams", team.id);
          batch.update(ref, {
            purse: team.purse ?? tournamentData.defaultPurse ?? 1000000,
            spent: 0,
            roster: [],
          });
        });
        batch.update(doc(db, "tournaments", id), {
          auctionState: "READY",
        });
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
      }
      await batch.commit();
      window.location.reload();
    } catch (e) {
      console.error("Initialization failed", e);
      alert("Failed to initialize tournament");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0f172a] text-cyan-500 animate-pulse font-bold tracking-widest text-lg">
        LOADING...
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0f172a] text-gray-200 font-sans pb-20">
      {/* HERO SECTION */}
      <div className="relative bg-gradient-to-br from-gray-900 via-[#1e293b] to-gray-900 border-b border-gray-800 pt-8 pb-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isOwner && (
                <span className="bg-red-900/50 text-red-300 text-[10px] px-2 py-0.5 rounded border border-red-800">
                  ADMIN ACCESS
                </span>
              )}
              {canEdit && !isOwner && (
                <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-0.5 rounded border border-blue-800">
                  SCORER ACCESS
                </span>
              )}
            </div>
            <h1 className="text-3xl font-black text-white">
              {tournamentData?.name}
            </h1>
            <div className="text-sm text-gray-500 mt-2">
              {tournamentTeams.length} Teams · {matches.length} Matches
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-3">
              {/* 1. ADD MATCH BUTTON (Always Visible) */}
              <button
                onClick={() => setShowScheduler(!showScheduler)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
                <span>➕</span> {showScheduler ? "Hide Scheduler" : "Add Match"}
              </button>

              {/* 2. MODE SPECIFIC ACTIONS */}
              {isAuctionEnabled ? (
                <>
                  {!auctionInitialized ? (
                    <button
                      onClick={handleInitializeTournament}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
                      <span>🔨</span> Initialize Auction
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/tournaments/${id}/auction`)}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
                      <span>🔨</span> Enter Console
                    </button>
                  )}
                  <button
                    onClick={toggleAuctionMode}
                    className="bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50 font-bold px-4 py-3 rounded-xl transition-all text-xs">
                    Disable Auction
                  </button>
                </>
              ) : (
                <>
                  {/* Show "Create Fixtures" only if no matches exist yet */}
                  {matches.length === 0 && (
                    <button
                      onClick={handleInitializeTournament}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
                      <span>📅</span> Create Fixtures
                    </button>
                  )}

                  <button
                    onClick={toggleAuctionMode}
                    className="bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 font-bold px-4 py-3 rounded-xl transition-all text-xs flex items-center gap-2">
                    <span>⚙️</span> Enable Auction
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SCHEDULER SECTION */}
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-30">
        {showScheduler && (
          <MatchScheduler
            tournamentId={id}
            teams={tournamentTeams}
            onCancel={() => setShowScheduler(false)}
          />
        )}
      </div>

      {/* TABS CONTAINER */}
      <div
        className={`max-w-7xl mx-auto px-4 relative z-20 ${
          showScheduler ? "mt-4" : "-mt-12"
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
