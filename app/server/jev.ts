import { experimental_evaluate as evaluate } from 'ai';

type Question =
  | { type: 'boolean'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'score'; instructions: string; criteria: string[] };

type Answer<Q> = Q extends { type: 'boolean' } ? { probability: number } : { score: number };

export type JevResult<Qs extends Record<string, Question>> = {
  answers: { [K in keyof Qs]: Answer<Qs[K]> };
  inputTokens: number;
};

const DIRECT_URL = 'https://api.typesafe.ai/v1/systemone';
const GATEWAY_COOLDOWN_MS = 5 * 60_000;
let gatewayFailedAt = 0;

async function viaGateway<Qs extends Record<string, Question>>(state: unknown, questions: Qs) {
  const { answers, usage } = await evaluate({ model: 'typesafe-ai/jev', state, questions } as never);
  return { answers, inputTokens: usage.inputTokens ?? 0 } as JevResult<Qs>;
}

async function viaDirect<Qs extends Record<string, Question>>(state: unknown, questions: Qs) {
  // The direct API calls boolean questions "noul" and answers them in a `noul` field.
  const body = {
    model: 'jev-latest',
    state,
    questions: Object.fromEntries(
      Object.entries(questions).map(([k, q]) => [k, q.type === 'boolean' ? { ...q, type: 'noul' } : q]),
    ),
  };

  const res = await fetch(DIRECT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TypeSafe API returned ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const answers = Object.fromEntries(
    Object.entries(data.answers as Record<string, { type: string; noul?: number; score?: number }>).map(([k, a]) => [
      k,
      a.type === 'noul' ? { probability: a.noul } : { score: a.score },
    ]),
  );
  return { answers, inputTokens: data.usage?.input_tokens ?? 0 } as JevResult<Qs>;
}

export async function askJev<Qs extends Record<string, Question>>(state: unknown, questions: Qs) {
  const hasDirect = Boolean(process.env.TYPESAFE_API_KEY);
  const gatewayUsable =
    Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) &&
    Date.now() - gatewayFailedAt > GATEWAY_COOLDOWN_MS;

  if (!gatewayUsable && hasDirect) return viaDirect(state, questions);

  try {
    return await viaGateway(state, questions);
  } catch (err) {
    if (!hasDirect) throw err;
    // Skip the gateway for a while so each line of a posting does not pay for a failed call first.
    gatewayFailedAt = Date.now();
    console.warn('AI Gateway failed, falling back to the TypeSafe API:', err instanceof Error ? err.message : err);
    return viaDirect(state, questions);
  }
}
