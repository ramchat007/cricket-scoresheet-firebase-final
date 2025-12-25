import React from "react";
import TeamSelector from "../components/Teams.jsx";
import TeamManager from "./components/TeamManager.jsx";

export default function TeamsPage({ allTeams }) {
  return (
    <div className="container py-3">
      <div className="card mb-3 p-3">
        <h2 className="h5 mb-3">Browse Teams</h2>
        <TeamSelector teams={allTeams} />
      </div>
      <TeamManager teams={allTeams} />
    </div>
  );
}
