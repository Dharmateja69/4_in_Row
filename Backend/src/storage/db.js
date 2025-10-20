
import { Pool } from 'pg';

const PG_URL = process.env.PG_URL || 'postgres://postgres:sidhu123@localhost:5432/connect4';
console.log('[DB] PG_URL:', PG_URL);

export const pool = new Pool({
  connectionString: PG_URL,
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_MS || '5000', 10),
});

export async function initSchema() {
  console.log('[DB] initSchema...');
  const sql = `
  create table if not exists players (
    username text primary key,
    wins int not null default 0,
    losses int not null default 0,
    draws int not null default 0,
    created_at timestamptz not null default now()
  );

  create table if not exists games (
    id uuid primary key,
    player_x text not null references players(username) on delete restrict,
    player_o text not null,
    winner text,
    reason text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz
  );

  create table if not exists moves (
    game_id uuid not null references games(id) on delete cascade,
    ply int not null,
    player text not null,
    col int not null,
    played_at timestamptz not null default now(),
    primary key (game_id, ply)
  );

  create index if not exists idx_games_started_at on games(started_at desc);
  create index if not exists idx_games_winner on games(winner);
  `;
  try {
    await pool.query(sql);
    console.log('[DB] schema ok');
  } catch (e) {
    console.error('[DB] schema error', e);
    throw e;
  }
}

export async function query(text, params) {
  console.log('[DB] query:', (text || '').trim().split('\n')[0], 'params:', params);
  return pool.query(text, params);
}