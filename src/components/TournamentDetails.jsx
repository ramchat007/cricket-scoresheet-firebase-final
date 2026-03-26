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
import MatchCorrectionModal from "./MatchCorrectionModal";

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
          className="flex items-center gap-2 md:gap-3 bg-[#FF0000] hover:bg-red-700 text-white pl-3 pr-4 py-2 md:pl-4 md:pr-6 md:py-3 rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm animate-pulse transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/50 uppercase tracking-widest group">
          <Tv
            size={18}
            className="md:w-5 md:h-5 group-hover:scale-110 transition-transform"
          />
          <div className="flex flex-col leading-none text-left">
            <span>YouTube Live</span>
            {currentMatch && (
              <span className="text-[8px] md:text-[9px] opacity-80 normal-case tracking-normal font-medium mt-0.5">
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
          className="flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-3 py-2 md:px-5 md:py-3 rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm shadow-lg shadow-orange-900/40 border-b-[3px] md:border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 uppercase tracking-widest transition-all">
          <Gavel size={16} className="md:w-[18px] md:h-[18px]" />
          <span>Auction Live</span>
        </button>
      )}
    </>
  );
};

export default function TournamentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 🟢 Extract theme properties natively
  const { theme } = useTheme();

  // Safe Fallbacks
  const cardBg =
    theme?.card ||
    "bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl";
  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const accentText = theme?.accentText || "text-cyan-400";

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

  const [selectedMatchForCorrection, setSelectedMatchForCorrection] =
    useState(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

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
        className={`flex justify-center items-center min-h-screen animate-pulse font-bold tracking-widest text-lg bg-transparent ${textMain}`}>
        LOADING...
      </div>
    );
  }

  return (
    <div
      className={`w-full min-h-screen pb-20 font-sans transition-colors duration-300 bg-transparent ${textMain}`}>
      {/* 🟢 HERO SECTION - Uses the dynamic theme card style */}
      <div
        className={`relative pt-6 pb-8 md:pt-10 md:pb-12 px-3 md:px-4 overflow-hidden shadow-sm border-x-0 border-t-0 rounded-none ${cardBg}`}>
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-6">
          {/* TITLE & INFO */}
          <div className="flex-1">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
              {isOwner && (
                <span
                  className={`text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded md:rounded-md border uppercase tracking-widest bg-red-500/10 text-red-500 border-red-500/20`}>
                  Admin Access
                </span>
              )}
              {canEdit && !isOwner && (
                <span
                  className={`text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded md:rounded-md border uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border-indigo-500/20`}>
                  Scorer Access
                </span>
              )}
            </div>

            {/* TIGHTER TITLE FOR MOBILE */}
            <h1
              className={`text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none ${textMain}`}>
              {tournamentData?.name}
            </h1>

            <div
              className={`text-xs md:text-sm font-bold mt-2 md:mt-3 flex flex-wrap items-center gap-2 md:gap-3 uppercase tracking-wide ${textSub}`}>
              <span className="flex items-center gap-1">
                <Shield size={14} className="md:w-4 md:h-4" />{" "}
                {tournamentTeams.length} Teams
              </span>
              <span className="hidden sm:block w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-current opacity-30"></span>
              <span className="flex items-center gap-1">
                <Trophy size={14} className="md:w-4 md:h-4" /> {matches.length}{" "}
                Matches
              </span>
              <span className="hidden sm:block w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-current opacity-30"></span>

              {/* 🟢 DYNAMIC PLAYER BUTTON */}
              <button
                onClick={() => {
                  if (uniqueTeamPlayersCount === 0) {
                    navigate(`/view-players/${id}`);
                  } else {
                    setActiveTab("players");
                    window.scrollTo({ top: 500, behavior: "smooth" });
                  }
                }}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  uniqueTeamPlayersCount === 0 && !(canEdit || isOwner)
                    ? "pointer-events-none opacity-80"
                    : `hover:${accentText}`
                }`}
                title={
                  uniqueTeamPlayersCount === 0
                    ? canEdit || isOwner
                      ? "Manage Registered Players"
                      : "Players Registered"
                    : "View Player Stats"
                }>
                <Users size={14} className="md:w-4 md:h-4" />{" "}
                {displayPlayerCount} Players
              </button>
            </div>
          </div>

          {/* ACTIONS AREA */}
          <div className="flex flex-col items-start md:items-end gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
            {/* ROW 1: PRIMARY ACTION BUTTONS */}
            <div className="flex flex-wrap gap-2 md:gap-3 justify-start md:justify-end w-full">
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
                  className={`bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-emerald-600"} hover:opacity-90 text-white font-bold px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl shadow-lg flex items-center gap-1.5 md:gap-2 transition-all active:scale-95 text-[10px] md:text-xs uppercase tracking-widest`}>
                  <Settings size={14} className="md:w-[18px] md:h-[18px]" />
                  <span>Enter Console</span>
                </button>
              )}
            </div>

            {/* ROW 2: ADMIN MANAGEMENT TOOLS */}
            {canEdit && (
              <div
                className={`flex flex-wrap gap-1.5 md:gap-2 justify-start md:justify-end p-1.5 md:p-2 rounded-lg md:rounded-xl border bg-black/10 border-current/10 backdrop-blur-sm`}>
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 md:gap-2 border bg-current/5 border-current/10 hover:bg-current/10 text-inherit`}>
                  {showScheduler ? (
                    <X size={12} className="md:w-3.5 md:h-3.5" />
                  ) : (
                    <CalendarPlus size={12} className="md:w-3.5 md:h-3.5" />
                  )}
                  {showScheduler ? "Close" : "Schedule"}
                </button>

                <button
                  onClick={() => navigate(`/tournaments/${id}/bracket`)}
                  className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 md:gap-2 border bg-purple-500/10 border-purple-500/20 text-purple-500 hover:bg-purple-500/20`}>
                  <Shield size={12} className="md:w-3.5 md:h-3.5" /> Bracket
                  Editor
                </button>

                {isAuctionEnabled ? (
                  <>
                    {!auctionInitialized && (
                      <button
                        onClick={handleInitializeAuction}
                        className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 md:gap-2 border bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500 hover:bg-fuchsia-500/20`}>
                        <Rocket size={12} className="md:w-3.5 md:h-3.5" /> Init
                        Auction
                      </button>
                    )}
                    <button
                      onClick={toggleAuctionMode}
                      className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 md:gap-2 border bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20`}>
                      <Lock size={12} className="md:w-3.5 md:h-3.5" /> Disable
                      Auction
                    </button>
                  </>
                ) : (
                  <button
                    onClick={toggleAuctionMode}
                    className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 md:gap-2 border bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20`}>
                    <Unlock size={12} className="md:w-3.5 md:h-3.5" /> Enable
                    Auction
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟢 SCHEDULER SECTION */}
      <div className="max-w-7xl mx-auto px-2 md:px-4 -mt-4 md:-mt-8 relative z-30 animate-in fade-in slide-in-from-top-4 duration-500">
        {showScheduler && (
          <div
            className={`rounded-[1.5rem] md:rounded-[2rem] shadow-2xl p-1 md:p-2 mb-4 md:mb-8 ${cardBg}`}>
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
        className={`max-w-7xl mx-auto px-2 md:px-4 relative z-20 ${showScheduler ? "mt-0" : "-mt-3 md:-mt-6"}`}>
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
          onOpenCorrection={(matchObj) => {
            setSelectedMatchForCorrection(matchObj);
            setShowCorrectionModal(true);
          }}
        />
      </div>
      {showCorrectionModal && selectedMatchForCorrection && (
        <MatchCorrectionModal
          match={selectedMatchForCorrection}
          tournamentId={id}
          onClose={() => {
            setShowCorrectionModal(false);
            setSelectedMatchForCorrection(null);
          }}
        />
      )}
    </div>
  );
}
