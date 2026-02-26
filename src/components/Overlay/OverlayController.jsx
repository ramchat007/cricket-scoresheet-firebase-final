import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore"; // ✅ Added getDoc and setDoc
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
} from "lucide-react";

export default function OverlayController({ tournamentId, matchId, match }) {
  const { theme, lightMode } = useTheme();

  const fileInputLogoRef = useRef(null);
  const fileInputBannerRef = useRef(null);
  const fileInputAppLogoRef = useRef(null);

  const [config, setConfig] = useState({
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
    appLogo: "", 
    showAppLogo: false,
  });

  // ✅ NEW: Global Logo State
  const [globalLogo, setGlobalLogo] = useState("");

  const [saving, setSaving] = useState(false);
  const [newSponsorName, setNewSponsorName] = useState("");
  const [newSponsorPhone, setNewSponsorPhone] = useState("");
  const [processingImage, setProcessingImage] = useState(false);

  // 1. 🔥 FETCH GLOBAL LOGO ON MOUNT
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

  // 2. SET MATCH OVERLAY DATA
  useEffect(() => {
    if (match?.meta?.overlay) {
      const data = match.meta.overlay;
      if (data.activeView && !data.activeViews)
        data.activeViews = [data.activeView];
      if (!data.sponsors) data.sponsors = [];
      if (!data.fullScreenBanners) data.fullScreenBanners = [];
      setConfig((prev) => ({ ...prev, ...data }));
    }
  }, [match?.meta?.overlay]);

  // 3. 🔥 UPLOAD AND SAVE GLOBALLY (1 Time Upload)
  const handleAppLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400; // High quality for branding
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL("image/webp", 0.9);

        try {
          // A. Save to Global Settings Collection
          await setDoc(doc(db, "settings", "branding"), { defaultLogo: base64 }, { merge: true });
          setGlobalLogo(base64);

          // B. Instantly apply to current Match Overlay
          updateOverlay({
            appLogo: base64,
            showAppLogo: true,
          });
        } catch (err) {
          console.error("Error saving global logo:", err);
          alert("Failed to save global logo securely.");
        }

        e.target.value = null;
        setProcessingImage(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const updateOverlay = async (updates) => {
    setSaving(true);
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "matches", matchId),
        { "meta.overlay": newConfig },
      );
    } catch (e) {
      console.error("Overlay update failed", e);
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
    const currentInn = match?.innings?.[match?.currentInnings || 0];
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

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!newSponsorName.trim()) {
      alert("Please type a Sponsor Name before uploading the logo.");
      e.target.value = null;
      return;
    }

    setProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL("image/webp", 0.8);
        const newSponsor = {
          id: Date.now().toString(),
          name: newSponsorName,
          phone: newSponsorPhone,
          image: base64,
        };

        updateOverlay({ sponsors: [...(config.sponsors || []), newSponsor] });
        setNewSponsorName("");
        setNewSponsorPhone("");
        e.target.value = null;
        setProcessingImage(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1280;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL("image/webp", 0.7);
        const newBanner = { id: Date.now().toString(), image: base64 };

        updateOverlay({
          fullScreenBanners: [...(config.fullScreenBanners || []), newBanner],
        });
        e.target.value = null;
        setProcessingImage(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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

  const currentInn = match?.innings?.[match?.currentInnings || 0];
  const strikerName = currentInn?.striker || "";
  const nonStrikerName = currentInn?.nonStriker || "";
  const bowlerName = currentInn?.currentBowler || "";
  const liveScore = `${currentInn?.score || 0}/${currentInn?.wickets || 0}`;
  const liveOvers = `${currentInn?.over || 0}.${currentInn?.overBallCount || 0}`;

  const allPlayers = [
    ...(match?.teamASquad || []),
    ...(match?.teamBSquad || []),
  ];
  const strikerId = allPlayers.find((p) => p.name === strikerName)?.id;
  const nonStrikerId = allPlayers.find((p) => p.name === nonStrikerName)?.id;
  const bowlerId = allPlayers.find((p) => p.name === bowlerName)?.id;

  const cardClass = `p-5 rounded-2xl border shadow-sm transition-all flex flex-col h-full ${lightMode ? "bg-white border-gray-200" : "bg-[#161920] border-white/5"}`;
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
      className={`w-full py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-between transition-all shadow-md active:scale-95 ${active ? `${colorClass} text-white shadow-lg shadow-teal-500/20 ring-2 ring-white/20` : lightMode ? "bg-gray-100 text-gray-500 hover:bg-gray-200" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
      <div className="flex items-center gap-2">
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${active ? "border-white bg-white/20" : "border-current opacity-50"}`}>
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
      className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-white ${colorClass} hover:opacity-90`}>
      <Play size={14} fill="currentColor" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div
        className={`flex items-start md:items-center justify-between p-5 rounded-2xl border shadow-lg flex-col md:flex-row gap-4 ${lightMode ? "bg-gradient-to-r from-indigo-50 to-white border-indigo-100 text-indigo-900" : "bg-gradient-to-r from-indigo-900/30 to-[#0F1115] border-indigo-500/20 text-indigo-100"}`}>
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
              href={`/overlay/${tournamentId}/broadcast/${matchId}`}
              target="_blank"
              rel="noreferrer"
              className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${lightMode ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"}`}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* --- 1. CORE MATCH GRAPHICS --- */}
        <div
          className={`${cardClass} border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-teal-400"></div>
          <div className="flex items-center gap-2 mb-5 text-indigo-500">
            <LayoutTemplate size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Match Graphics
            </h4>
          </div>
          <div className="space-y-3 flex-grow">
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center mb-2">
                <label className={`${labelClass} mb-0`}>App Branding Logo</label>
                {/* Visual indicator */}
                {globalLogo && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500`}>
                    Global Logo Active
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputAppLogoRef.current?.click()}
                  className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border flex items-center justify-center gap-1 ${lightMode ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                  <Upload size={12} /> {globalLogo ? "Update Global Logo" : "Set Global Logo"}
                </button>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputAppLogoRef}
                  className="hidden"
                  onChange={handleAppLogoUpload}
                />
              </div>
            </div>
            
            <ToggleButton
              label="Show Brand Logo on Screen"
              active={config.showAppLogo}
              onClick={() => {
                const newStatus = !config.showAppLogo;
                // If we are turning it on, make sure the overlay object has the global logo data
                if (newStatus && globalLogo) {
                   updateOverlay({ showAppLogo: newStatus, appLogo: globalLogo });
                } else if (newStatus && !globalLogo) {
                   alert("Please upload a Global Logo first!");
                } else {
                   updateOverlay({ showAppLogo: newStatus });
                }
              }}
              icon={Star}
              colorClass="bg-gradient-to-r from-indigo-600 to-blue-500"
            />

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

        {/* --- 2. BREAK SCREENS --- */}
        <div
          className={`${cardClass} border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)] relative overflow-hidden`}>
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
                  className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${lightMode ? "bg-white hover:bg-gray-50 border-gray-200" : "bg-white/5 hover:bg-white/10 border-white/10"}`}>
                  {processingImage ? (
                    <span className="animate-pulse">Compressing...</span>
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
                  className={`p-2 rounded-xl border flex gap-2 overflow-x-auto ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                  {config.fullScreenBanners.map((b) => (
                    <div key={b.id} className="relative shrink-0">
                      <img
                        src={b.image}
                        alt=""
                        className="h-12 w-20 object-cover rounded border border-white/10"
                      />
                      <button
                        onClick={() => removeBanner(b.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow">
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

        {/* --- 3. UPLOAD SPONSORS LOGOS --- */}
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
                  placeholder="Sponsor Name"
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
                  onClick={() => fileInputLogoRef.current?.click()}
                  disabled={processingImage}
                  className={`px-4 rounded-xl flex items-center justify-center transition-all border ${lightMode ? "bg-white hover:bg-gray-50 border-gray-200" : "bg-white/5 hover:bg-white/10 border-white/10"}`}>
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
                  className={`p-2 rounded-xl border max-h-24 overflow-y-auto ${lightMode ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"}`}>
                  {config.sponsors.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-1.5 border-b last:border-0 ${lightMode ? "border-gray-200" : "border-white/5"}`}>
                      <img
                        src={s.image}
                        alt=""
                        className="w-8 h-8 rounded object-contain bg-white/10 border border-white/10"
                      />
                      <div className="flex flex-col flex-1 truncate">
                        <span className="text-[10px] font-bold uppercase">
                          {s.name}
                        </span>
                        {s.phone && (
                          <span className="text-[9px] text-slate-500 font-mono tracking-widest">
                            {s.phone}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeSponsor(s.id)}
                        className="text-red-500 hover:bg-red-500/10 p-1 rounded">
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

        {/* 🔥 4. MATCH EVENTS & INFO CARDS */}
        <div
          className={`${cardClass} border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)] relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
          <div className="flex items-center gap-2 mb-4 text-green-500">
            <Zap size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Events & Info Cards
            </h4>
          </div>

          <div className="space-y-4 flex-grow flex flex-col">
            <div>
              <p
                className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${theme.sub}`}>
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
            </div>

            <div className="pt-3 border-t border-black/5 dark:border-white/5">
              <p
                className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${theme.sub}`}>
                Full-Screen Info Cards
              </p>
              <div className="space-y-2.5">
                <ToggleButton
                  label="Over Summary"
                  active={isActive("SUMMARY_CARD")}
                  onClick={() => toggleView("SUMMARY_CARD")}
                  icon={BarChart}
                  colorClass="bg-indigo-600"
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
            </div>
          </div>
        </div>

        {/* --- 5. PLAYER SPOTLIGHT --- */}
        <div
          className={`${cardClass} border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)] relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-400"></div>
          <div className="flex items-center gap-2 mb-5 text-teal-500">
            <Target size={20} />
            <h4 className="font-black uppercase italic tracking-tight text-sm">
              Live Player Spotlight
            </h4>
          </div>
          <div className="space-y-4 flex-grow flex flex-col">
            <p className={`text-xs font-medium mb-2 ${theme.sub}`}>
              Select a player to flash their live match stats.
            </p>
            <select
              className={inputClass}
              value={config.spotlightPlayerId}
              onChange={(e) =>
                updateOverlay({ spotlightPlayerId: e.target.value })
              }>
              <option value="">-- Select Active Player --</option>
              {strikerName && (
                <option value={strikerId}>🏏 Striker: {strikerName}</option>
              )}
              {nonStrikerName && (
                <option value={nonStrikerId}>
                  🏏 Non-Striker: {nonStrikerName}
                </option>
              )}
              {bowlerName && (
                <option value={bowlerId}>🥎 Bowler: {bowlerName}</option>
              )}
              <optgroup label="Other Players">
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="mt-auto pt-4">
              <ToggleButton
                label="Show Player Profile"
                active={isActive("SPOTLIGHT")}
                onClick={() => {
                  if (!config.spotlightPlayerId)
                    return alert("Select a player first!");
                  toggleView("SPOTLIGHT");
                }}
                icon={Target}
                colorClass="bg-teal-500"
              />
            </div>
          </div>
        </div>

        {/* --- 6. NEWS TICKER & ALERT --- */}
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
                  className={`px-4 rounded-xl font-bold text-xs uppercase ${config.showTicker ? "bg-slate-700 text-white" : lightMode ? "bg-gray-200 text-gray-500" : "bg-white/10 text-white"}`}>
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