import React, { useEffect, createContext, useContext, useState } from "react";
import { TOURNAMENT_THEMES, DEFAULT_THEME } from "../utils/themeConfig";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [activeThemeKey, setActiveThemeKey] = useState(() => {
    return localStorage.getItem("userThemePreference") || DEFAULT_THEME;
  });

  const theme =
    TOURNAMENT_THEMES[activeThemeKey] || TOURNAMENT_THEMES[DEFAULT_THEME];

  // 2. Automatically save to local storage whenever the user changes it
  useEffect(() => {
    localStorage.setItem("userThemePreference", activeThemeKey);
  }, [activeThemeKey]);
  const lightMode =
    activeThemeKey === "daylight" || activeThemeKey === "minimal";

  return (
    <ThemeContext.Provider
      value={{
        activeThemeKey,
        setActiveThemeKey, // You will call this when a tournament loads!
        theme,
        themes: TOURNAMENT_THEMES, // Expose all themes in case you want to build a preview UI
        lightMode,
      }}>
      {/* 🟢 THIS IS THE MASTER BACKGROUND WRAPPER */}
      <div
        className="min-h-screen w-full bg-cover bg-center bg-fixed transition-all duration-700"
        style={{ backgroundImage: `url('${theme.bgImage}')` }}>
        {/* The color overlay and blur */}
        <div
          className={`min-h-screen w-full transition-colors duration-700 ${theme.globalBg}`}>
          {children}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
