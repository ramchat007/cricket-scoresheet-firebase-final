import { collection, query, where, getDocs } from "firebase/firestore";

const TournamentPlayerList = () => {
  const { tournamentId } = useParams();
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const fetchPlayers = async () => {
      const q = query(
        collection(db, "players"),
        where("tournamentId", "==", tournamentId), // Filters only for this tournament
      );
      const snapshot = await getDocs(q);
      setPlayers(snapshot.docs.map((doc) => doc.data()));
    };
    fetchPlayers();
  }, [tournamentId]);

  return (
    <div>
      <h1>Players for {tournamentId}</h1>
      {/* Map through players and show cards/table */}
    </div>
  );
};
