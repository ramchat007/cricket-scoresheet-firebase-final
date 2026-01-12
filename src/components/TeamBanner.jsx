import React from "react";

const TeamBanner = ({ team, canEdit, onEditClick }) => {
  return (
    <div className="relative w-full bg-[#1C2128] border border-white/5 rounded-[2.5rem] overflow-hidden mb-6 group shadow-2xl transition-all hover:border-teal-500/30">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-teal-500/5 to-transparent skew-x-12 translate-x-20 pointer-events-none"></div>

      <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
        {/* TEAM LOGO Section */}
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <img 
            src={team.logoURL || "https://cdn-icons-png.flaticon.com/512/1165/1165230.png"} 
            alt={team.name}
            className="w-24 h-24 md:w-32 md:h-32 object-contain relative z-10 drop-shadow-2xl transition-transform group-hover:scale-110 duration-500"
          />
        </div>

        {/* TEAM INFO Section */}
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-black text-slate-100 uppercase italic tracking-tighter mb-2 group-hover:text-teal-400 transition-colors">
            {team.name}
          </h2>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
             <span className="bg-[#0F1115] text-teal-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-teal-500/20 uppercase tracking-widest shadow-lg">
               {team.roster?.length || 0} Players Joined
             </span>
             {canEdit && (
               <button 
                onClick={() => onEditClick(team)}
                className="bg-white/5 hover:bg-teal-600 hover:text-white text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border border-white/10"
               >
                 ✎ Edit Team Identity
               </button>
             )}
          </div>
        </div>

        {/* SQUAD PREVIEW Section */}
        <div className="flex -space-x-4 overflow-hidden p-2 hover:space-x-1 transition-all duration-500">
          {(team.roster || []).slice(0, 6).map((player, idx) => (
            <div key={idx} className="relative group/player">
              <img
                className="inline-block h-14 w-14 md:h-16 md:w-16 rounded-full ring-4 ring-[#1C2128] object-cover bg-black shadow-xl"
                src={player.photoURL || "https://cdn-icons-png.flaticon.com/512/847/847969.png"}
                alt={player.name}
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#0F1115] text-[8px] font-bold px-2 py-0.5 rounded border border-white/10 opacity-0 group-hover/player:opacity-100 transition-opacity text-slate-300">
                {player.name.split(' ')[0]}
              </div>
            </div>
          ))}
          {team.roster?.length > 6 && (
            <div className="flex items-center justify-center h-14 w-14 md:h-16 md:w-16 rounded-full bg-[#0F1115] ring-4 ring-[#1C2128] text-teal-500 text-xs font-black border border-teal-500/20">
              +{team.roster.length - 6}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamBanner;