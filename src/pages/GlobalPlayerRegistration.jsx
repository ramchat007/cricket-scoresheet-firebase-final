import React, { useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "../utils/firebase"; // REMOVED 'storage' import

export default function GlobalPlayerRegistration() {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    role: "All-Rounder",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
  });

  // Image States (Stores Base64 String directly)
  const [photoBase64, setPhotoBase64] = useState("");
  const [paymentBase64, setPaymentBase64] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // --- UTILITY: COMPRESS IMAGE TO BASE64 ---
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

          // Calculate new dimensions
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * ratio;

          // Draw and Compress (0.7 quality)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          resolve(compressedBase64);
        };
      };
    });
  };

  // --- HANDLERS ---

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Compress to 300px width (Small enough for DB)
      const compressed = await compressImage(file, 300);
      setPhotoBase64(compressed);
    }
  };

  const handlePaymentImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Compress to 400px width
      const compressed = await compressImage(file, 400);
      setPaymentBase64(compressed);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");
    setErrorMessage("");

    const cleanMobile = formData.mobile.trim().replace(/\D/g, "");

    if (cleanMobile.length < 10) {
      setLoading(false);
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!photoBase64) {
      setLoading(false);
      alert("⚠️ Profile Photo is mandatory.");
      return;
    }

    if (!paymentBase64) {
      setLoading(false);
      alert("⚠️ Payment Screenshot is mandatory.");
      return;
    }

    try {
      // 1. Check for Duplicate
      const q = query(
        collection(db, "players"),
        where("mobile", "==", cleanMobile)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setStatus("exists");
        setLoading(false);
        return;
      }

      // 2. Save directly to Firestore (No Storage Bucket needed)
      const isoDate = new Date().toISOString();

      await addDoc(collection(db, "players"), {
        name: formData.name.trim(),
        mobile: cleanMobile,
        role: formData.role,
        battingStyle: formData.battingStyle,
        bowlingStyle: formData.bowlingStyle,
        photoURL: photoBase64, // Storing the actual image string
        paymentScreenshotURL: paymentBase64, // Storing the actual image string
        stats: { matches: 0, runs: 0, wickets: 0 },
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
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-green-500/50 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Registration Complete!
          </h2>
          <p className="text-gray-400 mb-6">
            Your profile has been created successfully.
          </p>
          <div className="bg-gray-800 p-4 rounded-xl mb-6 flex items-center gap-4 text-left">
            <img
              src={photoBase64}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border border-gray-600"
            />
            <div>
              <div className="text-lg font-bold text-white">
                {formData.name}
              </div>
              <div className="text-sm font-mono text-cyan-400">
                {formData.mobile}
              </div>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors">
            Register Another Player
          </button>
          <Link
            to="/"
            className="block mt-4 text-sm text-gray-500 hover:text-white">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 flex flex-col items-center justify-center">
      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              PLAYER REGISTRATION
            </span>
          </h1>
          <p className="text-gray-400 text-sm">
            Please provide your details and payment proof.
          </p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          {status === "exists" && (
            <div className="bg-yellow-900/30 border border-yellow-600/50 text-yellow-200 p-4 rounded-xl mb-6 text-sm text-center">
              ⚠️ Mobile number already registered.
            </div>
          )}
          {status === "error" && (
            <div className="bg-red-900/30 border border-red-600/50 text-red-200 p-4 rounded-xl mb-6 text-sm text-center">
              Error: {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                <label htmlFor="profile-upload" className="cursor-pointer">
                  <div
                    className={`w-28 h-28 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl ${
                      photoBase64
                        ? "border-cyan-500"
                        : "border-dashed border-gray-600 hover:border-gray-400"
                    }`}>
                    {photoBase64 ? (
                      <img
                        src={photoBase64}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-3xl">📷</span>
                        <p className="text-[10px] text-gray-400 uppercase mt-1 font-bold">
                          Profile Photo*
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* TEXT FIELDS */}
            <div className="space-y-4">
              <input
                required
                type="text"
                placeholder="Full Name *"
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"
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
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData({ ...formData, mobile: e.target.value })
                }
              />

              <div className="grid grid-cols-2 gap-2">
                {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map(
                  (role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({ ...formData, role })}
                      className={`py-3 px-2 rounded-lg text-xs font-bold border transition-all ${
                        formData.role === role
                          ? "bg-cyan-900/40 border-cyan-500 text-cyan-400"
                          : "bg-gray-800 border-gray-800 text-gray-400"
                      }`}>
                      {role}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="w-full bg-black border border-gray-700 rounded-xl px-3 py-3 text-sm text-white outline-none"
                  value={formData.battingStyle}
                  onChange={(e) =>
                    setFormData({ ...formData, battingStyle: e.target.value })
                  }>
                  <option>Right Hand Bat</option>
                  <option>Left Hand Bat</option>
                </select>
                <select
                  className="w-full bg-black border border-gray-700 rounded-xl px-3 py-3 text-sm text-white outline-none"
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
            <div className="bg-gray-800/50 p-4 rounded-xl border border-dashed border-gray-600">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-3 text-center">
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
                    className="w-full h-40 object-cover rounded-lg border border-gray-600"
                  />
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center bg-black/40 rounded-lg hover:bg-black/60 transition-colors">
                    <span className="text-3xl mb-2">🧾</span>
                    <span className="text-sm text-gray-400">
                      Click to upload screenshot
                    </span>
                  </div>
                )}
              </label>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50">
              {loading ? "Registering..." : "Submit Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
