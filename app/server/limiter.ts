import { Redis } from '@upstash/redis';

export type Limit = { limit: number; windowMs: number };
export type Window = { count: number; ttlMs: number };

export type Store = {
  take(key: string, limit: number, windowMs: number): Promise<Window & { counted: boolean }>;
  peek(key: string): Promise<Window>;
};

export type RedisCommands = {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
  get(key: string): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

export type Gate =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfter: number; resetAt: number; unavailable?: boolean };

export type Denied = Extract<Gate, { ok: false }>;

// Never increments past the limit; the first counted hit starts the window.
export const TAKE_SCRIPT = `
local n = tonumber(redis.call('GET', KEYS[1]) or '0')
if n >= tonumber(ARGV[2]) then return {n, redis.call('PTTL', KEYS[1]), 0} end
n = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {n, ttl, 1}
`;

export function redisStore(redis: RedisCommands): Store {
  return {
    async take(key, limit, windowMs) {
      const [count, ttl, counted] = (await redis.eval(TAKE_SCRIPT, [key], [windowMs, limit])) as number[];
      return { count: Number(count), ttlMs: Math.max(0, Number(ttl)), counted: Number(counted) === 1 };
    },
    async peek(key) {
      const [raw, ttl] = await Promise.all([redis.get(key), redis.pttl(key)]);
      return { count: Number(raw ?? 0), ttlMs: Math.max(0, Number(ttl)) };
    },
  };
}

export function memoryStore(maxKeys = 10_000, clock: () => number = Date.now): Store {
  const windows = new Map<string, { count: number; expiresAt: number }>();
  const live = (key: string, now: number) => {
    const w = windows.get(key);
    if (w && w.expiresAt <= now) windows.delete(key);
    return w && w.expiresAt > now ? w : undefined;
  };

  return {
    async take(key, limit, windowMs) {
      const now = clock();
      // Cheapest way to bound memory: drop everything once the map gets large.
      if (windows.size > maxKeys) windows.clear();
      const w = live(key, now);
      if (w && w.count >= limit) return { count: w.count, ttlMs: w.expiresAt - now, counted: false };
      if (!w && limit <= 0) return { count: 0, ttlMs: 0, counted: false };
      const next = w ?? { count: 0, expiresAt: now + windowMs };
      next.count += 1;
      windows.set(key, next);
      return { count: next.count, ttlMs: next.expiresAt - now, counted: true };
    },
    async peek(key) {
      const now = clock();
      const w = live(key, now);
      return w ? { count: w.count, ttlMs: w.expiresAt - now } : { count: 0, ttlMs: 0 };
    },
  };
}

export function defaultStore(env: Record<string, string | undefined> = process.env): Store {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return memoryStore();
  return redisStore(new Redis({ url, token }) as unknown as RedisCommands);
}

function groupV6(ip: string) {
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return `${full.slice(0, 4).map((h) => (parseInt(h, 16) || 0).toString(16)).join(':')}::/64`;
}

export function clientIp(req: Request) {
  // The leftmost x-forwarded-for entry is client-supplied; x-real-ip and the last hop are set by the proxy.
  const real = req.headers.get('x-real-ip')?.trim();
  const ip = real || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  // One IPv6 visitor usually owns a whole /64, so count the prefix.
  return ip.includes(':') ? groupV6(ip.toLowerCase()) : ip;
}

export function createRateLimit<N extends string>(opts: {
  app: string;
  limits: Record<N, Limit>;
  noun: string;
  store?: () => Store;
  clock?: () => number;
}) {
  let store: Store | undefined;
  const getStore = () => (store ??= (opts.store ?? defaultStore)());
  const clock = opts.clock ?? Date.now;
  const keyFor = (req: Request, name: N) => `rl:${opts.app}:${name}:${clientIp(req)}`;

  async function check(req: Request, name: N): Promise<Gate> {
    const { limit, windowMs } = opts.limits[name];
    const now = clock();
    try {
      const w = await getStore().take(keyFor(req, name), limit, windowMs);
      const resetAt = now + w.ttlMs;
      if (!w.counted) return { ok: false, retryAfter: Math.ceil(w.ttlMs / 1000), resetAt };
      return { ok: true, remaining: Math.max(0, limit - w.count), resetAt };
    } catch (err) {
      // Paid routes sit behind this gate, so a store failure must deny, not allow.
      console.error('rate limit store failed:', err instanceof Error ? err.message : err);
      return { ok: false, retryAfter: 60, resetAt: now + 60_000, unavailable: true };
    }
  }

  async function peek(req: Request, name: N) {
    const { limit } = opts.limits[name];
    const w = await getStore().peek(keyFor(req, name));
    return { limit, used: w.count, remaining: Math.max(0, limit - w.count), resetAt: w.count ? clock() + w.ttlMs : null };
  }

  function tooMany(gate: Denied | number) {
    const g = typeof gate === 'number' ? { retryAfter: gate, resetAt: clock() + gate * 1000 } : gate;
    if ('unavailable' in g && g.unavailable) {
      return Response.json(
        { error: 'The service is busy, try again in a minute.' },
        { status: 503, headers: { 'retry-after': '60' } },
      );
    }
    const minutes = Math.max(1, Math.ceil(g.retryAfter / 60));
    return Response.json(
      {
        error: `Rate limit reached. This is a demo running on my own API credits, so it allows a few ${opts.noun} per hour. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        resetAt: new Date(g.resetAt).toISOString(),
      },
      { status: 429, headers: { 'retry-after': String(g.retryAfter) } },
    );
  }

  return { check, peek, tooMany, keyFor };
}
