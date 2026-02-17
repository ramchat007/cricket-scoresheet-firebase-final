import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth.jsx";
import { db } from "../../utils/firebase";

function AccessDenied({ title = "Access denied", detail = "You do not have permission to view this page." }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <h2 className="text-lg font-black uppercase tracking-wider text-red-400">{title}</h2>
        <p className="mt-2 text-sm opacity-80">{detail}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-5 px-4 py-2 rounded-lg bg-white text-black font-bold text-xs uppercase tracking-wider">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function RequireTournamentAccess({ children, requireEdit = false }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  const { tournamentId, id } = useParams();
  const activeTournamentId = useMemo(() => tournamentId || id || "", [tournamentId, id]);

  const [checking, setChecking] = useState(true);
  const [deniedReason, setDeniedReason] = useState("");

  useEffect(() => {
    let active = true;

    async function validateAccess() {
      if (loading) return;

      if (!user) {
        if (active) setChecking(false);
        return;
      }

      if (!activeTournamentId || typeof activeTournamentId !== "string") {
        if (active) {
          setDeniedReason("Invalid tournament identifier in URL.");
          setChecking(false);
        }
        return;
      }

      if (activeTournamentId === "generic") {
        if (active) setChecking(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "tournaments", activeTournamentId));
        if (!snap.exists()) {
          if (active) {
            setDeniedReason("Tournament does not exist or was removed.");
            setChecking(false);
          }
          return;
        }

        const data = snap.data() || {};
        const owner = data.ownerId === user.uid;
        const scorer = Array.isArray(data.scorers) && data.scorers.includes(user.uid);
        const viewer = Array.isArray(data.viewers) && data.viewers.includes(user.uid);

        const canView = owner || scorer || viewer;
        const canEdit = owner || scorer;

        if (!canView || (requireEdit && !canEdit)) {
          if (active) {
            setDeniedReason(
              requireEdit
                ? "You need scorer/owner access for this tournament."
                : "You are not listed as owner, scorer, or viewer for this tournament.",
            );
            setChecking(false);
          }
          return;
        }

        if (active) {
          setDeniedReason("");
          setChecking(false);
        }
      } catch (e) {
        if (active) {
          setDeniedReason("Could not verify your access right now. Please retry.");
          setChecking(false);
        }
      }
    }

    validateAccess();

    return () => {
      active = false;
    };
  }, [loading, user, activeTournamentId, requireEdit]);

  if (loading || checking) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm font-bold uppercase tracking-widest opacity-70">
        Validating tournament access...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (deniedReason) {
    return <AccessDenied detail={deniedReason} />;
  }

  return children;
}
