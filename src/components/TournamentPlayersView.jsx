import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  deleteGlobalPlayer,
  listMatchesForTournament,
} from "../utils/firestore";
import { useAuth } from "../hooks/useAuth";

// 1. Theme & Icons
import { useTheme } from "../context/ThemeContext";
import {
  Search,
  Filter,
  Plus,
  Trophy,
  Medal,
  ChevronDown,
  Edit3,
  Trash2,
  X,
  Camera,
  Receipt,
  Loader2,
  Check,
  AlertCircle,
  Sun,
  Moon,
  ArrowUpDown,
  LayoutGrid,
  List,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

// 2. Cropper Import
import Cropper from "react-easy-crop";

// --- TOAST COMPONENT ---
const NotificationToast = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={`fixed top-6 right-6 z-[500] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 border backdrop-blur-md ${
        isError
          ? "bg-red-500/10 border-red-500/20 text-red-500 bg-white dark:bg-red-900/10"
          : "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400 bg-white dark:bg-teal-900/10"
      }`}>
      {isError ? <AlertCircle size={24} /> : <Check size={24} />}
      <div>
        <h4 className="font-bold text-base uppercase tracking-wider">
          {isError ? "Error" : "Success"}
        </h4>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100">
        <X size={20} />
      </button>
    </div>
  );
};

// --- CROP UTILITY FUNCTION ---
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const TARGET_SIZE = 300;
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    TARGET_SIZE,
    TARGET_SIZE,
  );

  return canvas.toDataURL("image/jpeg", 0.8);
}

