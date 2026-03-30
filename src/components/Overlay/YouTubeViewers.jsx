import React, { useState, useEffect } from "react";
import { Eye } from "lucide-react"; // Import the Eye icon for total views

export default function YouTubeViewers({
  videoId = "Q4cydjxhkIY",
  apiKey = "AIzaSyCgnUtN3tl1GrHJxWOpVaIY8s7cAzhyz84",
}) {
  const [liveViewers, setLiveViewers] = useState("0");
  const [totalViews, setTotalViews] = useState("0");

  useEffect(() => {
    if (!apiKey || !videoId) return;

    const fetchViewerData = async () => {
      // 🟢 ADDED 'statistics' to the 'part' query parameter
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${videoId}&key=${apiKey}`;

      try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
          const videoInfo = data.items[0];

          // 1. Get Live Concurrent Viewers
          const live = videoInfo.liveStreamingDetails?.concurrentViewers;
          setLiveViewers(live ? Number(live).toLocaleString() : "0");

          // 2. Get Total Cumulative Views
          const total = videoInfo.statistics?.viewCount;
          setTotalViews(total ? Number(total).toLocaleString() : "0");
        }
      } catch (error) {
        console.error("Error fetching viewer data:", error);
      }
    };

    fetchViewerData();
    const intervalId = setInterval(fetchViewerData, 10000);

    return () => clearInterval(intervalId);
  }, [videoId, apiKey]);

  return (
    <div className="flex items-center justify-center w-full h-full bg-transparent p-4 font-sans">
      {/* 🟢 SLEEK SPLIT-PILL DESIGN FOR OBS */}
      <div className="flex items-stretch bg-black/60 rounded-2xl shadow-lg border border-white/10 overflow-hidden backdrop-blur-sm">
        {/* LIVE VIEWERS SECTION */}
        <div className="flex items-center px-6 py-3 bg-red-500/10 border-r border-white/10">
          <span className="text-red-500 text-2xl mr-3 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
            🔴
          </span>
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] font-black uppercase tracking-widest leading-none mb-1">
              Live Now
            </span>
            <span className="text-white text-4xl font-black drop-shadow-md leading-none tracking-wide">
              {liveViewers}
            </span>
          </div>
        </div>

        {/* TOTAL VIEWS SECTION */}
        <div className="flex items-center px-6 py-3 bg-white/5">
          <Eye className="text-gray-400 mr-3 shrink-0" size={28} />
          <div className="flex flex-col">
            <span className="text-white/60 text-[10px] font-black uppercase tracking-widest leading-none mb-1">
              Total Views
            </span>
            <span className="text-white text-4xl font-black drop-shadow-md leading-none tracking-wide">
              {totalViews}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
