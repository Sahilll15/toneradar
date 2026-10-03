import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAKE_SCRIPT, clientIp, createRateLimit, memoryStore, redisStore } from '../app/server/limiter.ts';

const HOUR = 60 * 60 * 1000;
const req = (headers = {}) => new Request('http://localhost/api', { method: 'POST', headers });

// Implements only the commands the limiter sends, with the same semantics as TAKE_SCRIPT.
function fakeRedis(clock) {
  const data = new Map();
  const calls = [];
  const alive = (key) => {
    const e = data.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= clock()) data.delete(key);
    return data.get(key);
  };
  const pttl = (key) => {
    const e = alive(key);
    if (!e) return -2;
    return e.expiresAt === null ? -1 : e.expiresAt - clock();
  };
  return {
    data,
    calls,
    async eval(script, keys, args) {
      calls.push('eval');
      assert.equal(script, TAKE_SCRIPT);
      const [key] = keys;
      const [windowMs, limit] = args.map(Number);
      const n = alive(key)?.value ?? 0;
      if (n >= limit) return [n, pttl(key), 0];
      const e = alive(key) ?? { value: 0, expiresAt: null };
      e.value += 1;
      data.set(key, e);
      if (pttl(key) < 0) e.expiresAt = clock() + windowMs;
      return [e.value, pttl(key), 1];
    },
    async get(key) {
      calls.push('get');
      return alive(key)?.value ?? null;
    },
    async pttl(key) {
      calls.push('pttl');
      return pttl(key);
    },
  };
}

function setup(store, now) {
  const limits = { analyze: { limit: 2, windowMs: HOUR } };
  return createRateLimit({ app: 'test-app', limits, noun: 'checks', store: () => store, clock: () => now.t });
}

for (const [name, make] of [
  ['redis', (now) => redisStore(fakeRedis(() => now.t))],
  ['memory', (now) => memoryStore(10_000, () => now.t)],
]) {
  test(`${name}: allows the limit, then denies with resetAt from the first hit`, async () => {
    const now = { t: 1_000_000 };
    const rl = setup(make(now), now);
    const r = req({ 'x-real-ip': '198.51.100.4' });

    assert.deepEqual(await rl.check(r, 'analyze'), { ok: true, remaining: 1, resetAt: 1_000_000 + HOUR });
    now.t += 10_000;
    assert.deepEqual(await rl.check(r, 'analyze'), { ok: true, remaining: 0, resetAt: 1_000_000 + HOUR });
    now.t += 10_000;
    const denied = await rl.check(r, 'analyze');
    assert.equal(denied.ok, false);
    assert.equal(denied.resetAt, 1_000_000 + HOUR);
    assert.equal(denied.retryAfter, Math.ceil((HOUR - 20_000) / 1000));
  });

  test(`${name}: peek never increments and agrees with check`, async () => {
    const now = { t: 5_000 };
    const rl = setup(make(now), now);
    const r = req({ 'x-real-ip': '198.51.100.5' });

    assert.deepEqual(await rl.peek(r, 'analyze'), { limit: 2, used: 0, remaining: 2, resetAt: null });
    await rl.check(r, 'analyze');
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(await rl.peek(r, 'analyze'), { limit: 2, used: 1, remaining: 1, resetAt: 5_000 + HOUR });
    }
    assert.equal((await rl.check(r, 'analyze')).ok, true);
    assert.equal((await rl.check(r, 'analyze')).ok, false);
    assert.equal((await rl.peek(r, 'analyze')).used, 2);
  });

  test(`${name}: window expiry starts a fresh window`, async () => {
    const now = { t: 0 };
    const rl = setup(make(now), now);
    const r = req({ 'x-real-ip': '198.51.100.6' });
    await rl.check(r, 'analyze');
    await rl.check(r, 'analyze');
    assert.equal((await rl.check(r, 'analyze')).ok, false);
    now.t = HOUR;
    assert.deepEqual(await rl.check(r, 'analyze'), { ok: true, remaining: 1, resetAt: 2 * HOUR });
  });
}

test('redis: over the limit does not increment the counter', async () => {
  const now = { t: 0 };
  const redis = fakeRedis(() => now.t);
  const rl = setup(redisStore(redis), now);
  const r = req({ 'x-real-ip': '203.0.113.9' });
  for (let i = 0; i < 5; i++) await rl.check(r, 'analyze');
  assert.equal(redis.data.get('rl:test-app:analyze:203.0.113.9').value, 2);
});

test('keys are namespaced per app, bucket and client', async () => {
  const now = { t: 0 };
  const redis = fakeRedis(() => now.t);
  const rl = setup(redisStore(redis), now);
  await rl.check(req({ 'x-real-ip': '203.0.113.10' }), 'analyze');
  assert.deepEqual([...redis.data.keys()], ['rl:test-app:analyze:203.0.113.10']);
});

test('fails closed with a 503 when the store errors', async () => {
  const now = { t: 0 };
  const broken = { take: async () => Promise.reject(new Error('down')), peek: async () => ({ count: 0, ttlMs: 0 }) };
  const rl = setup(broken, now);
  const errors = console.error;
  console.error = () => {};
  try {
    const gate = await rl.check(req(), 'analyze');
    assert.equal(gate.ok, false);
    assert.equal(gate.unavailable, true);
    const res = rl.tooMany(gate);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'The service is busy, try again in a minute.');
  } finally {
    console.error = errors;
  }
});

test('tooMany returns 429 with resetAt and retry-after', async () => {
  const rl = setup(memoryStore(), { t: 0 });
  const res = rl.tooMany({ ok: false, retryAfter: 90, resetAt: Date.UTC(2026, 0, 1) });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '90');
  const body = await res.json();
  assert.equal(body.resetAt, '2026-01-01T00:00:00.000Z');
  assert.match(body.error, /a few checks per hour\. Try again in 2 minutes/);
});

test('clientIp prefers x-real-ip, then the last forwarded hop, and groups IPv6 by /64', () => {
  assert.equal(clientIp(req({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })), '1.2.3.4');
  assert.equal(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5' })), '5.5.5.5');
  assert.equal(clientIp(req()), 'unknown');
  assert.equal(clientIp(req({ 'x-real-ip': '2001:db8:aa:bb:1:2:3:4' })), '2001:db8:aa:bb::/64');
  assert.equal(clientIp(req({ 'x-real-ip': '2001:DB8:aa:bb::99' })), '2001:db8:aa:bb::/64');
  assert.equal(clientIp(req({ 'x-real-ip': '2001:db8::1' })), '2001:db8:0:0::/64');
  assert.equal(clientIp(req({ 'x-real-ip': '::ffff:10.0.0.1' })), '10.0.0.1');
});
