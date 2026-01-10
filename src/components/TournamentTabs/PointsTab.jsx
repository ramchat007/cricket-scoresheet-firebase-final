import React from "react";

export default function PointsTab({ pointsTable }) {
  return (
    <div className="bg-[#1C2128] border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0F1115] text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] border-b border-white/5">
            <tr>
              <th className="px-6 py-4">Pos</th>
              <th className="px-6 py-4">Team</th>
              <th className="px-4 text-center">P</th>
              <th className="px-4 text-center">W</th>
              <th className="px-4 text-center">L</th>
              <th className="px-4 text-center text-slate-200">Pts</th>
              <th className="px-4 text-right">NRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pointsTable.length > 0 ? (
              pointsTable.map((t, i) => (
                <tr
                  key={i}
                  className={`hover:bg-white/5 transition-colors group ${
                    i < 4
                      ? "bg-gradient-to-r from-teal-500/10 to-transparent border-l-4 border-teal-500"
                      : "border-l-4 border-transparent"
                  }`}>
                  <td className="px-6 py-4 font-mono text-slate-500 group-hover:text-slate-300 transition-colors">
                    #{i + 1}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-200 text-base group-hover:text-white transition-colors">
                    {t.name}
                  </td>
                  <td className="px-4 text-center text-slate-500 font-medium">{t.played}</td>
                  <td className="px-4 text-center font-bold text-teal-400">
                    {t.won}
                  </td>
                  <td className="px-4 text-center text-red-400 font-medium">{t.lost}</td>
                  <td className="px-4 text-center">
                    <span className="inline-block bg-[#0F1115] text-slate-100 font-bold px-2.5 py-1 rounded-lg border border-white/10 min-w-[32px] shadow-sm">
                      {t.points}
                    </span>
                  </td>
                  <td className="px-4 text-right font-mono text-slate-400 font-medium">
                    {t.nrr}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-16 text-center text-slate-600 italic bg-[#0F1115]/50 text-xs uppercase tracking-widest">
                  No teams registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}