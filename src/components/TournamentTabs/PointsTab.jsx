import React from "react";

export default function PointsTab({ pointsTable }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-950/50 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Pos</th>
              <th className="px-6 py-4">Team</th>
              <th className="px-4 text-center">P</th>
              <th className="px-4 text-center">W</th>
              <th className="px-4 text-center">L</th>
              <th className="px-4 text-center text-white">Pts</th>
              <th className="px-4 text-right">NRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pointsTable.length > 0 ? (
              pointsTable.map((t, i) => (
                <tr
                  key={i}
                  className={`hover:bg-gray-800/50 transition-colors ${
                    i < 4
                      ? "bg-gradient-to-r from-green-900/5 to-transparent border-l-4 border-green-500"
                      : "border-l-4 border-transparent"
                  }`}>
                  <td className="px-6 py-4 font-mono text-gray-500">
                    #{i + 1}
                  </td>
                  <td className="px-6 py-4 font-bold text-white text-base">
                    {t.name}
                  </td>
                  <td className="px-4 text-center text-gray-400">{t.played}</td>
                  <td className="px-4 text-center font-bold text-green-400">
                    {t.won}
                  </td>
                  <td className="px-4 text-center text-red-400">{t.lost}</td>
                  <td className="px-4 text-center">
                    <span className="inline-block bg-gray-800 text-white font-bold px-2 py-1 rounded min-w-[30px]">
                      {t.points}
                    </span>
                  </td>
                  <td className="px-4 text-right font-mono text-gray-400">
                    {t.nrr}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500 italic">
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
