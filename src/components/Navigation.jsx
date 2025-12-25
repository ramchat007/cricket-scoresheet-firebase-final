// src/components/Navigation.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { auth } from "../utils/firebase";

export default function Navigation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 shadow-lg backdrop-blur-md bg-opacity-90 mb-6">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
            <span className="text-cyan-500">⚡</span> CRIC
            <span className="text-cyan-500">SCORE</span>
          </Link>

          <div className="flex items-center gap-6">
            {user ? (
              <Link
                to="/dashboard"
                className="text-sm font-bold text-gray-300 hover:text-white transition-colors">
                Dashboard
              </Link>
            ) : (
              ""
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="relative group">
                  {/* AVATAR LOGIC */}
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border border-gray-600 shadow-sm object-cover group-hover:border-cyan-400 transition-all"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }} // Fallback if link broken
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/20 group-hover:from-cyan-400 group-hover:to-blue-500">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-bold text-cyan-400 hover:text-cyan-300">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-cyan-900/20">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
