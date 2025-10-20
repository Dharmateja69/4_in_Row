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
              {rows.map((r, idx) => (
                <tr key={r.username}>
                  <td className="rank-column">{idx + 1}</td>
                  <td>{r.username}</td>
                  <td style={{ textAlign: "center" }}>
                    {r.total_games || r.wins + r.losses + (r.draws || 0)}
                  </td>
                  <td style={{ textAlign: "center", color: "var(--success)" }}>
                    {r.wins}
                  </td>
                  <td style={{ textAlign: "center", color: "var(--danger)" }}>
                    {r.losses}
                  </td>
                  <td className="win-rate" style={{ textAlign: "center" }}>
                    {r.win_rate ? `${r.win_rate.toFixed(1)}%` : "0%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
