
import { cfg } from '../config.js';
import { sendEvent } from './kafka.js';

const TOPIC = cfg.KAFKA_TOPIC;

// canonical event emitters
export const Analytics = {
    gameStarted({ gameId, mode, players, startedAt = Date.now() }) {
        return sendEvent(TOPIC, gameId, {
            type: 'game.started',
            gameId, mode, players, startedAt,
        }, { type: 'game.started' });
    },

    movePlayed({ gameId, ply, by, col, at = Date.now() }) {
        return sendEvent(TOPIC, gameId, {
            type: 'move.played',
            gameId, ply, by, col, at,
        }, { type: 'move.played' });
    },

    gameFinished({ gameId, winner, reason, durationMs, endedAt = Date.now() }) {
        return sendEvent(TOPIC, gameId, {
            type: 'game.finished',
            gameId, winner, reason, durationMs, endedAt,
        }, { type: 'game.finished' });
    },

    playerRejoined({ gameId, username, at = Date.now() }) {
        return sendEvent(TOPIC, gameId, {
            type: 'player.rejoined',
            gameId, username, at,
        }, { type: 'player.rejoined' });
    },

    playerForfeited({ gameId, username, at = Date.now() }) {
        return sendEvent(TOPIC, gameId, {
            type: 'player.forfeited',
            gameId, username, at,
        }, { type: 'player.forfeited' });
    },
};