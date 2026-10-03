// Pure scoring and copy logic. No imports so node --test can load it with --experimental-strip-types.

export const RECIPIENTS = ['manager', 'teammate', 'client', 'friend'] as const;
export type Recipient = (typeof RECIPIENTS)[number];

export const RECIPIENT_LABEL: Record<Recipient, string> = {
  manager: 'Manager',
  teammate: 'Teammate',
  client: 'Client',
  friend: 'Friend',
};

export const AXIS_KEYS = [
  'warmth',
  'clarity',
  'confidence',
  'urgency',
  'politeness',
  'passiveAggression',
  'defensiveness',
  'formality',
] as const;
export type AxisKey = (typeof AXIS_KEYS)[number];

type Polarity = 'good' | 'bad' | 'target';

export type AxisDef = {
  key: AxisKey;
  label: string;
  polarity: Polarity;
  instructions: string;
  criteria: string[];
  high: string;
  low: string;
};

export const AXES: AxisDef[] = [
  {
    key: 'warmth',
    label: 'Warmth',
    polarity: 'good',
    instructions: 'How warm and personable does this message feel to the recipient?',
    criteria: [
      'cold or hostile',
      'detached and transactional',
      'neutral',
      'friendly',
      'genuinely warm and caring',
    ],
    high: 'warm',
    low: 'cold',
  },
  {
    key: 'clarity',
    label: 'Clarity',
    polarity: 'good',
    instructions: 'How easy is it for the recipient to understand what the sender means and wants?',
    criteria: [
      'confusing, the point is lost',
      'vague, the reader has to guess',
      'understandable with some effort',
      'clear',
      'crisp and unmistakable',
    ],
    high: 'clear',
    low: 'muddled',
  },
  {
    key: 'confidence',
    label: 'Confidence',
    polarity: 'good',
    instructions: 'How confident and self-assured does the sender sound?',
    criteria: [
      'anxious or self-undermining',
      'unsure and hedging',
      'neutral',
      'assured',
      'very self-assured',
    ],
    high: 'assured',
    low: 'unsure of itself',
  },
  {
    key: 'urgency',
    label: 'Urgency',
    polarity: 'target',
    instructions: 'How much time pressure does the message put on the recipient?',
    criteria: [
      'no time pressure at all',
      'relaxed, whenever suits',
      'some expectation of a timely reply',
      'pressing, wants action soon',
      'demanding immediate action',
    ],
    high: 'pushy about timing',
    low: 'unhurried',
  },
  {
    key: 'politeness',
    label: 'Politeness',
    polarity: 'good',
    instructions: 'How polite and courteous is the message?',
    criteria: ['rude', 'curt', 'neutral', 'polite', 'very courteous'],
    high: 'courteous',
    low: 'curt',
  },
  {
    key: 'passiveAggression',
    label: 'Passive-aggression',
    polarity: 'bad',
    instructions: 'How much veiled frustration, sarcasm or indirect criticism does the message carry?',
    criteria: [
      'none, completely straightforward',
      'a faint edge',
      'noticeable veiled frustration',
      'clearly passive-aggressive',
      'dripping with sarcasm or veiled hostility',
    ],
    high: 'passive-aggressive',
    low: 'straightforward',
  },
  {
    key: 'defensiveness',
    label: 'Defensiveness',
    polarity: 'bad',
    instructions: 'How defensive does the sender sound, for example justifying, deflecting or protecting themselves?',
    criteria: [
      'open, not defensive at all',
      'slightly guarded',
      'somewhat defensive',
      'clearly defensive',
      'very defensive, deflecting blame',
    ],
    high: 'defensive',
    low: 'open',
  },
  {
    key: 'formality',
    label: 'Formality',
    polarity: 'target',
    instructions: 'How formal is the register of the message?',
    criteria: ['very casual, slang', 'casual', 'conversational', 'professional', 'very formal'],
    high: 'stiff',
    low: 'too casual',
  },
];

export const AXIS_BY_KEY = Object.fromEntries(AXES.map((a) => [a.key, a])) as Record<AxisKey, AxisDef>;

export type AxisValues = Record<AxisKey, number>;

// Ideal level (0..1) for the target axes, plus how much each axis matters per recipient.
const TARGETS: Record<Recipient, { urgency: number; formality: number }> = {
  manager: { urgency: 0.4, formality: 0.6 },
  teammate: { urgency: 0.4, formality: 0.4 },
  client: { urgency: 0.35, formality: 0.75 },
  friend: { urgency: 0.2, formality: 0.15 },
};

