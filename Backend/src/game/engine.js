// engine.js - Core game state machine (used by matchmaking)
import { applyMove, checkWinner, createEmptyBoard, isDraw, legalMoves } from './rules.js';

function cryptoRandom() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seatOf(user, seats) {
    if (seats.X === user) return 'X';
    if (seats.O === user) return 'O';
    return null;
}

/**
 * Creates a new game engine instance.
 */
export function createEngine({
    gameId = cryptoRandom(),
    rows = 6,
    cols = 7,
    seatX,
    seatO,
    cfg,
    vsBot = false,
    botName = null,
    broadcast = () => { } // Broadcast function
}) {
    console.log('[ENG] createEngine', { gameId, seatX, seatO, vsBot });

    const state = {
        id: gameId, rows, cols, cfg,
        board: createEmptyBoard(rows, cols),
        seats: { X: seatX, O: seatO },
        participants: [seatX, seatO].filter(p => p !== botName),
        turn: 'X',
        currentUser: seatX,
        finished: false,
        winner: null,
        reason: null,
        disconnected: new Set(),
        rejoinTimers: new Map(),
        createdAt: Date.now(),
        ply: 0,
        vsBot,
        botName,
        connectedPlayers: [seatX, seatO].filter(p => p !== botName), // Track connected players
    };

    let _broadcast = broadcast; // Store broadcast function
    let _ctx = null; // Store context

    function asPublic(includeDisconnect = false, disconnectedPlayer = null) {
        const pub = {
            gameId: state.id,
            board: state.board,
            turn: state.turn,
            current: state.currentUser,
            currentUser: state.currentUser, // Add this for clarity
            seats: state.seats,
            finished: state.finished,
            winner: state.winner,
            reason: state.reason,
        };

        if (includeDisconnect) {
            const user = disconnectedPlayer || [...state.disconnected][0];
            if (user && !state.finished) {
                const timer = state.rejoinTimers.get(user);
                let remaining = state.cfg?.REJOIN_TIMEOUT_MS || 30000;
                if (timer && timer._idleStart) {
                    const elapsed = Date.now() - timer._idleStart;
                    remaining = Math.max(0, remaining - elapsed);
                }
                pub.disconnectedPlayer = user;
                pub.timeoutMs = remaining;
            }
        }
        return pub;
    }

    function play(user, col) {
        if (state.finished) return { ok: false, err: 'finished' };

        const seat = seatOf(user, state.seats);
        if (!seat) return { ok: false, err: 'not-in-game' };
        if (state.currentUser !== user) return { ok: false, err: 'not-your-turn' };
        if (!legalMoves(state.board).includes(col)) return { ok: false, err: 'illegal' };

        const move = applyMove(state.board, col, seat);
        if (!move) return { ok: false, err: 'illegal' };

        state.ply++;
        const { r, c } = move;

        const w = checkWinner(state.board);
        if (w) {
            state.finished = true;
            state.winner = state.seats[w];
            state.reason = 'connect4';
            state.currentUser = null;
        } else if (isDraw(state.board)) {
            state.finished = true;
            state.winner = null;
            state.reason = 'draw';
            state.currentUser = null;
        } else {
            // Switch turns
            state.turn = state.turn === 'X' ? 'O' : 'X';
            state.currentUser = state.seats[state.turn];
            if (state.disconnected.has(state.currentUser)) {
                state.currentUser = null;
            }
        }

        console.log(`[ENG] After move: turn=${state.turn}, currentUser=${state.currentUser}`);
        return { ok: true, state: asPublic(), move: { r, c } };
    }

    function resign(user) {
        if (state.finished) return { ok: false, err: 'finished' };
        const seat = seatOf(user, state.seats);
        if (!seat) return { ok: false, err: 'not-in-game' };
        const winnerSeat = seat === 'X' ? 'O' : 'X';
        state.finished = true;
        state.winner = state.seats[winnerSeat];
        state.reason = 'resign';
        state.currentUser = null;
        return { ok: true, state: asPublic() };
    }

    function onDisconnect(user, onForfeit) {
        if (state.finished || state.disconnected.has(user)) return;
        state.disconnected.add(user);

        // Remove from connected players
        state.connectedPlayers = state.connectedPlayers.filter(p => p !== user);

        if (state.currentUser === user) {
            state.currentUser = null;
        }
        const oldTimer = state.rejoinTimers.get(user);
        if (oldTimer) clearTimeout(oldTimer);
        const timer = setTimeout(() => {
            if (state.finished) return;
            if (state.disconnected.has(user)) {
                const winnerSeat = seatOf(user, state.seats) === 'X' ? 'O' : 'X';
                state.finished = true;
                state.winner = state.seats[winnerSeat];
                state.reason = 'forfeit';
                state.currentUser = null;
                onForfeit(state.winner, asPublic());
            }
        }, state.cfg?.REJOIN_TIMEOUT_MS || 30000);
        state.rejoinTimers.set(user, timer);
    }

    function onRejoin(user) {
        if (!state.disconnected.has(user)) return asPublic(true);
        state.disconnected.delete(user);

        // Add back to connected players
        if (!state.connectedPlayers.includes(user)) {
            state.connectedPlayers.push(user);
        }

        const t = state.rejoinTimers.get(user);
        if (t) clearTimeout(t);
        state.rejoinTimers.delete(user);
        if (state.seats[state.turn] === user) {
            state.currentUser = user;
        }
        return asPublic(true);
    }

    function updateContext(ctx) {
        console.log(`[ENG] updateContext called for game ${state.id}`);
        _ctx = ctx;
        state.cfg = ctx.cfg;

        // Recreate broadcaster with updated clients reference
        _broadcast = (payload) => {
            const participants = [state.seats.X, state.seats.O];
            participants.forEach(username => {
                if (!username) return;
                const client = ctx.clients.get(username);
                if (client && client.readyState === 1) {
                    console.log(`[ENG] Sending to ${username}:`, payload.type);
                    client.send(JSON.stringify(payload));
                }
            });
        };
    }

    return {
        state,
        asPublic,
        play,
        resign,
        onDisconnect,
        onRejoin,
        updateContext,
        broadcast: (payload) => _broadcast(payload),
        cfg: state.cfg,
    };
}
