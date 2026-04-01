import React, { useState, useEffect, useMemo } from "react";
import { Trophy, Layers } from "lucide-react";
import { supabase } from "../../utils/supabase";
import { calculatePointsTable } from "../../utils/statsHelper";

export default function PointsTable({ tournamentId, matches }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 NEW: State to track which Slot is currently being viewed
  const [activeSlot, setActiveSlot] = useState("");

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from("tournament_standings")
            .select("*")
            .eq("tournament_id", tournamentId)
            .order("points", { ascending: false })
            .order("nrr", { ascending: false });

          if (!error && data && data.length > 0) {
            setStandings(data);

            // Auto-select the first available slot when data loads
            const uniqueSlots = [
              ...new Set(data.map((item) => item.slot_name || "Main Pool")),
            ];
            if (uniqueSlots.length > 0) setActiveSlot(uniqueSlots[0]);

            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Supabase view not ready, falling back to local math.");
      }

      // Local Fallback
      if (matches && matches.length > 0) {
        const localStandings = calculatePointsTable(matches);
        setStandings(localStandings);
        setActiveSlot("Main Pool"); // Default slot for local math
      }
      setLoading(false);
    };

    fetchStandings();
  }, [tournamentId, matches]);

  // 🔥 NEW: Group the data by slot
  const slots = useMemo(() => {
    const uniqueSlots = [
      ...new Set(standings.map((s) => s.slot_name || "Main Pool")),
    ];
    return uniqueSlots.sort(); // Alphabetical sort (Slot A, Slot B, etc.)
  }, [standings]);

  // 🔥 NEW: Filter the table to only show teams in the active slot
  const displayedStandings = useMemo(() => {
    return standings.filter((s) => (s.slot_name || "Main Pool") === activeSlot);
  }, [standings, activeSlot]);

  // Cycle through tabs automatically every 10 seconds if there are multiple slots
  useEffect(() => {
    if (slots.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlot((current) => {
        const currentIndex = slots.indexOf(current);
        const nextIndex = (currentIndex + 1) % slots.length;
        return slots[nextIndex];
      });
    }, 10000); // 10 seconds per tab
    return () => clearInterval(interval);
  }, [slots]);

  if (loading) return null;

  return (
    <>
      <style>
        {`
          @keyframes fadeInScale {
            0% { transform: scale(0.95); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes slideInRight {
            0% { transform: translateX(20px); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
          .anim-table { animation: fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .anim-row { animation: slideInRight 0.4s ease-out forwards; }
        `}
      </style>

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-12 font-sans anim-table">
        <div className="w-full max-w-5xl bg-slate-900/95 border-2 border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 flex flex-col gap-4 border-b-2 border-amber-400 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                <Trophy size={32} strokeWidth={3} /> Tournament Standings
              </h2>
            </div>

            {/* 🔥 NEW: Slot Navigation Tabs */}
            {slots.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="flex items-center justify-center bg-slate-900/20 text-slate-900 px-3 rounded-lg mr-2">
                  <Layers size={18} strokeWidth={3} />
                </div>
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setActiveSlot(slot)}
                    className={`px-6 py-2 rounded-lg font-black uppercase tracking-widest text-sm transition-all duration-300 ${
                      activeSlot === slot
                        ? "bg-slate-900 text-amber-400 shadow-lg scale-105"
                        : "bg-slate-900/20 text-slate-900 hover:bg-slate-900/40"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="p-2 bg-black/40 min-h-[400px]">
            <table className="w-full text-left border-collapse relative">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs font-black uppercase tracking-widest bg-slate-900/50">
                  <th className="p-4 text-center w-16">Pos</th>
                  <th className="p-4">Team</th>
                  <th className="p-4 text-center w-16">P</th>
                  <th className="p-4 text-center w-16">W</th>
                  <th className="p-4 text-center w-16">L</th>
                  <th className="p-4 text-center w-24 text-cyan-400">NRR</th>
                  <th className="p-4 text-center w-24 text-amber-400 text-lg">
                    Pts
                  </th>
                </tr>
              </thead>
              <tbody key={activeSlot}>
                {displayedStandings.map((team, index) => (
                  <tr 
                    key={team.name} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors anim-row opacity-0"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <td className="p-4 text-center font-black text-white/40">{index + 1}</td>
                    <td className="p-4 font-black text-xl text-white uppercase tracking-wider">{team.name}</td>
                    <td className="p-4 text-center font-bold text-white/80">{team.played || 0}</td>
                    <td className="p-4 text-center font-bold text-emerald-400">{team.won || 0}</td>
                    <td className="p-4 text-center font-bold text-rose-400">{team.lost || 0}</td>
                    <td className="p-4 text-center font-mono font-bold text-cyan-400">{Number(team.nrr || 0).toFixed(3)}</td>
                    <td className="p-4 text-center font-black text-2xl text-amber-400 drop-shadow-md">{team.points || 0}</td>
                  </tr>
                ))}
                {displayedStandings.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-white/40 font-bold uppercase tracking-widest italic">
                      No teams found in this slot yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
