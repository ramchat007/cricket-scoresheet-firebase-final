import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from "firebase/firestore";
import { db } from "../utils/firebase";
import { createAuctionSlot, assignPlayerToSlot } from "../utils/auction";

export default function AuctionSlotManager({ tournamentId, players }) {
  const [slots, setSlots] = useState([]);
  const [newSlotName, setNewSlotName] = useState("");

  useEffect(() => {
    const q = query(collection(db, "tournaments", tournamentId, "auction_slots"), orderBy("order"));
    return onSnapshot(q, (snap) => {
      setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [tournamentId]);

  const handleCreateSlot = async () => {
    if (!newSlotName) return;
    await createAuctionSlot(tournamentId, { 
      name: newSlotName, 
      order: slots.length + 1 
    });
    setNewSlotName("");
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-4 bg-gray-850 border-b border-gray-800">
        <h3 className="text-white font-bold">Dynamic Slot Management</h3>
      </div>
      
      <div className="p-4 space-y-6">
        {/* Create Slot UI */}
        <div className="flex gap-2">
          <input 
            className="flex-1 bg-black border border-gray-700 p-2 rounded text-white text-sm"
            placeholder="Slot Name (e.g. Expert Batsmen)"
            value={newSlotName}
            onChange={e => setNewSlotName(e.target.value)}
          />
          <button onClick={handleCreateSlot} className="bg-cyan-600 px-4 py-2 rounded text-white font-bold text-sm">Add Slot</button>
        </div>

        {/* Slot Progress List */}
        <div className="space-y-2">
            <label className="text-[10px] text-gray-500 font-black uppercase">Defined Slots</label>
            {slots.map(s => (
                <div key={s.id} className="flex justify-between items-center bg-gray-950 p-3 rounded-lg border border-gray-800">
                    <span className="text-white font-medium text-sm">{s.order}. {s.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${s.status === 'completed' ? 'bg-green-900/20 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                        {s.status}
                    </span>
                </div>
            ))}
        </div>

        {/* Assignment Table (Section 2: Player Assignment) */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
                <thead className="bg-gray-800 text-gray-400 uppercase">
                    <tr>
                        <th className="p-3">Player</th>
                        <th className="p-3">Slot Assignment</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {players.map(p => (
                        <tr key={p.id}>
                            <td className="p-3 text-white font-bold">{p.name}</td>
                            <td className="p-3">
                                <select 
                                    className="bg-black border border-gray-700 rounded p-1 w-full"
                                    value={p.auctionSlotId || ""}
                                    onChange={(e) => assignPlayerToSlot(tournamentId, p.id, e.target.value)}
                                >
                                    <option value="">Unassigned</option>
                                    {slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}