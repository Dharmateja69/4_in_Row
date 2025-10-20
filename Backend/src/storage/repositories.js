// repositories.js — DB helpers with detailed logging and safe writes
import { query } from './db.js';

// Ensure a player row exists
export async function upsertPlayer(username) {
    console.log('[Repo] upsertPlayer', username);
    await query(
        `insert into players(username) values ($1)
     on conflict (username) do nothing`,
        [username]
    );
}

// Create a game row at match start (winner null, reason 'in_progress')
export async function createGame({ gameId, playerX, playerO, startedAt }) {
    console.log('[Repo] createGame', { gameId, playerX, playerO });
    await upsertPlayer(playerX);
    if (playerO !== 'BOT') await upsertPlayer(playerO);
    await query(
        `insert into games(id, player_x, player_o, winner, reason, started_at)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do nothing`,
        [gameId, playerX, playerO, null, 'in_progress', startedAt || new Date().toISOString()]
    );
}

// Record a single move (FK requires games row to exist)
export async function recordMove({ gameId, ply, player, col, playedAt }) {
    console.log('[Repo] recordMove', { gameId, ply, player, col });
    await query(
        `insert into moves(game_id, ply, player, col, played_at)
     values ($1,$2,$3,$4,$5)
     on conflict (game_id, ply) do nothing`,
        [gameId, ply, player, col, playedAt || new Date().toISOString()]
    );
}

// Finalize a game and update tallies
export async function recordResult({ gameId, playerX, playerO, winner, reason, startedAt, finishedAt }) {
    console.log('[Repo] recordResult', { gameId, playerX, playerO, winner, reason });
    await upsertPlayer(playerX);
    if (playerO !== 'BOT') await upsertPlayer(playerO);

    // Ensure game exists then update it with result
    await query(
        `insert into games(id, player_x, player_o, winner, reason, started_at, finished_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do update set
       winner = excluded.winner,
       reason = excluded.reason,
       finished_at = excluded.finished_at`,
        [gameId, playerX, playerO, winner, reason, startedAt || new Date().toISOString(), finishedAt || new Date().toISOString()]
    );

    // Update tallies (skip BOT for wins/losses)
    if (winner === playerX) {
        await query(`update players set wins = wins + 1 where username = $1`, [playerX]);
        if (playerO !== 'BOT') await query(`update players set losses = losses + 1 where username = $1`, [playerO]);
    } else if (winner === playerO) {
        if (playerO !== 'BOT') await query(`update players set wins = wins + 1 where username = $1`, [playerO]);
        await query(`update players set losses = losses + 1 where username = $1`, [playerX]);
    } else {
        // draw
        if (playerO !== 'BOT') {
            await query(`update players set draws = draws + 1 where username in ($1,$2)`, [playerX, playerO]);
        } else {
            await query(`update players set draws = draws + 1 where username = $1`, [playerX]);
        }
    }
}

// Leaderboard
export async function getLeaderboard({ limit = 20 } = {}) {
    console.log('[Repo] getLeaderboard', { limit });
    const { rows } = await query(
        `select username, wins, losses, draws,
            (wins) as score
     from players
     order by wins desc, draws desc, username asc
     limit $1`,
        [limit]
    );
    console.log('[Repo] leaderboard rows', rows.length);
    return rows;
}
