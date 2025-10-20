import { randomUUID } from "crypto";
import { Analytics } from "./analytics/events.js";
import { findBestMove } from "./game/bot.js";
import { createEngine } from "./game/engine.js";
import {
    createGame,
    recordMove,
    recordResult,
    upsertPlayer,
} from "./storage/repositories.js";

const queue = [];
const games = new Map();
const disconnectTimers = new Map();
const disconnectTimestamps = new Map();

function sendToUser(clients, username, payload) {
    console.log(`[MM] Sending to ${username}:`, JSON.stringify(payload).substring(0, 200));
    const c = clients.get(username);
    if (c && c.readyState === 1) c.send(JSON.stringify(payload));
}

export const matchmaking = {
    enqueue(username, ctx) {
        console.log(`[MM] Enqueue request from ${username}`);

        if (queue.includes(username)) {
            console.log(`[MM] ${username} already in queue`);
            return;
        }

        for (const e of games.values())
            if (e.state.participants.includes(username) && !e.state.finished) {
                console.log(`[MM] ${username} already in active game`);
                return;
            }

        queue.push(username);
        sendToUser(ctx.clients, username, { type: "queued" });
        tryMatchOrBot(ctx);
    },

    dequeue(username) {
        const i = queue.indexOf(username);
        if (i > -1) queue.splice(i, 1);
        console.log(`[MM] Dequeued ${username}`);
    },

    async onMove(gameId, username, move, ctx) {
        console.log(`[MM] Move received from ${username} in game ${gameId}, col=${move.col}`);

        const s = games.get(gameId);
        if (!s) {
            console.log(`[MM] Game ${gameId} not found`);
            sendToUser(ctx.clients, username, {
                type: "rejoinFailed",
                reason: "game_not_found"
            });
            return;
        }

        if (s.state.finished) {
            console.log(`[MM] Game ${gameId} already finished - blocking move`);
            sendToUser(ctx.clients, username, {
                type: "rejoinFailed",
                reason: "game_finished"
            });
            return;
        }

        s.updateContext(ctx);
        const res = s.play(username, move.col);

        if (!res.ok) {
            console.log(`[MM] Invalid move by ${username}:`, res.error || 'unknown error');
            return;
        }

        const { r, c } = res.move;
        console.log(`[MM] Valid move: row=${r}, col=${c}`);

        try {
            await upsertPlayer(username);
            await recordMove({
                gameId,
                ply: s.state.ply,
                player: username,
                col: c,
                row: r,
                playedAt: new Date().toISOString(),
            });
        } catch (e) {
            console.error("[MM][DB] recordMove failed", e);
        }

        if (s.cfg.KAFKA_ENABLED)
            Analytics.movePlayed({
                gameId,
                ply: s.state.ply,
                by: username,
                col: c,
                at: Date.now(),
            });

        s.broadcast({ type: "move", gameId, by: username, row: r, col: c });

        const updatedState = s.asPublic(true);
        console.log(`[MM] Broadcasting state update. Current turn: ${updatedState.turn}, currentUser: ${updatedState.currentUser}`);
        s.broadcast({ type: "state", payload: updatedState });

        if (res.state.finished)
            return await finishAndPersist(s, res.state.winner, res.state.reason, ctx);

        if (s.state.vsBot && s.state.currentUser === s.state.botName) {
            console.log(`[MM] Bot's turn - triggering botPlay`);
            setImmediate(() => botPlay(s, ctx));
        }
    },

    rejoin(gameId, username, cb, ctx) {
        console.log(`[MM] Rejoin attempt by ${username} for game ${gameId}`);

        const key = `${gameId}-${username}`;
        const disconnectTime = disconnectTimestamps.get(key);

        // ✅ CHECK TIMEOUT FIRST - before anything else
        if (disconnectTime) {
            const elapsedMs = Date.now() - disconnectTime;
            console.log(`[MM] ${username} was disconnected ${elapsedMs}ms ago (limit: 30000ms)`);

            if (elapsedMs >= 30000) {
                console.log(`[MM] ❌ REJOIN BLOCKED: ${username} exceeded 30s timeout`);
                cb({ type: "rejoinFailed", reason: "timeout_exceeded", gameId });

                // Clean up
                disconnectTimers.delete(key);
                disconnectTimestamps.delete(key);

                return false;
            }
        }

        const s = games.get(gameId);

        if (!s) {
            console.log(`[MM] Rejoin failed: game not found`);
            cb({ type: "rejoinFailed", reason: "unknown_game", gameId });
            disconnectTimestamps.delete(key);
            return false;
        }

        if (!s.state.participants.includes(username)) {
            console.log(`[MM] Rejoin failed: ${username} not part of game`);
            cb({ type: "rejoinFailed", reason: "player_not_in_game", gameId });
            disconnectTimestamps.delete(key);
            return false;
        }

        if (s.state.finished) {
            console.log(`[MM] Rejoin failed: game already finished`);
            cb({ type: "rejoinFailed", reason: "game_finished", gameId });
            disconnectTimestamps.delete(key);
            return false;
        }

        // ✅ ALLOWED - rejoin within time limit
        s.updateContext(ctx);
        const state = s.onRejoin(username);
        console.log(`[MM] ✅ Sending rejoin state to ${username}`);
        cb({ type: "state", payload: state });
        s.broadcast({ type: "rejoined", who: username, gameId });

        if (s.cfg.KAFKA_ENABLED)
            Analytics.playerRejoined({ gameId, username, at: Date.now() });

        // Clear timers and timestamps
        if (disconnectTimers.has(key)) {
            clearTimeout(disconnectTimers.get(key));
            disconnectTimers.delete(key);
            console.log(`[MM] Cleared disconnect timer for ${username}`);
        }
        disconnectTimestamps.delete(key);

        console.log(`[MM] ${username} successfully rejoined game ${gameId}`);
        return true;
    },

    async resign(gameId, username, ctx) {
        console.log(`[MM] ${username} resigned from ${gameId}`);
        const s = games.get(gameId);
        if (!s || s.state.finished) {
            console.log(`[MM] Resign ignored - game not found or already finished`);
            return;
        }
        s.updateContext(ctx);
        const res = s.resign(username);
        if (!res.ok) {
            console.log(`[MM] Resign failed for ${username}`);
            return;
        }
        await finishAndPersist(s, res.state.winner, res.state.reason, ctx);
    },

    onDisconnect(gameId, username, ctx) {
        const s = games.get(gameId);
        if (!s || s.state.finished) return;

        console.log(`[MM] ⚡ Disconnect detected: ${username} from ${gameId}`);

        const key = `${gameId}-${username}`;

        // ✅ Record disconnect timestamp
        disconnectTimestamps.set(key, Date.now());
        console.log(`[MM] 📝 Recorded disconnect timestamp for ${username}`);

        s.updateContext(ctx);

        s.broadcast({
            type: "playerDisconnected",
            gameId,
            disconnectedPlayer: username,
            timeoutMs: 30000,
        });

        if (disconnectTimers.has(key)) {
            clearTimeout(disconnectTimers.get(key));
            disconnectTimers.delete(key);
        }

        const timer = setTimeout(async () => {
            const game = games.get(gameId);
            if (!game || game.state.finished) {
                console.log(`[MM] Game ${gameId} already finished or removed`);
                disconnectTimers.delete(key);
                disconnectTimestamps.delete(key);
                return;
            }

            const stillDisconnected = !game.state.connectedPlayers.includes(username);
            if (stillDisconnected) {
                console.log(`[MM] ⏰ FORFEIT TIMEOUT: ${username} in ${gameId}`);

                const res = game.resign(username);
                if (res.ok) {
                    await finishAndPersist(game, res.state.winner, "forfeit_timeout", ctx);

                    game.broadcast({
                        type: "gameForfeitedByTimeout",
                        gameId,
                        forfeitedPlayer: username,
                        winner: res.state.winner,
                    });
                }
            }

            disconnectTimers.delete(key);
            disconnectTimestamps.delete(key);
        }, 30000);

        disconnectTimers.set(key, timer);
    },
};

