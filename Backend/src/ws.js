import WebSocket, { WebSocketServer } from "ws";
import { matchmaking } from "./matcjmaking.js";

export function initWebSocket(server, cfg) {
    const wss = new WebSocketServer({ server });
    const clients = new Map();
    const noop = () => { };

    wss.on("connection", (ws) => {
        ws.isAlive = true;
        ws.on("pong", () => (ws.isAlive = true));

        ws.on("message", (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                return;
            }
            const { type, payload } = msg || {};

            // Handle join (with optional rejoin via gameId)
            if (type === "join") {
                const { username, gameId } = payload || {};
                if (!username) return send(ws, { type: "error", error: "username required" });

                console.log(`[WS] Join from ${username}${gameId ? ` with gameId ${gameId}` : ''}`);

                const oldWs = clients.get(username);
                if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
                    console.log(`[WS] Terminating old connection for ${username}`);
                    oldWs.terminate();
                }
                clients.set(username, ws);
                ws.username = username;
                ws.gameId = null;

                // Try rejoin if gameId provided
                if (gameId) {
                    const rejoined = matchmaking.rejoin(gameId, username, (state) => send(ws, state), { clients, cfg });
                    if (rejoined) {
                        ws.gameId = gameId;
                        return;
                    } else {
                        // Tell client rejoin failed so frontend can clear localStorage
                        send(ws, { type: "rejoinFailed" });
                    }
                }

                // Otherwise, enqueue for new match
                matchmaking.enqueue(username, { clients, cfg });
            }

            // Handle explicit rejoin message
            if (type === "rejoin") {
                const { username: u, gameId } = payload || {};
                if (!u || !gameId) return;

                console.log(`[WS] Explicit rejoin from ${u} for game ${gameId}`);

                const oldWs = clients.get(u);
                if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
                    oldWs.terminate();
                }
                clients.set(u, ws);
                ws.username = u;

                const rejoined = matchmaking.rejoin(gameId, u, (state) => send(ws, state), { clients, cfg });
                if (rejoined) {
                    ws.gameId = gameId;
                }
            }

            if (type === "move") {
                const { gameId, ...rest } = payload || {};
                if (!ws.username || !gameId) return;
                ws.gameId = gameId;
                matchmaking.onMove(gameId, ws.username, rest, { clients, cfg });
            }

            if (type === "resign") {
                const { gameId } = payload || {};
                if (!ws.username || !gameId) return;
                ws.gameId = gameId;
                matchmaking.resign(gameId, ws.username, { clients, cfg });
            }
        });

        ws.on("close", () => {
            if (!ws.username) return;
            const c = clients.get(ws.username);
            if (c === ws) {
                if (ws.gameId) {
                    console.log(`[WS] ${ws.username} disconnected from game ${ws.gameId}`);
                    matchmaking.onDisconnect(ws.gameId, ws.username, { clients, cfg });
                } else {
                    matchmaking.dequeue(ws.username);
                    clients.delete(ws.username);
                }
            }
        });

        ws.on("error", (err) => console.warn("[WS] client error", err.message));
    });

    const hb = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log(`[WS] Terminating dead client: ${ws.username || "unknown"}`);
                if (ws.username) {
                    const c = clients.get(ws.username);
                    if (c === ws) {
                        if (ws.gameId) matchmaking.onDisconnect(ws.gameId, ws.username, { clients, cfg });
                        else {
                            matchmaking.dequeue(ws.username);
                            clients.delete(ws.username);
                        }
                    }
                }
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping(noop);
        });
    }, cfg.HEARTBEAT_MS);

    wss.on("close", () => clearInterval(hb));

    function send(ws, obj) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    }
}
