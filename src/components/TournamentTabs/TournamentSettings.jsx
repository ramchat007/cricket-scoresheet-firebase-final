import React, { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import {
  MapPin,
  Calendar,
  Radio,
  Save,
  Lock,
  Loader2,
  Globe,
  Copy,
  Layers,
  Monitor,
} from "lucide-react";

export default function TournamentSettings({
  tournament: initialData,
  tournamentId,
}) {
  const { user } = useAuth();

  // 🟢 Natively extract theme
  const { theme } = useTheme();

  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const cardBg =
    theme?.card ||
    "bg-black/60 backdrop-blur-xl border border-white/10 shadow-xl";

  // 1. Internal State
  const [tournament, setTournament] = useState(initialData || null);
  const [origin, setOrigin] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    liveStreamUrl: "",
    startDate: "",
    endDate: "",
    maxPlayers: "",
  });

  const [status, setStatus] = useState("loading");
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [saving, setSaving] = useState(false);

  // --- EFFECT: Get Window Origin for Links ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // --- EFFECT: FETCH DATA ---
  useEffect(() => {
    if (initialData) {
      setTournament(initialData);
      return;
    }
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

  // --- EFFECT: PERMISSIONS & FORM ---
  useEffect(() => {
    if (!tournament) {
      setLoadingMessage("Waiting for Data...");
      return;
    }
    if (user === undefined) return;
    if (user === null) {
      setStatus("restricted");
      return;
    }

    setFormData({
      name: tournament.name || "",
      location: tournament.location || "",
      liveStreamUrl: tournament.liveStreamUrl || "",
      startDate: tournament.startDate || "",
      endDate: tournament.endDate || "",
      maxPlayers: tournament.maxPlayers || "",
    });

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
        maxPlayers: formData.maxPlayers ? Number(formData.maxPlayers) : null,
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

  const copyOverlayLink = () => {
    const url = `${origin}/overlay/${tournamentId}/active?clean=true`;
    navigator.clipboard.writeText(url);
    alert("✅ Global Overlay URL Copied!\nPaste this into OBS.");
  };

  // --- RENDER ---

  if (status === "loading") {
    return (
      <div
        className={`p-8 text-center rounded-3xl border animate-pulse flex flex-col items-center gap-2 bg-current/5 border-current/10 text-inherit`}>
        <Loader2 className={`animate-spin ${textSub}`} size={24} />
        <span
          className={`text-xs font-bold uppercase tracking-widest ${textSub}`}>
          {loadingMessage}
        </span>
      </div>
    );
  }

  if (status === "restricted") {
    return (
      <div
        className={`p-10 text-center rounded-3xl border bg-current/5 border-current/10 text-inherit opacity-70`}>
        <div className="flex justify-center mb-2">
          <Lock size={32} />
        </div>
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
    <div
      className={`space-y-6 animate-in fade-in slide-in-from-bottom-4 ${textMain}`}>
      {/* 📡 BROADCAST STUDIO CARD */}
      <div
        className={`border rounded-3xl relative overflow-hidden group ${cardBg}`}>
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center gap-3 bg-purple-500/10 border-current/10`}>
          <Monitor size={20} className="text-purple-500" />
          <h3
            className={`text-sm font-black uppercase tracking-widest ${textMain}`}>
            Broadcast Studio
          </h3>
        </div>

        <div className="p-6 space-y-8">
          {/* 1. OBS OUTPUT */}
          <div>
            <label
              className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-2 ${textSub}`}>
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-teal-500" /> Global Overlay
                Source (OBS)
              </span>
              <span className="text-teal-500">Output</span>
            </label>
            <div
              className={`flex items-center gap-2 p-1.5 rounded-xl border bg-current/5 border-current/10`}>
              <div
                className={`flex-1 px-3 text-xs font-mono truncate select-all opacity-80`}>
                {origin}/overlay/{tournamentId}/broadcast/active?clean=true
              </div>
              <button
                onClick={copyOverlayLink}
                className={`p-2 rounded-lg transition-all active:scale-95 bg-current/10 border border-transparent hover:bg-current/20 hover:border-current/20 text-inherit opacity-80 hover:opacity-100`}
                title="Copy to Clipboard">
                <Copy size={14} />
              </button>
            </div>
            <p className={`text-[10px] mt-2 opacity-70 ${textSub}`}>
              <strong>One link for the whole tournament.</strong> It
              automatically displays graphics for whichever match is currently{" "}
              <strong>Live</strong>.
            </p>
          </div>

          {/* Divider */}
          <div className={`h-px w-full bg-current/10`}></div>

          {/* 2. YOUTUBE INPUT */}
          <div>
            <label
              className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-2 ${textSub}`}>
              <span className="flex items-center gap-1.5">
                <Radio size={14} className="text-red-500" /> Live Stream Source
              </span>
              <span className="text-red-500">Input</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.liveStreamUrl}
                onChange={(e) =>
                  setFormData({ ...formData, liveStreamUrl: e.target.value })
                }
                placeholder="Paste YouTube Live URL here..."
                // 🟢 Clean, adaptable glassmorphism input
                className={`w-full text-sm p-3 pl-4 pr-10 rounded-xl outline-none focus:border-red-500 focus:bg-current/10 transition-colors border bg-current/5 border-current/10 text-inherit placeholder:opacity-50`}
              />
              {/* Status Dot inside input */}
              <div
                className={`absolute right-3 top-3.5 w-2 h-2 rounded-full ${formData.liveStreamUrl ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-gray-500 opacity-50"}`}></div>
            </div>
            <p className={`text-[10px] mt-2 opacity-70 ${textSub}`}>
              This video will be embedded on the public tournament page.
            </p>
          </div>
        </div>
      </div>

      {/* 📝 GENERAL SETTINGS */}
      <form
        onSubmit={handleSave}
        className={`border p-6 rounded-3xl space-y-5 ${cardBg}`}>
        <h3
          className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${textMain}`}>
          <Globe size={14} className="text-teal-500" /> General Information
        </h3>

        <div>
          <label
            className={`block text-[10px] font-bold uppercase mb-1 ${textSub}`}>
            Tournament Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full text-sm p-3 rounded-xl outline-none transition-colors border focus:border-teal-500 focus:bg-current/10 bg-current/5 border-current/10 text-inherit`}
          />
        </div>

        <div>
          <label
            className={`block text-[10px] font-bold uppercase mb-1 ${textSub}`}>
            Location / Venue
          </label>
          <div className="relative">
            <MapPin
              className={`absolute left-3 top-3.5 ${textSub}`}
              size={14}
            />
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className={`w-full text-sm p-3 pl-9 rounded-xl outline-none transition-colors border focus:border-teal-500 focus:bg-current/10 bg-current/5 border-current/10 text-inherit`}
            />
          </div>
        </div>

        <div>
          <label
            className={`block text-[10px] font-bold uppercase mb-1 text-teal-500`}>
            Max Registrations (Limit)
          </label>
          <input
            type="number"
            placeholder="e.g. 80 (Leave blank for unlimited)"
            value={formData.maxPlayers}
            onChange={(e) =>
              setFormData({ ...formData, maxPlayers: e.target.value })
            }
            className={`w-full text-sm p-3 rounded-xl outline-none transition-colors border focus:border-teal-500 focus:bg-current/10 bg-current/5 border-current/10 text-inherit placeholder:opacity-50`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className={`block text-[10px] font-bold uppercase mb-1 ${textSub}`}>
              Start Date
            </label>
            <div className="relative">
              <Calendar
                className={`absolute left-3 top-3.5 ${textSub}`}
                size={14}
              />
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className={`w-full text-sm p-3 pl-9 rounded-xl outline-none transition-colors border focus:border-teal-500 focus:bg-current/10 bg-current/5 border-current/10 text-inherit`}
              />
            </div>
          </div>
          <div>
            <label
              className={`block text-[10px] font-bold uppercase mb-1 ${textSub}`}>
              End Date
            </label>
            <div className="relative">
              <Calendar
                className={`absolute left-3 top-3.5 ${textSub}`}
                size={14}
              />
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className={`w-full text-sm p-3 pl-9 rounded-xl outline-none transition-colors border focus:border-teal-500 focus:bg-current/10 bg-current/5 border-current/10 text-inherit`}
              />
            </div>
          </div>
        </div>

        <div className={`pt-5 border-t flex justify-end border-current/10`}>
          <button
            type="submit"
            disabled={saving}
            // 🟢 Styled to use dynamic theme gradient
            className={`bg-gradient-to-r ${theme?.gradient || "from-teal-600 to-emerald-600"} text-white text-xs font-black uppercase px-6 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg hover:opacity-90`}>
            {saving ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}{" "}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
