type Hits = number[];

const buckets = new Map<string, Hits>();
const MAX_KEYS = 10_000;

export type Limit = { limit: number; windowMs: number };

export const LIMITS = {
  analyze: {
    limit: Number(process.env.RATE_LIMIT_ANALYZE ?? 5),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000),
  },
} satisfies Record<string, Limit>;

export function clientIp(req: Request) {
  // The leftmost x-forwarded-for entry is client-supplied; x-real-ip and the last hop are set by the proxy.
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',').at(-1)?.trim() || 'unknown';
}

export function check(req: Request, name: keyof typeof LIMITS) {
  const { limit, windowMs } = LIMITS[name];
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();

  // Cheapest way to bound memory: drop everything once the map gets large.
  if (buckets.size > MAX_KEYS) buckets.clear();

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const retryAfter = Math.ceil((hits[0] + windowMs - now) / 1000);
    buckets.set(key, hits);
    return { ok: false as const, retryAfter };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { ok: true as const, remaining: limit - hits.length };
}

export function tooMany(retryAfter: number) {
  const minutes = Math.ceil(retryAfter / 60);
  return Response.json(
    {
      error: `Rate limit reached. This is a demo running on my own API credits, so it allows a few checks per hour. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  );
}
