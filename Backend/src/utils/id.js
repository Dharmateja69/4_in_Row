// id.js - tiny helpers for stable ids
export function newId(prefix = 'c4') {
    const core = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${core}`;
}

export function shortId(len = 8) {
    const s = (typeof crypto !== 'undefined' && crypto.getRandomValues)
        ? (() => {
            const bytes = new Uint8Array(len);
            crypto.getRandomValues(bytes);
            return Array.from(bytes, b => (b % 36).toString(36)).join('');
        })()
        : Math.random().toString(36).slice(2, 2 + len);
    return s;
}
