// src/components/OfflineBanner.jsx
import React, { useState, useEffect } from "react";

export default function OfflineBanner({ onSyncNow }) {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="alert alert-warning text-center m-0 p-2 d-flex justify-content-center align-items-center gap-2">
      <span>
        ⚠️ You are offline. Changes will be stored locally and sync when online.
      </span>
      {onSyncNow && (
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={onSyncNow}>
          Sync now
        </button>
      )}
    </div>
  );
}