export const WEIGHTS: Record<Recipient, AxisValues> = {
  manager: { warmth: 0.8, clarity: 1.3, confidence: 1.1, urgency: 0.7, politeness: 1, passiveAggression: 1.4, defensiveness: 1.3, formality: 0.8 },
  teammate: { warmth: 1, clarity: 1.2, confidence: 0.8, urgency: 0.7, politeness: 0.9, passiveAggression: 1.5, defensiveness: 1, formality: 0.5 },
  client: { warmth: 0.9, clarity: 1.3, confidence: 1, urgency: 0.8, politeness: 1.3, passiveAggression: 1.5, defensiveness: 1.2, formality: 1 },
  friend: { warmth: 1.5, clarity: 0.7, confidence: 0.5, urgency: 0.6, politeness: 0.7, passiveAggression: 1.4, defensiveness: 1, formality: 0.6 },
};

export function targetFor(axis: AxisKey, recipient: Recipient): number | null {
  if (axis === 'urgency' || axis === 'formality') return TARGETS[recipient][axis];
  return null;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function normalizeScore(score: number, levels: number) {
  return clamp01(score / (levels - 1));
}

/** How well one axis value suits the recipient, 0 (bad) to 1 (ideal). */
export function axisFit(axis: AxisKey, value: number, recipient: Recipient) {
  const def = AXIS_BY_KEY[axis];
  if (def.polarity === 'good') return clamp01(value);
  if (def.polarity === 'bad') return clamp01(1 - value);
  const target = targetFor(axis, recipient) ?? 0.5;
  return clamp01(1 - Math.abs(value - target) * 1.6);
}

export const FLAG_KEYS = ['passiveAggressive', 'readsAngry', 'hedges', 'dismissive', 'blames', 'clearAsk', 'warm'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export type FlagDef = {
  key: FlagKey;
  label: string;
  good: boolean;
  weight: number;
  instructions: string;
  tip: string;
};

export const FLAGS: FlagDef[] = [
  {
    key: 'passiveAggressive',
    label: 'Reads as passive-aggressive',
    good: false,
    weight: 1,
    instructions: 'Does this sentence read as passive-aggressive, with veiled frustration or sarcasm?',
    tip: 'Say the frustration plainly or drop it. Phrases like "as I mentioned" or "per my last message" land as a jab.',
  },
  {
    key: 'readsAngry',
    label: 'Could be misread as angry',
    good: false,
    weight: 0.95,
    instructions: 'Could the recipient reasonably misread this sentence as angry or irritated?',
    tip: 'Soften the edges. Lead with context, cut absolutes like "always" or "never", and lose any all caps.',
  },
  {
    key: 'hedges',
    label: 'Hedges unnecessarily',
    good: false,
    weight: 0.6,
    instructions: 'Does this sentence hedge or apologise more than it needs to, weakening the point?',
    tip: 'Cut the qualifiers ("just", "sorry to bother", "I might be wrong but") and state the point.',
  },
  {
    key: 'dismissive',
    label: 'Sounds dismissive',
    good: false,
    weight: 0.85,
    instructions: 'Does this sentence sound dismissive of the recipient or their concerns?',
    tip: 'Acknowledge what they said before moving on, even in a few words.',
  },
  {
    key: 'blames',
    label: 'Points blame',
    good: false,
    weight: 0.8,
    instructions: 'Does this sentence assign blame to the recipient or someone else?',
    tip: 'Describe what happened and what is needed next, not whose fault it was.',
  },
  {
    key: 'clearAsk',
    label: 'Is a clear ask',
    good: true,
    weight: 1,
    instructions: 'Is this sentence a clear, actionable request or next step?',
    tip: '',
  },
  {
    key: 'warm',
    label: 'Feels warm',
    good: true,
    weight: 1,
    instructions: 'Does this sentence come across as warm or appreciative?',
    tip: '',
  },
];

export const FLAG_BY_KEY = Object.fromEntries(FLAGS.map((f) => [f.key, f])) as Record<FlagKey, FlagDef>;

export type FlagValues = Record<FlagKey, number>;

export type SentenceResult = {
  index: number;
  text: string;
  paragraph: number;
  flags: FlagValues | null;
  /** Probability the sentence carries content rather than being a greeting or sign-off. */
  substance?: number;
};

export type Draft = {
  text: string;
  axes: AxisValues;
  sentences: SentenceResult[];
  truncated: boolean;
};

export type Segment = { text: string; paragraph: number };

/** Splits a message into sentences, keeping paragraph numbers so the heat view can rebuild line breaks. */
export function splitSentences(message: string): Segment[] {
  const out: Segment[] = [];
  const paragraphs = message.replace(/\r\n?/g, '\n').split(/\n+/);
  let p = 0;
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const parts = trimmed.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [trimmed];
    for (const part of parts) {
      const t = part.trim();
      if (t) out.push({ text: t, paragraph: p });
    }
    p++;
  }
  return out;
}

// Greetings and sign-offs inherit the tone of the whole message, so they are damped rather than ranked.
export function sentenceRisk(flags: FlagValues | null, substance = 1) {
  if (!flags) return 0;
  const worst = Math.max(...FLAGS.filter((f) => !f.good).map((f) => flags[f.key] * f.weight));
  return clamp01(worst * (0.4 + 0.6 * clamp01(substance)));
}

export const riskOf = (s: Pick<SentenceResult, 'flags' | 'substance'>) => sentenceRisk(s.flags, s.substance ?? 1);

export function axisScore(axes: AxisValues, recipient: Recipient) {
  const w = WEIGHTS[recipient];
  let sum = 0;
  let total = 0;
  for (const k of AXIS_KEYS) {
    sum += axisFit(k, axes[k], recipient) * w[k];
    total += w[k];
  }
  return sum / total;
}

/** Overall 0..100 "how it lands" number: mostly the whole-message axes, dragged down by the worst sentences. */
export function landingScore(draft: Pick<Draft, 'axes' | 'sentences'>, recipient: Recipient) {
  const risks = draft.sentences
    .filter((s) => s.flags)
    .map(riskOf)
    .sort((a, b) => b - a);
  const worst = risks.length ? risks.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, risks.length) : 0;
  return Math.round(100 * (0.72 * axisScore(draft.axes, recipient) + 0.28 * (1 - worst)));
}

