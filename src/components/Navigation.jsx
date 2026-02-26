import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
// 1. IMPORT THEME HOOK & ICONS
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileData, setProfileData] = useState(null);
  const [isAuctionEnabled, setIsAuctionEnabled] = useState(false);

  // 2. CONSUME THEME
  const { theme, toggleTheme, lightMode } = useTheme();

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

  // --- Auction Logic ---
  useEffect(() => {
    if (tournamentId && tournamentId !== "auction") {
      const unsub = onSnapshot(
        doc(db, "tournaments", tournamentId),
        (docSnap) => {
          if (docSnap.exists()) {
            setIsAuctionEnabled(docSnap.data().isAuction === true);
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
      {/* <div className="bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] w-8 h-8 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
        <span className="text-white text-lg font-bold">⚡</span>
      </div> */}
      {/* <div className="flex flex-col leading-none">
        <span
          className={`font-black text-xl tracking-tighter uppercase ${lightMode ? "text-gray-900" : "text-white"}`}>
          CRIC
        </span>
        <span className="text-cyan-500 font-black text-[10px] tracking-[0.3em] uppercase ml-0.5">
          SYNC
        </span>
      </div> */}
      <div className="flex flex-col logowrapper">
        <picture>          
          <source
            srcSet={`
              ${
                lightMode
                  ? "/cricsync-light-logo.jpg"
                  : "/cricsync-dark-logo.jpg"
              }`}/>
          <img
            src="/cricsync-light-logo.jpg"
            alt="CricSync Logo"
            className="w-20 h-auto object-contain"
          />
        </picture>
      </div>
    </Link>
  );

  return (
    <>
      {/* 1. MAIN NAVBAR CONTAINER (Dynamic Colors) */}
      <nav
        className={`sticky top-0 z-[100] backdrop-blur-xl h-16 flex items-center shadow-sm border-b transition-colors duration-300
        ${
          lightMode
            ? "bg-white/90 border-gray-200 text-gray-900"
            : "bg-black/90 border-white/5 text-white"
        }`}>
        <div className="container mx-auto px-5 flex justify-between items-center">
          <Logo />

          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[11px] font-black uppercase tracking-widest transition-all ${
                  isActive(link.path)
                    ? "text-cyan-500"
                    : lightMode
                      ? "text-gray-500 hover:text-black"
                      : "text-gray-500 hover:text-white"
                }`}>
                {link.name}
              </Link>
            ))}

            {/* --- DESKTOP THEME TOGGLE --- */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-all active:scale-95 ${
                lightMode
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}>
              {lightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {user ? (
              <div
                className={`flex items-center gap-5 border-l pl-5 ${lightMode ? "border-gray-300" : "border-white/10"}`}>
                <Link
                  to="/profile"
                  className={`w-9 h-9 rounded-full border overflow-hidden hover:border-cyan-500 transition-all shadow-lg ${lightMode ? "border-gray-200" : "border-white/10"}`}>
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt="profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="bg-gray-800 w-full h-full flex items-center justify-center font-bold text-cyan-500">
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
              <div className="flex items-center gap-4">
                <Link
                  to="/register-player"
                  className={`text-[10px] font-black uppercase transition-colors ${lightMode ? "text-gray-500 hover:text-black" : "text-gray-400 hover:text-white"}`}>
                  Register Player
                </Link>
                <Link
                  to="/login"
                  className={`text-[11px] font-black uppercase px-6 py-2 rounded-full hover:bg-cyan-500 hover:text-white transition-all ${
                    lightMode ? "bg-black text-white" : "bg-white text-black"
                  }`}>
                  Login
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className={`md:hidden w-10 h-10 rounded-xl border flex items-center justify-center active:scale-90 transition-transform ${
              lightMode
                ? "bg-gray-100 border-gray-200 text-black"
                : "bg-white/5 border-white/10 text-white"
            }`}>
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

      {/* 2. FULL SCREEN DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] isolate">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`absolute inset-y-0 right-0 w-full border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ${
              lightMode
                ? "bg-white border-gray-200 text-gray-900"
                : "bg-black border-white/10 text-white"
            }`}>
            <div
              className={`flex justify-between items-center px-6 h-20 border-b ${lightMode ? "border-gray-200" : "border-white/5 bg-black"}`}>
              <Logo />

              <div className="flex gap-3">
                {/* --- MOBILE THEME TOGGLE --- */}
                <button
                  onClick={toggleTheme}
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all active:scale-90 ${
                    lightMode
                      ? "bg-gray-100 border-gray-200 text-gray-600"
                      : "bg-white/5 border-white/10 text-white"
                  }`}>
                  {lightMode ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all active:scale-90 ${
                    lightMode
                      ? "bg-gray-100 border-gray-200 text-gray-900"
                      : "bg-white/5 border-white/10 text-white"
                  }`}>
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
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-8 block">
                Navigation
              </label>

              <div className="space-y-3">
                {links.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-6 rounded-[2rem] text-xl font-black uppercase tracking-tighter transition-all active:scale-95 ${
                      isActive(link.path)
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-500/20"
                        : lightMode
                          ? "bg-gray-100 border border-gray-200 text-gray-600"
                          : "bg-white/5 border border-white/5 text-gray-400"
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
                      className={`w-full py-5 rounded-[2rem] border text-center font-black uppercase tracking-widest text-xs ${
                        lightMode
                          ? "bg-gray-100 border-gray-200 text-gray-900"
                          : "bg-white/5 border-white/10 text-white"
                      }`}>
                      Register Player
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setIsOpen(false)}
                      className={`w-full py-5 rounded-[2rem] text-center font-black uppercase tracking-widest text-sm shadow-xl ${
                        lightMode
                          ? "bg-black text-white"
                          : "bg-white text-black"
                      }`}>
                      Login
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-[2.5rem] border transition-colors ${
                        lightMode
                          ? "bg-gray-100 border-gray-200 text-gray-900 active:bg-gray-200"
                          : "bg-white/5 border-white/10 text-white active:bg-white/10"
                      }`}>
                      <span className="text-2xl">👤</span>
                      <span className="text-[10px] font-black text-gray-500 uppercase">
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
