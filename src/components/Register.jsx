// src/components/Register.jsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../utils/firebase.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useNavigate } from "react-router-dom";

export default function Register({ onSuccess }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleRegister(e) {
    e?.preventDefault?.();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // send verification email
      await sendEmailVerification(cred.user);

      // create full profile in Firestore users/{uid}
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        firstName,
        lastName,
        playerRole: "", // default empty, user can set later in profile page
        role: "scorer", // app-level role
        createdAt: new Date().toISOString(),
        emailVerified: false,
      });

      setUser(cred.user);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setError(null);

      alert("Verification email sent. Please check your inbox before login.");
      if (onSuccess) onSuccess();
      navigate("/login"); // redirect to login page
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err.message || "Registration failed");
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Register Card */}
        <form
          onSubmit={handleRegister}
          className="bg-gray-900 border-gray-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
          {/* Decorative Top Glow (Green variant for Register) */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>

          <h5 className="text-2xl font-bold text-center text-white mb-2 tracking-wide">
            Create Account
          </h5>
          <p className="text-center text-gray-500 text-sm mb-6">
            Join as a new scorer
          </p>

          {error && (
            <div className="bg-red-900/30 border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                First Name
              </label>
              <input
                className="w-full bg-gray-800 text-white border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-500"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Last Name
              </label>
              <input
                className="w-full bg-gray-800 text-white border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-500"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              className="w-full bg-gray-800 text-white border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-500"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-8">
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Password
            </label>
            <input
              className="w-full bg-gray-800 text-white border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-500"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
            type="submit">
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}
