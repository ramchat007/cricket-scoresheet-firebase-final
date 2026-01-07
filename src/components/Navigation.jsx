// src/components/Navigation.jsx
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

  // --- NEW STATE: Local Profile Data ---
  const [profileData, setProfileData] = useState(null);

  // --- NEW EFFECT: Fetch Real-time Profile Data ---
  useEffect(() => {
    async function fetchProfileData() {
      if (user?.uid) {
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setProfileData(snap.data());
          }
        } catch (e) {
          console.error("Error fetching nav profile:", e);
        }
      } else {
        setProfileData(null);
      }
    }
    fetchProfileData();
  }, [user]);

  // Determine which image to show: Firestore > Auth > Default
  const displayImage = profileData?.photoURL || user?.photoURL || null;

  // --- LOGIC: Get Tournament ID from URL ---
  const pathSegments = location.pathname.split("/");
  const tournamentIndex = pathSegments.indexOf("tournament");
  const tournamentId =
    tournamentIndex !== -1 && pathSegments.length > tournamentIndex + 1
      ? pathSegments[tournamentIndex + 1]
      : null;

  // --- LOGIC: Build Dynamic Links Array ---
  const links = [];

  // 1. Global Public Links
  links.push(
    { name: "Home", path: "/" },
    { name: "📈 Players Stats", path: "/players" }
  );

  // 2. Tournament Context Links
  if (tournamentId) {
    links.push({
      name: "🏏 Matches",
      path: `/tournament/${tournamentId}/matches`,
    });
    links.push({
      name: "👥 Teams",
      path: `/tournament/${tournamentId}/teams`,
    });
    links.push({
      name: "📊 Points",
      path: `/tournament/${tournamentId}/points`,
    });
  }

  // 3. Admin Dashboard (Only if logged in)
  if (user) {
    links.push({ name: "🏆 Dashboard", path: "/dashboard" });
  }

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
    setIsOpen(false);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 shadow-lg backdrop-blur-md bg-opacity-90 mb-6">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* --- 1. LOGO --- */}
          <Link
            to="/"
            className="text-2xl font-black text-white tracking-tighter flex items-center gap-2 z-50"
            onClick={() => setIsOpen(false)}>
            <span className="text-cyan-500">⚡</span> CRIC
            <span className="text-cyan-500">SCORE</span>
          </Link>

          {/* --- 2. DESKTOP MENU --- */}
          <div className="hidden md:flex items-center gap-6">
            {/* Render Links */}
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-bold transition-colors ${
                  isActive(link.path)
                    ? "text-cyan-400 border-b-2 border-cyan-400 pb-1"
                    : "text-gray-300 hover:text-white"
                }`}>
                {link.name}
              </Link>
            ))}

            {/* --- PLAYER REGISTRATION LINK (PUBLIC) --- */}
            {!user && (
              <>
                <Link
                  to="/register-player"
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2">
                  <span>📝</span> Register as Player
                </Link>
                
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded-lg text-base font-bold bg-gradient-to-r from-cyan-900/50 to-blue-900/50 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900/70">
                    Login
                  </Link>
              </>
            )}

            {/* Render Auth Buttons (Only show User Profile/Logout if logged in) */}
            {user ? (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-700">
                <Link
                  to="/profile"
                  className="group flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-white">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border border-gray-600 shadow-sm object-cover group-hover:border-cyan-400 transition-all"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/20 group-hover:from-cyan-400 group-hover:to-blue-500">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>My Profile</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors">
                  Logout
                </button>
              </div>
            ) : // HIDDEN: Login/Signup links are commented out per requirement
            // You can uncomment these later when you want to enable public signups again
            /*
              <div className="flex items-center gap-4 border-l border-gray-700 pl-4 ml-2">
                <Link to="/login" className="...">Login</Link>
                <Link to="/register" className="...">Sign Up</Link>
              </div>
              */
            null}
          </div>

          {/* --- 3. MOBILE HAMBURGER BUTTON --- */}
          <div className="md:hidden flex items-center gap-3">
            {/* Show Register button on mobile header too if space allows, or put in menu */}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white focus:outline-none p-2 rounded-md hover:bg-gray-800 transition-colors">
              {isOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
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
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- 4. MOBILE MENU DROPDOWN --- */}
      {isOpen && (
        <div className="md:hidden bg-gray-900 border-b border-gray-800 animate-in slide-in-from-top-2 absolute w-full left-0 top-16 z-40 shadow-2xl">
          <div className="px-4 py-4 space-y-3">
            {/* Mobile Links */}
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-3 rounded-lg text-base font-bold ${
                  isActive(link.path)
                    ? "bg-cyan-900/30 text-cyan-400 border-l-4 border-cyan-500"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}>
                {link.name}
              </Link>
            ))}

            {/* Mobile Register Link */}
            {!user && (
              <>
                <Link
                  to="/register-player"
                  onClick={() => setIsOpen(false)}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2">
                  📝 Register as Player
                </Link>                
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-3 rounded-lg text-base font-bold bg-gradient-to-r from-cyan-900/50 to-blue-900/50 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900/70">
                  Login
                </Link>
              </>
            )}

            {/* Mobile Auth Section */}
            {user && (
              <div className="border-t border-gray-800 pt-4 mt-2">
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-bold text-gray-300 hover:bg-gray-800 hover:text-white mb-2">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border border-gray-600 object-cover"
                    />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                  My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-3 rounded-lg text-base font-bold text-red-400 hover:bg-red-900/20">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
