import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../hooks/useAuth";
import { useParams } from "react-router-dom";
// 1. Theme & Icons
import { useTheme } from "../context/ThemeContext";
import {
  Camera,
  Upload,
  Check,
  AlertCircle,
  X,
  Loader2,
  User,
  Phone,
  Receipt,
} from "lucide-react";

// --- INTERNAL TOAST COMPONENT ---
const NotificationToast = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 border backdrop-blur-md ${
        isError
          ? "bg-red-500/10 border-red-500/20 text-red-500 bg-white dark:bg-red-900/10"
          : "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400 bg-white dark:bg-teal-900/10"
      }`}>
      {isError ? <AlertCircle size={20} /> : <Check size={20} />}
      <div>
        <h4 className="font-bold text-sm uppercase tracking-wider">
          {isError ? "Error" : "Success"}
        </h4>
        <p className="text-xs opacity-90">{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
};

export default function GlobalPlayerRegistration() {
  const { tournamentId } = useParams();
  const { user } = useAuth();

  // 2. Consume Theme
  const { theme, lightMode } = useTheme();

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    role: "All-Rounder",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
  });

  const [photoBase64, setPhotoBase64] = useState("");
  const [paymentBase64, setPaymentBase64] = useState("");

  const [existingPlayerId, setExistingPlayerId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [notification, setNotification] = useState(null); // Replaces errorMessage

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

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

  const loadExistingPlayer = (playerData, docId) => {
    setFormData({
      name: playerData.name,
      mobile: playerData.mobile,
      role: playerData.role,
      battingStyle: playerData.battingStyle || "Right Hand Bat",
      bowlingStyle: playerData.bowlingStyle || "Right Arm Medium",
    });
    setPhotoBase64(playerData.photoURL || "");
    setPaymentBase64(playerData.paymentScreenshotURL || "");
    setExistingPlayerId(docId);
    setIsEditing(true);
    setStatus("idle");
    showToast("Profile loaded for editing", "success");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("checking");
    setNotification(null);

    const cleanMobile = formData.mobile.trim().replace(/\D/g, "");

    if (cleanMobile.length < 10) {
      setLoading(false);
      setStatus("idle");
      showToast("Please enter a valid 10-digit mobile number.", "error");
      return;
    }

    if (!photoBase64 || !paymentBase64) {
      setLoading(false);
      setStatus("idle");
      showToast("Profile Photo and Payment Screenshot are mandatory.", "error");
      return;
    }

    try {
      const playersRef = collection(db, "players");
      const isoDate = new Date().toISOString();

      if (isEditing && existingPlayerId) {
        const playerDocRef = doc(db, "players", existingPlayerId);
        await updateDoc(playerDocRef, {
          name: formData.name.trim(),
          role: formData.role,
          battingStyle: formData.battingStyle,
          bowlingStyle: formData.bowlingStyle,
          photoURL: photoBase64,
          paymentScreenshotURL: paymentBase64,
          updatedAt: isoDate,
          tournamentId: tournamentId || "global",
        });
        setStatus("updated");
      } else {
        const q = query(playersRef, where("mobile", "==", cleanMobile));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const isUserAdmin = user && user.email === "ramchat007@gmail.com";

          if (isUserAdmin) {
            if (
              window.confirm(
                "⚠️ Admin Access: This mobile number is already registered. Load for editing?",
              )
            ) {
              loadExistingPlayer(docSnap.data(), docSnap.id);
              setLoading(false);
              return;
            }
          } else {
            setStatus("exists");
            setLoading(false);
            return;
          }
        }

        await addDoc(playersRef, {
          name: formData.name.trim(),
          mobile: cleanMobile,
          role: formData.role,
          battingStyle: formData.battingStyle,
          bowlingStyle: formData.bowlingStyle,
          photoURL: photoBase64,
          paymentScreenshotURL: paymentBase64,
          stats: { matches: 0, runs: 0, wickets: 0 },
          isVerified: false,
          createdAt: isoDate,
          updatedAt: isoDate,
        });
        setStatus("success");
      }
    } catch (error) {
      console.error("Error registering:", error);
      setStatus("error");
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Styles ---
  const inputClass = `w-full border rounded-xl px-5 py-4 outline-none transition-all font-bold placeholder:font-normal focus:ring-2
    ${
      lightMode
        ? "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-teal-500 focus:ring-teal-100"
        : "bg-[#0F1115] border-white/10 text-slate-200 focus:border-teal-500/50 focus:bg-black"
    }`;

  // --- SUCCESS VIEW ---
  if (status === "success" || status === "updated") {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 font-sans ${theme.bg}`}>
        <div
          className={`border p-8 rounded-3xl max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 ${theme.card}`}>
          <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 border border-green-500/20 shadow-lg shadow-green-500/10">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2
            className={`text-2xl font-black mb-2 uppercase tracking-tight italic ${theme.text}`}>
            {status === "updated"
              ? "Profile Updated!"
              : "Registration Complete!"}
          </h2>
          <p className={`mb-8 text-sm font-medium ${theme.sub}`}>
            Your profile has been{" "}
            {status === "updated" ? "updated" : "submitted"} for review.
          </p>
          <button
            onClick={() => window.location.reload()}
            className={`block w-full font-bold py-4 rounded-xl transition-all mb-4 text-xs uppercase tracking-widest ${theme.btnBase}`}>
            Back to Form
          </button>
          <Link
            to="/"
            className={`block text-xs font-bold uppercase tracking-widest transition-colors ${theme.sub} hover:text-teal-500`}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // --- FORM VIEW ---
  return (
    <div
      className={`min-h-screen p-4 flex flex-col items-center justify-center font-sans ${theme.bg} ${theme.text}`}>
      <NotificationToast
        message={notification?.message}
        type={notification?.type}
        onClose={() => setNotification(null)}
      />

      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500 uppercase">
              {isEditing ? "Update Profile" : "Player Registration"}
            </span>
          </h1>
          <p
            className={`text-xs font-bold uppercase tracking-widest ${theme.sub}`}>
            {isEditing
              ? "Modify your details below"
              : "Join the league • Create your profile"}
          </p>
        </div>

        <div
          className={`border rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md ${theme.card}`}>
          {/* EXISTS ERROR */}
          {status === "exists" && (
            <div
              className={`border p-6 rounded-3xl mb-8 animate-in shake ${lightMode ? "bg-amber-50 border-amber-200" : "bg-amber-900/30 border-amber-500/50"}`}>
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="text-amber-500" />
                <h4
                  className={`font-black uppercase text-sm italic tracking-tight ${lightMode ? "text-amber-800" : "text-amber-200"}`}>
                  Profile Already Registered
                </h4>
              </div>
              <p
                className={`text-xs leading-relaxed mb-4 font-bold ${lightMode ? "text-amber-700" : "text-slate-200"}`}>
                This mobile number is already registered in our global
                directory.
              </p>
              <div
                className={`p-4 rounded-xl border text-center ${lightMode ? "bg-white border-amber-100" : "bg-[#0F1115] border-white/5"}`}>
                <p className="text-teal-500 text-[10px] font-black uppercase tracking-widest">
                  Please contact the Admin to update your profile.
                </p>
              </div>
              <button
                onClick={() => setStatus("idle")}
                className={`mt-6 w-full py-2 text-[9px] font-black uppercase transition-colors border-t pt-4 ${lightMode ? "text-amber-600 border-amber-200 hover:text-amber-800" : "text-slate-500 border-white/5 hover:text-white"}`}>
                Register a different number
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* PHOTO UPLOAD */}
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="hidden"
                  id="profile-upload"
                />
                <label
                  htmlFor="profile-upload"
                  className="cursor-pointer group relative block">
                  {/* Circle Container */}
                  <div
                    className={`w-32 h-32 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl relative z-10 
                    ${
                      photoBase64
                        ? "border-teal-500 shadow-teal-500/20"
                        : lightMode
                          ? "border-dashed border-gray-300 bg-gray-50 group-hover:bg-white"
                          : "border-dashed border-white/10 bg-[#0F1115] group-hover:border-white/30"
                    }`}>
                    {photoBase64 ? (
                      <img
                        src={photoBase64}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Camera
                          className={`w-8 h-8 mx-auto mb-2 opacity-50 ${theme.sub}`}
                        />
                        <p
                          className={`text-[9px] uppercase font-black tracking-widest ${theme.sub}`}>
                          Upload
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Edit Badge */}
                  <div className="absolute bottom-1 right-1 z-20 bg-teal-500 text-white rounded-full p-2 shadow-lg border-2 border-white dark:border-black">
                    <Upload size={14} />
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-5">
              <div className="relative">
                <User
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.sub}`}
                  size={18}
                />
                <input
                  required
                  type="text"
                  placeholder="Full Name *"
                  className={`${inputClass} pl-12`}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="relative">
                <Phone
                  className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.sub}`}
                  size={18}
                />
                <input
                  required
                  type="tel"
                  placeholder="Mobile Number *"
                  maxLength={10}
                  disabled={isEditing}
                  className={`${inputClass} pl-12 ${isEditing ? "opacity-50 cursor-not-allowed" : ""}`}
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                />
              </div>

              {/* Roles Grid */}
              <div className="grid grid-cols-2 gap-3">
                {["Batsman", "Bowler", "All-Rounder", "Wicket Keeper"].map(
                  (role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({ ...formData, role })}
                      className={`py-4 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        formData.role === role
                          ? "bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400 shadow-lg"
                          : theme.btnBase
                      }`}>
                      {role}
                    </button>
                  ),
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className={`${inputClass} text-xs`}
                  value={formData.battingStyle}
                  onChange={(e) =>
                    setFormData({ ...formData, battingStyle: e.target.value })
                  }>
                  <option>Right Hand Bat</option>
                  <option>Left Hand Bat</option>
                </select>
                <select
                  className={`${inputClass} text-xs`}
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

            {/* PAYMENT UPLOAD */}
            <div
              className={`p-6 rounded-2xl border border-dashed transition-colors group ${
                lightMode
                  ? "bg-gray-50 border-gray-300 hover:bg-white"
                  : "bg-[#0F1115] border-white/10 hover:border-white/20"
              }`}>
              <label
                className={`block text-[10px] font-black uppercase mb-4 text-center tracking-[0.2em] ${theme.sub}`}>
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
                  <div className="relative">
                    <img
                      src={paymentBase64}
                      alt="Proof"
                      className="w-full h-48 object-cover rounded-xl border shadow-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                      <span className="text-white font-bold text-xs uppercase">
                        Change Image
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`h-32 flex flex-col items-center justify-center rounded-xl transition-colors ${lightMode ? "bg-white border" : "bg-[#161920]"}`}>
                    <Receipt
                      className={`mb-3 opacity-30 ${theme.text}`}
                      size={32}
                    />
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${theme.sub}`}>
                      Click to upload proof
                    </span>
                  </div>
                )}
              </label>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl shadow-teal-900/20 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2">
              {loading && <Loader2 className="animate-spin" />}
              {loading
                ? "Processing..."
                : isEditing
                  ? "Update Profile"
                  : "Submit Registration"}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`w-full text-xs font-bold uppercase tracking-widest transition-colors ${theme.sub} hover:text-teal-500`}>
                Cancel Edit
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
