import React, { useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "../utils/firebase"; 

export default function GlobalPlayerRegistration() {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    role: "All-Rounder",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
  });

  const [photoBase64, setPhotoBase64] = useState("");
  const [paymentBase64, setPaymentBase64] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, checking, exists, success, error
  const [errorMessage, setErrorMessage] = useState("");

  const compressImage = (file, maxWidth = 300) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * ratio;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
      };
    });
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImage(file, 300);
      setPhotoBase64(compressed);
    }
  };

  const handlePaymentImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImage(file, 400);
      setPaymentBase64(compressed);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("checking");
    setErrorMessage("");

    const cleanMobile = formData.mobile.trim().replace(/\D/g, "");

    if (cleanMobile.length < 10) {
      setLoading(false);
      setStatus("idle");
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!photoBase64) {
      setLoading(false);
      setStatus("idle");
      alert("⚠️ Profile Photo is mandatory.");
      return;
    }

    if (!paymentBase64) {
      setLoading(false);
      setStatus("idle");
      alert("⚠️ Payment Screenshot is mandatory.");
      return;
    }

    try {
      // --- 1. DUPLICATE CHECK ---
      // Query Firestore for existing mobile number
      const playersRef = collection(db, "players"); // Or "globalPlayers" depending on your schema
      const q = query(playersRef, where("mobile", "==", cleanMobile));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setStatus("exists");
        setLoading(false);
        return; // Stop execution
      }

      // --- 2. SAVE DATA ---
      const isoDate = new Date().toISOString();

      await addDoc(collection(db, "players"), {
        name: formData.name.trim(),
        mobile: cleanMobile,
        role: formData.role,
        battingStyle: formData.battingStyle,
        bowlingStyle: formData.bowlingStyle,
        photoURL: photoBase64,
        paymentScreenshotURL: paymentBase64, 
        stats: { matches: 0, runs: 0, wickets: 0 },
        isVerified: false, // Admin can toggle this later
        createdAt: isoDate,
        updatedAt: isoDate,
      });

      setStatus("success");
    } catch (error) {
      console.error("Error registering:", error);
      setStatus("error");
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center p-4 font-sans">
        <div className="bg-[#1C2128] border border-green-500/30 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl animate-in zoom-in-95">
          <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 border border-green-500/20">
            ✓
          </div>
          <h2 className="text-2xl font-black text-slate-100 mb-2 uppercase tracking-tight italic">
            Registration Complete!
          </h2>
          <p className="text-slate-500 mb-8 text-sm font-medium">
            Your profile has been submitted for review.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="block w-full bg-[#2D3339] hover:bg-[#363D45] text-white font-bold py-4 rounded-xl transition-all mb-4 text-xs uppercase tracking-widest">
            Register Another Player
          </button>
          <Link
            to="/"
            className="block text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 p-4 flex flex-col items-center justify-center font-sans">
      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500 uppercase">
              Player Registration
            </span>
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            Join the league • Create your profile
          </p>
        </div>

        <div className="bg-[#1C2128] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md">
          
          {status === "exists" && (
            <div className="bg-amber-900/20 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-8 text-sm text-center font-bold animate-in shake">
              ⚠️ This mobile number is already registered.
            </div>
          )}
          {status === "error" && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-200 p-4 rounded-xl mb-8 text-sm text-center font-bold">
              Error: {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* PROFILE PHOTO  */}
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="hidden"
                  id="profile-upload"
                />
                <label htmlFor="profile-upload" className="cursor-pointer group">
                  <div
                    className={`w-32 h-32 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl ${
                      photoBase64
                        ? "border-teal-500 shadow-teal-500/20"
                        : "border-dashed border-white/10 group-hover:border-white/30 bg-[#0F1115]"
                    }`}>
                    {photoBase64 ? (
                      <img
                        src={photoBase64}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-3xl opacity-50 grayscale group-hover:grayscale-0 transition-all">📷</span>
                        <p className="text-[9px] text-slate-500 uppercase mt-2 font-black tracking-widest">
                          Upload Photo
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* TEXT FIELDS */}
            <div className="space-y-5">
              <input
                required
                type="text"
                placeholder="Full Name *"
                className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-5 py-4 text-slate-200 outline-none focus:border-teal-500/50 transition-all placeholder:text-slate-600 font-bold"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />

              <input
                required
                type="tel"
                placeholder="Mobile Number *"
                maxLength={10}
                className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-5 py-4 text-slate-200 outline-none focus:border-teal-500/50 transition-all placeholder:text-slate-600 font-bold"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData({ ...formData, mobile: e.target.value })
                }
              />

              <div className="grid grid-cols-2 gap-3">
                {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map(
                  (role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({ ...formData, role })}
                      className={`py-4 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        formData.role === role
                          ? "bg-teal-500/10 border-teal-500/50 text-teal-400 shadow-lg"
                          : "bg-[#0F1115] border-white/5 text-slate-500 hover:text-slate-300"
                      }`}>
                      {role}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-4 text-xs font-bold text-slate-300 outline-none focus:border-teal-500/50"
                  value={formData.battingStyle}
                  onChange={(e) =>
                    setFormData({ ...formData, battingStyle: e.target.value })
                  }>
                  <option>Right Hand Bat</option>
                  <option>Left Hand Bat</option>
                </select>
                <select
                  className="w-full bg-[#0F1115] border border-white/10 rounded-xl px-4 py-4 text-xs font-bold text-slate-300 outline-none focus:border-teal-500/50"
                  value={formData.bowlingStyle}
                  onChange={(e) =>
                    setFormData({ ...formData, bowlingStyle: e.target.value })
                  }>
                  <option>Right Arm Medium</option>
                  <option>Right Arm Fast</option>
                  <option>Right Arm Spin</option>
                  <option>Left Arm Medium</option>
                  <option>Left Arm Fast</option>
                  <option>Left Arm Spin</option>
                  <option>None</option>
                </select>
              </div>
            </div>

            {/* PAYMENT SCREENSHOT  */}
            <div className="bg-[#0F1115] p-6 rounded-2xl border border-dashed border-white/10 hover:border-white/20 transition-colors group">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 text-center tracking-[0.2em]">
                Payment Screenshot *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePaymentImageChange}
                className="hidden"
                id="payment-upload"
              />
              <label
                htmlFor="payment-upload"
                className="cursor-pointer block w-full">
                {paymentBase64 ? (
                  <img
                    src={paymentBase64}
                    alt="Proof"
                    className="w-full h-48 object-cover rounded-xl border border-white/10 shadow-lg"
                  />
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center bg-[#161920] rounded-xl transition-colors">
                    <span className="text-3xl mb-3 opacity-30 grayscale group-hover:grayscale-0 transition-all">🧾</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Click to upload proof
                    </span>
                  </div>
                )}
              </label>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl shadow-teal-900/20 transition-all disabled:opacity-50 active:scale-[0.98]">
              {loading ? (status === "checking" ? "Checking Availability..." : "Registering...") : "Submit Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}