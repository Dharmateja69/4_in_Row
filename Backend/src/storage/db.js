import pkg from 'pg';
const { Pool } = pkg;

// ✅ Use environment variable if available, else fallback to your Render connection string
const PG_URL =
  process.env.PG_URL ||
  'postgresql://connect4_h3ct_user:bTE68HWYbntk96xxPN0D4ygMkBMRBPEs@dpg-d3r66j0dl3ps73cepfjg-a/connect4_h3ct?ssl=true';

console.log('[DB] Using PG_URL:', PG_URL);

// ✅ Enable SSL when connecting to Render (it requires it)
const useSSL = PG_URL.includes('render.com') || PG_URL.includes('dpg-');

// ✅ Create a connection pool
export const pool = new Pool({
  connectionString: PG_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false, // ✅ this line allows Render’s self-signed SSL cert
  },
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_MS || '5000', 10),
});


// ✅ Initialize database schema if it doesn’t exist
export async function initSchema() {
  console.log('[DB] Initializing schema...');
  const sql = `
  CREATE TABLE IF NOT EXISTS players (
    username TEXT PRIMARY KEY,
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    draws INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY,
    player_x TEXT NOT NULL REFERENCES players(username) ON DELETE RESTRICT,
    player_o TEXT NOT NULL,
    winner TEXT,
    reason TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS moves (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    ply INT NOT NULL,
    player TEXT NOT NULL,
    col INT NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (game_id, ply)
  );

  CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_games_winner ON games(winner);
  `;

  try {
    await pool.query(sql);
    console.log('[DB] Schema initialized successfully');
  } catch (error) {
    console.error('[DB] Schema initialization failed:', error);
    throw error;
  }
}

// ✅ Generic query helper
export async function query(text, params) {
  console.log('[DB] Query:', (text || '').trim().split('\n')[0], 'Params:', params);
  return pool.query(text, params);
}
