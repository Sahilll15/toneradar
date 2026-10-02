import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AXIS_KEYS,
  FLAG_KEYS,
  axisFit,
  compareDrafts,
  landingScore,
  normalizeScore,
  rewriteCandidates,
  sentenceRisk,
  splitSentences,
  tierFor,
  verdict,
} from '../lib/tone.ts';

const axes = (over = {}) => ({ ...Object.fromEntries(AXIS_KEYS.map((k) => [k, 0.5])), ...over });
const flags = (over = {}) => ({ ...Object.fromEntries(FLAG_KEYS.map((k) => [k, 0.05])), ...over });
const sentence = (index, f) => ({ index, text: `Sentence ${index}.`, paragraph: 0, flags: f });

const kind = axes({ warmth: 0.85, clarity: 0.9, confidence: 0.8, urgency: 0.4, politeness: 0.9, passiveAggression: 0.02, defensiveness: 0.05, formality: 0.4 });
const snide = axes({ warmth: 0.15, clarity: 0.6, confidence: 0.6, urgency: 0.85, politeness: 0.2, passiveAggression: 0.9, defensiveness: 0.7, formality: 0.4 });

test('splitSentences keeps paragraphs and punctuation', () => {
  const out = splitSentences('Hi Sam,\n\nThis is late. Is it done?! Thanks');
  assert.deepEqual(out, [
    { text: 'Hi Sam,', paragraph: 0 },
    { text: 'This is late.', paragraph: 1 },
    { text: 'Is it done?!', paragraph: 1 },
    { text: 'Thanks', paragraph: 1 },
  ]);
  assert.deepEqual(splitSentences('   \n\n  '), []);
});

test('normalizeScore maps criteria index to 0..1 and clamps', () => {
  assert.equal(normalizeScore(2, 5), 0.5);
  assert.equal(normalizeScore(9, 5), 1);
  assert.equal(normalizeScore(-1, 5), 0);
  assert.equal(normalizeScore(Number.NaN, 5), 0);
});

test('axisFit respects polarity and recipient targets', () => {
  assert.equal(axisFit('warmth', 0.8, 'friend'), 0.8);
  assert.ok(Math.abs(axisFit('passiveAggression', 0.8, 'friend') - 0.2) < 1e-9);
  assert.equal(axisFit('formality', 0.75, 'client'), 1);
  assert.ok(axisFit('formality', 0.75, 'friend') < 0.1);
});

test('sentenceRisk takes the worst weighted bad flag and ignores good flags', () => {
  assert.equal(sentenceRisk(null), 0);
  assert.equal(sentenceRisk(flags({ passiveAggressive: 0.9, clearAsk: 1 })), 0.9);
  assert.ok(Math.abs(sentenceRisk(flags({ hedges: 1 })) - 0.6) < 1e-9);
});

test('a kind message beats a snide one and tiers follow the score', () => {
  const clean = [sentence(0, flags()), sentence(1, flags({ clearAsk: 0.9 }))];
  const rough = [sentence(0, flags({ passiveAggressive: 0.92 })), sentence(1, flags({ readsAngry: 0.8 }))];
  const good = landingScore({ axes: kind, sentences: clean }, 'teammate');
  const bad = landingScore({ axes: snide, sentences: rough }, 'teammate');
  assert.ok(good >= 78, `expected good >= 78, got ${good}`);
  assert.ok(bad < 48, `expected bad < 48, got ${bad}`);
  assert.equal(tierFor(good), 'good');
  assert.equal(tierFor(bad), 'bad');

  const v = verdict({ axes: snide, sentences: rough }, 'client');
  assert.equal(v.headline, 'Likely to backfire');
  assert.match(v.body, /passive-aggressive/);
  assert.ok(v.note);
});

test('rewriteCandidates ranks risky sentences, caps at three, explains why', () => {
  const s = [
    sentence(0, flags()),
    sentence(1, flags({ hedges: 0.9 })),
    sentence(2, flags({ passiveAggressive: 0.95, blames: 0.7 })),
    sentence(3, flags({ readsAngry: 0.7 })),
    sentence(4, flags({ dismissive: 0.8 })),
    { index: 5, text: 'unscored', paragraph: 0, flags: null },
  ];
  const r = rewriteCandidates(s);
  assert.deepEqual(r.map((x) => x.index), [2, 4, 3]);
  assert.deepEqual(r[0].reasons.map((x) => x.key), ['passiveAggressive', 'blames']);
});

test('compareDrafts names the better draft and the axes that moved', () => {
  const a = { text: '', truncated: false, axes: snide, sentences: [sentence(0, flags({ passiveAggressive: 0.9 }))] };
  const b = { text: '', truncated: false, axes: kind, sentences: [sentence(0, flags())] };
  const c = compareDrafts(a, b, 'manager');
  assert.equal(c.winner, 'B');
  assert.ok(c.delta > 20);
  assert.match(c.summary, /^Draft B lands better with your manager\./);
  assert.match(c.summary, /less passive-aggression/);
  assert.equal(compareDrafts(a, a, 'manager').winner, 'tie');
});

test('greetings and sign-offs are damped by low substance', () => {
  const f = flags({ passiveAggressive: 0.9 });
  assert.equal(sentenceRisk(f, 1), 0.9);
  assert.ok(Math.abs(sentenceRisk(f, 0) - 0.36) < 1e-9);
  const r = rewriteCandidates([
    { index: 0, text: 'Hi Dana,', paragraph: 0, flags: f, substance: 0.05 },
    { index: 1, text: 'This is late again.', paragraph: 1, flags: f, substance: 0.95 },
  ]);
  assert.deepEqual(r.map((x) => x.index), [1]);
});
