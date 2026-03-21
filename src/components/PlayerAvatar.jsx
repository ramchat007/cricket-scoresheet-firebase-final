import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

// 🟢 NEW: Generates a local Base64 SVG avatar. 100% immune to CORS issues!
const generateFallbackAvatar = (name) => {
  const initial = name ? name.trim().charAt(0).toUpperCase() : "P";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#1C2128"/>
    <text x="100" y="115" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="90" font-weight="bold">${initial}</text>
  </svg>`;
  
  // ✅ FIX: Replaced btoa() with encodeURIComponent to safely handle all characters
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export default function PlayerAvatar({
  player,
  playerId,
  tournamentId,
  className,
  forPoster = false,
}) {
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!player) return;

    const fetchImage = async () => {
      // 1. Local Check
      let foundImg =
        player.photoURL ||
        player.photoUrl ||
        player.image ||
        (player.tournamentData &&
          player.tournamentData[tournamentId] &&
          player.tournamentData[tournamentId].photoURL);

      if (foundImg) {
        if (isMounted) setImgSrc(foundImg);
        return;
      }

      // 2. Global Check
      const globalId = player.originalPlayerId || player.id || playerId;

      if (globalId) {
        try {
          const globalRef = doc(db, "players", globalId);
          const globalSnap = await getDoc(globalRef);
          if (globalSnap.exists()) {
            const gData = globalSnap.data();
            foundImg =
              gData.photoURL ||
              gData.photoUrl ||
              gData.image ||
              (gData.tournamentData &&
                gData.tournamentData[tournamentId] &&
                gData.tournamentData[tournamentId].photoURL);

            if (foundImg && isMounted) {
              setImgSrc(foundImg);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to fetch global image:", err);
        }
      }

      // 3. Set to Local Fallback if no photo exists
      if (isMounted) {
        setImgSrc(generateFallbackAvatar(player.name));
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [player, playerId, tournamentId]);

  // Pre-calculate fallback in case the main imgSrc errors out after loading
  const fallback = generateFallbackAvatar(player?.name);

  return (
    <img
      src={imgSrc || fallback}
      onError={(e) => {
        // If an image link is broken, instantly swap to the local generated avatar
        e.target.src = fallback;
      }}
      alt={player?.name || "Player"}
      className={className}
      {...(forPoster ? { crossOrigin: "anonymous" } : {})}
    />
  );
}
