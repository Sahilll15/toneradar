# ToneRadar

Paste a message you are about to send and see how it will land before you hit send. Pick who it is for (manager, teammate, client or friend) and ToneRadar sends the message and that context to TypeSafe's Jev as state. Jev answers eight score questions about the whole message (warmth, clarity, confidence, urgency, politeness, passive-aggression, defensiveness, formality, each with five ordered criteria), a boolean on whether you will get the reply you want, and eight booleans per sentence such as "reads as passive-aggressive", "could be misread as angry", "hedges unnecessarily" and "is a clear ask". Jev only returns numbers. The radar chart, the heat-marked message, the verdict, the rewrite list and every line of copy are computed in `lib/tone.ts` from those numbers. You can also compare two drafts on one radar.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in a key
npm run dev                  # http://localhost:3000
npm test                     # unit tests for the scoring logic
npm run build && npx next start -p 3101
```

## Config

| Variable | Default | What it does |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | none | Vercel AI Gateway key, tried first |
| `TYPESAFE_API_KEY` | none | Direct TypeSafe API key, used as fallback |
| `RATE_LIMIT_ANALYZE` | `5` | Checks allowed per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Rate limit window in milliseconds |

Limits per request are two drafts, 8,000 characters each, and the first 20 sentences of each draft get scored.
