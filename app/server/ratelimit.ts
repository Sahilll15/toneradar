import { createRateLimit, type Limit } from './limiter';

export { clientIp, type Gate, type Limit } from './limiter';

export const LIMITS = {
  analyze: {
    limit: Number(process.env.RATE_LIMIT_ANALYZE ?? 5),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000),
  },
} satisfies Record<string, Limit>;

// Counts live in Upstash Redis when KV_REST_API_* is set, so they hold across instances.
export const { check, peek, tooMany } = createRateLimit({ app: 'toneradar', limits: LIMITS, noun: 'checks' });
