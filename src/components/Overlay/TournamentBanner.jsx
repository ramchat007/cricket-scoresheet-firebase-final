import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";

export default function TournamentBanner() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // --- 1. FETCH DATA ---
  useEffect(() => {
    if (!tournamentId) return;

    // A. Tournament Info
    const unsubTournament = onSnapshot(
      doc(db, "tournaments", tournamentId),
      (docSnap) => {
        if (docSnap.exists()) setTournament(docSnap.data());
      },
    );

    // B. Teams Subcollection
    const teamsRef = collection(db, "tournaments", tournamentId, "teams");
    const unsubTeams = onSnapshot(teamsRef, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTeams(teamsData);
      setLoading(false);
    });

    return () => {
      unsubTournament();
      unsubTeams();
    };
  }, [tournamentId]);

  // --- 2. AUTO-ROTATE SLIDER ---
  useEffect(() => {
    if (teams.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % teams.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [teams.length]);

  // --- 3. DISPLAY LOGIC (FIXED DUPLICATES) ---
  const activeTeam = teams[currentIndex];

  const displayList = useMemo(() => {
    if (!activeTeam) return [];

    const rawRoster = activeTeam.roster || [];
    const ownerName = activeTeam.ownerName || activeTeam.owner;

    // Step 1: Separate the Owner from the Roster
    let ownerObj = null;
    let playingRoster = [];

    if (ownerName) {
      // Check if owner is actually in the roster
      const ownerInRoster = rawRoster.find(
        (p) =>
          p.name &&
          p.name.trim().toLowerCase() === ownerName.trim().toLowerCase(),
      );

      if (ownerInRoster) {
        // Use the roster data (so we get the photo!) but override role
        ownerObj = { ...ownerInRoster, role: "TEAM OWNER", isOwner: true };
        // Remove them from the general player pool
        playingRoster = rawRoster.filter(
          (p) => p.name.trim().toLowerCase() !== ownerName.trim().toLowerCase(),
        );
      } else {
        // Owner is not a player, create a manual card
        ownerObj = {
          name: ownerName,
          role: "TEAM OWNER",
          photo: null,
          isOwner: true,
        };
        playingRoster = [...rawRoster];
      }
    } else {
      playingRoster = [...rawRoster];
    }

    // Step 2: Sort the remaining players (Icons first)
    playingRoster.sort((a, b) => (b.isIcon ? 1 : 0) - (a.isIcon ? 1 : 0));

    // Step 3: Build Final List (Max 10)
    const finalList = [];

    // Add Owner First
    if (ownerObj) finalList.push(ownerObj);

    // Fill remaining slots
    const slotsRemaining = 10 - finalList.length;
    finalList.push(...playingRoster.slice(0, slotsRemaining));

    return finalList;
  }, [activeTeam]);

  // Helpers
  const getTeamLogo = (team) =>
    team?.logoUrl ||
    team?.logo ||
    team?.teamLogo ||
    "https://cdn-icons-png.flaticon.com/512/164/164449.png";
  const getPlayerPhoto = (p) =>
    p.photoURL ||
    p.photoUrl ||
    p.image ||
    "https://cdn-icons-png.flaticon.com/512/3076/3076134.png";
  const tournamentLogo =
    tournament?.logoUrl ||
    tournament?.logo ||
    "https://placehold.co/400x400/00b4d8/ffffff?text=CUP";

  if (loading)
    return (
      <div className="w-[1920px] h-[1080px] bg-black text-white flex items-center justify-center text-6xl font-black">
        LOADING DATA...
      </div>
    );
  if (!tournament || teams.length === 0)
    return (
      <div className="w-[1920px] h-[1080px] bg-black text-white flex items-center justify-center text-6xl font-black">
        WAITING FOR TEAMS...
      </div>
    );

  return (
    <div className="w-[1920px] h-[1080px] bg-[#0b0f19] text-white overflow-hidden font-sans relative flex flex-col selection:bg-none">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div
          key={activeTeam?.id}
          className="absolute inset-0 bg-gradient-to-br from-[#00b4d8]/20 via-[#0b0f19] to-black opacity-60 transition-colors duration-1000"></div>
      </div>

      {/* --- HEADER --- */}
      <div className="z-20 h-[160px] flex items-center justify-between px-16 border-b border-white/10 bg-gradient-to-b from-black/90 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <img
            src={tournamentLogo}
            className="h-24 w-24 object-contain drop-shadow-[0_0_15px_rgba(0,180,216,0.6)]"
            alt="Tourney"
          />
          <div className="flex flex-col justify-center">
            <h2 className="text-4xl font-black uppercase tracking-wider text-white drop-shadow-md">
              {tournament.name}
            </h2>
            <span className="text-[#00b4d8] font-bold tracking-[0.4em] text-lg uppercase">
              Official Broadcast
            </span>
          </div>
        </div>
        <div className="text-right opacity-80">
          <span className="text-5xl font-black text-white/20">
            {currentIndex + 1}
          </span>
          <span className="text-2xl font-bold text-white/20">
            /{teams.length}
          </span>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div
        key={activeTeam?.id}
        className="z-10 flex-1 flex flex-col items-center justify-start pt-10 pb-12 animate-slide-in">
        {/* TEAM LOGO & NAME */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-32 h-32 bg-[#0b0f19] rounded-full p-2 border-4 border-[#00b4d8] shadow-[0_0_50px_rgba(0,180,216,0.3)] mb-3 flex items-center justify-center relative z-10">
            <img
              src={getTeamLogo(activeTeam)}
              className="w-full h-full object-cover rounded-full"
              alt={activeTeam?.name}
            />
          </div>
          <h1 className="text-6xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-white drop-shadow-2xl text-center">
            {activeTeam?.name}
          </h1>
        </div>

        {/* PLAYERS GRID (5x2) */}
        <div className="grid grid-cols-5 gap-8 w-[1600px]">
          {displayList.map((person, idx) => (
            <div
              key={idx}
              className="relative bg-[#131826] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center pt-5 pb-3 group transform transition-all duration-300 hover:scale-105 hover:border-[#00b4d8]/40"
              style={{ animationDelay: `${idx * 80}ms` }}>
              {/* Top Accent */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${person.isOwner ? "bg-yellow-500" : person.isIcon ? "bg-[#00b4d8]" : "bg-slate-600"}`}></div>

              {/* Photo */}
              <div
                className={`w-24 h-24 rounded-full border-[3px] ${person.isOwner ? "border-yellow-500" : person.isIcon ? "border-[#00b4d8]" : "border-slate-600"} overflow-hidden bg-black shadow-lg mb-3`}>
                {person.isOwner && !person.photo ? (
                  <div className="w-full h-full flex items-center justify-center bg-yellow-500 text-black text-4xl font-bold">
                    <img
                    src={getPlayerPhoto(person)}
                    className="w-full h-full object-cover"
                    alt={person.name}
                  />
                  </div>
                ) : (
                  <img
                    src={getPlayerPhoto(person)}
                    className="w-full h-full object-cover"
                    alt={person.name}
                  />
                )}
              </div>

              {/* Info Text */}
              <div className="text-center px-3 w-full">
                <div
                  className={`text-lg font-black uppercase truncate leading-none mb-1 ${person.isOwner ? "text-yellow-400" : "text-white"}`}>
                  {person.name}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {person.role || "Player"}
                </div>
              </div>

              {/* Star Badge */}
              {person.isIcon && (
                <div className="absolute top-3 right-3 text-[#00b4d8] text-2xl animate-pulse">
                  ★
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- PROGRESS BAR --- */}
      <div className="z-20 absolute bottom-0 left-0 w-full h-3 bg-white/5">
        <div
          key={currentIndex}
          className="h-full bg-[#00b4d8] animate-progress-bar origin-left shadow-[0_0_20px_#00b4d8]"></div>
      </div>

      <style>{`
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
            animation: slideIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes progressBar {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
        }
        .animate-progress-bar {
            animation: progressBar 10s linear forwards;
        }
      `}</style>
    </div>
  );
}
