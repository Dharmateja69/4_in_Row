
import { Kafka, logLevel } from 'kafkajs';
import { cfg } from '../config.js';

const BROKERS = cfg.KAFKA_BROKERS;
const CLIENT_ID = cfg.KAFKA_CLIENT_ID;
const KAFKA_LOG = cfg.KAFKA_LOG_LEVEL;

const levelMap = { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 };
const kafkaLogLevel = logLevel[KAFKA_LOG] ?? logLevel.INFO;

let kafka;
let producer;

function getKafkaInstance() {
    if (!kafka) {
        if (!cfg.KAFKA_ENABLED) {
            // Return a mock instance if Kafka is disabled
            return {
                producer: () => ({
                    connect: async () => console.warn('[KAFKA] Mock Connect (Disabled)'),
                    send: async () => console.warn('[KAFKA] Mock Send (Disabled)'),
                }),
                consumer: () => ({
                    connect: async () => console.warn('[KAFKA] Mock Consumer Connect (Disabled)'),
                    subscribe: async () => { },
                    run: async () => { },
                }),
            };
        }
        kafka = new Kafka({
            clientId: CLIENT_ID,
            brokers: BROKERS,
            logLevel: kafkaLogLevel,
        });
    }
    return kafka;
}

/** Connect a singleton producer */
export async function connectProducer() {
    if (!producer) {
        producer = getKafkaInstance().producer();
    }
    await producer.connect();
    return producer;
}

/** Send one event to topic with JSON serialization */
export async function sendEvent(topic, key, payload, headers = {}) {
    if (!cfg.KAFKA_ENABLED) return;
    try {
        const p = await connectProducer();
        await p.send({
            topic,
            messages: [{ key, value: JSON.stringify(payload), headers }],
        });
    } catch (err) {
        console.error('[KAFKA] sendEvent failed', err.message);
    }
}

/** Optional analytics consumer */
export async function startConsumer({ topic = 'game.events', groupId = `${CLIENT_ID}-analytics`, eachMessage }) {
    if (!cfg.KAFKA_ENABLED) return;
    const consumer = getKafkaInstance().consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const val = message.value ? message.value.toString() : '';
            const evt = safeJSON(val);
            try {
                await (eachMessage ? eachMessage({ topic, partition, message, evt }) : defaultHandler(evt));
            } catch (e) {
                console.error('[KAFKA] analytics handler error', e);
            }
        },
    });
    return consumer;
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }
async function defaultHandler(evt) { if (evt) console.log('analytics:', evt); }