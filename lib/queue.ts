
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let _videoQueue: Queue | null = null;
let _connection: Redis | null = null;

function getConnection(): Redis {
    if (_connection) return _connection;

    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    _connection = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
    });
    return _connection;
}

export function getVideoQueue(): Queue {
    if (_videoQueue) return _videoQueue;

    _videoQueue = new Queue('video-generation-queue', {
        connection: getConnection(),
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
    return _videoQueue;
}

// Alias for backwards compatibility - will be lazy initialized
export const videoQueue = new Proxy({} as Queue, {
    get(_, prop) {
        return (getVideoQueue() as unknown as Record<string | symbol, unknown>)[prop];
    }
});
