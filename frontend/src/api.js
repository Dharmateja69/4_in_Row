
const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || 'http://localhost:8080';
const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || 'ws://localhost:8080';

console.log('[FE][API] endpoints', { BACKEND_HTTP, BACKEND_WS });

export const endpoints = {
    ws: () => `${BACKEND_WS}`,
    health: () => `${BACKEND_HTTP}/health`,
    leaderboard: () => `${BACKEND_HTTP}/api/leaderboard`,
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
