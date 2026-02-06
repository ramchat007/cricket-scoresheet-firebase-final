import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // 1. Load from Local Storage (Default to Dark Mode)
  const [lightMode, setLightMode] = useState(() => {
    const saved = localStorage.getItem("cricketAppTheme");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("cricketAppTheme", JSON.stringify(lightMode));
  }, [lightMode]);

  const toggleTheme = () => setLightMode((prev) => !prev);

  // 2. Define your Global Colors here
  const theme = lightMode
    ? {
        bg: "bg-gray-100",
        text: "text-gray-900",
        card: "bg-white border-gray-300 shadow-sm",
        sub: "text-gray-500",
        btnBase:
          "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50",
        btnActive: "bg-blue-600 text-white border-blue-700",
        timeline: "bg-gray-200 text-gray-800",
        accent: "text-blue-600",
        isDark: false,
      }
    : {
        bg: "bg-black", // Matches your current MainApp bg-black
        text: "text-gray-200", // Matches your current text-gray-200
        card: "bg-gray-900/50 border-white/5",
        sub: "text-gray-500",
        btnBase:
          "bg-[#1C2128] border border-white/5 text-slate-300 hover:bg-[#252b36]",
        btnActive: "bg-[#00b4d8] text-black border-[#0096c7]",
        timeline: "bg-slate-800 text-slate-400",
        accent: "text-cyan-500",
        isDark: true,
      };

  return (
    <ThemeContext.Provider value={{ lightMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
