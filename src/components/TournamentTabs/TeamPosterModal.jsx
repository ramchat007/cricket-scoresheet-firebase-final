import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useTheme } from "../../context/ThemeContext"; // 🔥 Added Theme Hook

export default function TeamPosterModal({
  team,
  isOpen,
  onClose,
  tournamentName,
  isAuctionEnabled, // 🔥 Added conditional flag
}) {
  const { theme, lightMode } = useTheme(); // 🔥 Grab global theme state
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
          // 🔥 Dynamically set background based on theme
          backgroundColor: lightMode ? "#ffffff" : "#0F1115",
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
  const playerList = roster.filter((p) => !p.isOwner);
  const owner = roster.find((p) => p.isOwner);

  // --- Dynamic Theme Classes for the Poster ---
  const posterBgClass = lightMode ? "bg-white" : "bg-[#0F1115]";
  const posterTextClass = lightMode ? "text-gray-900" : "text-white";
  const posterSubClass = lightMode ? "text-gray-500" : "text-slate-400";
  const playerCardBg = lightMode
    ? "bg-gray-50 border-gray-200"
    : "bg-white/5 border-white/5";
  const playerTextClass = lightMode ? "text-gray-900" : "text-white";

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="flex flex-col items-center gap-3 w-full max-w-[450px]">
        {/* Header Actions */}
        <div
          className={`flex justify-between items-center w-full px-4 py-2 rounded-lg border ${lightMode ? "bg-white text-black border-gray-200" : "bg-white/5 text-white border-white/10"}`}>
          <h3 className="font-black uppercase tracking-widest text-xs">
            <span>Preview Poster</span>
          </h3>
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold ${lightMode ? "text-gray-500 hover:text-black hover:bg-gray-100" : "text-slate-400 hover:text-white hover:bg-white/10"}`}>
            ✕ Close
          </button>
        </div>

        {/* --- POSTER PREVIEW AREA --- */}
        <div
          className={`w-full max-h-[75vh] overflow-y-auto rounded-xl border shadow-2xl custom-scrollbar ${lightMode ? "border-gray-200" : "border-white/10"}`}>
          <div
            ref={posterRef}
            className={`w-full flex flex-col relative overflow-hidden ${posterBgClass}`}
            style={{ fontFamily: "sans-serif", minHeight: "auto" }}>
            {/* Background Gradients (Adjusted for Light/Dark Mode) */}
            <div
              className={`absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none ${lightMode ? "bg-teal-200/50" : "bg-teal-500/20"}`}></div>
            <div
              className={`absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none ${lightMode ? "bg-purple-200/50" : "bg-purple-500/20"}`}></div>

            {/* Poster Header */}
            <div className="p-6 pt-8 text-center relative z-10">
              <p
                className={`text-[10px] font-black tracking-[0.3em] uppercase mb-4 ${posterSubClass}`}>
                {tournamentName || "OFFICIAL SQUAD"}
              </p>

              <div className="flex justify-center mb-4">
                {teamLogo ? (
                  <img
                    src={teamLogo}
                    alt="Logo"
                    className="w-20 h-20 object-contain drop-shadow-2xl"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-white/5 border-white/10"}`}>
                    🛡️
                  </div>
                )}
              </div>

              <h1
                className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter leading-none mb-3 ${posterTextClass}`}>
                {team.name}
              </h1>

              {/* Owner Pill */}
              {isAuctionEnabled && (
                <div className="flex justify-center w-full">
                  <div className="bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-2 mx-auto">
                    {owner?.photoURL && (
                      <img
                        src={`${owner.photoURL}`}
                        className="w-12 h-12 rounded-full object-cover bg-black border border-black"
                        crossOrigin="anonymous"
                        alt=""
                      />
                    )}
                    <span className="whitespace-nowrap">
                      Owner: {team.ownerName || "TBA"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Squad Grid */}
            <div className="flex-1 px-4 pb-4 relative z-10">
              <div className="grid grid-cols-4 gap-2 mt-2">
                {playerList.map((player, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center text-center p-1.5 rounded-lg border shadow-sm relative group ${playerCardBg}`}>
                    <div className="relative mb-1">
                      <img
                        src={
                          player.photoURL ||
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                        }
                        className={`w-9 h-9 rounded-full object-cover border ${lightMode ? "bg-gray-200 border-gray-300" : "bg-black/50 border-white/10"}`}
                        crossOrigin="anonymous"
                        alt={player.name}
                      />

                      {/* 🔥 ICON & DIRECT BUY BADGES (Auction Logic Applied) */}
                      {player.isIcon && (
                        <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[6px] font-bold px-1 py-0.5 rounded-full shadow-sm">
                          ★
                        </span>
                      )}

                      {/* Only show Direct Buy if Auction is actually enabled for this tournament */}
                      {isAuctionEnabled && player.isDirectBuy && (
                        <span className="absolute -bottom-1 -right-1 bg-purple-500 text-white text-[6px] font-bold px-1 py-0.5 rounded-full shadow-sm">
                          ⚡
                        </span>
                      )}
                    </div>

                    <div className="w-full">
                      <p
                        className={`text-[8px] font-bold leading-tight break-words ${playerTextClass}`}>
                        {player.name}
                      </p>
                      <p
                        className={`text-[6px] font-black uppercase tracking-wider mt-0.5 opacity-80 ${lightMode ? "text-teal-600" : "text-teal-500"}`}>
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
          className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
          {isGenerating ? "Generating High-Res..." : "Download Poster 📥"}
        </button>
      </div>
    </div>
  );
}