export default function TournamentPlayersView() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, lightMode, toggleTheme } = useTheme();

  const fileInputRef = useRef(null);
  const paymentInputRef = useRef(null);

  // --- STATE ---
  const [players, setPlayers] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // VIEW MODE STATE (grid vs list)
  const [viewMode, setViewMode] = useState("grid");

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [notification, setNotification] = useState(null);

  const [sortConfig, setSortConfig] = useState({
    key: "runs",
    direction: "desc",
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  // CROPPER STATE
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    role: "All-Rounder",
    battingStyle: "Right Hand Bat",
    bowlingStyle: "Right Arm Medium",
    mobile: "",
    photoURL: "",
    paymentScreenshotURL: "",
  });

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadTournamentData = async () => {
    setLoading(true);
    try {
      const playersRef = collection(db, "players");
      const q = query(
        playersRef,
        where("registeredTournaments", "array-contains", tournamentId),
      );
      const querySnapshot = await getDocs(q);
      const tournamentPlayers = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPlayers(tournamentPlayers);

      const matches = await listMatchesForTournament(tournamentId);
      const taggedMatches = matches.map((m) => ({
        ...m,
        tournamentId: tournamentId,
      }));
      setAllMatches(taggedMatches);
    } catch (err) {
      console.error("Error loading tournament data:", err);
      showToast("Failed to load tournament data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (processedPlayers.length === 0) {
      showToast("No players available to export!", "error");
      return;
    }

    // Map through the accurately calculated processedPlayers
    const formattedData = processedPlayers.map((player, index) => {
      const stats = player.calculatedStats || {};
      const tData = player.tournamentData?.[tournamentId] || {};

      // Calculate advanced metrics
      const strikeRate =
        stats.ballsFaced > 0
          ? ((stats.runs / stats.ballsFaced) * 100).toFixed(2)
          : "0.00";
      const oversBowled = stats.ballsBowled / 6;
      const economy =
        oversBowled > 0
          ? (stats.runsConceded / oversBowled).toFixed(2)
          : "0.00";

      return {
        "Sr No.": index + 1,
        "Player Name": player.name || "N/A",
        Role: player.activeRole || "N/A",
        "Batting Style": tData.battingStyle || player.battingStyle || "N/A",
        "Bowling Style": tData.bowlingStyle || player.bowlingStyle || "N/A",
        Mobile: player.mobile || "N/A"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();

    // Auto-size columns for better readability in Excel
    const colWidths = [
      { wch: 8 }, // Sr No
      { wch: 25 }, // Name
      { wch: 15 }, // Role
      { wch: 18 }, // Batting
      { wch: 18 }, // Bowling
      { wch: 15 }, // Mobile
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Tournament Stats");

    // Dynamic filename based on the current tournament URL
    const cleanTournamentName = tournamentId
      ? tournamentId.replace(/-/g, "_")
      : "Tournament";
    XLSX.writeFile(workbook, `${cleanTournamentName}_Players_Stats.xlsx`);
  };

  useEffect(() => {
    if (tournamentId) loadTournamentData();
  }, [tournamentId]);

  // --- ENGINE ---
  const { processedPlayers, orangeCap, purpleCap } = useMemo(() => {
    if (players.length === 0)
      return { processedPlayers: [], orangeCap: null, purpleCap: null };

    const statsMap = {};
    players.forEach((p) => {
      const tData = p.tournamentData?.[tournamentId] || {};
      statsMap[p.id] = {
        ...p,
        activeRole: tData.role || p.role,
        calculatedStats: {
          matches: 0,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          runsConceded: 0,
          ballsBowled: 0,
          highestScore: 0,
          notOuts: 0,
          history: [],
        },
      };
    });

    const identityMap = {};
    players.forEach((p) => {
      identityMap[p.name.trim().toLowerCase()] = p.id;
      identityMap[p.id] = p.id;
    });

    allMatches.forEach((match) => {
      const status = (match.status || match.meta?.status || "").toLowerCase();
      if (!["finished", "completed"].includes(status)) return;

      let inningsArray = Array.isArray(match.innings)
        ? match.innings
        : Object.values(match.innings || {});
      if (inningsArray.length === 0) return;

      const findGlobalId = (name) =>
        identityMap[(name || "").trim().toLowerCase()];

      inningsArray.forEach((inn) => {
        if (inn.batsmenStats) {
          Object.entries(inn.batsmenStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const r = Number(s.runs) || 0;
              const b = Number(s.balls) || 0;
              const isOut = s.out;

              if (b > 0 || isOut) {
                p.calculatedStats.runs += r;
                p.calculatedStats.ballsFaced += b;
                if (!isOut) p.calculatedStats.notOuts += 1;
                if (r > p.calculatedStats.highestScore)
                  p.calculatedStats.highestScore = r;

                const existingHist = p.calculatedStats.history.find(
                  (h) => h.matchId === match.id,
                );
                if (existingHist) {
                  existingHist.runs = r;
                  existingHist.isNotOut = !isOut;
                } else {
                  p.calculatedStats.history.push({
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    date: match.date || match.meta?.date,
                    opponent: inn.bowlingTeam || "Opponent",
                    runs: r,
                    wickets: 0,
                    isNotOut: !isOut,
                  });
                }
              }
            }
          });
        }
        if (inn.bowlerStats) {
          Object.entries(inn.bowlerStats).forEach(([pName, s]) => {
            const gid = findGlobalId(pName);
            if (gid && statsMap[gid]) {
              const p = statsMap[gid];
              const w = Number(s.wickets) || 0;
              const rc = Number(s.runs) || 0;
              const bb = Number(s.balls) || 0;

              if (bb > 0) {
                p.calculatedStats.wickets += w;
                p.calculatedStats.runsConceded += rc;
                p.calculatedStats.ballsBowled += bb;

                const existingHist = p.calculatedStats.history.find(
                  (h) => h.matchId === match.id,
                );
                if (existingHist) {
                  existingHist.wickets = w;
                } else {
                  p.calculatedStats.history.push({
                    matchId: match.id,
                    tournamentId: match.tournamentId,
                    date: match.date || match.meta?.date,
                    opponent: inn.battingTeam || "Opponent",
                    runs: 0,
                    wickets: w,
                    isNotOut: false,
                  });
                }
              }
            }
          });
        }
      });
    });

    const allStats = Object.values(statsMap).map((p) => {
      p.calculatedStats.matches = p.calculatedStats.history.length;
      return p;
    });

    const orange = [...allStats].sort(
      (a, b) => b.calculatedStats.runs - a.calculatedStats.runs,
    )[0];
    const purple = [...allStats].sort(
      (a, b) => b.calculatedStats.wickets - a.calculatedStats.wickets,
    )[0];

    let result = [...allStats];

    if (searchTerm) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    if (roleFilter !== "All") {
      result = result.filter((p) => p.activeRole === roleFilter);
    }

    result.sort((a, b) => {
      let valA =
        a.calculatedStats[sortConfig.key] ??
        a[sortConfig.key] ??
        a.activeRole ??
        0;
      let valB =
        b.calculatedStats[sortConfig.key] ??
        b[sortConfig.key] ??
        b.activeRole ??
        0;

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return {
      processedPlayers: result,
      orangeCap: orange?.calculatedStats.runs > 0 ? orange : null,
      purpleCap: purple?.calculatedStats.wickets > 0 ? purple : null,
    };
  }, [players, allMatches, searchTerm, roleFilter, sortConfig, tournamentId]);

  const handleDelete = async (playerId, e) => {
    if (e) e.stopPropagation();
    if (
      !window.confirm("⚠ Permanently delete this player from the tournament?")
    )
      return;
    try {
      await deleteGlobalPlayer(playerId);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      setSelectedPlayer(null);
      showToast("Player deleted successfully");
    } catch (error) {
      showToast("Failed to delete player", "error");
    }
  };

  const goToMatch = (tId, matchId) => {
    if (tId && matchId) navigate(`/tournaments/${tId}/scorecard/${matchId}`);
  };

  const handleSort = (key) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ colKey }) => (
    <span
      className={`ml-1 transition-opacity inline-block ${sortConfig.key === colKey ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
      {sortConfig.key === colKey && sortConfig.direction === "asc" ? "↑" : "↓"}
    </span>
  );

  // CROP & UPLOAD
  const handleProfileImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        setImageToCrop(reader.result);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropModalOpen(true);
      };
    }
  };

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    try {
      setProcessingImage(true);
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setFormData((prev) => ({ ...prev, photoURL: croppedImage }));
      setCropModalOpen(false);
      setImageToCrop(null);
    } catch (e) {
      showToast("Failed to crop image", "error");
    } finally {
      setProcessingImage(false);
    }
  };

  const compressImage = (file, maxWidth = 500) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * ratio;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
      };
    });
  };

  const handlePaymentImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const compressedBase64 = await compressImage(file, 600);
      setFormData((prev) => ({
        ...prev,
        paymentScreenshotURL: compressedBase64,
      }));
    } catch (error) {
      showToast("Failed to process payment image", "error");
    } finally {
      setProcessingImage(false);
    }
  };

  // FORM HANDLING
  const openAddModal = () => {
    setFormData({
      id: "",
      name: "",
      role: "All-Rounder",
      battingStyle: "Right Hand Bat",
      bowlingStyle: "Right Arm Medium",
      mobile: "",
      photoURL: "",
      paymentScreenshotURL: "",
    });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const openEditModal = (player, e) => {
    if (e) e.stopPropagation();
    const tData = player.tournamentData?.[tournamentId] || {};
    setFormData({
      id: player.id,
      name: player.name,
      role: tData.role || player.role || "All-Rounder",
      battingStyle:
        tData.battingStyle || player.battingStyle || "Right Hand Bat",
      bowlingStyle:
        tData.bowlingStyle || player.bowlingStyle || "Right Arm Medium",
      mobile: player.mobile || "",
      photoURL: tData.photoURL || player.photoURL || "",
      paymentScreenshotURL:
        tData.paymentScreenshotURL || player.paymentScreenshotURL || "",
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return showToast("Name is required", "error");
    setProcessingImage(true);

    try {
      const cleanMobile = formData.mobile
        ? formData.mobile.trim().replace(/\D/g, "")
        : "";
      const playersRef = collection(db, "players");
      const isoDate = new Date().toISOString();

      if (isEditing && formData.id) {
        const playerDocRef = doc(db, "players", formData.id);
        await setDoc(
          playerDocRef,
          {
            name: formData.name,
            mobile: cleanMobile,
            updatedAt: isoDate,
            tournamentData: {
              [tournamentId]: {
                role: formData.role,
                battingStyle: formData.battingStyle,
                bowlingStyle: formData.bowlingStyle,
                photoURL: formData.photoURL,
                paymentScreenshotURL: formData.paymentScreenshotURL,
                lastEdited: isoDate,
              },
            },
          },
          { merge: true },
        );
        showToast("Player Updated!");
        setSelectedPlayer(null);
      } else {
        if (cleanMobile) {
          const q = query(playersRef, where("mobile", "==", cleanMobile));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            const existingData = existingDoc.data();
            if (
              (existingData.registeredTournaments || []).includes(tournamentId)
            ) {
              showToast(
                "This player is already registered in this tournament.",
                "error",
              );
              setProcessingImage(false);
              return;
            }
            await setDoc(
              doc(db, "players", existingDoc.id),
              {
                registeredTournaments: arrayUnion(tournamentId),
                updatedAt: isoDate,
                tournamentData: {
                  [tournamentId]: {
                    role: formData.role,
                    battingStyle: formData.battingStyle,
                    bowlingStyle: formData.bowlingStyle,
                    photoURL: formData.photoURL,
                    paymentScreenshotURL: formData.paymentScreenshotURL,
                    registeredAt: isoDate,
                  },
                },
              },
              { merge: true },
            );
            showToast("Global player found! Linked to this tournament.");
            setShowFormModal(false);
            loadTournamentData();
            setProcessingImage(false);
            return;
          }
        }
        await addDoc(playersRef, {
          name: formData.name,
          mobile: cleanMobile,
          registeredTournaments: [tournamentId],
          stats: { matches: 0, runs: 0, wickets: 0 },
          isVerified: true,
          createdAt: isoDate,
          updatedAt: isoDate,
          tournamentData: {
            [tournamentId]: {
              role: formData.role,
              battingStyle: formData.battingStyle,
              bowlingStyle: formData.bowlingStyle,
              photoURL: formData.photoURL,
              paymentScreenshotURL: formData.paymentScreenshotURL,
              registeredAt: isoDate,
            },
          },
        });
        showToast("New Tournament Player Created!");
      }
      setShowFormModal(false);
      loadTournamentData();
    } catch (error) {
      showToast("Error saving player", "error");
    } finally {
      setProcessingImage(false);
    }
  };

  const DetailItem = ({ label, value, isMono = false }) => (
    <div
      className={`flex flex-col p-4 rounded-xl border ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#161920] border-white/5"}`}>
      <span
        className={`text-[10px] uppercase font-black mb-1.5 tracking-wider ${theme.sub}`}>
        {label}
      </span>
      <span
        className={`text-sm break-words font-bold ${isMono ? "font-mono text-teal-500" : theme.text}`}>
        {value || "N/A"}
      </span>
    </div>
  );

  const inputClass = `w-full border rounded-xl px-4 py-3 outline-none transition-all font-bold text-sm focus:ring-2
    ${lightMode ? "bg-white border-gray-200 text-gray-900 focus:ring-teal-100 focus:border-teal-500" : "bg-[#0F1115] border-white/10 text-slate-200 focus:border-teal-500/50"}`;

  return (
    <div
      className={`min-h-screen p-4 md:p-6 pb-20 font-sans transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      <NotificationToast
        message={notification?.message}
        type={notification?.type}
        onClose={() => setNotification(null)}
      />

      {/* CROP MODAL */}
      {cropModalOpen && imageToCrop && (
        <div className="fixed inset-0 z-[600] bg-black/95 flex flex-col animate-in fade-in duration-200">
          <div className="flex-grow relative">
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="bg-[#111] p-6 pb-12 flex flex-col gap-6">
            <div className="flex items-center gap-4 px-4">
              <span className="text-white text-sm font-bold uppercase">
                Zoom
              </span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(e.target.value)}
                className="w-full accent-indigo-500"
              />
            </div>
            <div className="flex justify-between gap-4 px-4">
              <button
                onClick={handleCancelCrop}
                className="flex-1 py-4 rounded-xl border border-white/20 text-white font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveCrop}
                className="flex-1 py-4 rounded-xl bg-indigo-500 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                Save Picture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER DETAILS MODAL (Pop-up) */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 md:p-8 custom-scrollbar ${lightMode ? "bg-white border border-gray-200" : "bg-[#1C2128] border border-white/10"}`}>
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors z-10">
              <X size={24} />
            </button>

            <div className="flex flex-col md:flex-row gap-6 items-start mb-8">
              <img
                src={
                  selectedPlayer.tournamentData?.[tournamentId]?.photoURL ||
                  selectedPlayer.photoURL ||
                  "https://cdn-icons-png.flaticon.com/512/847/847969.png"
                }
                alt={selectedPlayer.name}
                className={`w-32 h-32 md:w-48 md:h-48 rounded-3xl object-cover border-4 shadow-xl cursor-pointer ${lightMode ? "border-white" : "border-[#0F1115]"}`}
                onClick={(e) => setPreviewImage(e.target.src)}
              />
              <div className="flex-grow pt-2 w-full">
                <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-3 mb-2 pr-12 md:pr-14">
                  <h2
                    className={`text-2xl md:text-3xl font-black italic tracking-tight break-words ${theme.text}`}>
                    {selectedPlayer.name}
                  </h2>
                  {user && (
                    <div className="flex gap-2 sm:ml-auto shrink-0 mt-1 sm:mt-0">
                      <button
                        onClick={() => {
                          setSelectedPlayer(null);
                          openEditModal(selectedPlayer);
                        }}
                        className={`p-2.5 rounded-lg transition-all ${lightMode ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/5 hover:bg-white/10 text-white"}`}>
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(selectedPlayer.id)}
                        className="p-2.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <span
                  className={`inline-block text-xs px-4 py-1.5 rounded-full uppercase font-black tracking-widest border mb-6 ${lightMode ? "bg-gray-100 border-gray-200 text-gray-600" : "bg-white/5 border-white/10 text-slate-300"}`}>
                  {selectedPlayer.activeRole}
                </span>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailItem
                    label="Batting"
                    value={
                      selectedPlayer.tournamentData?.[tournamentId]
                        ?.battingStyle || selectedPlayer.battingStyle
                    }
                  />
                  <DetailItem
                    label="Bowling"
                    value={
                      selectedPlayer.tournamentData?.[tournamentId]
                        ?.bowlingStyle || selectedPlayer.bowlingStyle
                    }
                  />
                  <DetailItem
                    label="Phone"
                    value={selectedPlayer.mobile}
                    isMono={true}
                  />
                  <DetailItem
                    label="Matches"
                    value={selectedPlayer.calculatedStats.matches}
                    isMono={true}
                  />
                </div>
              </div>
            </div>

            {/* Receipt & History Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-black/5 dark:border-white/10">
              {user &&
                (selectedPlayer.tournamentData?.[tournamentId]
                  ?.paymentScreenshotURL ||
                  selectedPlayer.paymentScreenshotURL) && (
                  <div>
                    <h4
                      className={`text-xs font-black uppercase mb-4 tracking-widest ${theme.sub}`}>
                      Payment Proof
                    </h4>
                    <img
                      src={
                        selectedPlayer.tournamentData?.[tournamentId]
                          ?.paymentScreenshotURL ||
                        selectedPlayer.paymentScreenshotURL
                      }
                      onClick={(e) => setPreviewImage(e.target.src)}
                      className={`w-full h-40 object-cover rounded-xl border cursor-pointer hover:opacity-80 transition-opacity ${lightMode ? "border-gray-200" : "border-white/10"}`}
                    />
                  </div>
                )}
              <div
                className={
                  user &&
                  (selectedPlayer.tournamentData?.[tournamentId]
                    ?.paymentScreenshotURL ||
                    selectedPlayer.paymentScreenshotURL)
                    ? ""
                    : "md:col-span-2"
                }>
                <h4
                  className={`text-xs font-black uppercase mb-4 tracking-widest ${theme.sub}`}>
                  Recent Matches
                </h4>
                {selectedPlayer.calculatedStats.history.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {selectedPlayer.calculatedStats.history.map(
                      (match, idx) => (
                        <div
                          key={idx}
                          onClick={() =>
                            goToMatch(match.tournamentId, match.matchId)
                          }
                          className={`flex justify-between items-center p-4 rounded-xl cursor-pointer border hover:border-teal-500 transition-colors ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#0F1115] border-white/5"}`}>
                          <div>
                            <div
                              className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${theme.sub}`}>
                              {new Date(match.date).toLocaleDateString()}
                            </div>
                            <div className={`text-sm font-bold ${theme.text}`}>
                              vs {match.opponent}
                            </div>
                          </div>
                          <div className="flex gap-4 text-sm font-mono font-bold">
                            {match.runs > 0 && (
                              <span className="text-teal-500">
                                🏏 {match.runs}
                              </span>
                            )}
                            {match.wickets > 0 && (
                              <span className="text-purple-500">
                                🥎 {match.wickets}
                              </span>
                            )}
                            {match.runs === 0 && match.wickets === 0 && (
                              <span className={theme.sub}>-</span>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div
                    className={`p-6 text-center text-sm font-medium italic rounded-xl border border-dashed ${theme.sub} ${lightMode ? "border-gray-300" : "border-white/10"}`}>
                    No matches played yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        {/* HEADER CONTROLS */}
        <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-6">
          <div className="text-center lg:text-left">
            <h1
              className={`text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 justify-center lg:justify-start ${theme.text}`}>
              <span
                className={`p-3 rounded-2xl ${lightMode ? "bg-indigo-100 text-indigo-600" : "bg-indigo-500/10 text-indigo-500"}`}>
                <Trophy size={24} />
              </span>
              {tournamentId ? tournamentId.replace(/-/g, " ") : "Tournament"}
            </h1>
            <p
              className={`text-sm mt-3 font-bold uppercase tracking-widest flex items-center gap-2 justify-center lg:justify-start ${theme.sub}`}>
              {processedPlayers.length} profiles registered
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-center lg:justify-end items-center">
            {/* TIGHTENED SEARCH */}
            <div className="relative w-full sm:w-[130px] flex-grow sm:flex-grow-0">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.sub}`}
                size={14}
              />
              <input
                type="text"
                placeholder="Search..."
                className={inputClass
                  .replace("px-4", "pl-8 pr-3")
                  .replace("text-sm", "text-xs")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* TIGHTENED DROPDOWNS: Role Filter */}
            <div className="relative w-full sm:w-[130px] flex-grow sm:flex-grow-0">
              <Filter
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.sub}`}
                size={14}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={`${inputClass.replace("px-4", "pl-8 pr-7").replace("text-sm", "text-xs")} appearance-none cursor-pointer`}>
                <option value="All">All Roles</option>
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-Rounder">All-Rounder</option>
                <option value="Wicket Keeper">Wicket Keeper</option>
              </select>
              <ChevronDown
                className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme.sub}`}
                size={14}
              />
            </div>

            {/* TIGHTENED DROPDOWNS: Sort Filter */}
            <div className="relative w-full sm:w-[125px] flex-grow sm:flex-grow-0">
              <ArrowUpDown
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.sub}`}
                size={14}
              />
              <select
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split("-");
                  setSortConfig({ key, direction: dir });
                }}
                className={`${inputClass.replace("px-4", "pl-8 pr-7").replace("text-sm", "text-xs")} appearance-none cursor-pointer`}>
                <option value="runs-desc">Most Runs</option>
                <option value="wickets-desc">Most Wkts</option>
                <option value="matches-desc">Most Mat</option>
                <option value="name-asc">Name (A-Z)</option>
              </select>
              <ChevronDown
                className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme.sub}`}
                size={14}
              />
            </div>

            {/* VIEW TOGGLE */}
            <div
              className={`flex p-1 rounded-xl border ${lightMode ? "bg-gray-100 border-gray-200" : "bg-[#0F1115] border-white/10"}`}>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2.5 rounded-lg transition-all ${viewMode === "grid" ? (lightMode ? "bg-white shadow-sm text-indigo-600" : "bg-white/10 text-indigo-400") : theme.sub}`}
                title="Grid View">
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 rounded-lg transition-all ${viewMode === "list" ? (lightMode ? "bg-white shadow-sm text-indigo-600" : "bg-white/10 text-indigo-400") : theme.sub}`}
                title="List View">
                <List size={18} />
              </button>
            </div>

            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className={`p-3.5 rounded-xl border transition-all ${lightMode ? "bg-white border-gray-200 text-gray-600 hover:bg-gray-50" : "bg-[#0F1115] border-white/10 text-slate-300 hover:bg-white/5"}`}
                title="Toggle Theme">
                {lightMode ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            )}

            {user && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportToExcel}
                  className={`p-3.5 px-5 rounded-xl font-black text-sm uppercase tracking-widest shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 border ${
                    lightMode
                      ? "bg-white text-green-600 border-green-200 hover:bg-green-50"
                      : "bg-green-900/20 text-green-400 border-green-500/30 hover:bg-green-900/40"
                  }`}>
                  <Download size={16} /> Export
                </button>

                <button
                  onClick={openAddModal}
                  className="bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white p-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> Add Player
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CAPS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          {orangeCap && (
            <div
              className={`p-6 rounded-[2rem] flex items-center gap-5 shadow-sm border transition-all ${lightMode ? "bg-orange-50/50 border-orange-200" : "bg-orange-900/10 border-orange-500/20"}`}>
              <div
                className={`p-4 rounded-full border ${lightMode ? "bg-orange-100 border-orange-200 text-orange-600" : "bg-orange-500/10 border-orange-500/20 text-orange-500"}`}>
                <Medal size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">
                  Tournament Orange Cap
                </div>
                <div className={`text-xl font-black italic ${theme.text}`}>
                  {orangeCap.name}
                </div>
                <div
                  className={`text-sm font-mono font-bold mt-1 ${theme.sub}`}>
                  {orangeCap.calculatedStats.runs} Runs
                </div>
              </div>
            </div>
          )}
          {purpleCap && (
            <div
              className={`p-6 rounded-[2rem] flex items-center gap-5 shadow-sm border transition-all ${lightMode ? "bg-purple-50/50 border-purple-200" : "bg-purple-900/10 border-purple-500/20"}`}>
              <div
                className={`p-4 rounded-full border ${lightMode ? "bg-purple-100 border-purple-200 text-purple-600" : "bg-purple-500/10 border-purple-500/20 text-purple-500"}`}>
                <Medal size={28} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">
                  Tournament Purple Cap
                </div>
                <div className={`text-xl font-black italic ${theme.text}`}>
                  {purpleCap.name}
                </div>
                <div
                  className={`text-sm font-mono font-bold mt-1 ${theme.sub}`}>
                  {purpleCap.calculatedStats.wickets} Wickets
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PLAYERS RENDERING (Grid OR List based on viewMode state) */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-indigo-500 animate-pulse text-sm font-black uppercase tracking-widest gap-4">
            <Loader2 className="animate-spin" size={40} /> Loading Roster...
          </div>
        ) : processedPlayers.length === 0 ? (
          <div className={`text-center py-20 italic text-base ${theme.sub}`}>
            No players found.
          </div>
        ) : viewMode === "grid" ? (
          // GRID VIEW
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {processedPlayers.map((player) => {
              const tData = player.tournamentData?.[tournamentId] || {};
              const displayPhoto =
                tData.photoURL ||
                player.photoURL ||
                "https://cdn-icons-png.flaticon.com/512/847/847969.png";
              const displayRole = tData.role || player.role;

              return (
                <div
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`relative p-5 rounded-[2rem] border cursor-pointer transition-all shadow-sm hover:shadow-xl group flex flex-col gap-5 ${
                    lightMode
                      ? "bg-white border-gray-200 hover:border-indigo-300"
                      : "bg-[#1C2128] border-white/5 hover:border-indigo-500/50"
                  }`}>
                  <div className="flex items-center gap-4">
                    <img
                      src={displayPhoto}
                      alt={player.name}
                      className={`w-16 h-16 rounded-2xl object-cover border-2 shadow-md ${lightMode ? "border-white" : "border-white/10"}`}
                      onError={(e) => {
                        e.target.src =
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                      }}
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span
                        className={`font-black text-lg leading-tight truncate ${theme.text}`}>
                        {player.name}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${theme.sub}`}>
                        {displayRole}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`grid grid-cols-3 gap-3 pt-4 border-t text-center ${lightMode ? "border-gray-100" : "border-white/5"}`}>
                    <div className="flex flex-col">
                      <span
                        className={`text-[9px] uppercase font-black tracking-widest mb-1 ${theme.sub}`}>
                        Matches
                      </span>
                      <span
                        className={`text-base font-mono font-bold ${theme.text}`}>
                        {player.calculatedStats.matches}
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-r border-black/5 dark:border-white/5">
                      <span
                        className={`text-[9px] uppercase font-black tracking-widest mb-1 text-teal-500/80`}>
                        Runs
                      </span>
                      <span className="text-base font-mono font-bold text-teal-500">
                        {player.calculatedStats.runs}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`text-[9px] uppercase font-black tracking-widest mb-1 text-purple-500/80`}>
                        Wickets
                      </span>
                      <span className="text-base font-mono font-bold text-purple-500">
                        {player.calculatedStats.wickets}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // LIST VIEW (TABLE)
          <div
            className={`border rounded-[2.5rem] overflow-hidden shadow-2xl ${theme.card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead
                  className={`text-[11px] uppercase font-black tracking-[0.2em] border-b ${lightMode ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-[#0F1115] text-slate-500 border-white/5"}`}>
                  <tr>
                    <th
                      className="px-6 py-5 cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("name")}>
                      Player <SortIcon colKey="name" />
                    </th>
                    <th
                      className="px-6 py-5 text-center cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("matches")}>
                      Mat <SortIcon colKey="matches" />
                    </th>
                    <th
                      className="px-6 py-5 text-center cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("runs")}>
                      Runs <SortIcon colKey="runs" />
                    </th>
                    <th
                      className="px-6 py-5 text-center cursor-pointer hover:opacity-70 group hidden md:table-cell transition-opacity"
                      onClick={() => handleSort("highestScore")}>
                      HS <SortIcon colKey="highestScore" />
                    </th>
                    <th
                      className="px-6 py-5 text-center cursor-pointer hover:opacity-70 group transition-opacity"
                      onClick={() => handleSort("wickets")}>
                      Wkts <SortIcon colKey="wickets" />
                    </th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${lightMode ? "divide-gray-100" : "divide-white/5"}`}>
                  {processedPlayers.map((player) => {
                    const tData = player.tournamentData?.[tournamentId] || {};
                    const displayPhoto =
                      tData.photoURL ||
                      player.photoURL ||
                      "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                    const displayRole = tData.role || player.role;

                    return (
                      <tr
                        key={player.id}
                        onClick={() => setSelectedPlayer(player)}
                        className={`cursor-pointer group transition-colors ${lightMode ? "hover:bg-gray-50" : "hover:bg-white/5"}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <img
                              src={displayPhoto}
                              alt=""
                              className={`w-12 h-12 rounded-xl object-cover shadow-sm border ${lightMode ? "border-gray-200" : "border-white/10"}`}
                              onError={(e) => {
                                e.target.src =
                                  "https://cdn-icons-png.flaticon.com/512/847/847969.png";
                              }}
                            />
                            <div className="flex flex-col">
                              <span
                                className={`font-bold text-base ${theme.text}`}>
                                {player.name}
                              </span>
                              <span
                                className={`text-[10px] uppercase font-bold tracking-widest mt-0.5 ${theme.sub}`}>
                                {displayRole}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 text-center text-sm font-mono font-bold ${theme.sub}`}>
                          {player.calculatedStats.matches}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-teal-500 font-mono text-base">
                          {player.calculatedStats.runs}
                        </td>
                        <td
                          className={`px-6 py-4 text-center text-sm font-mono font-bold hidden md:table-cell ${theme.sub}`}>
                          {player.calculatedStats.highestScore}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-purple-500 font-mono text-base">
                          {player.calculatedStats.wickets}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {user && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={(e) => openEditModal(player, e)}
                                className={`p-2 rounded-lg transition-all ${lightMode ? "text-gray-400 hover:bg-gray-200 hover:text-gray-900" : "text-slate-500 hover:bg-white/10 hover:text-white"}`}>
                                <Edit3 size={18} />
                              </button>
                              <button
                                onClick={(e) => handleDelete(player.id, e)}
                                className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-all">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* IMAGE LIGHTBOX */}
        {previewImage && (
          <div
            className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-5xl max-h-[90vh]">
              <img
                src={previewImage}
                alt="Preview"
                className="rounded-xl shadow-2xl border border-white/10"
                style={{ maxWidth: "80vw", maxHeight: "80vh" }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                className="absolute -top-12 right-0 text-white hover:text-red-400 font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
                onClick={() => setPreviewImage(null)}>
                Close <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* FORM MODAL */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-in fade-in">
            <div
              className={`border w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${theme.card} ${theme.text}`}>
              <div
                className={`p-6 border-b flex justify-between items-center sticky top-0 z-10 ${lightMode ? "bg-white border-gray-200" : "bg-[#1C2128] border-white/5"}`}>
                <h3
                  className={`text-xl font-black uppercase tracking-tight italic ${theme.text}`}>
                  {isEditing ? "Edit Player" : "Register Player"}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${lightMode ? "bg-gray-100 hover:bg-gray-200" : "bg-white/5 hover:bg-white/10"}`}>
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="flex gap-6 justify-center">
                    <div className="flex flex-col items-center">
                      <div
                        className="relative group cursor-pointer"
                        onClick={() => fileInputRef.current.click()}>
                        <div
                          className={`w-28 h-28 rounded-full border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl ${formData.photoURL ? "border-indigo-500 shadow-indigo-500/20" : lightMode ? "bg-gray-100 border-gray-200 border-dashed" : "bg-[#0F1115] border-white/10 border-dashed"}`}>
                          {formData.photoURL ? (
                            <img
                              src={formData.photoURL}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera
                              className={`opacity-50 ${theme.sub}`}
                              size={32}
                            />
                          )}
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleProfileImageSelect}
                          className="hidden"
                          accept="image/*"
                          onClick={(e) => {
                            e.target.value = null;
                          }}
                        />
                      </div>
                      <p
                        className={`text-[10px] uppercase mt-3 font-black tracking-widest text-center ${theme.sub}`}>
                        Profile
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div
                        className="relative group cursor-pointer"
                        onClick={() => paymentInputRef.current.click()}>
                        <div
                          className={`w-28 h-28 rounded-xl border-4 flex items-center justify-center overflow-hidden transition-all shadow-xl ${formData.paymentScreenshotURL ? "border-purple-500 shadow-purple-500/20" : lightMode ? "bg-gray-100 border-gray-200 border-dashed" : "bg-[#0F1115] border-white/10 border-dashed"}`}>
                          {formData.paymentScreenshotURL ? (
                            <img
                              src={formData.paymentScreenshotURL}
                              alt="Proof"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Receipt
                              className={`opacity-50 ${theme.sub}`}
                              size={32}
                            />
                          )}
                        </div>
                        <input
                          type="file"
                          ref={paymentInputRef}
                          onChange={handlePaymentImageUpload}
                          className="hidden"
                          accept="image/*"
                        />
                      </div>
                      <p
                        className={`text-[10px] uppercase mt-3 font-black tracking-widest text-center ${theme.sub}`}>
                        Payment
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <input
                      className={inputClass}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      placeholder="Full Name"
                    />
                    <input
                      className={inputClass}
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({ ...formData, mobile: e.target.value })
                      }
                      placeholder="Mobile Number"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        "Batsman",
                        "Bowler",
                        "All-Rounder",
                        "Wicket Keeper",
                      ].map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setFormData({ ...formData, role })}
                          className={`py-3.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${formData.role === role ? "bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400" : lightMode ? "bg-white border-gray-200 text-gray-500 hover:bg-gray-50" : "bg-[#0F1115] border-white/5 text-slate-500 hover:text-slate-300"}`}>
                          {role}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <select
                        className={inputClass}
                        value={formData.battingStyle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            battingStyle: e.target.value,
                          })
                        }>
                        <option>Right Hand Bat</option>
                        <option>Left Hand Bat</option>
                      </select>
                      <select
                        className={inputClass}
                        value={formData.bowlingStyle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bowlingStyle: e.target.value,
                          })
                        }>
                        <option>Right Arm Medium</option>
                        <option>Right Arm Fast</option>
                        <option>Right Arm Spin</option>
                        <option>Left Arm Medium</option>
                        <option>Left Arm Fast</option>
                        <option>Left Arm Spin</option>
                        <option>None</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={processingImage}
                    className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-sm py-5 rounded-xl shadow-lg transition-all disabled:opacity-50 active:scale-[0.98]">
                    {processingImage
                      ? "Processing..."
                      : isEditing
                        ? "Update Player"
                        : "Register Player"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
