import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { auth, db } from "../utils/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileData, setProfileData] = useState(null);

  // --- Fetch Profile Logic (Preserved) ---
  useEffect(() => {
    async function fetchProfileData() {
      if (user?.uid) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) setProfileData(snap.data());
        } catch (e) { console.error(e); }
      } else { setProfileData(null); }
    }
    fetchProfileData();
  }, [user]);

  // Block body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }
    return () => { 
        document.body.style.overflow = 'unset';
        document.body.style.touchAction = 'auto';
    };
  }, [isOpen]);

  const displayImage = profileData?.photoURL || user?.photoURL || null;

  // --- Dynamic Links Logic (Preserved & Fixed Segments) ---
  const pathSegments = location.pathname.split("/");
  const tournamentIndex = pathSegments.indexOf("tournaments");
  const tournamentId = tournamentIndex !== -1 && pathSegments.length > tournamentIndex + 1 ? pathSegments[tournamentIndex + 1] : null;

  const links = [
    { name: "Home", path: "/" },
    { name: "Global Stats", path: "/players" }
  ];

  if (tournamentId && tournamentId !== 'auction') {
    links.push({ name: "Tournament", path: `/tournaments/${tournamentId}` });
    links.push({ name: "Auction Room", path: `/tournaments/${tournamentId}/auction` });
  }

  if (user) links.push({ name: "Dashboard", path: "/dashboard" });

  const isActive = (path) => location.pathname === path;

  // --- Logout Logic (Restored) ---
  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
    setIsOpen(false);
  };

  const Logo = () => (
    <Link to="/" className="group flex items-center gap-2" onClick={() => setIsOpen(false)}>
      <div className="bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] w-8 h-8 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
        <span className="text-white text-lg font-bold">⚡</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-white font-black text-xl tracking-tighter uppercase">CRIC</span>
        <span className="text-cyan-500 font-black text-[10px] tracking-[0.3em] uppercase ml-0.5">SCORE</span>
      </div>
    </Link>
  );

  return (
    <>
      {/* 1. MAIN NAVBAR CONTAINER */}
      <nav className="bg-black/90 border-b border-white/5 sticky top-0 z-[100] backdrop-blur-xl h-16 flex items-center shadow-2xl">
        <div className="container mx-auto px-5 flex justify-between items-center">
          <Logo />
          
          {/* DESKTOP MENU (With restored Logout) */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link key={link.path} to={link.path} className={`text-[11px] font-black uppercase tracking-widest transition-all ${isActive(link.path) ? "text-cyan-400" : "text-gray-500 hover:text-white"}`}>
                {link.name}
              </Link>
            ))}

            {user ? (
              <div className="flex items-center gap-5 border-l border-white/10 pl-5">
                <Link to="/profile" className="w-9 h-9 rounded-full border border-white/10 overflow-hidden hover:border-cyan-500 transition-all shadow-lg">
                  {displayImage ? <img src={displayImage} alt="profile" className="w-full h-full object-cover" /> : <div className="bg-gray-800 w-full h-full flex items-center justify-center font-bold text-cyan-500">{user.email?.charAt(0).toUpperCase()}</div>}
                </Link>
                {/* RESTORED DESKTOP LOGOUT BUTTON */}
                <button onClick={handleLogout} className="text-[10px] font-black uppercase text-red-500 hover:text-red-400 transition-colors tracking-widest">
                   Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/register-player" className="text-[10px] font-black uppercase text-gray-400 hover:text-white transition-colors">Register Player</Link>
                <Link to="/login" className="bg-white text-black text-[11px] font-black uppercase px-6 py-2 rounded-full hover:bg-cyan-500 hover:text-white transition-all">Login</Link>
              </div>
            )}
          </div>

          {/* MOBILE TOGGLE */}
          <button onClick={() => setIsOpen(true)} className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </nav>

      {/* 2. FULL SCREEN DRAWER (RESTORED INTERFACE) */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] isolate">
          {/* Blur Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300" onClick={() => setIsOpen(false)} />

          {/* Drawer Body */}
          <div className="absolute inset-y-0 right-0 w-full bg-black border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            
            {/* Drawer Top Header */}
            <div className="flex justify-between items-center px-6 h-20 border-b border-white/5 bg-black">
              <Logo />
              <button onClick={() => setIsOpen(false)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white transition-all active:scale-90">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Links Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] mb-8 block">Tournament Navigation</label>
              
              <div className="space-y-3">
                {links.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between p-6 rounded-[2rem] text-xl font-black uppercase tracking-tighter transition-all active:scale-95 ${
                      isActive(link.path)
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-500/20"
                        : "bg-white/5 border border-white/5 text-gray-400"
                    }`}
                  >
                    {link.name}
                    {isActive(link.path) && <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]"></div>}
                  </Link>
                ))}
              </div>

              {/* Bottom Auth Actions (RESTORED LOGOUT) */}
              <div className="mt-auto pt-10 pb-8 flex flex-col gap-4">
                {!user ? (
                  <div className="grid grid-cols-1 gap-4">
                    <Link to="/register-player" onClick={() => setIsOpen(false)} className="w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white text-center font-black uppercase tracking-widest text-xs">Register Player</Link>
                    <Link to="/login" onClick={() => setIsOpen(false)} className="w-full py-5 rounded-[2rem] bg-white text-black text-center font-black uppercase tracking-widest text-sm shadow-xl">Login</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Link to="/profile" onClick={() => setIsOpen(false)} className="flex flex-col items-center justify-center gap-2 p-6 rounded-[2.5rem] bg-white/5 border border-white/10 transition-colors active:bg-white/10">
                      <span className="text-2xl">👤</span>
                      <span className="text-[10px] font-black text-gray-500 uppercase">Profile</span>
                    </Link>
                    {/* RESTORED MOBILE LOGOUT BUTTON */}
                    <button onClick={handleLogout} className="flex flex-col items-center justify-center gap-2 p-6 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 transition-all active:bg-red-500/20">
                      <span className="text-2xl">🚪</span>
                      <span className="text-[10px] font-black text-red-500 uppercase">Logout</span>
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