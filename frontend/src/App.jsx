// App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { endpoints } from "./api";
import Board from "./components/Board";
import Leaderboard from "./components/Leaderboard";
import Login from "./components/Login";
import StatusBar from "./components/StatusBar";
import "./styles.css";
import { useC4Socket } from "./useC4Socket";

function useSfx() {
  const ctxRef = useRef(null);
  useEffect(() => {
    try {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }, []);
  const tone = (freq = 440, time = 0.12, type = "sine", gain = 0.08) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.setTargetAtTime(0, ctx.currentTime + time * 0.8, time * 0.2);
      o.stop(ctx.currentTime + time + 0.1);
    } catch (e) {
      console.warn("SFX failed", e);
    }
  };
  return { tone };
}

function RejoinPanel({ saved, onRejoin }) {
  const [username, setUsername] = useState(saved?.username || "");
  const [gameId, setGameId] = useState(saved?.gameId || "");
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4 style={{ color: "var(--accent-1)" }}>Rejoin game</h4>
      <div className="row">
        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your username"
        />
      </div>
      <div className="row">
        <label>Game ID</label>
        <input
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="paste gameId"
        />
      </div>
      <button
        onClick={() => onRejoin(username.trim(), gameId.trim())}
        disabled={!username || !gameId}
      >
        Rejoin
      </button>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(
    localStorage.getItem("c4.username") || ""
  );
  const wsUrl = useMemo(() => (username ? endpoints.ws() : null), [username]);

  const sfx = useSfx();

  const {
    connected,
    game,
    seat,
    opponent,
    opponentStatus,
    statusMessage,
    dropCell,
    resign,
    rejoin,
    lastSaved,
  } = useC4Socket({ wsUrl, username });

  useEffect(() => {
    if (username) localStorage.setItem("c4.username", username);
    else localStorage.removeItem("c4.username");
  }, [username]);

  useEffect(() => {
    const handleStorageCheck = () => {
      const storedUser = localStorage.getItem("c4.username");
      if (!storedUser && username) {
        setUsername("");
      }
    };
    const intervalId = setInterval(handleStorageCheck, 600);
    return () => clearInterval(intervalId);
  }, [username]);

  const [modal, setModal] = useState(null);
  useEffect(() => {
    if (!game) return;
    if (game.finished) {
      if (game.winner) {
        setModal({
          title: "Game Over",
          text: `${game.winner} won 🎉`,
          winner: game.winner,
        });
        game.winner === username
          ? sfx.tone(880, 0.18, "sine", 0.14)
          : sfx.tone(220, 0.25, "sawtooth", 0.08);
      } else {
        setModal({ title: "Game Over", text: `It's a draw`, winner: null });
        sfx.tone(400, 0.12, "triangle", 0.08);
      }
      localStorage.removeItem("c4.gameId");
    } else {
      setModal(null);
    }
  }, [game, username, sfx]);

  const onDropCell = (col) => {
    if (!game || game.finished || game.current !== username) return;
    sfx.tone(520, 0.06, "sine", 0.06);
    dropCell(col);
  };

  const isGameActive = game && game.board;

  return (
    <div className="container">
      <h2>4 in a Row</h2>

      {/* ⚠️ Warning Disclaimer - using CSS classes */}
      <div className="board-disclaimer">
        <span className="disclaimer-icon">⚠️</span>
        <span className="disclaimer-text">
          <strong>Important:</strong> Do not refresh the page during the game!
          If disconnected, you have 30 seconds to rejoin or you'll forfeit.
        </span>
      </div>

      {!username && <Login onJoin={setUsername} />}

      {username && (
        <>
          <StatusBar
            username={username}
            seat={seat}
            opponent={opponent}
            game={game}
            onResign={() => {
              sfx.tone(240, 0.08, "sawtooth", 0.06);
              resign();
            }}
            opponentStatus={opponentStatus}
          />

          {isGameActive ? (
            <Board
              board={game.board}
              onDropCell={onDropCell}
              disabled={
                game.finished || game.current !== username || !connected
              }
            />
          ) : (
            <div
              className="card"
              style={{ marginTop: 12, textAlign: "center" }}
            >
              <h4>{statusMessage}</h4>
              {lastSaved.gameId && statusMessage.includes("Reconnect") && (
                <RejoinPanel
                  saved={lastSaved}
                  onRejoin={(u, gid) => {
                    if (u) localStorage.setItem("c4.username", u);
                    rejoin(u, gid);
                  }}
                />
              )}
            </div>
          )}
          <Leaderboard />
        </>
      )}

      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{modal.title}</h3>
            <p style={{ fontSize: 16 }}>{modal.text}</p>
            <div className="actions">
              <button
                onClick={() => {
                  setModal(null);
                  setUsername("");
                }}
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
