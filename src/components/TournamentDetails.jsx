import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import {
  Tv,
  Gavel,
  Settings,
  Plus,
  X,
  Rocket,
  Shield,
  Lock,
  Unlock,
  CalendarPlus,
  Users,
  Trophy,
} from "lucide-react";

import TournamentTabs from "./TournamentTabs";
import MatchScheduler from "./MatchScheduler";

// --- 🔴 SMART LIVE BUTTON COMPONENT ---
const LiveActionButton = ({
  liveMatches = [],
  broadcastUrl,
  isAuctionLive,
  navigate,
  tournamentId,
}) => {
  const currentMatch = liveMatches.find(
    (m) =>
      (m.status || "").toLowerCase() === "in-progress" ||
      (m.status || "").toLowerCase() === "live",
  );

  return (
    <>
      {/* ✅ CHECK 1: If YouTube URL exists -> Show "YouTube Live" */}
      {broadcastUrl && (
        <a
          href={broadcastUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-[#FF0000] hover:bg-red-700 text-white pl-4 pr-6 py-3 rounded-xl font-bold text-xs md:text-sm animate-pulse transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/50 uppercase tracking-widest group">
          <Tv
            size={20}
            className="group-hover:scale-110 transition-transform"
          />
          <div className="flex flex-col leading-none text-left">
            <span>YouTube Live</span>
            {currentMatch && (
              <span className="text-[9px] opacity-80 normal-case tracking-normal font-medium">
                {currentMatch.teamA} vs {currentMatch.teamB}
              </span>
            )}
          </div>
        </a>
      )}

      {/* ✅ CHECK 2: If Auction is Initialized -> Show "Auction Live" */}
      {isAuctionLive && (
        <button
          onClick={() => navigate(`/tournaments/${tournamentId}/auction/live`)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-5 py-3 rounded-xl font-bold text-xs md:text-sm shadow-lg shadow-orange-900/40 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 uppercase tracking-widest transition-all">
          <Gavel size={18} />
          <span>Auction Live</span>
        </button>
      )}
    </>
  );
};

export default function TournamentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme, lightMode } = useTheme();

  const auth = useAuth();
  const user = auth?.user || null;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("matches");

  const [tournamentData, setTournamentData] = useState(null);
  const [tournamentTeams, setTournamentTeams] = useState([]);
  const [tournamentName, setTournamentName] = useState("");
  const [matches, setMatches] = useState([]);
  const [playerCount, setPlayerCount] = useState(0);

  const [streamUrl, setStreamUrl] = useState("");

  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  /* --------------------------------------------
     Load Registered Player Count (Global Registrations)
     --------------------------------------------- */
  useEffect(() => {
    if (!id) return;

    const fetchPlayerCount = async () => {
      try {
        const playersRef = collection(db, "players");
        const q = query(
          playersRef,
          where("registeredTournaments", "array-contains", id),
        );
        const snapshot = await getCountFromServer(q);
        setPlayerCount(snapshot.data().count);
      } catch (error) {
        console.error("Error loading player count:", error);
      }
    };

    fetchPlayerCount();
  }, [id]);

  /* --------------------------------------------
     Load tournament + permissions
     --------------------------------------------- */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const ref = doc(db, "tournaments", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          navigate("/404");
          return;
        }

        const data = snap.data();
        setTournamentData(data);
        setTournamentName(data.name);
        setStreamUrl(data.liveStreamUrl);

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
      orderBy("matchNo", "asc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(liveData);
      },
      (error) => console.error("Error listening to matches:", error),
    );
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
    if (
      !window.confirm(
        "Initialize Auction? This will reset purses, empty rosters, and create the console.",
      )
    )
      return;

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

  // 🟢 NEW: Calculate Total Unique Players across all teams
  const uniqueTeamPlayersCount = useMemo(() => {
    const playersSet = new Set();
    tournamentTeams.forEach((team) => {
      if (team.roster && Array.isArray(team.roster)) {
        team.roster.forEach((p) =>
          playersSet.add(p.originalId || p.id || p.name),
        );
      } else if (team.players && Array.isArray(team.players)) {
        team.players.forEach((name) => playersSet.add(name));
      }
    });
    return playersSet.size;
  }, [tournamentTeams]);

  // 🟢 SMART COUNT: Use the highest value between Global Registrations and Local Team Rosters
  const displayPlayerCount = Math.max(playerCount, uniqueTeamPlayersCount);

  if (loading) {
    return (
      <div
        className={`flex justify-center items-center min-h-screen animate-pulse font-bold tracking-widest text-lg ${theme.bg} ${theme.text}`}>
        LOADING...
      </div>
    );
  }

  return (
    <div
      className={`w-full min-h-screen pb-20 font-sans transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      {/* HERO SECTION */}
      <div
        className={`relative border-b pt-10 pb-12 px-4 overflow-hidden shadow-2xl ${
          lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"
        }`}>
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          {/* TITLE & INFO */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isOwner && (
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${
                    lightMode
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-red-900/30 text-red-400 border-red-500/30"
                  }`}>
                  Admin Access
                </span>
              )}
              {canEdit && !isOwner && (
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${
                    lightMode
                      ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                      : "bg-indigo-900/30 text-indigo-400 border-indigo-500/30"
                  }`}>
                  Scorer Access
                </span>
              )}
            </div>
            <h1
              className={`text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none ${theme.text}`}>
              {tournamentData?.name}
            </h1>
            <div
              className={`text-sm font-bold mt-3 flex flex-wrap items-center gap-3 uppercase tracking-wide ${theme.sub}`}>
              <span className="flex items-center gap-1">
                <Shield size={16} /> {tournamentTeams.length} Teams
              </span>
              <span
                className={`hidden sm:block w-1.5 h-1.5 rounded-full ${lightMode ? "bg-gray-300" : "bg-slate-700"}`}></span>
              <span className="flex items-center gap-1">
                <Trophy size={16} /> {matches.length} Matches
              </span>
              <span
                className={`hidden sm:block w-1.5 h-1.5 rounded-full ${lightMode ? "bg-gray-300" : "bg-slate-700"}`}></span>

              {/* 🟢 DYNAMIC PLAYER BUTTON: Registration List (Pre-Auction) vs Stats (Post-Auction) */}
              <button
                onClick={() => {
                  if (uniqueTeamPlayersCount === 0) {
                    // Pre-Auction: No teams formed yet -> Go to registration list
                    navigate(`/view-players/${id}`);
                  } else {
                    // Post-Auction: Teams exist -> Go to the stats tab
                    setActiveTab("stats"); 
                    window.scrollTo({ top: 500, behavior: 'smooth' });
                  }
                }}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  uniqueTeamPlayersCount === 0 && !(canEdit || isOwner) 
                    ? "pointer-events-none opacity-80" // Lock registration list for public
                    : "hover:text-teal-500"            // Unlock stats for everyone
                }`}
                title={
                  uniqueTeamPlayersCount === 0 
                    ? (canEdit || isOwner ? "Manage Registered Players" : "Players Registered")
                    : "View Player Stats"
                }>
                <Users size={16} /> {displayPlayerCount} Players
              </button>
            </div>
          </div>

          {/* ACTIONS AREA */}
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            {/* ROW 1: PRIMARY ACTION BUTTONS */}
            <div className="flex flex-wrap gap-3 justify-end w-full">
              <LiveActionButton
                liveMatches={matches}
                broadcastUrl={streamUrl}
                isAuctionLive={isAuctionEnabled && auctionInitialized}
                navigate={navigate}
                tournamentId={id}
              />

              {canEdit && isAuctionEnabled && auctionInitialized && (
                <button
                  onClick={() => navigate(`/tournaments/${id}/auction`)}
                  className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest">
                  <Settings size={18} />
                  <span>Enter Console</span>
                </button>
              )}
            </div>

            {/* ROW 2: ADMIN MANAGEMENT TOOLS */}
            {canEdit && (
              <div
                className={`flex flex-wrap gap-2 justify-end p-2 rounded-xl border backdrop-blur-sm ${
                  lightMode
                    ? "bg-gray-100 border-gray-200"
                    : "bg-black/20 border-white/5"
                }`}>
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  className={`px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border ${
                    lightMode
                      ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}>
                  {showScheduler ? <X size={14} /> : <CalendarPlus size={14} />}
                  {showScheduler ? "Close" : "Schedule"}
                </button>

                {isAuctionEnabled ? (
                  <>
                    {!auctionInitialized && (
                      <button
                        onClick={handleInitializeAuction}
                        className={`px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border ${
                          lightMode
                            ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                            : "bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/40"
                        }`}>
                        <Rocket size={14} /> Init Auction
                      </button>
                    )}
                    <button
                      onClick={toggleAuctionMode}
                      className={`px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2 ${
                        lightMode
                          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                          : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                      }`}>
                      <Lock size={14} /> Disable Auction
                    </button>
                  </>
                ) : (
                  <button
                    onClick={toggleAuctionMode}
                    className={`px-4 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2 ${
                      lightMode
                        ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                    }`}>
                    <Unlock size={14} /> Enable Auction
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
          <div
            className={`border rounded-[2rem] shadow-2xl p-2 mb-8 ${
              lightMode
                ? "bg-white border-gray-200"
                : "bg-[#1C2128] border-white/10"
            }`}>
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
        className={`max-w-7xl mx-auto px-4 relative z-20 ${showScheduler ? "mt-0" : "-mt-6"}`}>
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
