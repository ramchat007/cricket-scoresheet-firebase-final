import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useTheme } from "../../context/ThemeContext";
import {
  Camera,
  CheckCircle,
  Loader2,
  Search,
  User,
  Edit3,
} from "lucide-react";
import Cropper from "react-easy-crop";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// --- CROP UTILITY FUNCTIONS ---
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const TARGET_SIZE = 400;
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    TARGET_SIZE,
    TARGET_SIZE,
  );

  // 🟢 MODERN APPROACH: Return a real File/Blob instead of a Base64 string
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.8,
    );
  });
}

export default function PlayerPhotoUpload() {
  const { id: tournamentId } = useParams();
  const { theme, lightMode } = useTheme();

  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const [finalPhotoBlob, setFinalPhotoBlob] = useState(null);
  const [preview, setPreview] = useState(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // 1. FETCH PLAYERS
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const teamsSnap = await getDocs(
          collection(db, `tournaments/${tournamentId}/teams`),
        );

        let pList = [];
        teamsSnap.docs.forEach((teamDoc) => {
          const teamData = teamDoc.data();
          if (teamData.roster && Array.isArray(teamData.roster)) {
            teamData.roster.forEach((p) => {
              pList.push({
                ...p,
                localId: p.id,
                teamId: teamDoc.id,
                teamName: teamData.name,
              });
            });
          }
        });

        const uniquePlayers = Array.from(
          new Map(
            pList.map((item) => [item.name.toLowerCase(), item]),
          ).values(),
        );
        uniquePlayers.sort((a, b) => a.name.localeCompare(b.name));

        setPlayers(uniquePlayers);
      } catch (error) {
        console.error("Error fetching players:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [tournamentId]);

  // 2. HANDLE PLAYER SELECTION
  const handleSelectPlayer = async (player) => {
    setSelectedPlayer(player);
    setFinalPhotoBlob(null);
    setSuccess(false);

    let existingPhoto =
      player.photoURL || player.photoUrl || player.image || null;
    setPreview(existingPhoto);

    const globalId =
      player.originalPlayerId ||
      player.originalId ||
      player.localId ||
      player.id;
    if (globalId && !existingPhoto) {
      try {
        const globalSnap = await getDoc(doc(db, "players", globalId));
        if (globalSnap.exists() && globalSnap.data().photoURL) {
          setPreview(globalSnap.data().photoURL);
        }
      } catch (e) {}
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        setImageToCrop(reader.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropModalOpen(true);
      };
    }
    e.target.value = null;
  };

  const handleEditExistingPhoto = () => {
    if (!preview) return;
    setImageToCrop(preview);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropModalOpen(true);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);

      // 🟢 Save the raw file for Cloudinary
      setFinalPhotoBlob(croppedBlob);

      // 🟢 Create a temporary local URL just for the preview UI
      setPreview(URL.createObjectURL(croppedBlob));

      setCropModalOpen(false);
      setImageToCrop(null);
      setSuccess(false);
    } catch (e) {
      console.error(e);
      alert("Failed to crop image.");
    }
  };

  const handleCancelCrop = () => {
    setCropModalOpen(false);
    setImageToCrop(null);
  };

  // 🟢 4. CLOUDINARY UPLOAD & FIREBASE SAVE LOGIC
  const handleUpload = async () => {
    if (!selectedPlayer || !finalPhotoBlob)
      return alert("Please select your name and a photo.");

    setUploading(true);
    try {
      let finalPhotoUrl = null;

      // 1. Upload Blob to Cloudinary
      const formData = new FormData();
      formData.append("file", finalPhotoBlob);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();

      if (data.secure_url) {
        finalPhotoUrl = data.secure_url; // 🟢 We got the Cloudinary link!
      } else {
        console.error("Cloudinary Error:", data);
        throw new Error("Photo upload failed on Cloudinary side.");
      }

      // 2. Save the Cloudinary URL to Firestore
      const globalId =
        selectedPlayer.originalPlayerId ||
        selectedPlayer.originalId ||
        selectedPlayer.localId ||
        selectedPlayer.id;

      if (globalId) {
        await updateDoc(doc(db, "players", globalId), {
          photoURL: finalPhotoUrl,
        }).catch(() => {});
        await updateDoc(doc(db, "globalPlayers", globalId), {
          photoURL: finalPhotoUrl,
        }).catch(() => {});
      }

      if (selectedPlayer.teamId) {
        const teamRef = doc(
          db,
          `tournaments/${tournamentId}/teams`,
          selectedPlayer.teamId,
        );
        const teamSnap = await getDoc(teamRef);

        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          const updatedRoster = (teamData.roster || []).map((p) => {
            if (
              p.id === selectedPlayer.localId ||
              p.name === selectedPlayer.name
            ) {
              return { ...p, photoURL: finalPhotoUrl }; // Save URL here too
            }
            return p;
          });

          await updateDoc(teamRef, { roster: updatedRoster });
        }
      }

      setSuccess(true);
      setFinalPhotoBlob(null); // Clear blob from memory
      setPreview(finalPhotoUrl); // Show Cloudinary image in preview
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload photo. Please check your Cloudinary settings.");
    } finally {
      setUploading(false);
    }
  };

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const renderCropModal = () => {
    if (!cropModalOpen || !imageToCrop) return null;

    return (
      <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col animate-in fade-in duration-200">
        <div className="flex-grow relative">
          <Cropper
            image={imageToCrop}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="bg-[#111] p-6 pb-12 flex flex-col gap-6">
          <div className="flex items-center gap-4 px-4">
            <span className="text-white text-xs font-bold uppercase">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(e.target.value)}
              className="w-full accent-teal-500"
            />
          </div>
          <div className="flex justify-between gap-4 px-4">
            <button
              onClick={handleCancelCrop}
              className="flex-1 py-4 rounded-xl border border-white/20 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveCrop}
              className="flex-1 py-4 rounded-xl bg-teal-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
              Save Crop
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center font-bold animate-pulse ${theme.bg} ${theme.text}`}>
        Loading Team Rosters...
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-4 md:p-8 flex justify-center items-center font-sans ${theme.bg} ${theme.text}`}>
      {renderCropModal()}

      <div
        className={`w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 border ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/10"}`}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
            <Camera size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic">
            Update Profile Photo
          </h1>
          <p className={`text-xs font-bold mt-2 ${theme.sub}`}>
            Select your name, upload a photo, and crop it for the broadcast.
          </p>
        </div>

        {success ? (
          <div className="text-center animate-in zoom-in duration-500">
            <div className="w-32 h-32 mx-auto rounded-full border-4 border-green-500 overflow-hidden mb-4 shadow-xl">
              <img
                src={preview}
                alt="Success"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-green-500 font-black uppercase tracking-widest text-lg mb-2">
              <CheckCircle size={24} /> Uploaded!
            </div>
            <p className={`text-sm font-bold ${theme.sub} mb-6`}>
              Your photo is now live on the team page.
            </p>
            <button
              onClick={() => {
                setSelectedPlayer(null);
                setSuccess(false);
                setPreview(null);
                setSearch("");
              }}
              className="text-teal-500 font-bold text-sm underline underline-offset-4">
              Update another player
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* STEP 1: SELECT PLAYER */}
            <div>
              <label
                className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${theme.sub}`}>
                1. Find Your Name
              </label>

              {!selectedPlayer ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search
                      size={16}
                      className={`absolute left-4 top-3.5 ${theme.sub}`}
                    />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={`w-full rounded-xl pl-10 pr-4 py-3 font-bold text-sm outline-none border focus:border-teal-500 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/10"}`}
                    />
                  </div>

                  <div
                    className={`max-h-48 overflow-y-auto rounded-xl border custom-scrollbar ${lightMode ? "border-gray-200 bg-white" : "border-white/10 bg-[#0F1115]"}`}>
                    {filteredPlayers.length === 0 ? (
                      <div className="p-4 text-center text-xs font-bold opacity-50">
                        No players found in teams.
                      </div>
                    ) : (
                      filteredPlayers.map((p) => (
                        <button
                          key={`${p.localId}-${p.teamId}`}
                          onClick={() => handleSelectPlayer(p)}
                          className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors flex justify-between items-center ${lightMode ? "hover:bg-teal-50 border-gray-100" : "hover:bg-teal-900/20 border-white/5"}`}>
                          <span className="font-bold text-sm">{p.name}</span>
                          <span
                            className={`text-[9px] uppercase font-bold tracking-wider ${theme.sub}`}>
                            {p.teamName}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`flex justify-between items-center p-4 rounded-xl border ${lightMode ? "bg-teal-50 border-teal-200 text-teal-800" : "bg-teal-900/20 border-teal-500/30 text-teal-400"}`}>
                  <div>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <User size={16} /> {selectedPlayer.name}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70 ml-6">
                      Team: {selectedPlayer.teamName}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-[10px] uppercase font-black underline">
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* STEP 2: UPLOAD & EDIT PHOTO */}
            <div
              className={`transition-all duration-500 ${selectedPlayer ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
              <label
                className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${theme.sub}`}>
                2. Edit or Change Photo
              </label>

              <div className="flex flex-col items-center">
                {preview ? (
                  <>
                    <div
                      onClick={handleEditExistingPhoto}
                      className={`w-32 h-32 rounded-full border-4 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden mb-2 ${lightMode ? "border-gray-300 hover:border-teal-500 bg-gray-50" : "border-white/20 hover:border-teal-500 bg-[#0F1115]"}`}>
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute bottom-2 right-2 bg-teal-500 p-1.5 rounded-full text-white shadow-lg border-2 border-white dark:border-[#0F1115]">
                        <Edit3 size={14} />
                      </div>
                    </div>

                    <label
                      htmlFor="new-image-upload"
                      className="text-teal-500 text-xs font-bold underline cursor-pointer mb-6 hover:text-teal-400">
                      Or upload a different photo
                    </label>
                    <input
                      type="file"
                      id="new-image-upload"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="new-image-upload"
                      className={`w-32 h-32 rounded-full border-4 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden mb-2 ${lightMode ? "border-gray-300 hover:border-teal-500 bg-gray-50" : "border-white/20 hover:border-teal-500 bg-[#0F1115]"}`}>
                      <Camera size={24} className={theme.sub} />
                      <span
                        className={`text-[10px] font-bold uppercase mt-2 ${theme.sub}`}>
                        Tap to Select
                      </span>
                    </label>
                    <input
                      type="file"
                      id="new-image-upload"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />

                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest mb-6 ${theme.sub}`}>
                      Tap to Select Photo
                    </span>
                  </>
                )}

                <button
                  onClick={handleUpload}
                  disabled={uploading || !finalPhotoBlob}
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-sm disabled:opacity-50 transition-all flex justify-center items-center gap-2 active:scale-95">
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Uploading
                      to Cloud...
                    </>
                  ) : (
                    "Save Photo"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
