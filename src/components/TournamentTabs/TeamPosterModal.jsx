import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useTheme } from "../../context/ThemeContext";
import PlayerAvatar from "../PlayerAvatar"; // 🟢 Import Smart Avatar
import { Crown, Shield } from "lucide-react";

// --- 🛠️ HELPER: STANDARDIZED COMPARISON ---
const normalize = (str) =>
  String(str || "")
    .trim()
    .toLowerCase();

export default function TeamPosterModal({
  team,
  isOpen,
  onClose,
  tournamentName,
  isAuctionEnabled,
  tournamentId,
  masterPlayersMap = {}, // 🟢 Receive the master map from TeamsTab
}) {
  const { theme, lightMode } = useTheme();
  const posterRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !team) return null;

  const handleDownload = async () => {
    setIsGenerating(true);
    if (posterRef.current) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));

        const canvas = await html2canvas(posterRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: lightMode ? "#f8fafc" : "#0F1115",
          logging: false,
          scrollY: -window.scrollY,
        });

        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `${team.name.replace(/\s+/g, "_")}_Squad.png`;
        link.click();
      } catch (err) {
        console.error("Poster generation failed:", err);
        alert("Failed to generate poster. Check console.");
      }
    }
    setIsGenerating(false);
  };

  const roster = team.roster || [];
  const teamLogo = team.logoUrl || team.logo;

  // 🟢 HYDRATE THE PLAYER LIST USING THE MASTER MAP
  const playerList = roster
    .filter((p) => !p.isOwner)
    .map((p) => {
      const hydrated =
        masterPlayersMap[p.originalPlayerId] ||
        masterPlayersMap[p.id] ||
        masterPlayersMap[normalize(p.name)] ||
        p;
      return { ...p, ...hydrated };
    });

  // 🟢 HYDRATE THE OWNER
  const rawOwner = roster.find((p) => p.isOwner);
  const owner = rawOwner
    ? {
        ...rawOwner,
        ...(masterPlayersMap[rawOwner.originalPlayerId] ||
          masterPlayersMap[rawOwner.id] ||
          masterPlayersMap[normalize(rawOwner.name)] ||
          {}),
      }
    : null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
        {/* Header Actions */}
        <div
          className={`flex justify-between items-center w-full px-4 py-3 rounded-xl border shadow-xl ${lightMode ? "bg-white text-black border-gray-200" : "bg-[#161920] text-white border-white/10"}`}
        >
          <h3 className="font-black uppercase tracking-widest text-xs md:text-sm">
            <span className="text-teal-500 mr-2">✦</span>
            Squad Reveal Poster
          </h3>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-widest ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/5 hover:bg-white/10 text-slate-300"}`}
          >
            Close
          </button>
        </div>

        {/* --- 🎨 NEW PREMIUM POSTER DESIGN --- */}
        <div
          className={`w-full max-h-[75vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar ${lightMode ? "bg-gray-50 border border-gray-200" : "bg-[#090a0f] border border-white/10"}`}
        >
          <div
            ref={posterRef}
            className="w-full flex flex-col relative overflow-hidden"
            style={{ fontFamily: "sans-serif", minHeight: "auto" }}
          >
            {/* Dynamic Background Graphics */}
            <div
              className={`absolute top-0 right-0 w-full h-[400px] bg-gradient-to-bl ${lightMode ? "from-teal-100/60 to-transparent" : "from-teal-900/30 to-transparent"} pointer-events-none`}
            ></div>
            <div
              className={`absolute bottom-0 left-0 w-full h-[400px] bg-gradient-to-tr ${lightMode ? "from-indigo-100/60 to-transparent" : "from-indigo-900/20 to-transparent"} pointer-events-none`}
            ></div>

            {/* Poster Header */}
            <div className="p-8 pb-4 text-center relative z-10 flex flex-col items-center">
              <div
                className={`inline-block px-6 py-1.5 rounded-full text-[9px] md:text-[11px] font-black tracking-[0.3em] uppercase mb-6 border ${lightMode ? "bg-white border-gray-200 text-gray-500" : "bg-black/50 border-white/10 text-gray-400"}`}
              >
                {tournamentName || "OFFICIAL SQUAD"}
              </div>

              <div className="flex justify-center mb-4 relative">
                {teamLogo ? (
                  <img
                    src={teamLogo}
                    alt="Logo"
                    className="w-28 h-28 md:w-32 md:h-32 object-contain drop-shadow-2xl z-10"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div
                    className={`w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center text-5xl border-4 shadow-2xl z-10 ${lightMode ? "bg-white border-gray-100" : "bg-[#161920] border-white/5"}`}
                  >
                    <Shield
                      size={48}
                      className={lightMode ? "text-gray-300" : "text-gray-600"}
                    />
                  </div>
                )}
                {/* Glow behind logo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-teal-500/30 blur-[40px] rounded-full pointer-events-none"></div>
              </div>

              <h1
                className={`text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none mb-4 drop-shadow-md ${lightMode ? "text-gray-900" : "text-white"}`}
              >
                {team.name}
              </h1>

              {/* Owner Pill */}
              {isAuctionEnabled && (
                <div
                  className={`flex items-center gap-3 px-5 py-2 rounded-2xl border shadow-lg backdrop-blur-sm ${lightMode ? "bg-white/80 border-gray-200" : "bg-black/40 border-white/10"}`}
                >
                  {owner?.photoURL || owner?.image ? (
                    <PlayerAvatar
                      player={owner}
                      playerId={owner.originalPlayerId || owner.id}
                      photoURL={owner.photoURL || owner.image}
                      tournamentId={tournamentId}
                      className="w-10 h-10 rounded-full object-cover border-2 border-amber-500"
                      forPoster={true}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black">
                      <Crown size={20} />
                    </div>
                  )}
                  <div className="text-left">
                    <p
                      className={`text-[8px] font-black uppercase tracking-widest ${lightMode ? "text-gray-500" : "text-gray-400"}`}
                    >
                      Team Owner
                    </p>
                    <p
                      className={`text-sm font-bold leading-tight ${lightMode ? "text-gray-900" : "text-white"}`}
                    >
                      {team.ownerName || "TBA"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 🏏 Trading Card Squad Grid */}
            <div className="flex-1 p-6 md:p-8 pt-4 relative z-10">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 md:gap-4">
                {playerList.map((player, i) => (
                  <div
                    key={i}
                    className={`relative rounded-xl overflow-hidden shadow-lg flex flex-col justify-end aspect-[4/4] border ${lightMode ? "border-gray-300 bg-gray-200" : "border-white/10 bg-[#161920]"}`}
                  >
                    {/* Player Image */}
                    <div className="absolute inset-0">
                      <PlayerAvatar
                        player={player}
                        playerId={player.originalPlayerId || player.id}
                        photoURL={player.photoURL || player.image}
                        tournamentId={tournamentId}
                        className="w-full h-full object-cover"
                        forPoster={true}
                      />
                    </div>

                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

                    {/* Badges (Top) */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      {player.isIcon && (
                        <span className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black text-[8px] md:text-[9px] px-2 py-0.5 rounded font-black shadow-md border border-yellow-300 uppercase tracking-wider">
                          ★ Icon
                        </span>
                      )}
                      {isAuctionEnabled && player.isDirectBuy && (
                        <span className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[8px] md:text-[9px] px-2 py-0.5 rounded font-black shadow-md border border-purple-400 uppercase tracking-wider">
                          ⚡ Direct
                        </span>
                      )}
                    </div>

                    {/* Player Info (Bottom) */}
                    <div className="relative z-10 px-1 py-2 md:px-2 md:py-3 w-full text-center">
                      <p className="text-[9px] md:text-[11px] font-black text-white uppercase leading-none break-words line-clamp-3 drop-shadow-md">
                        {player.name}
                      </p>
                      <p className="text-[7px] md:text-[8px] font-bold text-teal-400 uppercase tracking-widest mt-1 break-words drop-shadow-md">
                        {player.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-1"
        >
          {isGenerating ? (
            <span className="animate-pulse">Generating High-Res Image...</span>
          ) : (
            <span>Download Squad Poster 📥</span>
          )}
        </button>
      </div>
    </div>
  );
}
