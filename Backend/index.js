// index.js — fixed healthz endpoint and process-level guards
import cors from 'cors';
import express from 'express';
import http from 'http';
import { loadConfig } from './src/config.js';
import { initSchema } from './src/storage/db.js';
import { getLeaderboard } from './src/storage/repositories.js';
import { initWebSocket } from './src/ws.js';

process.on('unhandledRejection', (reason) => {
    console.error('[SRV] unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[SRV] uncaughtException', err);
});

(async () => {
    const cfg = loadConfig();
    console.log('[SRV] starting with config:', cfg);

    const app = express();
    app.use(express.json());
    app.use(cors({
        origin: [
            'https://four-in-row-2.onrender.com',  // Your frontend URL
            'http://localhost:5173',                // Local development
            'http://localhost:3000'                 // Local development alternative
        ],
        credentials: true
    }));

    // ✅ Health endpoints
    app.get('/health', (_req, res) => {
        console.log('[SRV] /health');
        res.json({ ok: true });
    });

    app.get('/healthz', (_req, res) => {
        console.log('[SRV] /healthz');
        res.status(200).send('OK'); // Render requires HTTP 200
    });

    // Leaderboard route
    app.get('/api/leaderboard', async (_req, res) => {
        console.log('[SRV] GET /api/leaderboard');
        try {
            const rows = await getLeaderboard({ limit: 20 });
            console.log('[SRV] leaderboard rows: %d', rows.length);
            res.json(rows);
        } catch (e) {
            console.error('[SRV] leaderboard error', e);
            res.status(500).json({ error: 'leaderboard_failed' });
        }
    });

    // Initialize DB schema
    try {
        await initSchema();
        console.log('[SRV] schema initialized');
    } catch (e) {
        console.error('[SRV] schema init failed', e);
    }

    // HTTP + WebSocket server
    const server = http.createServer(app);
    initWebSocket(server, cfg);

    server.listen(cfg.PORT, () => {
        console.log(`[SRV] listening on :${cfg.PORT}`);
    });

    // Graceful shutdown
    const stop = async () => {
        console.log('[SRV] shutting down...');
        server.close(() => process.exit(0));
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
})();
