import React, { useEffect, useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { supabase } from "../../utils/supabase"; // 🟢 Added Supabase Import
import PlayerAvatar from "../PlayerAvatar";

export default function TournamentBanner({ tournamentId }) {
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // --- 1. DUAL DATA FETCHING ---
  useEffect(() => {
    if (!tournamentId) return;

    const fetchBroadcastData = async () => {
      try {
        // A. Fetch Tournament Meta (Just once, no listener needed for banners)
        const tSnap = await getDoc(doc(db, "tournaments", tournamentId));
        if (tSnap.exists()) {
          setTournament(tSnap.data());
        }

        // B. Fetch Teams, Logos, and Rosters from Supabase
        const { data: sbTeams, error } = await supabase
          .from("teams")
          .select("*")
          .eq("tournament_id", tournamentId);

        if (error) throw error;

        if (sbTeams) {
          setTeams(sbTeams);
        }
      } catch (err) {
        console.error("Error fetching broadcast data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBroadcastData();
  }, [tournamentId]);

  // --- 🔥 2. PRELOAD ENGINE: CACHE ALL IMAGES IN BACKGROUND 🔥 ---
  useEffect(() => {
    if (teams.length === 0) return;

    const urlsToPreload = new Set();

    teams.forEach((team) => {
      // Team Logo
      if (team.logo) urlsToPreload.add(team.logo);

      // Player Photos
      if (team.roster) {
        team.roster.forEach((p) => {
          if (p.photoUrl) urlsToPreload.add(p.photoUrl);
        });
      }
    });

    urlsToPreload.forEach((url) => {
      const img = new Image();
      img.src = url;
    });

    console.log(
      `🚀 Preloaded ${urlsToPreload.size} broadcast assets from Supabase to memory.`,
    );
  }, [teams]);

  // --- 3. TRANSITION TIMER ---
  useEffect(() => {
    if (teams.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % teams.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [teams.length]);

  // --- 4. ROSTER COMPILATION ---
  const activeTeam = teams[currentIndex];

  const displayList = useMemo(() => {
    if (!activeTeam) return [];
    const rawRoster = activeTeam.roster || [];
    const ownerName = activeTeam.owner;

    let ownerObj = null;
    let playingRoster = [];

    if (ownerName) {
      const ownerInRoster = rawRoster.find(
        (p) =>
          p.name &&
          p.name.trim().toLowerCase() === ownerName.trim().toLowerCase(),
      );

      if (ownerInRoster) {
        ownerObj = { ...ownerInRoster, role: "TEAM OWNER", isOwner: true };
        playingRoster = rawRoster.filter(
          (p) => p.name.trim().toLowerCase() !== ownerName.trim().toLowerCase(),
        );
      } else {
        ownerObj = {
          id: `owner_${activeTeam.id}`,
          name: ownerName,
          role: "TEAM OWNER",
          isOwner: true,
        };
        playingRoster = [...rawRoster];
      }
    } else {
      playingRoster = [...rawRoster];
    }

    playingRoster.sort((a, b) => (b.isIcon ? 1 : 0) - (a.isIcon ? 1 : 0));
    const finalList = [];
    if (ownerObj) finalList.push(ownerObj);
    const slotsRemaining = 10 - finalList.length;
    finalList.push(...playingRoster.slice(0, slotsRemaining));

    return finalList;
  }, [activeTeam]);

  // Styling Helpers
  const activeColor = activeTeam?.color || "#00b4d8";
  const getTeamLogo = (t) =>
    t?.logo || "https://cdn-icons-png.flaticon.com/512/164/164449.png";
  const tournamentLogo =
    tournament?.logoUrl ||
    tournament?.logo ||
    "https://placehold.co/400x400/00b4d8/ffffff?text=CUP";

  if (loading || !tournament || teams.length === 0) {
    return (
      <div className="absolute inset-0 w-[1920px] h-[1080px] bg-[#0b0f19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-teal-500 border-white/10 rounded-full animate-spin"></div>
          <span className="text-white font-black tracking-widest uppercase opacity-50">
            Fetching Supabase Assets...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-[1920px] h-[1080px] bg-[#070a12] text-white overflow-hidden font-sans flex flex-col z-[500]">
      {/* 🌌 BACKGROUND SYSTEM */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 transition-colors duration-1000"
          style={{ backgroundColor: `${activeColor}10` }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>

        <div
          key={`glow-t-${activeTeam?.id}`}
          className="absolute inset-0 opacity-30 transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${activeColor} 0%, transparent 60%)`,
          }}></div>
        <div
          key={`glow-b-${activeTeam?.id}`}
          className="absolute inset-0 opacity-20 transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 100%, ${activeColor} 0%, transparent 50%)`,
          }}></div>
      </div>

      {/* 🏷️ HEADER SECTION */}
      <div className="z-20 h-[140px] flex items-center justify-between px-20 border-b border-white/5 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-8">
          <img
            src={tournamentLogo}
            className="h-20 w-20 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
            alt=""
          />
          <div className="flex flex-col">
            <h2 className="text-3xl font-black uppercase tracking-widest text-white">
              {tournament.name}
            </h2>
            <span
              className="font-bold tracking-[0.5em] text-sm uppercase opacity-80"
              style={{ color: activeColor }}>
              Squad Showcase
            </span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-black opacity-10">
            {currentIndex + 1}
          </span>
          <span className="text-xl font-bold opacity-10">/ {teams.length}</span>
        </div>
      </div>

      {/* 🏆 TEAM IDENTITY SECTION */}
      <div
        key={`identity-${activeTeam?.id}`}
        className="z-20 flex flex-col items-center pt-8 pb-4 animate-slide-in">
        <div
          className="w-28 h-28 bg-white rounded-full p-1.5 border-4 shadow-2xl mb-4 transition-all duration-1000"
          style={{
            borderColor: activeColor,
            boxShadow: `0 0 40px ${activeColor}44`,
          }}>
          <img
            src={getTeamLogo(activeTeam)}
            className="w-full h-full object-contain rounded-full"
            alt=""
          />
        </div>
        <h1 className="text-7xl font-black uppercase tracking-tighter text-white drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)]">
          {activeTeam?.name}
        </h1>
      </div>

      {/* 👥 PLAYER GRID SYSTEM */}
      <div className="z-10 flex-1 flex items-center justify-center pb-16">
        <div className="w-[1280px] grid grid-cols-5 gap-6">
          {displayList.map((person, idx) => (
            <div
              key={`${activeTeam.id}-${person.id || idx}`}
              className="relative bg-[#0f141f]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col group animate-fade-in"
              style={{ animationDelay: `${idx * 40}ms` }}>
              <div
                className="absolute top-0 left-0 right-0 h-1.5 z-20"
                style={{
                  backgroundColor: person.isOwner ? "#fbbf24" : activeColor,
                }}></div>

              <div className="w-full aspect-square bg-slate-950 overflow-hidden relative">
                {/* Notice: We map 'person.photoUrl' down so PlayerAvatar knows where to look */}
                <PlayerAvatar
                  player={{ ...person, photoUrl: person.photoUrl }}
                  playerId={person.id || person.originalId}
                  tournamentId={tournamentId}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {person.isIcon && (
                  <div
                    className="absolute top-3 right-3 text-3xl animate-pulse z-10"
                    style={{ color: activeColor }}>
                    ★
                  </div>
                )}
              </div>

              <div
                className="p-4 text-center border-t border-white/5"
                style={{
                  background: `linear-gradient(to bottom, ${activeColor}08, transparent)`,
                }}>
                <div
                  className={`text-lg font-black uppercase truncate leading-tight ${person.isOwner ? "text-amber-400" : "text-white"}`}>
                  {person.name}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-1">
                  {person.role || "Squad"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ⏱️ FOOTER PROGRESS */}
      <div className="z-20 absolute bottom-0 left-0 w-full h-2 bg-white/5">
        <div
          key={`timer-${currentIndex}`}
          className="h-full animate-progress origin-left"
          style={{
            backgroundColor: activeColor,
            boxShadow: `0 0 15px ${activeColor}`,
          }}></div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes progressBar {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-slide-in { animation: slideIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-progress { animation: progressBar 4s linear forwards; }
      `}</style>
    </div>
  );
}
