import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); // State for error message
  const navigate = useNavigate();

  // Helper to translate Firebase codes to user-friendly text
  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case "auth/invalid-credential":
        return "Incorrect email or password. Please try again.";
      case "auth/user-not-found":
        return "No account found with this email.";
      case "auth/wrong-password":
        return "Incorrect password.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Please check your internet connection.";
      default:
        return "Login failed. Please try again.";
    }
  };

  // --- 1. Email/Password Login ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(""); // Clear previous errors

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      navigate("/");
    } catch (err) {
      console.error("Login Error:", err.code);
      setErrorMsg(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Google Login ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check/Create User in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          firstName: user.displayName?.split(" ")[0] || "User",
          lastName: user.displayName?.split(" ")[1] || "",
          uid: user.uid,
          createdAt: new Date().toISOString(),
          playerRole: "All Rounder",
          photoURL: user.photoURL,
        });
      }

      navigate("/");
    } catch (err) {
      console.error(err);
      setErrorMsg("Google Sign-In failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors";

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl">
        <h2 className="text-3xl font-black text-white mb-6 text-center">
          Welcome Back
        </h2>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
              Email
            </label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
              Password
            </label>
            <input
              className={inputClass}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>

          {/* 🔴 INLINE ERROR BANNER */}
          {errorMsg && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-sm text-red-200 font-medium">{errorMsg}</p>
            </div>
          )}

          <button
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50">
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="h-px bg-gray-800 flex-1"></div>
          <span className="text-gray-500 text-sm font-bold uppercase">OR</span>
          <div className="h-px bg-gray-800 flex-1"></div>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-gray-900 hover:bg-gray-100 font-bold py-3 rounded-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        <div className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-cyan-400 font-bold hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
