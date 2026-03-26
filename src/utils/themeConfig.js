// src/utils/themeConfig.js

export const TOURNAMENT_THEMES = {
  midnight: {
    id: "midnight",
    name: "Midnight Stadium",
    bgImage:
      "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2500&auto=format&fit=crop",
    globalBg: "bg-[#050505]/80 backdrop-blur-md", // Dark overlay
    card: "bg-[#0F1115]/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50",
    text: "text-white",
    sub: "text-gray-400",
    accentText: "text-cyan-400",
    accentBg: "bg-cyan-500",
    gradient: "from-cyan-600 to-blue-600",
  },
  classic: {
    id: "classic",
    name: "Classic Grass",
    bgImage:
      "https://images.unsplash.com/photo-1518091043644-c1d44570a2c9?q=80&w=2500&auto=format&fit=crop",
    globalBg: "bg-green-900/60 backdrop-blur-sm", // Greenish tint
    card: "bg-white/80 backdrop-blur-lg border border-white/40 shadow-xl shadow-green-900/20",
    text: "text-slate-900",
    sub: "text-slate-600",
    accentText: "text-green-700",
    accentBg: "bg-green-600",
    gradient: "from-green-600 to-emerald-600",
  },
  neon: {
    id: "neon",
    name: "Cyber Neon",
    bgImage:
      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2500&auto=format&fit=crop",
    globalBg: "bg-indigo-950/80 backdrop-blur-md",
    card: "bg-indigo-900/40 backdrop-blur-xl border border-fuchsia-500/30 shadow-[0_0_30px_rgba(217,70,239,0.15)]",
    text: "text-fuchsia-50",
    sub: "text-fuchsia-300",
    accentText: "text-fuchsia-400",
    accentBg: "bg-fuchsia-500",
    gradient: "from-fuchsia-600 to-purple-600",
  },
  daylight: {
    id: "daylight",
    name: "Daylight Match",
    // Sunny grass or stadium background
    bgImage:
      "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=2500&auto=format&fit=crop",
    globalBg: "bg-white/60 backdrop-blur-md", // Bright frosted overlay
    card: "bg-white/85 backdrop-blur-xl border border-white shadow-xl shadow-black/5",
    text: "text-slate-900",
    sub: "text-slate-500",
    accentText: "text-emerald-600",
    accentBg: "bg-emerald-500",
    gradient: "from-emerald-500 to-teal-600",
  },
  minimal: {
    id: "minimal",
    name: "Clean Light",
    bgImage: "", // No background image, just clean color
    globalBg: "bg-slate-50",
    card: "bg-white border border-gray-200 shadow-sm",
    text: "text-gray-900",
    sub: "text-gray-500",
    accentText: "text-blue-600",
    accentBg: "bg-blue-600",
    gradient: "from-blue-600 to-indigo-600",
  },
};

// Default theme if a tournament doesn't have one selected yet
export const DEFAULT_THEME = "minimal";
