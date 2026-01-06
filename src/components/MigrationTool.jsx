// src/components/MigrationTool.jsx
import React, { useState } from "react";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

export default function MigrationTool() {
  const [status, setStatus] = useState("Idle");
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  const startMigration = async () => {
    if (!window.confirm("Start Data Migration? This may take time.")) return;
    
    setStatus("Scanning...");
    setLog([]);
    const playersRef = collection(db, "players");
    const uniquePlayers = new Set();

    try {
      // 1. Get all player names from existing global players (to avoid dupes)
      const existingSnap = await getDocs(playersRef);
      existingSnap.forEach(doc => uniquePlayers.add(doc.data().name.toLowerCase().trim()));
      addLog(`Found ${uniquePlayers.size} existing global players.`);

      // 2. Scan Tournaments & Matches
      const tournamentsSnap = await getDocs(collection(db, "tournaments"));
      
      for (const tDoc of tournamentsSnap.docs) {
        addLog(`Scanning Tournament: ${tDoc.data().name || tDoc.id}`);
        
        // Scan Teams subcollection
        const teamsSnap = await getDocs(collection(db, `tournaments/${tDoc.id}/teams`));
        teamsSnap.forEach(team => {
            const players = team.data().players || []; // Legacy array
            players.forEach(name => {
                if(typeof name === 'string' && name.trim()) {
                    if(!uniquePlayers.has(name.toLowerCase().trim())) {
                        uniquePlayers.add(name.toLowerCase().trim());
                        // Create Player
                        createPlayer(name.trim());
                    }
                }
            })
        });
      }
      
      setStatus("Done!");
      addLog("Migration Complete.");

    } catch (e) {
      console.error(e);
      setStatus("Error");
      addLog("Error: " + e.message);
    }
  };

  const createPlayer = async (name) => {
    try {
        const newRef = doc(collection(db, "players"));
        await setDoc(newRef, {
            name: name,
            role: "Unknown",
            battingStyle: "Unknown",
            bowlingStyle: "Unknown",
            createdAt: new Date().toISOString(),
            migrated: true
        });
        addLog(`✅ Created Global Player: ${name}`);
    } catch(e) {
        addLog(`❌ Failed to create ${name}`);
    }
  }

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Legacy Data Migration</h1>
        <p className="mb-4 text-gray-400">Scans all legacy teams and creates Global Player profiles for them.</p>
        
        <button 
            onClick={startMigration} 
            disabled={status !== "Idle"}
            className="bg-blue-600 px-6 py-3 rounded font-bold disabled:opacity-50"
        >
            {status === "Idle" ? "Start Migration" : status}
        </button>

        <div className="mt-6 bg-black p-4 rounded h-96 overflow-y-auto font-mono text-xs">
            {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
    </div>
  );
}