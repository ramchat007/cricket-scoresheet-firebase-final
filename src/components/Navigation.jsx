import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { Palette, ChevronDown, Check } from "lucide-react";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileData, setProfileData] = useState(null);
  const [isAuctionEnabled, setIsAuctionEnabled] = useState(false);

  // 🟢 CONSUME DYNAMIC THEME (Removed lightMode)
  const { theme, themes, activeThemeKey, setActiveThemeKey } = useTheme();

  // Safely fallback to default classes
  const navBg =
    theme?.card || "bg-[#0F1115]/80 backdrop-blur-xl border border-white/10";
  const textMain = theme?.text || "text-white";
  const textSub = theme?.sub || "text-gray-400";
  const accentText = theme?.accentText || "text-cyan-400";
  const gradientBtn = theme?.gradient || "from-cyan-600 to-blue-600";

  // --- Close Dropdown on outside click ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(event.target)
      ) {
        setIsThemeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Fetch Profile Logic ---
  useEffect(() => {
    async function fetchProfileData() {
      if (user?.uid) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) setProfileData(snap.data());
        } catch (e) {
          console.error(e);
        }
      } else {
        setProfileData(null);
      }
    }
    fetchProfileData();
  }, [user]);

  // --- Dynamic Links Logic ---
  const pathSegments = location.pathname.split("/");
  const tournamentIndex = pathSegments.indexOf("tournaments");
  const tournamentId =
    tournamentIndex !== -1 && pathSegments.length > tournamentIndex + 1
      ? pathSegments[tournamentIndex + 1]
      : null;

  // --- Tournament Listener (Auction Status Only) ---
  useEffect(() => {
    if (tournamentId && tournamentId !== "auction") {
      const unsub = onSnapshot(
        doc(db, "tournaments", tournamentId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setIsAuctionEnabled(data.isAuction === true);
          } else {
            setIsAuctionEnabled(false);
          }
        },
      );
      return () => unsub();
    } else {
      setIsAuctionEnabled(false);
    }
  }, [tournamentId]);

  // --- 🟢 NEW: Personal Theme Change Handler (Local Only) ---
  const handleThemeChange = (themeId) => {
    // Instantly update the UI (ThemeContext will automatically save to LocalStorage)
    setActiveThemeKey(themeId);
    setIsThemeOpen(false);
  };

  // Block scroll on mobile menu
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "auto";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "auto";
    };
  }, [isOpen]);

  const displayImage = profileData?.photoURL || user?.photoURL || null;

  // Links Array
  const links = [
    { name: "Home", path: "/" },
    { name: "Global Stats", path: "/players" },
  ];

  if (tournamentId && tournamentId !== "auction") {
    links.push({ name: "Tournament", path: `/tournaments/${tournamentId}` });
    if (user && isAuctionEnabled) {
      links.push({
        name: "Auction Room",
        path: `/tournaments/${tournamentId}/auction`,
      });
    }
  }

  if (user) {
    links.push({ name: "Dashboard", path: "/dashboard" });
  }

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
    setIsOpen(false);
  };

  const Logo = () => (
    <Link
      to="/"
      className="group flex items-center gap-2"
      onClick={() => setIsOpen(false)}>
      <div className="flex flex-col logowrapper">
        <picture>
          <img
            src="/cricsync-light-logo.png"
            alt="CricSync Logo"
            className="w-20 h-auto object-contain drop-shadow-lg"
          />
        </picture>
      </div>
    </Link>
  );

  return (
    <>
      <nav
        className={`sticky top-0 z-[100] h-16 flex items-center shadow-md transition-colors duration-500 ${navBg} border-x-0 border-t-0`}>
        <div className="container mx-auto px-5 flex justify-between items-center">
          <Logo />

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[11px] font-black uppercase tracking-widest transition-all ${
                  isActive(link.path)
                    ? accentText
                    : `${textSub} hover:${textMain}`
                }`}>
                {link.name}
              </Link>
            ))}

            {/* THEME DROPDOWN (DESKTOP) */}
            <div className="relative" ref={themeDropdownRef}>
              <button
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                  isThemeOpen
                    ? "bg-current/10 border-current/20"
                    : "bg-transparent border-current/10 hover:bg-current/5 hover:border-current/20"
                } ${textSub} hover:${textMain}`}>
                <Palette size={14} className={accentText} />
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isThemeOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isThemeOpen && (
                <div
                  className={`absolute top-full right-0 mt-3 w-48 rounded-2xl border ${theme?.card || "bg-black/90"} border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2`}>
                  {Object.values(themes || {}).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                        activeThemeKey === t.id
                          ? "bg-current/10 font-bold " + textMain
                          : `${textSub} hover:bg-current/5 hover:${textMain}`
                      }`}>
                      <span className="text-xs uppercase tracking-widest">
                        {t.name}
                      </span>
                      {activeThemeKey === t.id && (
                        <Check size={14} className={accentText} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <div
                className={`flex items-center gap-5 border-l pl-5 border-current/10`}>
                <Link
                  to="/profile"
                  className={`w-9 h-9 rounded-full border overflow-hidden transition-all shadow-lg border-current/20 hover:border-current/50`}>
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt="profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="bg-black/40 w-full h-full flex items-center justify-center font-bold text-white backdrop-blur-sm">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-black uppercase text-red-500 hover:text-red-400 transition-colors tracking-widest">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 border-l pl-5 border-current/10">
                <Link
                  to="/register-player"
                  className={`text-[10px] font-black uppercase transition-colors ${textSub} hover:${textMain}`}>
                  Register
                </Link>
                <Link
                  to="/login"
                  className={`text-[11px] font-black uppercase px-6 py-2 rounded-full text-white bg-gradient-to-r ${gradientBtn} hover:shadow-lg hover:opacity-90 transition-all`}>
                  Login
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className={`md:hidden w-10 h-10 rounded-xl border flex items-center justify-center active:scale-90 transition-transform bg-current/5 border-current/10 ${textMain}`}>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </nav>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] isolate">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`absolute inset-y-0 right-0 w-full md:w-96 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ${navBg} border-y-0 border-r-0`}>
            <div className="flex justify-between items-center px-6 h-20 border-b border-current/10 bg-black/20">
              <Logo />

              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all active:scale-90 bg-current/10 border-current/20 ${textMain}`}>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              {/* THEME SELECTOR (MOBILE) */}
              <div className="mb-8">
                <label
                  className={`text-[10px] font-black ${textSub} uppercase tracking-[0.4em] mb-4 block flex items-center gap-2`}>
                  <Palette size={12} /> Select Theme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(themes || {}).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-between ${
                        activeThemeKey === t.id
                          ? `bg-gradient-to-r ${gradientBtn} text-white border-transparent`
                          : `bg-current/5 border-current/10 ${textSub}`
                      }`}>
                      {t.name}
                      {activeThemeKey === t.id && (
                        <Check size={12} className="text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <label
                className={`text-[10px] font-black ${textSub} uppercase tracking-[0.4em] mb-4 block`}>
                Navigation
              </label>

              <div className="space-y-3">
                {links.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-6 rounded-[2rem] text-xl font-black uppercase tracking-tighter transition-all active:scale-95 border ${
                      isActive(link.path)
                        ? `bg-gradient-to-r ${gradientBtn} text-white border-transparent shadow-xl`
                        : `bg-current/5 border-current/10 ${textSub}`
                    }`}>
                    {link.name}
                    {isActive(link.path) && (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]"></div>
                    )}
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-10 pb-8 flex flex-col gap-4">
                {!user ? (
                  <div className="grid grid-cols-1 gap-4">
                    <Link
                      to="/register-player"
                      onClick={() => setIsOpen(false)}
                      className={`w-full py-5 rounded-[2rem] border text-center font-black uppercase tracking-widest text-xs bg-current/10 border-current/20 ${textMain}`}>
                      Register Player
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setIsOpen(false)}
                      className={`w-full py-5 rounded-[2rem] text-center font-black uppercase tracking-widest text-sm shadow-xl text-white bg-gradient-to-r ${gradientBtn}`}>
                      Login
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-[2.5rem] border transition-colors bg-current/5 border-current/10 ${textMain} active:bg-current/10`}>
                      <span className="text-2xl">👤</span>
                      <span
                        className={`text-[10px] font-black ${textSub} uppercase`}>
                        Profile
                      </span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex flex-col items-center justify-center gap-2 p-6 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 transition-all active:bg-red-500/20">
                      <span className="text-2xl">🚪</span>
                      <span className="text-[10px] font-black text-red-500 uppercase">
                        Logout
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
