import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import {
  Tv,
  Users,
  Type,
  Award,
  Activity,
  Eye,
  EyeOff,
  Zap,
  MessageSquare,
  LayoutTemplate,
  Trophy,
  Target,
  ExternalLink,
  Play,
  BarChart,
  Check,
  MonitorPlay,
  Star,
  Upload,
  X,
  Image as ImageIcon,
  Monitor,
  Info,
  Volume2,
  VolumeX,
  Palette,
  User,
  Plus,
  Power,
} from "lucide-react";

// ☁️ CLOUDINARY CONFIGURATION
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// 🔥 NEW: DEFAULT BROADCAST CONFIGURATION
const DEFAULT_CONFIG = {
  activeViews: [],
  showTicker: false,
  hideBottomScoreTicker: false,
  sponsors: [],
  fullScreenBanners: [],
  organizerName: "",
  customMessageTitle: "",
  customMessageBody: "",
  tickerText: "",
  spotlightPlayerId: "",
  autoSpotlightEnabled: true, // ✅ Forced ON by default
  appLogo: "",
  showAppLogo: true, // ✅ Forced ON by default
  broadcastAudioEnabled: true,
};

export default function OverlayController({ tournamentId, matchId, match }) {
  const { theme, lightMode } = useTheme();

  const fileInputLogoRef = useRef(null);
  const fileInputBannerRef = useRef(null);
  const fileInputAppLogoRef = useRef(null);

  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const [globalLogo, setGlobalLogo] = useState("");
  const [saving, setSaving] = useState(false);
  const [newSponsorName, setNewSponsorName] = useState("");
  const [newSponsorPhone, setNewSponsorPhone] = useState("");
  const [processingImage, setProcessingImage] = useState(false);

  const [teamAColor, setTeamAColor] = useState("#0284c7");
  const [teamBColor, setTeamBColor] = useState("#e11d48");

  // 🔥 NEW: LIVE SYNC & AUTO-SAVE COLORS FROM DATABASE
  useEffect(() => {
    const fetchLiveTeamColors = async () => {
      if (!tournamentId || !match?.meta) return;

      let fetchedAColor = match.meta.teamAColor;
      let fetchedBColor = match.meta.teamBColor;
      let needsAutoSave = false;

      try {
        if (!fetchedAColor && match.meta.teamAId) {
          const teamASnap = await getDoc(
            doc(db, "tournaments", tournamentId, "teams", match.meta.teamAId),
          );
          if (teamASnap.exists() && teamASnap.data().color) {
            fetchedAColor = teamASnap.data().color;
            needsAutoSave = true;
          }
        }
        if (!fetchedBColor && match.meta.teamBId) {
          const teamBSnap = await getDoc(
            doc(db, "tournaments", tournamentId, "teams", match.meta.teamBId),
          );
          if (teamBSnap.exists() && teamBSnap.data().color) {
            fetchedBColor = teamBSnap.data().color;
            needsAutoSave = true;
          }
        }

        // Apply fallbacks if teams don't have colors set
        const finalAColor = fetchedAColor || "#0284c7";
        const finalBColor = fetchedBColor || "#e11d48";

        setTeamAColor(finalAColor);
        setTeamBColor(finalBColor);

        // If the match doc was missing colors, force save them so the ticker picks them up immediately!
        if (needsAutoSave || !match.meta.teamAColor || !match.meta.teamBColor) {
          await updateDoc(
            doc(db, "tournaments", tournamentId, "matches", matchId),
            {
              "meta.teamAColor": finalAColor,
              "meta.teamBColor": finalBColor,
            },
          );
        }
      } catch (error) {
        console.error("Error fetching live team colors:", error);
      }
    };

    fetchLiveTeamColors();
  }, [tournamentId, matchId, match?.meta?.teamAId, match?.meta?.teamBId]);

  const teamASquad = match?.teamASquad || [];
  const teamBSquad = match?.teamBSquad || [];
  const currentInn = match?.innings?.[match?.currentInnings || 0];
  const liveStriker = currentInn?.striker;
  const liveBowler = currentInn?.currentBowler;

  const getPlayerIdByName = (name) => {
    if (!name) return null;
    const allPlayers = [...teamASquad, ...teamBSquad];
    const p = allPlayers.find(
      (x) => x.name?.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return p?.id;
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data.secure_url;
  };

  useEffect(() => {
    if (!tournamentId || !matchId) return;

    const overlayRef = doc(db, "tournaments", tournamentId, "matches", matchId);
    const unsubscribe = onSnapshot(overlayRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()?.meta?.overlay;
        if (data) {
          if (data.activeView && !data.activeViews)
            data.activeViews = [data.activeView];
          if (!data.sponsors) data.sponsors = [];
          if (!data.fullScreenBanners) data.fullScreenBanners = [];
          setConfig((prev) => ({ ...DEFAULT_CONFIG, ...prev, ...data }));
        }
      }
    });
    return () => unsubscribe();
  }, [tournamentId, matchId]);

  useEffect(() => {
    const fetchGlobalBranding = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "branding"));
        if (snap.exists() && snap.data().defaultLogo) {
          setGlobalLogo(snap.data().defaultLogo);
        }
      } catch (e) {
        console.error("Failed to fetch global branding", e);
      }
    };
    fetchGlobalBranding();
  }, []);

  const updateOverlay = async (updates) => {
    setSaving(true);
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);

    try {
      await setDoc(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        { meta: { overlay: newConfig } },
        { merge: true },
      );
    } catch (e) {
      console.error("Overlay update failed", e);
      alert("Failed to save setting to the cloud.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeamColors = async () => {
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        {
          "meta.teamAColor": teamAColor,
          "meta.teamBColor": teamBColor,
        },
      );
      alert("✅ Team colors successfully updated on the live broadcast!");
    } catch (e) {
      console.error("Failed to save team colors", e);
      alert("Failed to save team colors.");
    } finally {
      setSaving(false);
    }
  };

  const toggleView = (viewName) => {
    const currentViews = config.activeViews || [];
    let newViews = currentViews.includes(viewName)
      ? currentViews.filter((v) => v !== viewName)
      : [...currentViews, viewName];
    updateOverlay({ activeViews: newViews });
  };

  const isActive = (viewName) => config.activeViews?.includes(viewName);

  const triggerManualAnimation = (type) => {
    const timeline = currentInn?.timeline || [];
    const lastBall = timeline.length > 0 ? timeline[timeline.length - 1] : null;

    if (!lastBall) return alert("Cannot trigger: No balls bowled yet!");
    if (type === "FOUR" && lastBall.runs !== 4)
      return alert("Cannot trigger: The last ball was not a 4!");
    if (type === "SIX" && lastBall.runs !== 6)
      return alert("Cannot trigger: The last ball was not a 6!");
    if (type === "WICKET" && !lastBall.isWicket)
      return alert("Cannot trigger: The last ball was not a Wicket!");

    updateOverlay({
      manualAnimation: type,
      manualAnimationTrigger: Date.now(),
    });
  };

  const triggerLiveSpotlight = (playerName) => {
    const pId = getPlayerIdByName(playerName);
    if (!pId) return alert("Player not found in team squads!");

    const currentViews = config.activeViews || [];
    const newViews = currentViews.includes("SPOTLIGHT")
      ? currentViews
      : [...currentViews, "SPOTLIGHT"];

    updateOverlay({ spotlightPlayerId: pId, activeViews: newViews });
  };

  const handleAppLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProcessingImage(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      await setDoc(
        doc(db, "settings", "branding"),
        { defaultLogo: secureUrl },
        { merge: true },
      );
      setGlobalLogo(secureUrl);
      updateOverlay({ appLogo: secureUrl, showAppLogo: true });
    } catch (err) {
      console.error("Error uploading logo:", err);
      alert("Failed to upload logo to Cloudinary.");
    } finally {
      e.target.value = null;
      setProcessingImage(false);
    }
  };

  // 🔥 UPDATED: Sponsor name is no longer required for image uploads
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProcessingImage(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      const newSponsor = {
        id: Date.now().toString(),
        name: newSponsorName.trim(), // Will save as empty string if left blank
        phone: newSponsorPhone.trim(),
        image: secureUrl,
      };

      updateOverlay({ sponsors: [...(config.sponsors || []), newSponsor] });
      setNewSponsorName("");
      setNewSponsorPhone("");
    } catch (err) {
      console.error("Error uploading sponsor logo:", err);
      alert("Failed to upload sponsor logo.");
    } finally {
      e.target.value = null;
      setProcessingImage(false);
    }
  };

  const handleTextSponsorAdd = () => {
    if (!newSponsorName.trim()) {
      alert("Please type a Sponsor Name for text-only partners.");
      return;
    }
    const newSponsor = {
      id: Date.now().toString(),
      name: newSponsorName,
      phone: newSponsorPhone,
      image: "",
    };
    updateOverlay({ sponsors: [...(config.sponsors || []), newSponsor] });
    setNewSponsorName("");
    setNewSponsorPhone("");
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if ((config.fullScreenBanners || []).length >= 15) {
      alert("Maximum of 15 banners allowed. Please delete one first.");
      e.target.value = null;
      return;
    }

    setProcessingImage(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      const newBanner = { id: Date.now().toString(), image: secureUrl };

      updateOverlay({
        fullScreenBanners: [...(config.fullScreenBanners || []), newBanner],
      });
    } catch (err) {
      console.error("Error uploading banner:", err);
      alert("Failed to upload banner.");
    } finally {
      e.target.value = null;
      setProcessingImage(false);
    }
  };

  const removeSponsor = (id) =>
    updateOverlay({
      sponsors: (config.sponsors || []).filter((s) => s.id !== id),
    });
  const removeBanner = (id) =>
    updateOverlay({
      fullScreenBanners: (config.fullScreenBanners || []).filter(
        (b) => b.id !== id,
      ),
    });

  const liveScore = `${currentInn?.score || 0}/${currentInn?.wickets || 0}`;
  const liveOvers = `${currentInn?.over || 0}.${currentInn?.overBallCount || 0}`;

  const cardClass = `p-5 rounded-2xl border shadow-sm transition-all flex flex-col ${lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"}`;
  const labelClass = `block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${theme.sub}`;
  const inputClass = `w-full rounded-xl px-4 py-3 text-xs font-bold border focus:outline-none transition-colors mb-3 ${lightMode ? "bg-gray-50 border-gray-200 focus:bg-white focus:border-indigo-500 text-black" : "bg-black/20 border-white/10 focus:bg-black focus:border-indigo-500 text-white"}`;

  const ToggleButton = ({
    label,
    active,
    onClick,
    icon: Icon,
    colorClass = "bg-teal-500",
  }) => (
    <button
      onClick={onClick}
      className={`w-full py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-between transition-all shadow-md active:scale-95 ${active ? `${colorClass} text-white shadow-lg shadow-teal-500/20 ring-2 ring-white/20` : lightMode ? "bg-gray-100 text-gray-500 hover:bg-gray-200" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${active ? "border-white bg-white/20" : "border-current opacity-50"}`}
        >
          {active && <Check size={12} strokeWidth={4} />}
        </div>
        <Icon
          size={16}
          className={active ? "text-white ml-1" : "opacity-70 ml-1"}
        />
        <span className="text-left leading-tight ml-1">{label}</span>
      </div>
      {active ? <Eye size={16} /> : <EyeOff size={16} className="opacity-40" />}
    </button>
  );

  const TriggerButton = ({ label, onClick, colorClass }) => (
    <button
      onClick={onClick}
      className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-white ${colorClass} hover:opacity-90`}
    >
      <Play size={14} fill="currentColor" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div
        className={`flex items-start md:items-center justify-between p-5 rounded-2xl border shadow-lg flex-col md:flex-row gap-4 ${lightMode ? "bg-gradient-to-r from-indigo-50 to-white border-indigo-100 text-indigo-900" : "bg-gradient-to-r from-indigo-900/30 to-[#0F1115] border-indigo-500/20 text-indigo-100"}`}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <Tv size={28} />
          </div>
          <div>
            <h3 className="font-black text-xl uppercase italic tracking-tighter leading-none mb-1">
              Broadcast Control
            </h3>
            <p className="text-xs opacity-70 font-bold uppercase tracking-widest">
              OBS Overlay Manager
            </p>
            <a
              href={`/overlay/${tournamentId}/broadcast/active?clean=true`}
              target="_blank"
              rel="noreferrer"
              className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${lightMode ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"}`}
            >
              <ExternalLink size={12} /> Open Live Preview
            </a>
          </div>
        </div>
        <div className="text-left md:text-right flex flex-col items-start md:items-end w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-indigo-500/20">
          <div className="text-[10px] font-black uppercase opacity-80 tracking-widest flex items-center gap-1.5 mb-1 bg-red-500/10 text-red-500 px-2 py-1 rounded-md">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>{" "}
            Live Stream Sync
          </div>
          <div className="text-2xl font-black font-mono tracking-tight">
            <span className="text-sm font-sans mr-2 opacity-70">
              {currentInn?.battingTeam || "Batting"}
            </span>{" "}
            {liveScore}{" "}
            <span className="text-lg opacity-50 ml-1">({liveOvers})</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {/* --- 1A. BRANDING & COLORS --- */}
        <div
          className={`${cardClass} border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] relative overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-teal-400"></div>
          <div className="flex items-center gap-2 mb-5 text-indigo-500">
            <Palette size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Branding & Colors
            </h4>
          </div>
          <div className="space-y-3 flex-grow">
            <div className="pt-2 pb-4">
              <p
                className={`text-[10px] uppercase font-bold tracking-widest mb-3 ${theme.sub}`}
              >
                Scorebug Team Colors
              </p>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1 bg-black/10 dark:bg-white/5 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                  <label
                    className={`text-[10px] font-bold block mb-2 truncate ${theme.text}`}
                  >
                    {match?.meta?.teamA || "Team A"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={teamAColor}
                      onChange={(e) => setTeamAColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span
                      className={`text-xs font-mono uppercase ${theme.sub}`}
                    >
                      {teamAColor}
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-black/10 dark:bg-white/5 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                  <label
                    className={`text-[10px] font-bold block mb-2 truncate ${theme.text}`}
                  >
                    {match?.meta?.teamB || "Team B"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={teamBColor}
                      onChange={(e) => setTeamBColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span
                      className={`text-xs font-mono uppercase ${theme.sub}`}
                    >
                      {teamBColor}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveTeamColors}
                disabled={saving}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${lightMode ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30"}`}
              >
                Save Colors to Broadcast
              </button>
            </div>

            <div className="pt-4 border-t border-black/10 dark:border-white/10">
              <div className="flex justify-between items-center mb-2">
                <label className={`${labelClass} mb-0`}>
                  App Branding Logo
                </label>
                {match?.meta?.overlay?.appLogo ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-500">
                    Custom Active
                  </span>
                ) : globalLogo ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                    Global Active
                  </span>
                ) : null}
              </div>

              {(match?.meta?.overlay?.appLogo || globalLogo) && (
                <div
                  className={`mb-3 p-4 rounded-xl border flex flex-col items-center justify-center ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/10"}`}
                >
                  <img
                    src={match?.meta?.overlay?.appLogo || globalLogo}
                    alt="Broadcast Logo"
                    className="max-h-16 w-auto object-contain drop-shadow-md mb-2"
                  />
                </div>
              )}

              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => fileInputAppLogoRef.current?.click()}
                  className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border flex items-center justify-center gap-1 ${lightMode ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                >
                  <Upload size={12} />{" "}
                  {match?.meta?.overlay?.appLogo
                    ? "Change Custom"
                    : "Upload Custom"}
                </button>
                {match?.meta?.overlay?.appLogo && (
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          "Remove custom logo and revert to Global Default?",
                        )
                      ) {
                        try {
                          await updateDoc(
                            doc(
                              db,
                              "tournaments",
                              tournamentId,
                              "matches",
                              match.id,
                            ),
                            { "meta.overlay.appLogo": "" },
                          );
                        } catch (err) {
                          console.error("Error removing logo:", err);
                        }
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-black transition-all border flex items-center justify-center text-red-500 ${lightMode ? "bg-red-50 border-red-200 hover:bg-red-100" : "bg-red-500/10 border-red-500/20 hover:bg-red-500/30"}`}
                    title="Revert to Global Logo"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputAppLogoRef}
                  className="hidden"
                  onChange={handleAppLogoUpload}
                />
              </div>
              <ToggleButton
                label="Show Brand Logo on Screen"
                active={config.showAppLogo}
                onClick={() => {
                  const newStatus = !config.showAppLogo;
                  if (newStatus && globalLogo)
                    updateOverlay({
                      showAppLogo: newStatus,
                      appLogo: globalLogo,
                    });
                  else if (newStatus && !globalLogo)
                    alert("Please upload a Global Logo first!");
                  else updateOverlay({ showAppLogo: newStatus });
                }}
                icon={Star}
                colorClass="bg-cyan-600"
              />
            </div>
          </div>
        </div>

        {/* --- 1B. MATCH DISPLAYS --- */}
        <div
          className={`${cardClass} border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)] relative overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
          <div className="flex items-center gap-2 mb-5 text-cyan-500">
            <LayoutTemplate size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Match Displays
            </h4>
          </div>
          <div className="space-y-2.5 flex-grow flex flex-col">
            <ToggleButton
              label="Hide Bottom Score Bar"
              active={config.hideBottomScoreTicker}
              onClick={() =>
                updateOverlay({
                  hideBottomScoreTicker: !config.hideBottomScoreTicker,
                })
              }
              icon={EyeOff}
              colorClass="bg-slate-700"
            />
            <ToggleButton
              label="Mini Scorebug (Corner)"
              active={isActive("MINI_SCORE")}
              onClick={() => toggleView("MINI_SCORE")}
              icon={Zap}
              colorClass="bg-blue-600"
            />
            <ToggleButton
              label="Current Partnership"
              active={isActive("PARTNERSHIP")}
              onClick={() => toggleView("PARTNERSHIP")}
              icon={Activity}
              colorClass="bg-amber-500"
            />
            <ToggleButton
              label={`${match?.meta?.teamA || "Team A"} Playing XI`}
              active={isActive("SQUAD_A")}
              onClick={() => toggleView("SQUAD_A")}
              icon={Users}
              colorClass="bg-blue-600"
            />
            <ToggleButton
              label={`${match?.meta?.teamB || "Team B"} Playing XI`}
              active={isActive("SQUAD_B")}
              onClick={() => toggleView("SQUAD_B")}
              icon={Users}
              colorClass="bg-rose-600"
            />
          </div>
        </div>

        {/* --- 2. PLAYER SPOTLIGHT --- */}
        <div
          className={`${cardClass} border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)] relative overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
          <div className="flex items-center gap-2 mb-5 text-teal-500">
            <User size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Player Spotlight
            </h4>
          </div>

          <div className="space-y-4 flex-grow flex flex-col">
            <div className="pb-4 border-b border-black/10 dark:border-white/10">
              <p
                className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${theme.sub}`}
              >
                Live Crease Controls
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    liveStriker
                      ? triggerLiveSpotlight(liveStriker)
                      : alert("No striker selected!")
                  }
                  className={`flex-1 py-2 px-3 rounded-xl border text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${lightMode ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"}`}
                >
                  🏏 {liveStriker || "Striker"}
                </button>
                <button
                  onClick={() =>
                    liveBowler
                      ? triggerLiveSpotlight(liveBowler)
                      : alert("No bowler selected!")
                  }
                  className={`flex-1 py-2 px-3 rounded-xl border text-[11px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${lightMode ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"}`}
                >
                  🥎 {liveBowler || "Bowler"}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>Manual Player Selection</label>
              <div className="relative">
                <select
                  className={`${inputClass} cursor-pointer appearance-none`}
                  value={config.spotlightPlayerId || ""}
                  onChange={(e) =>
                    updateOverlay({ spotlightPlayerId: e.target.value })
                  }
                >
                  <option value="" className="text-gray-500">
                    -- Choose a Player --
                  </option>
                  {teamASquad.length > 0 && (
                    <optgroup label={match?.meta?.teamA || "Team A"}>
                      {teamASquad.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {teamBSquad.length > 0 && (
                    <optgroup label={match?.meta?.teamB || "Team B"}>
                      {teamBSquad.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div
                  className={`absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none mb-3 transition-colors ${theme.sub}`}
                >
                  ▼
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-2">
              <ToggleButton
                label="Auto-Show Incoming Batter & Bowler (12s)"
                active={config.autoSpotlightEnabled}
                onClick={() =>
                  updateOverlay({
                    autoSpotlightEnabled: !config.autoSpotlightEnabled,
                  })
                }
                icon={MonitorPlay}
                colorClass="bg-teal-600"
              />
              <ToggleButton
                label="Show Selected Profile"
                active={isActive("SPOTLIGHT")}
                onClick={() => {
                  if (!config.spotlightPlayerId)
                    return alert("Please select a player first!");
                  toggleView("SPOTLIGHT");
                }}
                icon={Eye}
                colorClass="bg-teal-600"
              />
            </div>
          </div>
        </div>

        {/* --- 3. BREAK SCREENS --- */}
        <div
          className={`${cardClass} border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)] relative overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
          <div className="flex items-center gap-2 mb-5 text-yellow-500">
            <MonitorPlay size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Break Banners
            </h4>
          </div>
          <div className="space-y-4 flex-grow flex flex-col">
            <div className="mb-2">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => fileInputBannerRef.current?.click()}
                  disabled={processingImage}
                  className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${lightMode ? "bg-white hover:bg-gray-50 border-gray-200" : "bg-white/5 hover:bg-white/10 border-white/10"}`}
                >
                  {processingImage ? (
                    <span className="animate-pulse">Uploading...</span>
                  ) : (
                    <>
                      <ImageIcon size={14} /> Upload Giant Ad Banner
                    </>
                  )}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputBannerRef}
                  className="hidden"
                  onChange={handleBannerUpload}
                />
              </div>
              {config.fullScreenBanners?.length > 0 && (
                <div
                  className={`p-2 rounded-xl border flex gap-2 overflow-x-auto ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}
                >
                  {config.fullScreenBanners.map((b) => (
                    <div key={b.id} className="relative shrink-0">
                      <img
                        src={b.image}
                        alt=""
                        className="h-12 w-20 object-cover rounded border border-white/10"
                      />
                      <button
                        onClick={() => removeBanner(b.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-auto space-y-3 pt-2">
              <ToggleButton
                label="Show App Tournament Banner"
                active={isActive("APP_TOURNAMENT_BANNER")}
                onClick={() => toggleView("APP_TOURNAMENT_BANNER")}
                icon={Trophy}
                colorClass="bg-yellow-600"
              />
              <ToggleButton
                label="Play Uploaded Ad Banners"
                active={isActive("CUSTOM_AD_BANNERS")}
                onClick={() => {
                  if (config.fullScreenBanners?.length === 0)
                    return alert("Upload an Ad Banner first!");
                  toggleView("CUSTOM_AD_BANNERS");
                }}
                icon={Monitor}
                colorClass="bg-orange-600"
              />
            </div>
          </div>
        </div>

        {/* --- 4. UPLOAD SPONSORS LOGOS --- */}
        <div className={`${cardClass} relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <div className="flex items-center gap-2 mb-5 text-purple-500">
            <Award size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Sponsor Bug
            </h4>
          </div>
          <div className="flex-grow flex flex-col">
            <div className="mb-4">
              <label className={labelClass}>Add Partner</label>
              <div className="flex gap-2 mb-2">
                <input
                  className={`${inputClass} mb-0 flex-[2]`}
                  placeholder="Sponsor Name (Opt)"
                  value={newSponsorName}
                  onChange={(e) => setNewSponsorName(e.target.value)}
                />
                <input
                  className={`${inputClass} mb-0 flex-1`}
                  placeholder="Phone (Opt)"
                  value={newSponsorPhone}
                  onChange={(e) => setNewSponsorPhone(e.target.value)}
                />
                <button
                  onClick={handleTextSponsorAdd}
                  disabled={processingImage || !newSponsorName.trim()}
                  title="Add Text-Only Sponsor"
                  className={`px-3 rounded-xl flex items-center justify-center transition-all border ${lightMode ? "bg-white hover:bg-gray-50 border-gray-200 text-blue-600" : "bg-white/5 hover:bg-white/10 border-white/10 text-blue-400"}`}
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
                <button
                  onClick={() => fileInputLogoRef.current?.click()}
                  disabled={processingImage}
                  title="Upload Logo Image"
                  className={`px-3 rounded-xl flex items-center justify-center transition-all border ${lightMode ? "bg-white hover:bg-gray-50 border-gray-200" : "bg-white/5 hover:bg-white/10 border-white/10"}`}
                >
                  {processingImage ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    <Upload size={16} className={theme.text} />
                  )}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputLogoRef}
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
              {config.sponsors?.length > 0 && (
                <div
                  className={`p-2 rounded-xl border max-h-24 overflow-y-auto ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}
                >
                  {config.sponsors.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-1.5 border-b last:border-0 ${lightMode ? "border-gray-200" : "border-white/5"}`}
                    >
                      {s.image ? (
                        <img
                          src={s.image}
                          alt=""
                          className="w-8 h-8 rounded object-contain bg-white/10 border border-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 font-black text-xs">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col flex-1 truncate">
                        {s.name && (
                          <span className="text-[10px] font-bold uppercase">
                            {s.name}
                          </span>
                        )}
                        {s.phone && (
                          <span className="text-[9px] text-slate-500 font-mono tracking-widest">
                            {s.phone}
                          </span>
                        )}
                        {!s.name && !s.phone && (
                          <span className="text-[10px] text-slate-500 italic">
                            Logo Only
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeSponsor(s.id)}
                        className="text-red-500 hover:bg-red-500/10 p-1 rounded"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-auto space-y-3">
              <ToggleButton
                label="Show Top-Right Sponsor Bug"
                active={isActive("SPONSOR_BUG")}
                onClick={() => toggleView("SPONSOR_BUG")}
                icon={Star}
                colorClass="bg-amber-500"
              />
              <div className="pt-2 border-t border-black/5 dark:border-white/5">
                <label className={labelClass}>Organizer Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Sports Committee"
                  value={config.organizerName}
                  onChange={(e) =>
                    updateOverlay({ organizerName: e.target.value })
                  }
                  onBlur={(e) =>
                    updateOverlay({ organizerName: e.target.value })
                  }
                />
                <ToggleButton
                  label="Show Organizer Card"
                  active={isActive("ORGANIZER")}
                  onClick={() => toggleView("ORGANIZER")}
                  icon={Users}
                  colorClass="bg-purple-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- 5. MATCH EVENTS & AUDIO --- */}
        <div
          className={`${cardClass} border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)] relative overflow-hidden`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
          <div className="flex items-center gap-2 mb-4 text-green-500">
            <Zap size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Events & Audio
            </h4>
          </div>
          <div className="space-y-4 flex-grow flex flex-col">
            <button
              onClick={() => {
                updateOverlay({
                  forceClearOverlay: Date.now(),
                  activeViews: (config.activeViews || []).filter(
                    (v) =>
                      ![
                        "SUMMARY_CARD",
                        "WIN_PREDICTOR",
                        "TOSS_CARD",
                        "INNINGS_BREAK_CARD",
                        "RESULT_CARD",
                        "CUSTOM_MSG",
                        "SPOTLIGHT",
                      ].includes(v),
                  ),
                });
              }}
              className="w-full py-3 px-4 rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20 active:scale-95 text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 border border-red-400/50"
            >
              <X size={18} strokeWidth={4} /> Clear Screen (Kill Switch)
            </button>

            {/* 🔥 NEW: END BROADCAST SESSION BUTTON 🔥 */}
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "End this broadcast? This will release the match lock and jump to the Tournament Banner or the next scheduled match.",
                  )
                ) {
                  updateOverlay({
                    releaseLockTimestamp: Date.now(),
                    activeViews: ["APP_TOURNAMENT_BANNER"], // Auto-trigger the banner on exit
                  });
                }
              }}
              className="w-full mt-2 py-3 px-4 rounded-xl font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/20 active:scale-95 text-white bg-slate-800 hover:bg-slate-700 border border-slate-600"
            >
              <Power size={16} strokeWidth={3} /> End Broadcast & Release
            </button>

            <div>
              <p
                className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${theme.sub}`}
              >
                Instant Event Triggers
              </p>
              <div className="grid grid-cols-3 gap-2">
                <TriggerButton
                  label="4"
                  onClick={() => triggerManualAnimation("FOUR")}
                  colorClass="bg-teal-500"
                />
                <TriggerButton
                  label="6"
                  onClick={() => triggerManualAnimation("SIX")}
                  colorClass="bg-amber-500"
                />
                <TriggerButton
                  label="OUT"
                  onClick={() => triggerManualAnimation("WICKET")}
                  colorClass="bg-red-600"
                />
              </div>
              <div className="mt-6">
                <p
                  className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${theme.sub}`}
                >
                  Automated Stream Audio
                </p>
                <ToggleButton
                  label="Enable Auto-Sounds for 4s, 6s & Wickets"
                  active={config.broadcastAudioEnabled}
                  onClick={() =>
                    updateOverlay({
                      broadcastAudioEnabled: !config.broadcastAudioEnabled,
                    })
                  }
                  icon={config.broadcastAudioEnabled ? Volume2 : VolumeX}
                  colorClass="bg-pink-600"
                />
                <p className="text-[9px] mt-2 opacity-60 italic leading-tight">
                  When ON, the OBS Overlay will automatically play crowd/stadium
                  sounds whenever a boundary or wicket is scored on the
                  timeline.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* --- 6. FULL SCREEN OVERLAYS --- */}
        <div className={`${cardClass} relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div className="flex items-center gap-2 mb-5 text-indigo-500">
            <BarChart size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Full-Screen Overlays
            </h4>
          </div>
          <div className="space-y-3 flex-grow flex flex-col">
            <div className="space-y-2.5">
              <ToggleButton
                label="Over Summary"
                active={isActive("SUMMARY_CARD")}
                onClick={() => toggleView("SUMMARY_CARD")}
                icon={BarChart}
                colorClass="bg-indigo-600"
              />
              <ToggleButton
                label="Live Win Predictor"
                active={isActive("WIN_PREDICTOR")}
                onClick={() => toggleView("WIN_PREDICTOR")}
                icon={Activity}
                colorClass="bg-red-600"
              />
              <ToggleButton
                label="Toss Report"
                active={isActive("TOSS_CARD")}
                onClick={() => toggleView("TOSS_CARD")}
                icon={Info}
                colorClass="bg-indigo-600"
              />
              <ToggleButton
                label="Innings Break / Target"
                active={isActive("INNINGS_BREAK_CARD")}
                onClick={() => toggleView("INNINGS_BREAK_CARD")}
                icon={MonitorPlay}
                colorClass="bg-indigo-600"
              />
              <ToggleButton
                label="Match Result"
                active={isActive("RESULT_CARD")}
                onClick={() => toggleView("RESULT_CARD")}
                icon={Trophy}
                colorClass="bg-indigo-600"
              />
            </div>
            <button
              onClick={() => {
                // Toggles the Match Intro on or off
                const views = config.activeViews || [];
                const newViews = views.includes("MATCH_INTRO")
                  ? views.filter((v) => v !== "MATCH_INTRO")
                  : [...views, "MATCH_INTRO"];
                updateOverlay({ activeViews: newViews });
              }}
              className={`py-3 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border ${
                config.activeViews?.includes("MATCH_INTRO")
                  ? "bg-cyan-500 text-slate-900 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  : "bg-slate-800 text-cyan-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              Match Intro Slab
            </button>

            <button
              onClick={() => {
                // Toggles the Points Table on or off, and forces the bottom ticker to hide while it's up
                const views = config.activeViews || [];
                const isActive = views.includes("POINTS_TABLE");
                const newViews = isActive
                  ? views.filter((v) => v !== "POINTS_TABLE")
                  : [...views, "POINTS_TABLE"];

                updateOverlay({
                  activeViews: newViews,
                  hideBottomScoreTicker: !isActive, // Hide the main ticker if showing full-screen table
                });
              }}
              className={`py-3 px-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border ${
                config.activeViews?.includes("POINTS_TABLE")
                  ? "bg-amber-500 text-slate-900 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                  : "bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700"
              }`}
            >
              Live Points Table
            </button>
          </div>
        </div>

        {/* --- 7. NEWS TICKER & ALERT --- */}
        <div className={`${cardClass} relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500"></div>
          <div className="flex items-center gap-2 mb-5 text-rose-500">
            <MessageSquare size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Alerts & Ticker
            </h4>
          </div>
          <div className="space-y-3 flex-grow flex flex-col">
            <div>
              <label className={labelClass}>News Ticker (Bottom Scroll)</label>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} mb-0 flex-1`}
                  placeholder="e.g. Next match at 10 AM..."
                  value={config.tickerText}
                  onChange={(e) =>
                    updateOverlay({ tickerText: e.target.value })
                  }
                  onBlur={(e) => updateOverlay({ tickerText: e.target.value })}
                />
                <button
                  onClick={() =>
                    updateOverlay({ showTicker: !config.showTicker })
                  }
                  className={`px-4 rounded-xl font-bold text-xs uppercase ${config.showTicker ? "bg-slate-700 text-white" : lightMode ? "bg-gray-200 text-gray-500" : "bg-white/10 text-white"}`}
                >
                  {config.showTicker ? "ON" : "OFF"}
                </button>
              </div>
            </div>
            <div className="pt-3 border-t border-black/5 dark:border-white/5">
              <label className={labelClass}>Custom Full-Screen Flash</label>
              <input
                className={inputClass}
                placeholder="Giant Title (e.g. FREE HIT)"
                value={config.customMessageTitle}
                onChange={(e) =>
                  updateOverlay({ customMessageTitle: e.target.value })
                }
              />
              <input
                className={inputClass}
                placeholder="Subtitle"
                value={config.customMessageBody}
                onChange={(e) =>
                  updateOverlay({ customMessageBody: e.target.value })
                }
              />
            </div>
            <div className="mt-auto pt-2">
              <ToggleButton
                label="Flash Alert on Screen"
                active={isActive("CUSTOM_MSG")}
                onClick={() => toggleView("CUSTOM_MSG")}
                icon={MessageSquare}
                colorClass="bg-rose-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
