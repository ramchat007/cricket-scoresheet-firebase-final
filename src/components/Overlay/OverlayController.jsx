import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import {
  Tv,
  Users,
  Type,
  Image as ImageIcon,
  Award,
  Activity,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";

export default function OverlayController({ tournamentId, matchId, match }) {
  const { theme, lightMode } = useTheme();

  const [config, setConfig] = useState({
    activeView: "NONE", // Now supports: "PARTNERSHIP", "MINI_SCORE"
    showTicker: false,
    sponsorText: "",
    organizerName: "",
    customMessageTitle: "",
    customMessageBody: "",
    tickerText: "",
    spotlightPlayerId: "",
  });

  const [saving, setSaving] = useState(false);

  // Sync with current overlay state
  useEffect(() => {
    if (match?.meta?.overlay) {
      setConfig((prev) => ({ ...prev, ...match.meta.overlay }));
    }
  }, [match?.meta?.overlay]);

  const updateOverlay = async (updates) => {
    setSaving(true);
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        {
          "meta.overlay": newConfig,
        },
      );
    } catch (e) {
      console.error("Overlay update failed", e);
    } finally {
      setSaving(false);
    }
  };

  const toggleView = (viewName) => {
    const newView = config.activeView === viewName ? "NONE" : viewName;
    updateOverlay({ activeView: newView });
  };

  // --- 🔴 LIVE CONTEXT EXTRACTION ---
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  const strikerName = currentInn?.striker || "";
  const nonStrikerName = currentInn?.nonStriker || "";
  const bowlerName = currentInn?.currentBowler || "";
  const liveScore = `${currentInn?.score || 0}/${currentInn?.wickets || 0}`;
  const liveOvers = `${currentInn?.over || 0}.${currentInn?.overBallCount || 0}`;

  // Helper to find player IDs from names
  const allPlayers = [
    ...(match?.teamASquad || []),
    ...(match?.teamBSquad || []),
  ];
  const strikerId = allPlayers.find((p) => p.name === strikerName)?.id;
  const nonStrikerId = allPlayers.find((p) => p.name === nonStrikerName)?.id;
  const bowlerId = allPlayers.find((p) => p.name === bowlerName)?.id;

  // --- STYLES ---
  const cardClass = `p-5 rounded-2xl border shadow-sm transition-all flex flex-col ${lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"}`;
  const labelClass = `block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${theme.sub}`;
  const inputClass = `w-full rounded-xl px-4 py-2 text-sm font-bold border focus:outline-none focus:border-teal-500 mb-3 ${lightMode ? "bg-gray-50 border-gray-200 text-black" : "bg-black/20 border-white/10 text-white"}`;

  const ToggleButton = ({
    label,
    isActive,
    onClick,
    icon: Icon,
    color = "green",
  }) => (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
        isActive
          ? `bg-${color}-500 text-white shadow-${color}-500/20`
          : lightMode
            ? "bg-gray-200 text-gray-500 hover:bg-gray-300"
            : "bg-white/5 text-slate-500 hover:bg-white/10"
      }`}>
      <Icon size={16} /> {isActive ? "ON AIR" : label}
      {isActive ? (
        <Eye size={14} className="ml-1" />
      ) : (
        <EyeOff size={14} className="ml-1 opacity-50" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* HEADER WITH LIVE FEEDBACK */}
      <div
        className={`flex items-center justify-between p-4 rounded-2xl ${lightMode ? "bg-indigo-50 text-indigo-900" : "bg-indigo-900/20 text-indigo-200"}`}>
        <div className="flex items-center gap-3">
          <Tv size={24} />
          <div>
            <h3 className="font-black text-lg uppercase italic tracking-tighter">
              Broadcast Control
            </h3>
            <p className="text-xs opacity-70">Source 3 Custom Layer</p>
          </div>
        </div>
        {/* LIVE SCORE HINT FOR PRODUCER */}
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase opacity-70 tracking-widest flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>{" "}
            Live Sync
          </div>
          <div className="text-xl font-black font-mono">
            {currentInn?.battingTeam || "Team"} {liveScore}{" "}
            <span className="text-sm">({liveOvers})</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* --- 1. SMART LIVE ACTIONS --- */}
        <div
          className={`${cardClass} border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)]`}>
          <div className="flex items-center gap-2 mb-4 text-teal-400">
            <Zap size={18} />
            <h4 className="font-bold text-sm uppercase">Quick Live Graphics</h4>
          </div>

          <div className="space-y-3 flex-1">
            <ToggleButton
              label="Mini Scorebug (Top Left)"
              icon={Activity}
              isActive={config.activeView === "MINI_SCORE"}
              onClick={() => toggleView("MINI_SCORE")}
            />
            <ToggleButton
              label="Partnership Card"
              icon={Users}
              isActive={config.activeView === "PARTNERSHIP"}
              onClick={() => toggleView("PARTNERSHIP")}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <label className={labelClass}>Smart Spotlight</label>
            <select
              className={inputClass}
              value={config.spotlightPlayerId}
              onChange={(e) =>
                updateOverlay({ spotlightPlayerId: e.target.value })
              }>
              <option value="">-- Select Player --</option>

              {/* DYNAMIC GROUP: Currently Playing */}
              <optgroup label="🏏 Currently Active">
                {strikerId && (
                  <option value={strikerId}>Striker: {strikerName}</option>
                )}
                {nonStrikerId && (
                  <option value={nonStrikerId}>
                    Non-Str: {nonStrikerName}
                  </option>
                )}
                {bowlerId && (
                  <option value={bowlerId}>Bowler: {bowlerName}</option>
                )}
              </optgroup>

              <optgroup label="Team A">
                {match?.teamASquad?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Team B">
                {match?.teamBSquad?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <ToggleButton
              label="Show Player Card"
              icon={Users}
              isActive={config.activeView === "SPOTLIGHT"}
              onClick={() => toggleView("SPOTLIGHT")}
            />
          </div>
        </div>

        {/* --- 2. SQUADS & BRANDING --- */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-4 text-amber-500">
            <Award size={18} />
            <h4 className="font-bold text-sm uppercase">Squads & Branding</h4>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <ToggleButton
              label="Team A XI"
              icon={Users}
              isActive={config.activeView === "SQUAD_A"}
              onClick={() => toggleView("SQUAD_A")}
            />
            <ToggleButton
              label="Team B XI"
              icon={Users}
              isActive={config.activeView === "SQUAD_B"}
              onClick={() => toggleView("SQUAD_B")}
            />
          </div>

          <div className="my-2 border-t border-dashed border-gray-500/20"></div>

          <div>
            <label className={labelClass}>Sponsor Name / Text</label>
            <input
              className={inputClass}
              placeholder="e.g. Powered By Jio"
              value={config.sponsorText}
              onChange={(e) =>
                setConfig({ ...config, sponsorText: e.target.value })
              }
              onBlur={() => updateOverlay({ sponsorText: config.sponsorText })}
            />
            <ToggleButton
              label="Show Sponsor"
              icon={ImageIcon}
              isActive={config.activeView === "SPONSOR"}
              onClick={() => toggleView("SPONSOR")}
            />
          </div>
        </div>

        {/* --- 3. CUSTOM MESSAGES --- */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-4 text-rose-500">
            <Type size={18} />
            <h4 className="font-bold text-sm uppercase">Alerts & Ticker</h4>
          </div>

          <div className="mb-4">
            <label className={labelClass}>Full Screen Alert Title</label>
            <input
              className={inputClass}
              placeholder="e.g. INNINGS BREAK"
              value={config.customMessageTitle}
              onChange={(e) =>
                setConfig({ ...config, customMessageTitle: e.target.value })
              }
              onBlur={() =>
                updateOverlay({ customMessageTitle: config.customMessageTitle })
              }
            />
            <label className={labelClass}>Message Body</label>
            <input
              className={inputClass}
              placeholder="e.g. Target: 154 Runs"
              value={config.customMessageBody}
              onChange={(e) =>
                setConfig({ ...config, customMessageBody: e.target.value })
              }
              onBlur={() =>
                updateOverlay({ customMessageBody: config.customMessageBody })
              }
            />
            <ToggleButton
              label="Show Alert"
              icon={Tv}
              isActive={config.activeView === "CUSTOM_MSG"}
              onClick={() => toggleView("CUSTOM_MSG")}
            />
          </div>

          <div
            className={`p-3 rounded-xl border mt-auto ${config.showTicker ? "bg-green-500/10 border-green-500/30" : "border-transparent"}`}>
            <label className={labelClass}>Bottom Scrolling Ticker</label>
            <input
              className={inputClass}
              placeholder="e.g. Subscribe for more updates..."
              value={config.tickerText}
              onChange={(e) =>
                setConfig({ ...config, tickerText: e.target.value })
              }
              onBlur={() => updateOverlay({ tickerText: config.tickerText })}
            />
            <ToggleButton
              label={config.showTicker ? "Stop Ticker" : "Start Ticker"}
              icon={Activity}
              isActive={config.showTicker}
              onClick={() => updateOverlay({ showTicker: !config.showTicker })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
