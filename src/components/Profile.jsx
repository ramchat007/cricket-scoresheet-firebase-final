import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../utils/firebase";

export default function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [processingImage, setProcessingImage] = useState(false);

  // Edit States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setPhotoURL(data.photoURL || user.photoURL || "");
          setIsAdmin(!!data.isAdmin);
        }
      } catch (err) {
        console.error("Error loading profile", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  // --- IMAGE COMPRESSION HELPER ---
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check File Size (Max 2MB input allowed before compression)
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large! Please pick an image under 2MB.");
      return;
    }

    setProcessingImage(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        // Create Canvas to resize
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Max Dimensions (Thumbnail size)
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;

        let width = img.width;
        let height = img.height;

        // Calculate Aspect Ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Base64 (JPEG, 0.7 quality)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

        setPhotoURL(compressedBase64);
        setProcessingImage(false);
      };
    };
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      // 1. Update Firestore
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        firstName,
        lastName,
        photoURL, // Saves the Base64 string
      });

      // 2. Update Auth Profile (Updates Navbar immediately)
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          photoURL: photoURL,
        });
      }

      setMsg("✅ Profile updated successfully!");
    } catch (err) {
      console.error(err);
      setMsg("❌ Update failed. Image might be too large.");
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center text-cyan-500 animate-pulse">
        Loading Profile...
      </div>
    );
  if (!user)
    return (
      <div className="p-10 text-center text-gray-400">
        Please login to view profile.
      </div>
    );

  const inputClass =
    "w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors";

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
      {/* --- HEADER & AVATAR --- */}
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-8 border-b border-gray-800">
        {/* Avatar Upload Area */}
        <div
          className="relative group cursor-pointer"
          onClick={() => fileInputRef.current.click()}>
          <img
            src={
              photoURL ||
              "https://cdn-icons-png.flaticon.com/512/847/847969.png"
            }
            alt="Avatar"
            className={`w-28 h-28 rounded-full border-4 border-gray-800 shadow-lg object-cover bg-gray-700 transition-opacity ${
              processingImage ? "opacity-50" : "opacity-100"
            }`}
            onError={(e) => {
              e.target.src =
                "https://cdn-icons-png.flaticon.com/512/847/847969.png";
            }}
          />
          {/* Overlay Icon */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-sm font-bold uppercase">
              Change
            </span>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/*"
          />
        </div>

        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-black text-white">
            {firstName} {lastName}
          </h1>
          <p className="text-gray-500 font-mono text-sm mb-2">{user.email}</p>
          {isAdmin && (
            <span className="bg-purple-900/50 text-purple-400 text-sm font-bold px-2 py-1 rounded border border-purple-500/30">
              ADMINISTRATOR
            </span>
          )}
        </div>
      </div>

      {/* --- FORM --- */}
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
              First Name
            </label>
            <input
              className={inputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
              Last Name
            </label>
            <input
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        {/* Info Note */}
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex gap-3 items-start">
          <span className="text-cyan-500 text-xl">💡</span>
          <p className="text-sm text-gray-400 leading-relaxed">
            Click your profile picture above to upload a new one. Images are
            automatically optimized and securely saved to your profile.
          </p>
        </div>

        <button
          disabled={processingImage}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-900/20 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
          {processingImage ? "Processing Image..." : "Save Changes"}
        </button>

        {msg && (
          <div
            className={`text-center font-bold animate-pulse ${
              msg.includes("❌") ? "text-red-400" : "text-green-400"
            }`}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}
