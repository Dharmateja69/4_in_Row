import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";

const LS_KEYS = {
    username: "c4.username",
    gameId: "c4.gameId",
};

const sendJSON = (sendJsonMessage, obj) => {
    console.log("[FE][WS] send", obj);
    try {
        sendJsonMessage(obj);
    } catch (e) {
        console.warn("[FE][WS] send failed", e);
    }
};

export function useC4Socket({ wsUrl, username }) {
    const [connected, setConnected] = useState(false);
    const [game, setGame] = useState(null);
    const [seat, setSeat] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [opponentStatus, setOpponentStatus] = useState(null);
    const [statusMessage, setStatusMessage] = useState("Initializing...");

    const lastGameId = useRef(localStorage.getItem(LS_KEYS.gameId));
    const gameFinishedRef = useRef(false);
    const disconnectTimer = useRef(null);
    const forfeitTimeoutRef = useRef(null);

    const lastSaved = useMemo(
        () => ({
            username: localStorage.getItem(LS_KEYS.username) || "",
            gameId: localStorage.getItem(LS_KEYS.gameId) || "",
        }),
        []
    );

    const { sendJsonMessage, lastJsonMessage } = useWebSocket(
        wsUrl,
        {
            shouldReconnect: () => true,
            reconnectAttempts: 100,
            reconnectInterval: (attempt) => Math.min(5000, 500 * attempt),
            onOpen: () => {
                console.log("[FE][WS] WebSocket opened");
                setConnected(true);
                setStatusMessage("Connected");

                // Try rejoin with saved gameId or start new game
                const savedGameId = localStorage.getItem(LS_KEYS.gameId);
                if (savedGameId && !gameFinishedRef.current) {
                    console.log("[FE][WS] Attempting rejoin with saved gameId:", savedGameId);
                    sendJSON(sendJsonMessage, {
                        type: "join",
                        payload: { username, gameId: savedGameId },
                    });
                } else {
                    console.log("[FE][WS] Starting new game");
                    sendJSON(sendJsonMessage, { type: "join", payload: { username } });
                }
            },
            onClose: (e) => {
                console.log("[FE][WS] WebSocket closed", e?.code, e?.reason);
                setConnected(false);
                setStatusMessage("Disconnected. Reconnecting...");
            },
            onError: (e) => {
                console.error("[FE][WS] WebSocket error", e);
                setStatusMessage("Connection Error");
            },
        },
        !!wsUrl
    );

    const clearGameState = useCallback(() => {
        console.log("[FE][WS] Clearing game state and localStorage");
        setGame(null);
        setSeat(null);
        setOpponent(null);
        setOpponentStatus(null);
        localStorage.removeItem(LS_KEYS.gameId);
        lastGameId.current = null;
        gameFinishedRef.current = false;

        if (disconnectTimer.current) {
            clearInterval(disconnectTimer.current);
            disconnectTimer.current = null;
        }

        if (forfeitTimeoutRef.current) {
            clearTimeout(forfeitTimeoutRef.current);
            forfeitTimeoutRef.current = null;
        }
    }, []);

    const makeEmptyBoard = useCallback(() => {
        const rows = 6;
        const cols = 7;
        return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    }, []);

    useEffect(() => {
        if (!lastJsonMessage) return;

        const { type, payload, ...rest } = lastJsonMessage;
        console.log("[FE][WS] Message received:", { type, payload, rest });

        // --- QUEUE ---
        if (type === "queued") {
            setStatusMessage("In queue, searching for opponent...");
        }

        // --- MATCHED ---
        if (type === "matched") {
            const { gameId, seat: mySeat, opponent: opp, turn, seats, board } = payload ?? rest;

            if (forfeitTimeoutRef.current) {
                clearTimeout(forfeitTimeoutRef.current);
                forfeitTimeoutRef.current = null;
            }

            setSeat(mySeat);
            setOpponent(opp);
            lastGameId.current = gameId;
            localStorage.setItem(LS_KEYS.gameId, gameId);
            setOpponentStatus(null);
            gameFinishedRef.current = false;

            const safeBoard = board ?? makeEmptyBoard();
            setGame({ gameId, board: safeBoard, turn, current: seats?.[turn], seats, finished: false });
            setStatusMessage("");
        }

        // --- MOVE ---
        if (type === "move") {
            const { by, row, col } = payload ?? rest;
            setGame((prevGame) => {
                if (!prevGame) return prevGame;
                const newBoard = prevGame.board.map((r) => [...r]);
                const playerSeat = prevGame.seats?.X === by ? "X" : "O";
                newBoard[row][col] = playerSeat;
                return { ...prevGame, board: newBoard };
            });
        }

        // --- STATE UPDATE ---
        if (type === "state") {
            const { gameId, board, turn, seats, finished, winner } = payload ?? rest;
            lastGameId.current = gameId;
            const safeBoard = board ?? makeEmptyBoard();
            const mySeat = seats?.X === username ? "X" : "O";
            const opp = mySeat === "X" ? seats?.O : seats?.X;

            setSeat(mySeat);
            setOpponent(opp);

            setGame({ gameId, board: safeBoard, turn, current: seats?.[turn], seats, finished, winner });
            if (finished) gameFinishedRef.current = true;
        }

        // --- PLAYER DISCONNECTED ---
        // --- PLAYER DISCONNECTED ---
        if (type === "playerDisconnected") {
            const { disconnectedPlayer, timeoutMs, gameId: disconnectGameId } = payload ?? rest;

            if (disconnectedPlayer === username) {
                // I disconnected - start my own forfeit countdown
                if (forfeitTimeoutRef.current) clearTimeout(forfeitTimeoutRef.current);
                forfeitTimeoutRef.current = setTimeout(() => {
                    console.log("[FE][WS] I forfeited due to timeout");
                    clearGameState();
                    setStatusMessage("⚠️ Connection lost - Game forfeited. Please login to start a new game.");
                }, timeoutMs);
            } else {
                // Opponent disconnected - show timer
                const start = Date.now();
                setOpponentStatus({
                    text: `${disconnectedPlayer} disconnected`,
                    timeoutMs,
                    start,
                    remainingMs: timeoutMs
                });

                if (disconnectTimer.current) clearInterval(disconnectTimer.current);

                disconnectTimer.current = setInterval(() => {
                    setOpponentStatus((prev) => {
                        if (!prev) {
                            clearInterval(disconnectTimer.current);
                            disconnectTimer.current = null;
                            return null;
                        }
                        const elapsed = Date.now() - prev.start;
                        const remaining = Math.max(0, prev.timeoutMs - elapsed);

                        if (remaining <= 0) {
                            // ✅ TIMER HIT ZERO - Mark game as finished locally
                            console.log("[FE][WS] Opponent forfeit timeout reached - awaiting server confirmation");
                            clearInterval(disconnectTimer.current);
                            disconnectTimer.current = null;

                            // Set game as finished optimistically
                            setGame((g) => {
                                if (g && !g.finished) {
                                    return { ...g, finished: true, winner: username, reason: "forfeit_timeout" };
                                }
                                return g;
                            });

                            return { ...prev, expired: true, remainingMs: 0 };
                        }
                        return { ...prev, remainingMs: remaining };
                    });
                }, 250);
            }
        }


        // --- GAME FORFEITED BY TIMEOUT ---
        if (type === "gameForfeitedByTimeout") {
            const { winner } = payload ?? rest;
            setGame((g) => ({ ...g, finished: true, winner, reason: "forfeit_timeout" }));
            gameFinishedRef.current = true;
            setTimeout(clearGameState, 3000);
        }

        // --- FINISH ---
        if (type === "finish") {
            const { gameId, result } = payload ?? rest;
            setGame((g) =>
                g?.gameId === gameId ? { ...g, finished: true, winner: result.winner, reason: result.reason } : g
            );
            gameFinishedRef.current = true;
            setTimeout(clearGameState, 2000);
        }

        // --- REJOIN SUCCESS ---
        if (type === "rejoined") {
            const { who, gameId } = payload ?? rest;
            if (who === username && forfeitTimeoutRef.current) {
                clearTimeout(forfeitTimeoutRef.current);
                forfeitTimeoutRef.current = null;
            } else if (!gameFinishedRef.current && game?.gameId === gameId) {
                setOpponentStatus(null);
                if (disconnectTimer.current) {
                    clearInterval(disconnectTimer.current);
                    disconnectTimer.current = null;
                }
                setOpponent(who);
            }
        }

        // --- REJOIN FAILED (NEW CASE ADDED) ---
        if (type === "rejoinFailed") {
            const { reason } = payload ?? rest;
            console.log(`[FE][WS] Rejoin failed: ${reason}`);

            clearGameState();

            if (reason === "game_finished") {
                setStatusMessage("⚠️ Game has ended. Starting new game...");
            } else if (reason === "unknown_game") {
                setStatusMessage("⚠️ Game not found. Starting new game...");
            } else if (reason === "timeout_exceeded") {
                setStatusMessage("⚠️ Reconnection timeout exceeded. You forfeited. Starting new game...");
            } else {
                setStatusMessage("⚠️ Rejoin failed. Starting new game...");
            }

            setTimeout(() => {
                sendJSON(sendJsonMessage, { type: "join", payload: { username } });
            }, 2000);
        }

        // --- SERVER ERROR ---
        if (type === "error") {
            console.error("[FE][WS] Server error:", payload?.error || rest.error);
            setStatusMessage(`Error: ${payload?.error || rest.error}`);
        }
    }, [lastJsonMessage, username, makeEmptyBoard, sendJsonMessage, clearGameState, game?.gameId]);

    const dropCell = useCallback(
        (col) => {
            if (!game || game.finished || game.current !== username) return;
            sendJSON(sendJsonMessage, { type: "move", payload: { gameId: game.gameId, col } });
        },
        [game, sendJsonMessage, username]
    );

    const resign = useCallback(() => {
        if (!game || game.finished) return;
        sendJSON(sendJsonMessage, { type: "resign", payload: { gameId: game.gameId } });
    }, [game, sendJsonMessage]);

    const rejoin = useCallback(
        (u, gid) => {
            if (!u || !gid) return;
            localStorage.setItem(LS_KEYS.username, u);
            localStorage.setItem(LS_KEYS.gameId, gid);
            lastGameId.current = gid;
            gameFinishedRef.current = false;
            sendJSON(sendJsonMessage, { type: "rejoin", payload: { username: u, gameId: gid } });
        },
        [sendJsonMessage]
    );

    return {
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
    };
}
