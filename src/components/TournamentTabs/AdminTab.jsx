import React from "react";
import TeamManager from "../TeamManager";
import TournamentAccessManager from "../TournamentAccessManager";
import { useNavigate } from "react-router-dom";

export default function AdminTab({
  canEdit,
  isOwner,
  tournamentData,
  setShowImportModal,
  handleDeleteTournament,
  id,
  user,
}) {
  const navigate = useNavigate();

  if (!canEdit) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl group-hover:scale-110 transition-transform">
          🛡️
        </div>
        <h3 className="text-white font-bold text-lg mb-4">Team Management</h3>

        {tournamentData.isAuction ? (
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h4 className="text-white font-bold mb-2">Rosters Locked</h4>
            <p className="text-gray-500 text-sm mb-6">
              This is an <strong>Auction Tournament</strong>. Teams and players
              are managed through the Auction Console.
            </p>
            <button
              onClick={() => navigate(`/tournaments/${id}/auction`)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-all">
              Go to Auction Console
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-blue-400 border border-blue-900/30 px-4 py-3 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 transition-all">
              <span>+</span> Import Global Teams
            </button>
            <TeamManager tournamentId={id} />
          </>
        )}
      </div>

      {isOwner && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-white font-bold text-lg mb-4">
              Access Control
            </h3>
            <TournamentAccessManager
              tournament={tournamentData}
              currentUserId={user.uid}
            />
          </div>

          <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-6">
            <h4 className="text-red-500 font-bold mb-2">Danger Zone</h4>
            <p className="text-red-400/50 text-xs mb-4">
              This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteTournament}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold w-full transition-colors shadow-lg shadow-red-900/20">
              Delete Tournament
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
