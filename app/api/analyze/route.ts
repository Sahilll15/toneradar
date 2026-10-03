import { NextResponse } from 'next/server';
import {
  AXES,
  FLAGS,
  RECIPIENTS,
  normalizeScore,
  splitSentences,
  type AxisValues,
  type Draft,
  type FlagValues,
  type Recipient,
} from '../../../lib/tone';
import { askJev } from '../../server/jev';
import { check, tooMany } from '../../server/ratelimit';

const PRICE_PER_INPUT_TOKEN = 0.042 / 1_000_000;
const MAX_CHARS = 8_000;
const MAX_SENTENCES = 20;

const RECIPIENT_CONTEXT: Record<Recipient, string> = {
  manager: "the sender's manager at work",
  teammate: 'a teammate or peer at work',
  client: 'an external client or customer',
  friend: 'a personal friend',
};

type ScoreQ = { type: 'score'; instructions: string; criteria: string[] };
type BoolQ = { type: 'boolean'; instructions: string };

const AXIS_QUESTIONS: Record<string, ScoreQ> = Object.fromEntries(
  AXES.map((a) => [a.key, { type: 'score', instructions: a.instructions, criteria: a.criteria }]),
);

const FLAG_QUESTIONS: Record<string, BoolQ> = Object.fromEntries(
  FLAGS.map((f) => [f.key, { type: 'boolean', instructions: f.instructions }]),
);

const SUBSTANCE_QUESTION: Record<string, BoolQ> = {
  substantive: {
    type: 'boolean',
    instructions: 'Does this sentence carry real content, rather than being only a greeting, sign-off or name?',
  },
};

const REPLY_QUESTION: Record<string, BoolQ> = {
  getsReply: {
    type: 'boolean',
    instructions: 'Is the recipient likely to respond the way the sender hopes after reading this message?',
  },
};

async function scoreMessage(message: string, recipient: Recipient) {
  const state = { message, recipient: RECIPIENT_CONTEXT[recipient] };
  const [axes, reply] = await Promise.all([askJev(state, AXIS_QUESTIONS), askJev(state, REPLY_QUESTION)]);
  const values = Object.fromEntries(
    AXES.map((a) => [a.key, normalizeScore(axes.answers[a.key].score, a.criteria.length)]),
  ) as AxisValues;
  return { axes: values, getsReply: reply.answers.getsReply.probability, inputTokens: axes.inputTokens + reply.inputTokens };
}

async function scoreSentence(sentence: string, message: string, recipient: Recipient) {
  const { answers, inputTokens } = await askJev(
    { sentence, fullMessage: message, recipient: RECIPIENT_CONTEXT[recipient] },
    { ...FLAG_QUESTIONS, ...SUBSTANCE_QUESTION },
  );
  const flags = Object.fromEntries(FLAGS.map((f) => [f.key, answers[f.key].probability])) as FlagValues;
  return { flags, substance: answers.substantive.probability, inputTokens };
}

async function analyzeDraft(text: string, recipient: Recipient) {
  const segments = splitSentences(text);
  const scored = segments.slice(0, MAX_SENTENCES);
  const [whole, perSentence] = await Promise.all([
    scoreMessage(text, recipient),
    Promise.all(scored.map((s) => scoreSentence(s.text, text, recipient))),
  ]);
  const draft: Draft & { getsReply: number } = {
    text,
    axes: whole.axes,
    getsReply: whole.getsReply,
    truncated: segments.length > MAX_SENTENCES,
    sentences: segments.map((s, i) => ({ index: i, text: s.text, paragraph: s.paragraph, flags: perSentence[i]?.flags ?? null, substance: perSentence[i]?.substance })),
  };
  const inputTokens = whole.inputTokens + perSentence.reduce((n, s) => n + s.inputTokens, 0);
  return { draft, inputTokens };
}

export async function POST(req: Request) {
  let body: { drafts?: unknown; recipient?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON with a drafts array and a recipient.' }, { status: 400 });
  }

  const drafts = Array.isArray(body.drafts) ? body.drafts.filter((d): d is string => typeof d === 'string') : [];
  const recipient = RECIPIENTS.includes(body.recipient as Recipient) ? (body.recipient as Recipient) : null;

  if (!recipient) {
    return NextResponse.json({ error: `Pick who it is for: ${RECIPIENTS.join(', ')}.` }, { status: 400 });
  }
  if (drafts.length === 0 || drafts.length > 2 || drafts.some((d) => !d.trim())) {
    return NextResponse.json({ error: 'Paste a message first. You can compare up to two drafts.' }, { status: 400 });
  }
  if (drafts.some((d) => d.length > MAX_CHARS)) {
    return NextResponse.json(
      { error: `Each draft is capped at ${MAX_CHARS.toLocaleString()} characters. Trim it down and try again.` },
      { status: 413 },
    );
  }

  const gate = await check(req, 'analyze');
  if (!gate.ok) return tooMany(gate);

  try {
    const results = await Promise.all(drafts.map((d) => analyzeDraft(d.trim(), recipient)));
    const inputTokens = results.reduce((n, r) => n + r.inputTokens, 0);
    return NextResponse.json({
      recipient,
      drafts: results.map((r) => r.draft),
      inputTokens,
      cost: inputTokens * PRICE_PER_INPUT_TOKEN,
    });
  } catch (err) {
    console.error('analyze failed', err);
    return NextResponse.json({ error: 'The tone check failed upstream. Give it another try in a moment.' }, { status: 502 });
  }
}
