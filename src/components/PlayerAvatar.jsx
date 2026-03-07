import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";

export default function PlayerAvatar({ player, playerId, tournamentId, className }) {
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

      // 2. Global Check - NOW USING THE RELIABLE EXPLICIT playerId 🟢
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

      // 3. Fallback
      if (isMounted) {
        setImgSrc(
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            player.name || "Player"
          )}&background=0F1115&color=fff`
        );
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [player, playerId, tournamentId]);

  return (
    <img
      src={
        imgSrc ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          player?.name || "Player"
        )}&background=0F1115&color=fff`
      }
      onError={(e) => {
        e.target.src = "https://cdn-icons-png.flaticon.com/512/847/847969.png";
      }}
      alt={player?.name || "Player"}
      className={className}
    />
  );
}