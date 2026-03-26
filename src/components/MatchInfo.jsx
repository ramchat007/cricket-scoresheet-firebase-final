import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import {
  Trophy,
  Calendar,
  MapPin,
  Zap,
  Users,
  Video,
  Save,
  Shield,
  Clock,
  Loader2,
} from "lucide-react";

export default function MatchInfo({ match }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [streamUrl, setStreamUrl] = useState(match.meta?.liveStreamUrl || "");
  const [saving, setSaving] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ✅ Check Permissions: Only show to Owner or Scorer
  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !match?.meta?.tournament) return;
      try {
        const tSnap = await getDoc(
          doc(db, "tournaments", match.meta.tournament),
        );
        if (tSnap.exists()) {
          const tData = tSnap.data();
          // Allow if User is Owner OR in Scorers list
          if (tData.ownerId === user.uid || tData.scorers?.includes(user.uid)) {
            setIsAuthorized(true);
          }
        }
      } catch (e) {
        console.error("Permission check failed", e);
      }
    };
    checkPermission();
  }, [user, match]);

  const handleSaveStream = async () => {
    if (!match?.id || !match?.meta?.tournament) return;
    setSaving(true);
    try {
      const matchRef = doc(
        db,
        "tournaments",
        match.meta.tournament,
        "matches",
        match.id,
      );
      let cleanUrl = streamUrl;
      await updateDoc(matchRef, {
        "meta.liveStreamUrl": cleanUrl,
      });
      alert("Stream linked successfully! Check the header.");
    } catch (e) {
      console.error(e);
      alert("Error saving link");
    } finally {
      setSaving(false);
    }
  };

  if (!match) return null;

  const meta = match.meta || {};
  const currentInn = match.innings?.[match.currentInnings || 0] || {};

  // --- 1. UTILITIES ---
  const formatDate = (dateStr) => {
    if (!dateStr) return "Date TBA";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? dateStr
      : date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  };

  const cleanName = (p) => (typeof p === "object" ? p.name : p) || "Unknown";

  const getPlayerBadge = (name) => {
    const n = cleanName(name);
    if (
      n === cleanName(currentInn.striker) ||
      n === cleanName(currentInn.nonStriker)
    ) {
      return (
        <span
          className={`text-[8px] px-1.5 py-0.5 rounded border font-black ml-auto ${lightMode ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-teal-500/20 text-teal-400 border-teal-500/20"}`}>
          ON FIELD
        </span>
      );
    }
    const stats = currentInn.batsmenStats?.[n];
    if (stats?.out) {
      return (
        <span
          className={`text-[8px] px-1.5 py-0.5 rounded border font-bold ml-auto uppercase ${lightMode ? "bg-red-50 text-red-600 border-red-200" : "bg-red-500/10 text-red-400/60 border-red-500/10"}`}>
          Out
        </span>
      );
    }
    return null;
  };

  const InfoRow = ({ label, value, icon: Icon }) => (
    <div
      className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${
        lightMode
          ? "bg-white border-gray-100 hover:border-teal-200 hover:shadow-md"
          : "bg-[#161920] border-white/5 hover:border-white/10"
      }`}>
      <div className="flex items-center gap-3">
        <span
          className={`text-xl transition-transform group-hover:scale-110 ${lightMode ? "text-teal-600 opacity-80" : "opacity-60"}`}>
          {typeof Icon === "string" ? Icon : <Icon size={20} />}
        </span>
        <span
          className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}>
          {label}
        </span>
      </div>
      <div
        className={`font-bold text-right text-sm tracking-tight ${theme.text}`}>
        {value || "N/A"}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20 px-2 sm:px-0">
      {/* 🔴 LIVE STREAM SETTINGS (Admin Only) */}
      {isAuthorized && (
        <div
          className={`p-5 rounded-2xl border animate-in fade-in slide-in-from-top-4 ${lightMode ? "bg-white border-red-100 shadow-lg" : "bg-[#1C2128] border-white/5"}`}>
          <h3
            className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${theme.text}`}>
            <Video size={16} className="text-red-500" /> Admin: Live Stream
            Config
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="Paste YouTube Link or ID here..."
              className={`flex-1 text-xs p-3 rounded-xl outline-none border transition-all focus:border-red-500 ${
                lightMode
                  ? "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white"
                  : "bg-black border-white/10 text-white focus:bg-black/50"
              }`}
            />
            <button
              onClick={handleSaveStream}
              disabled={saving}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase px-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
              {saving ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Save size={14} />
              )}
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
          <p className={`text-[10px] mt-2 ${theme.sub}`}>
            Visible only to you. Linking a stream enables the video player for
            all viewers.
          </p>
        </div>
      )}

      {/* 1. MATCH ARCHIVE CARD */}
      <div
        className={`border rounded-3xl p-6 shadow-2xl relative overflow-hidden ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        {!lightMode && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
        )}

        <div
          className={`flex items-center gap-3 mb-6 border-b pb-4 ${lightMode ? "border-gray-100" : "border-white/5"}`}>
          <Shield
            size={24}
            className={lightMode ? "text-teal-600" : "text-slate-400"}
          />
          <h3
            className={`text-sm font-black uppercase tracking-widest ${theme.text}`}>
            General Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow
            label="Series"
            value={meta.tournament || "Exhibition"}
            icon={Trophy}
          />
          <InfoRow
            label="Fixture Date"
            value={formatDate(match.date || meta.date)}
            icon={Calendar}
          />
          <InfoRow
            label="Match Format"
            value={`${meta.overs || "?"} Overs`}
            icon={Clock}
          />
          <InfoRow
            label="Arena"
            value={meta.location || meta.venue || "Neutral Ground"}
            icon={MapPin}
          />
          <InfoRow
            label="The Toss"
            value={
              meta.toss
                ? `${meta.toss.winner} (Chose to ${meta.toss.decision})`
                : "Yet to happen"
            }
            icon="🪙"
          />
          <InfoRow
            label="Match Level"
            value={meta.matchType || "Standard"}
            icon={Zap}
          />
        </div>
      </div>

      {/* 2. SQUADS & STATUS CARD */}
      <div
        className={`border rounded-3xl p-6 shadow-2xl relative ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
        <div
          className={`flex items-center gap-3 mb-6 border-b pb-4 ${lightMode ? "border-gray-100" : "border-white/5"}`}>
          <Users
            size={24}
            className={lightMode ? "text-indigo-600" : "text-slate-400"}
          />
          <h3
            className={`text-sm font-black uppercase tracking-widest ${theme.text}`}>
            Active Playing Squads
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TEAM A */}
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl border flex justify-between items-center ${lightMode ? "bg-teal-50 border-teal-100" : "bg-teal-500/10 border-teal-500/20"}`}>
              <span
                className={`font-black uppercase text-xs tracking-tighter ${lightMode ? "text-teal-700" : "text-teal-400"}`}>
                {meta.teamA}
              </span>
              <span
                className={`text-[10px] font-bold uppercase ${lightMode ? "text-teal-600" : "text-teal-600"}`}>
                {match.teamASquad?.length || 0} Players
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(match.teamASquad || []).map((p, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg flex items-center border transition-colors group ${
                    lightMode
                      ? "bg-white border-gray-100 hover:border-teal-200 hover:shadow-sm"
                      : "bg-black/20 border-white/5 hover:bg-black/40"
                  }`}>
                  <span className={`text-[10px] font-mono w-5 ${theme.sub}`}>
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold transition-colors ${theme.text}`}>
                    {cleanName(p)}
                  </span>
                  {getPlayerBadge(p)}
                </div>
              ))}
            </div>
          </div>

          {/* TEAM B */}
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl border flex justify-between items-center ${lightMode ? "bg-indigo-50 border-indigo-100" : "bg-indigo-500/10 border-indigo-500/20"}`}>
              <span
                className={`font-black uppercase text-xs tracking-tighter ${lightMode ? "text-indigo-700" : "text-indigo-400"}`}>
                {meta.teamB}
              </span>
              <span
                className={`text-[10px] font-bold uppercase ${lightMode ? "text-indigo-600" : "text-indigo-600"}`}>
                {match.teamBSquad?.length || 0} Players
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(match.teamBSquad || []).map((p, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg flex items-center border transition-colors group ${
                    lightMode
                      ? "bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm"
                      : "bg-black/20 border-white/5 hover:bg-black/40"
                  }`}>
                  <span className={`text-[10px] font-mono w-5 ${theme.sub}`}>
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold transition-colors ${theme.text}`}>
                    {cleanName(p)}
                  </span>
                  {getPlayerBadge(p)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MATCH OFFICIALS */}
      {(meta.umpires || meta.referee) && (
        <div
          className={`border rounded-2xl p-5 flex flex-wrap gap-6 justify-center shadow-lg ${theme.card} ${lightMode ? "border-gray-200" : "border-white/5"}`}>
          {meta.umpires && (
            <div className="text-center">
              <div
                className={`text-[9px] font-black uppercase tracking-widest mb-1 ${theme.sub}`}>
                Umpires
              </div>
              <div className={`text-xs font-bold ${theme.text}`}>
                {meta.umpires}
              </div>
            </div>
          )}
          {meta.referee && (
            <div className="text-center">
              <div
                className={`text-[9px] font-black uppercase tracking-widest mb-1 ${theme.sub}`}>
                Match Referee
              </div>
              <div className={`text-xs font-bold ${theme.text}`}>
                {meta.referee}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
