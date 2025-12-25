// src/components/Auth.jsx
import React, { useState } from "react";
import { auth } from "../utils/firebase.js"; // Updated path for consistency
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export default function Auth({ user }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const login = async () => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login failed:", error.message);
      setError("Login failed. Check credentials.");
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {user ? (
        // --- Logged In View ---
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* User Avatar Placeholder */}
            <div className="w-10 h-10 rounded-full bg-cyan-900/30 flex items-center justify-center border border-cyan-800 text-cyan-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                Welcome back
              </span>
              <p className="text-sm text-gray-200 truncate font-medium">
                {user.name}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm font-medium text-red-400 bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-800 rounded-full transition-all">
            Logout
          </button>
        </div>
      ) : (
        // --- Logged Out View (Mini Login Form) ---
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
          <h6 className="text-gray-300 text-sm font-bold mb-3 uppercase tracking-wide">
            Quick Login
          </h6>

          {error && (
            <div className="mb-3 text-sm text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder-gray-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder-gray-500"
            />
            <button
              onClick={login}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg text-sm transition-all shadow-[0_0_10px_rgba(8,145,178,0.3)] hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