function tryMatchOrBot(ctx) {
    console.log(`[MM] tryMatchOrBot - queue length: ${queue.length}`);

    if (queue.length >= 2) {
        const p1 = queue.shift();
        const p2 = queue.shift();
        const gameId = randomUUID();
        const seatX = Math.random() < 0.5 ? p1 : p2;
        const seatO = seatX === p1 ? p2 : p1;

        console.log(`[MM] Matching ${p1} vs ${p2}, gameId: ${gameId}`);

        const engine = createEngine({
            gameId,
            seatX,
            seatO,
            cfg: ctx.cfg,
            broadcast: createBroadcaster(gameId, [p1, p2], ctx.clients),
        });
        games.set(gameId, engine);
        bootstrapGameRow(engine.state);

        const initialState = engine.asPublic();

        sendToUser(ctx.clients, seatX, {
            type: "matched",
            payload: {
                gameId,
                seat: "X",
                opponent: seatO,
                ...initialState,
            },
        });
        sendToUser(ctx.clients, seatO, {
            type: "matched",
            payload: {
                gameId,
                seat: "O",
                opponent: seatX,
                ...initialState,
            },
        });

        if (ctx.cfg.KAFKA_ENABLED)
            Analytics.gameStarted({
                gameId,
                mode: "pvp",
                players: [seatX, seatO],
                startedAt: engine.state.createdAt,
            });
        return;
    }

    if (queue.length === 1) {
        const p1 = queue[0];
        console.log(`[MM] Starting 10s bot timer for ${p1}`);

        const timer = setTimeout(() => {
            const idx = queue.indexOf(p1);
            if (idx === -1) return;
            queue.splice(idx, 1);

            const botName = ctx.cfg.BOT_NAME || "BOT";
            const gameId = randomUUID();

            console.log(`[MM] Matching ${p1} vs ${botName}, gameId: ${gameId}`);

            const engine = createEngine({
                gameId,
                seatX: p1,
                seatO: botName,
                cfg: ctx.cfg,
                vsBot: true,
                botName,
                broadcast: createBroadcaster(gameId, [p1, botName], ctx.clients),
            });
            games.set(gameId, engine);
            bootstrapGameRow(engine.state);

            const initialState = engine.asPublic();

            sendToUser(ctx.clients, p1, {
                type: "matched",
                payload: {
                    gameId,
                    seat: "X",
                    opponent: botName,
                    ...initialState,
                },
            });

            if (ctx.cfg.KAFKA_ENABLED)
                Analytics.gameStarted({
                    gameId,
                    mode: "pve",
                    players: [p1, botName],
                    startedAt: engine.state.createdAt,
                });
        }, ctx.cfg.MATCH_WAIT_MS || 10000);

        ctx.pendingBotTimer = timer;
    }
}

