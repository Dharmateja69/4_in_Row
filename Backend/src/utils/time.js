// time.js - time utilities for scheduling, backoff, and formatting
export const now = () => Date.now();

export const ms = (n) => n;

export const sec = (n) => n * 1000;

export const min = (n) => n * 60 * 1000;

export function deadline(startMs, timeoutMs) {
    return startMs + timeoutMs;
}

export function remaining(endMs) {
    return Math.max(0, endMs - now());
}

export function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

// exponential backoff with cap and jitter
export function backoff(attempt, { base = 200, factor = 2, max = 5000, jitter = true } = {}) {
    const exp = Math.min(max, base * Math.pow(factor, attempt));
    if (!jitter) return exp;
    const delta = Math.random() * 0.4 + 0.8; // 0.8x-1.2x
    return Math.floor(exp * delta);
}
