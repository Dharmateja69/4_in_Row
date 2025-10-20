export default function StatusBar({
  username,
  seat,
  opponent,
  game,
  onResign,
  opponentStatus,
}) {
  const turnName =
    game?.current === username
      ? "Your turn"
      : game?.current
      ? `${game.current}'s turn`
      : game?.board
      ? "Waiting for first move..."
      : "Waiting for game to start...";

  const status = game?.finished
    ? game?.winner
      ? `Winner: ${game.winner}`
      : "Draw"
    : turnName;

  const secondsLeft = opponentStatus
    ? Math.ceil((opponentStatus.remainingMs ?? opponentStatus.timeoutMs) / 1000)
    : null;

  const progress = opponentStatus
    ? (secondsLeft / (opponentStatus.timeoutMs / 1000)) * 100
    : 0;

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="badge">
            User: <strong className="monosp">{username || "-"}</strong>
          </div>
          <div className="badge">
            Seat: <strong>{seat || "-"}</strong>
          </div>
          <div className="badge">
            Opponent: <strong>{opponent || "-"}</strong>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontWeight: 700,
              color: "var(--accent-1)",
              fontSize: "1.1rem",
            }}
          >
            {status}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: "0.25rem",
            }}
          >
            {game?.gameId ? (
              <span className="monosp">{game.gameId.slice(0, 13)}...</span>
            ) : (
              "-"
            )}
          </div>
        </div>
      </div>

      {opponentStatus && !game?.finished && (
        <div className="disconnect-popup">
          <div>
            <span style={{ fontSize: "1.5rem" }}>⚠️</span>
            <span>{opponentStatus.text}</span>
          </div>
          <div className="timer-display">
            <span style={{ color: "var(--text-secondary)" }}>
              Reconnecting in:
            </span>
            <strong>{secondsLeft}s</strong>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 12, justifyContent: "center" }}>
        {game && !game.finished && (
          <button
            onClick={onResign}
            style={{ background: "linear-gradient(135deg, #ff4757, #ff6b9d)" }}
          >
            🏳️ Resign
          </button>
        )}
      </div>
    </div>
  );
}
