import { useEffect, useState } from "react";
import { endpoints, httpGet } from "../api";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    const url = endpoints.leaderboard();

    httpGet(url)
      .then((j) => {
        if (!abort) {
          setRows(j || []);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!abort) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      abort = true;
    };
  }, []);

  // ✅ Calculate win rate
  const calculateWinRate = (row) => {
    const totalGames =
      row.total_games || row.wins + row.losses + (row.draws || 0);

    // If no games played, return 0%
    if (totalGames === 0) return "0.0";

    // If win_rate exists from backend, use it
    if (row.win_rate !== null && row.win_rate !== undefined) {
      return row.win_rate.toFixed(1);
    }

    // Calculate from wins/total
    const winRate = (row.wins / totalGames) * 100;
    return winRate.toFixed(1);
  };

  return (
    <div className="leaderboard-container">
      <div className="card">
        <h3 style={{ color: "var(--accent-1)", marginBottom: "1.5rem" }}>
          🏆 Leaderboard
        </h3>

        {loading && <p style={{ color: "var(--text-muted)" }}>Loading...</p>}
        {error && (
          <div style={{ color: "var(--danger)" }}>❌ Error: {error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>
            No players yet. Be the first!
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <table className="lb">
            <thead>
              <tr>
                <th style={{ width: "10%", textAlign: "center" }}>Rank</th>
                <th style={{ width: "30%" }}>Player</th>
                <th style={{ width: "15%", textAlign: "center" }}>Games</th>
                <th style={{ width: "15%", textAlign: "center" }}>Wins</th>
                <th style={{ width: "15%", textAlign: "center" }}>Losses</th>
                <th style={{ width: "15%", textAlign: "center" }}>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const totalGames =
                  r.total_games || r.wins + r.losses + (r.draws || 0);
                const winRate = calculateWinRate(r);

                return (
                  <tr key={r.username}>
                    <td className="rank-column">{idx + 1}</td>
                    <td>{r.username}</td>
                    <td style={{ textAlign: "center" }}>{totalGames}</td>
                    <td
                      style={{ textAlign: "center", color: "var(--success)" }}
                    >
                      {r.wins || 0}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--danger)" }}>
                      {r.losses || 0}
                    </td>
                    <td className="win-rate" style={{ textAlign: "center" }}>
                      {winRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
