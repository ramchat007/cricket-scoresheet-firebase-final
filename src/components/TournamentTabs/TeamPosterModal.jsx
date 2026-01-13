import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";

export default function TeamPosterModal({
  team,
  isOpen,
  onClose,
  tournamentName,
}) {
  if (!isOpen || !team) return null;

  const posterRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    if (posterRef.current) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for images

        const canvas = await html2canvas(posterRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#0F1115",
          logging: false,
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

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="flex flex-col items-center gap-4 w-full max-w-[400px]">
        {/* Header Actions */}
        <div className="flex justify-between w-full text-white">
          <h3 className="font-black uppercase tracking-widest text-sm">
            Preview Poster
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕ Close
          </button>
        </div>

        {/* --- POSTER AREA --- */}
        <div className="relative w-full aspect-[4/5] bg-[#0F1115] rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <div
            ref={posterRef}
            className="w-full h-full bg-[#0F1115] flex flex-col relative overflow-hidden"
            style={{ fontFamily: "sans-serif" }}>
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-teal-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/20 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3"></div>

            {/* Header */}
            <div className="p-6 pt-8 text-center relative z-10">
              <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase mb-4">
                {tournamentName || "OFFICIAL SQUAD"}
              </p>

              <div className="flex justify-center mb-4">
                {team.logo ? (
                  <img
                    src={team.logo}
                    className="w-24 h-24 object-contain drop-shadow-2xl"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-4xl border border-white/10">
                    🛡️
                  </div>
                )}
              </div>

              <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">
                {team.name}
              </h1>
              <div className="inline-block bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Owned by {team.ownerName || "TBA"}
              </div>
            </div>

            {/* Squad List */}
            <div className="flex-1 px-6 pb-6 relative z-10">
              <div className="grid grid-cols-2 gap-2 mt-2">
                {roster.slice(0, 10).map((player, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/5">
                    <img
                      src={player.photoURL}
                      className="w-8 h-8 rounded-md object-cover bg-black"
                      crossOrigin="anonymous"
                    />
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-white truncate leading-tight flex items-center gap-1">
                        {player.name}
                        {player.isIcon && (
                          <span className="text-[7px] text-amber-400">★</span>
                        )}
                      </p>
                      <p className="text-[7px] text-teal-500 font-black uppercase">
                        {player.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {roster.length > 10 && (
                <div className="mt-3 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  + {roster.length - 10} More Players
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-white/5 border-t border-white/5 text-center">
              <p className="text-[8px] text-slate-400 uppercase tracking-widest">
                Generated by Cricket Sync App
              </p>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
          {isGenerating ? "Generating..." : "Download Poster 📥"}
        </button>
      </div>
    </div>
  );
}