async function botPlay(s, ctx) {
    try {
        if (s.cfg.BOT_THINK_MS) {
            await new Promise((res) => setTimeout(res, s.cfg.BOT_THINK_MS));
        }

        if (s.state.finished) return;

        s.updateContext(ctx);

        const seat = s.state.seats.X === s.state.botName ? "X" : "O";
        const bestCol = findBestMove(s.state.board, seat, s.cfg.BOT_DEPTH || 5);

        const res = s.play(s.state.botName, bestCol);
        if (!res.ok) return console.error("[MM] Bot move invalid", { bestCol, error: res.error });

        const { r, c } = res.move;

        try {
            await recordMove({
                gameId: s.state.id,
                ply: s.state.ply,
                player: s.state.botName,
                col: c,
                row: r,
                playedAt: new Date().toISOString(),
            });
        } catch (e) {
            console.error("[MM][DB] Bot recordMove failed", e);
        }

        if (s.cfg.KAFKA_ENABLED)
            Analytics.movePlayed({
                gameId: s.state.id,
                ply: s.state.ply,
                by: s.state.botName,
                col: c,
                at: Date.now(),
            });

        s.broadcast({ type: "move", gameId: s.state.id, by: s.state.botName, row: r, col: c });

        const updatedState = s.asPublic(true);
        s.broadcast({ type: "state", payload: updatedState });

        if (res.state.finished) {
            await finishAndPersist(s, res.state.winner, res.state.reason, ctx);
        }
    } catch (error) {
        console.error(`[MM] Error in botPlay:`, error);
    }
}

function createBroadcaster(gameId, users, clients) {
    return (payload) => {
        console.log(`[MM] Broadcasting to game ${gameId}:`, payload.type);
        users.forEach((u) => sendToUser(clients, u, payload));
    };
}

async function finishAndPersist(s, winner, reason, ctx) {
    console.log(`[MM] 🏁 Finish game ${s.state.id}`, { winner, reason });

    s.state.finished = true;

    await persistResultSafe(s.state, { winner, reason });

    if (s.cfg.KAFKA_ENABLED)
        Analytics.gameFinished({
            gameId: s.state.id,
            winner,
            reason,
            durationMs: Date.now() - s.state.createdAt,
            endedAt: Date.now(),
        });

    s.broadcast({ type: "finish", gameId: s.state.id, result: { winner, reason } });

    games.delete(s.state.id);
    console.log(`[MM] Game ${s.state.id} removed from active games`);

    // Clean up all timers/timestamps for this game
    for (const [key] of disconnectTimers) {
        if (key.startsWith(s.state.id)) {
            clearTimeout(disconnectTimers.get(key));
            disconnectTimers.delete(key);
            disconnectTimestamps.delete(key);
        }
    }
}

async function bootstrapGameRow(s) {
    try {
        await createGame({
            gameId: s.id,
            playerX: s.seats.X,
            playerO: s.seats.O,
            vsBot: s.vsBot,
            startedAt: new Date(s.createdAt).toISOString(),
        });
    } catch (e) {
        console.error("[MM][DB] bootstrapGameRow failed", e);
    }
}

async function persistResultSafe(s, result) {
    try {
        await recordResult({
            gameId: s.id,
            playerX: s.seats.X,
            playerO: s.seats.O,
            winner: result.winner,
            reason: result.reason,
            startedAt: new Date(s.createdAt).toISOString(),
            finishedAt: new Date().toISOString(),
            ply: s.ply,
        });
    } catch (e) {
        console.error("[MM][DB] persistResultSafe failed", e);
    }
}
