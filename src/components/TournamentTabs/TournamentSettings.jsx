import React, { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useAuth } from "../../hooks/useAuth";

export default function TournamentSettings({
  tournament: initialData,
  tournamentId,
}) {
  const { user } = useAuth();

  // 1. Internal State for Tournament Data (handles prop missing case)
  const [tournament, setTournament] = useState(initialData || null);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    liveStreamUrl: "",
    startDate: "",
    endDate: "",
  });

  const [status, setStatus] = useState("loading"); // loading | authorized | restricted
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [saving, setSaving] = useState(false);

  // --- EFFECT 1: FETCH DATA IF PROP IS MISSING ---
  useEffect(() => {
    // If props provided data, use it
    if (initialData) {
      setTournament(initialData);
      return;
    }

    // If no prop, fetch from DB
    if (tournamentId) {
      setLoadingMessage("Fetching Tournament Details...");
      const unsub = onSnapshot(
        doc(db, "tournaments", tournamentId),
        (docSnap) => {
          if (docSnap.exists()) {
            setTournament(docSnap.data());
          }
        },
      );
      return () => unsub();
    }
  }, [initialData, tournamentId]);

  // --- EFFECT 2: CHECK PERMISSIONS & POPULATE FORM ---
  useEffect(() => {
    // A. Wait for Data
    if (!tournament) {
      setLoadingMessage("Waiting for Data...");
      return;
    }

    // B. Wait for Auth
    if (user === undefined) return; // Auth loading
    if (user === null) {
      setStatus("restricted");
      return;
    }

    // C. Populate Form
    setFormData({
      name: tournament.name || "",
      location: tournament.location || "",
      liveStreamUrl: tournament.liveStreamUrl || "",
      startDate: tournament.startDate || "",
      endDate: tournament.endDate || "",
    });

    // D. Check Permissions
    const isOwner = tournament.ownerId === user.uid;
    const isScorer =
      tournament.scorers && Array.isArray(tournament.scorers)
        ? tournament.scorers.includes(user.uid)
        : false;

    if (isOwner || isScorer) {
      setStatus("authorized");
    } else {
      setStatus("restricted");
    }
  }, [tournament, user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tRef = doc(db, "tournaments", tournamentId);
      await updateDoc(tRef, {
        name: formData.name,
        location: formData.location,
        liveStreamUrl: formData.liveStreamUrl,
        startDate: formData.startDate,
        endDate: formData.endDate,
        lastUpdated: new Date().toISOString(),
      });
      alert("✅ Tournament Settings Updated!");
    } catch (err) {
      console.error(err);
      alert("❌ Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  // --- RENDER ---

  if (status === "loading") {
    return (
      <div className="p-8 text-center bg-[#1C2128] rounded-2xl border border-white/5 animate-pulse">
        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
          {loadingMessage}
        </span>
      </div>
    );
  }

  if (status === "restricted") {
    return (
      <div className="p-10 text-center text-slate-500 bg-[#161920] rounded-2xl border border-white/5">
        <span className="text-2xl">🔒</span>
        <p className="text-xs font-bold uppercase tracking-widest mt-2">
          Restricted Access
        </p>
        <p className="text-xs mt-1 opacity-50">
          You must be logged in as the Owner or a Scorer to edit this.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* 🔴 BROADCAST CONFIGURATION */}
      <div className="bg-[#1C2128] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span className="text-6xl">📡</span>
        </div>
        <h3 className="text-slate-300 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="text-red-500 animate-pulse">●</span> Global Broadcast
          Link
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            value={formData.liveStreamUrl}
            onChange={(e) =>
              setFormData({ ...formData, liveStreamUrl: e.target.value })
            }
            placeholder="Paste YouTube Live URL here..."
            className="w-full bg-black border border-red-500/20 text-white text-sm p-4 rounded-xl outline-none focus:border-red-500 transition-colors placeholder:text-slate-600"
          />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Matches without a specific link will play this video.
          </p>
        </div>
      </div>

      {/* 📝 GENERAL SETTINGS */}
      <form
        onSubmit={handleSave}
        className="bg-[#1C2128] border border-white/5 p-6 rounded-2xl space-y-5">
        <h3 className="text-slate-300 text-xs font-black uppercase tracking-widest mb-2">
          General Information
        </h3>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Tournament Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-black/40 border border-white/10 text-white text-sm p-3 rounded-xl outline-none focus:border-teal-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Location / Venue
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            className="w-full bg-black/40 border border-white/10 text-white text-sm p-3 rounded-xl outline-none focus:border-teal-500 transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="w-full bg-black/40 border border-white/10 text-white text-sm p-3 rounded-xl outline-none focus:border-teal-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              End Date
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              className="w-full bg-black/40 border border-white/10 text-white text-sm p-3 rounded-xl outline-none focus:border-teal-500 transition-colors"
            />
          </div>
        </div>
        <div className="pt-4 border-t border-white/5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase px-6 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
            {saving ? <span className="animate-spin">↻</span> : "💾"} Save
          </button>
        </div>
      </form>
    </div>
  );
}
