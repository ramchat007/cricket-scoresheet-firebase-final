import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TeamSelector({ teams = [] }) {
  const [selectedTeam, setSelectedTeam] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const teamId = e.target.value;
    setSelectedTeam(teamId);
    if (teamId) {
      // Navigates to a dynamic route for the selected team
      navigate(`/team/${teamId}`);
    }
  };

  return (
    <div className="p-2">
      <label className="block mb-1 font-semibold">Select Team:</label>
      <select
        className="border p-2 rounded"
        value={selectedTeam}
        onChange={handleChange}>
        <option value="">-- Choose a Team --</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.id}
          </option>
        ))}
      </select>
    </div>
  );
}