export type Tier = 'good' | 'ok' | 'risky' | 'bad';

export function tierFor(score: number): Tier {
  if (score >= 78) return 'good';
  if (score >= 63) return 'ok';
  if (score >= 48) return 'risky';
  return 'bad';
}

export const TIER_HEADLINE: Record<Tier, string> = {
  good: 'Lands well',
  ok: 'Mostly fine, a few rough edges',
  risky: 'Might sting',
  bad: 'Likely to backfire',
};

const RECIPIENT_NOUN: Record<Recipient, string> = {
  manager: 'your manager',
  teammate: 'a teammate',
  client: 'a client',
  friend: 'a friend',
};

const AXIS_NOTE: Partial<Record<`${AxisKey}:${'high' | 'low'}`, Partial<Record<Recipient, string>> & { any: string }>> = {
  'passiveAggression:high': {
    any: 'The veiled frustration is what they will remember, not the request.',
    client: 'Clients rarely push back on a jab. They just quietly trust you less.',
    manager: 'Managers tend to read this as a morale problem rather than a process one.',
  },
  'defensiveness:high': {
    any: 'It spends more effort protecting the sender than moving things forward.',
    manager: 'Owning it in one line will read as more senior than explaining it away.',
  },
  'clarity:low': {
    any: 'They will have to reply asking what you actually need.',
    client: 'A vague ask to a client usually means another round trip and a slower answer.',
  },
  'warmth:low': {
    any: 'It reads colder than you probably intend.',
    friend: 'From a friend, this can read as upset even if you are not.',
  },
  'politeness:low': { any: 'The tone is curt enough that it may set them on edge before they read the details.' },
  'confidence:low': {
    any: 'It undersells your own point.',
    manager: 'Hedging this much can make a solid update look like a problem.',
  },
  'urgency:high': {
    any: 'The time pressure may feel like a demand rather than a request.',
    friend: 'That much urgency in a casual message can feel like a guilt trip.',
  },
  'formality:high': {
    any: 'The register is stiffer than the relationship calls for.',
    friend: 'It sounds like a letter from the bank, not a friend.',
    teammate: 'It sounds more like a memo than a message to a peer.',
  },
  'formality:low': {
    any: 'It is more casual than this context usually allows.',
    client: 'Clients tend to read this casual a register as careless.',
  },
};

export type AxisRead = { axis: AxisKey; direction: 'high' | 'low'; fit: number; severity: number; phrase: string };

