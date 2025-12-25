// src/components/AuthStatus.jsx
import React from "react";
import { useAuth } from "../hooks/useAuth.jsx";

export default function AuthStatus() {
  const { user, logout } = useAuth();

  if (!user) return <div className="text-end text-muted">Guest mode</div>;

  return (
    <div className="d-flex justify-content-end align-items-center gap-2 mb-2">
      <small className="text-muted">Signed in as</small>
      <strong>{user.email}</strong>
      <button className="btn btn-sm btn-outline-danger" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
