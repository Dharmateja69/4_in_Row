export function loadConfig() {
    const cfg = {
        PORT: parseInt(process.env.PORT || '8080', 10),
        MATCH_WAIT_MS: parseInt(process.env.MATCH_WAIT_MS || '10000', 10),
        REJOIN_TIMEOUT_MS: parseInt(process.env.REJOIN_TIMEOUT_MS || '30000', 10),
        HEARTBEAT_MS: parseInt(process.env.HEARTBEAT_MS || '30000', 10),

        // Bot strength and UX
        BOT_DEPTH: parseInt(process.env.BOT_DEPTH || '7', 10),        // search depth (REDUCED from 12)
        BOT_TIME_MS: parseInt(process.env.BOT_TIME_MS || '2500', 10), // per-move time budget
        BOT_THINK_MS: parseInt(process.env.BOT_THINK_MS || '500', 10), // delay to feel natural
        BOT_NAME: process.env.BOT_NAME || 'BOT',

        // Database
        PG_URL: process.env.PG_URL || 'postgresql://connect4_h3ct_user:bTE68HWYbntk96xxPN0D4ygMkBMRBPEs@dpg-d3r66j0dl3ps73cepfjg-a/connect4_h3ct',

        // Kafka (if used)
        KAFKA_ENABLED: process.env.KAFKA_ENABLED === 'true',
        KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'c4-server',
        KAFKA_LOG_LEVEL: process.env.KAFKA_LOG_LEVEL || 'info',
        KAFKA_TOPIC: process.env.KAFKA_TOPIC || 'game-events',

    };
    console.log('[CFG] loaded', cfg);

    return cfg;
}

export const cfg = loadConfig();