/** Each axis as a phrase, ordered by how much it hurts with this recipient. */
export function axisReads(axes: AxisValues, recipient: Recipient): AxisRead[] {
  return AXIS_KEYS.map((k) => {
    const def = AXIS_BY_KEY[k];
    const v = axes[k];
    let direction: 'high' | 'low';
    if (def.polarity === 'target') direction = v >= (targetFor(k, recipient) ?? 0.5) ? 'high' : 'low';
    else direction = v >= 0.5 ? 'high' : 'low';
    const fit = axisFit(k, v, recipient);
    return { axis: k, direction, fit, severity: (1 - fit) * WEIGHTS[recipient][k], phrase: direction === 'high' ? def.high : def.low };
  }).sort((a, b) => b.severity - a.severity);
}

export type Verdict = { score: number; tier: Tier; headline: string; body: string; note: string | null };

export function verdict(draft: Pick<Draft, 'axes' | 'sentences'>, recipient: Recipient): Verdict {
  const score = landingScore(draft, recipient);
  const tier = tierFor(score);
  const reads = axisReads(draft.axes, recipient);
  const problems = reads.filter((r) => r.fit < 0.5).slice(0, 2);
  const strengths = reads
    .filter((r) => r.fit >= 0.7 && AXIS_BY_KEY[r.axis].polarity === 'good')
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 2);
  const who = RECIPIENT_NOUN[recipient];

  let body: string;
  if (problems.length === 0) {
    const s = strengths.map((r) => r.phrase);
    body = s.length
      ? `To ${who}, this comes across ${joinAnd(s)} with nothing that should catch them off guard.`
      : `To ${who}, this reads neutral. Nothing in it should cause friction.`;
  } else {
    const p = joinAnd(problems.map((r) => r.phrase));
    body = strengths.length
      ? `To ${who}, it is ${joinAnd(strengths.map((r) => r.phrase))}, but it also comes across ${p}.`
      : `To ${who}, this comes across ${p}.`;
  }

  const worst = problems[0];
  let note: string | null = null;
  if (worst) {
    const entry = AXIS_NOTE[`${worst.axis}:${worst.direction}`];
    if (entry) note = entry[recipient] ?? entry.any;
  }
  return { score, tier, headline: TIER_HEADLINE[tier], body, note };
}

export type Rewrite = { index: number; text: string; risk: number; reasons: { key: FlagKey; label: string; p: number; tip: string }[] };

export function rewriteCandidates(sentences: SentenceResult[], max = 3, threshold = 0.45): Rewrite[] {
  return sentences
    .filter((s) => s.flags)
    .map((s) => ({ s, risk: riskOf(s) }))
    .filter((x) => x.risk >= threshold)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, max)
    .map(({ s, risk }) => ({
      index: s.index,
      text: s.text,
      risk,
      reasons: FLAGS.filter((f) => !f.good && s.flags![f.key] * f.weight >= threshold)
        .sort((a, b) => s.flags![b.key] * b.weight - s.flags![a.key] * a.weight)
        .map((f) => ({ key: f.key, label: f.label, p: s.flags![f.key], tip: f.tip })),
    }));
}

export type Comparison = { winner: 'A' | 'B' | 'tie'; delta: number; summary: string };

export function compareDrafts(a: Draft, b: Draft, recipient: Recipient): Comparison {
  const sa = landingScore(a, recipient);
  const sb = landingScore(b, recipient);
  const delta = sb - sa;
  const who = RECIPIENT_NOUN[recipient];
  if (Math.abs(delta) < 3) {
    return { winner: 'tie', delta, summary: `Both drafts land about the same with ${who}. Pick the one that sounds more like you.` };
  }
  const better = delta > 0 ? b : a;
  const worse = delta > 0 ? a : b;
  const gains = AXIS_KEYS.map((k) => ({
    k,
    gain: axisFit(k, better.axes[k], recipient) - axisFit(k, worse.axes[k], recipient),
  }))
    .filter((g) => g.gain > 0.08)
    .sort((x, y) => y.gain - x.gain)
    .slice(0, 2)
    .map((g) => gainPhrase(g.k));
  const name = delta > 0 ? 'Draft B' : 'Draft A';
  const why = gains.length ? `, mostly from ${joinAnd(gains)}` : '';
  return {
    winner: delta > 0 ? 'B' : 'A',
    delta,
    summary: `${name} lands better with ${who}. It scores ${Math.abs(delta)} points higher${why}.`,
  };
}

function gainPhrase(k: AxisKey) {
  const def = AXIS_BY_KEY[k];
  if (def.polarity === 'bad') return `less ${def.label.toLowerCase()}`;
  if (def.polarity === 'target') return `a better pitched ${def.label.toLowerCase()}`;
  return `more ${def.label.toLowerCase()}`;
}

export function joinAnd(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
