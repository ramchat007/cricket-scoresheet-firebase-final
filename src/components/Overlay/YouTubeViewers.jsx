import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../utils/firebase"; // 👈 Ensure this path matches your project
import { Eye, AlertCircle } from "lucide-react";

// 🛠 THE BULLETPROOF DECODER
const extractYouTubeId = (rawUrl) => {
  if (!rawUrl) return null;
  try {
    const cleanUrl = String(rawUrl).replace(/['"]/g, "").trim();
    if (cleanUrl.includes("youtube.com/watch")) {
      const urlObj = new URL(cleanUrl);
      return urlObj.searchParams.get("v")?.substring(0, 11) || null;
    }
    if (cleanUrl.includes("youtu.be/")) {
      return cleanUrl.split("youtu.be/")[1].split(/[?#]/)[0].substring(0, 11);
    }
    if (cleanUrl.includes("/live/")) {
      return cleanUrl.split("/live/")[1].split(/[?#]/)[0].substring(0, 11);
    }
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
    const match = cleanUrl.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  } catch (error) {
    console.error("🔴 Failed to parse URL:", error);
    return null;
  }
};

export default function YouTubeViewers({
  apiKey = import.meta.env.VITE_YOUTUBE_API_KEY,
}) {
  // 1. Grab the ID directly from your Router URL
  const { tournamentId } = useParams();

  // 2. Local State
  const [liveStreamUrl, setLiveStreamUrl] = useState(null);
  const [liveViewers, setLiveViewers] = useState("0");
  const [totalViews, setTotalViews] = useState("0");

  const activeVideoId = extractYouTubeId(liveStreamUrl);

  // 3. FIREBASE SYNC: Listen for the Tournament URL in real-time
  useEffect(() => {
    if (!tournamentId) return;

    const unsubscribe = onSnapshot(
      doc(db, "tournaments", tournamentId),
      (docSnap) => {
        if (docSnap.exists()) {
          const url = docSnap.data().liveStreamUrl;
          setLiveStreamUrl(url || null);
          console.log("🔥 Firebase URL Synced:", url);
        }
      },
    );

    return () => unsubscribe();
  }, [tournamentId]);

  // 4. YOUTUBE API: Fetch viewer counts
  useEffect(() => {
    if (!apiKey || !activeVideoId) return;

    const fetchViewerData = async () => {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${activeVideoId}&key=${apiKey}`;
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        // 🔍 NEW: Log the exact error if Google rejects it
        if (!response.ok) {
          console.error("🔴 YouTube API Error:", data.error.message);
          return;
        }

        if (data.items && data.items.length > 0) {
          const videoInfo = data.items[0];
          const live = videoInfo.liveStreamingDetails?.concurrentViewers;
          setLiveViewers(live ? Number(live).toLocaleString() : "0");
          const total = videoInfo.statistics?.viewCount;
          setTotalViews(total ? Number(total).toLocaleString() : "0");
        }
      } catch (error) {
        console.error("Network error fetching viewer data:", error);
      }
    };

    fetchViewerData();
    const intervalId = setInterval(fetchViewerData, 10000);
    return () => clearInterval(intervalId);
  }, [activeVideoId, apiKey]);

  // 5. THE RENDER: Wrapped in a full-screen container for OBS placement
  return (
    <>
      <style>
        {`
          html, body, #root {
            background-color: transparent !important;
            background: transparent !important;
            margin: 0; padding: 0; overflow: hidden;
          }
        `}
      </style>

      {/* Screen Wrapper for OBS */}
      <div className="w-screen h-screen relative bg-transparent pointer-events-none">
        {/* Positioning Box (Top Right Corner) */}
        <div className="absolute top-10 left-10 z-[100] flex flex-col items-end">
          {!activeVideoId ? (
            <div className="inline-flex items-center gap-3 bg-zinc-900/90 border border-amber-500/50 rounded-lg px-4 py-2 shadow-lg backdrop-blur-sm animate-pulse">
              <AlertCircle className="text-amber-500" size={18} />
              <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest">
                Waiting for YouTube URL...
              </span>
            </div>
          ) : (
            <div className="inline-flex items-stretch rounded-lg shadow-[0_12px_30px_rgba(0,0,0,0.6)] border-2 border-white/10 overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center gap-4 px-3 py-3 bg-[#e50914]">
                <div className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-white shadow-[0_0_8px_white]"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/90 text-xs font-bold uppercase tracking-wider mb-0.5">
                    Live Now
                  </span>
                  <span className="text-white text-3xl font-black leading-none drop-shadow-md">
                    {liveViewers}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 px-3 py-3 bg-zinc-900 border-l border-zinc-700">
                <Eye className="text-gray-400 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-0.5">
                    Total Views
                  </span>
                  <span className="text-white text-3xl font-black leading-none drop-shadow-md">
                    {totalViews}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
