// src/api.js - Frontend API Configuration

// Production backend URLs
const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || 'https://four-in-row-1.onrender.com';
const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || 'wss://four-in-row-1.onrender.com';

console.log('[FE][API] endpoints', { BACKEND_HTTP, BACKEND_WS });

export const endpoints = {
    // WebSocket connection for real-time game
    ws: () => `${BACKEND_WS}`,

    // REST API endpoints
    health: () => `${BACKEND_HTTP}/health`,
    leaderboard: () => `${BACKEND_HTTP}/api/leaderboard`,
    analytics: () => `${BACKEND_HTTP}/api/analytics/metrics`,
    playerStats: (username) => `${BACKEND_HTTP}/api/analytics/player/${username}`,
};

export async function httpGet(url) {
    console.log('[FE][API] GET', url);
    const res = await fetch(url);
    console.log('[FE][API] GET status', res.status);

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('[FE][API] GET not ok', { status: res.status, text });
        throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    console.log('[FE][API] GET json length', Array.isArray(json) ? json.length : Object.keys(json || {}).length);
    return json;
}
