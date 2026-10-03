'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AXES,
  RECIPIENTS,
  RECIPIENT_LABEL,
  compareDrafts,
  landingScore,
  rewriteCandidates,
  splitSentences,
  verdict,
  type Draft,
  type Recipient,
  type Tier,
} from '../../lib/tone';
import { SAMPLES, type Sample } from '../samples';
import { HeatText, riskBand } from './HeatText';
import { Radar, type Series } from './Radar';
import { SegBar } from './SegBar';

type ApiDraft = Draft & { getsReply: number };
type Result = { recipient: Recipient; drafts: ApiDraft[]; inputTokens: number; cost: number };

const MAX_CHARS = 8000;
const COLORS = ['#6a5cf2', '#3e8fd9'];
const NAMES = ['Draft A', 'Draft B'];

const TIER_STYLE: Record<Tier, { ring: string; chip: string; text: string }> = {
  good: { ring: '#3f9d63', chip: 'bg-good-soft text-good', text: 'text-good' },
  ok: { ring: '#6a5cf2', chip: 'bg-violet-soft text-violet-deep', text: 'text-violet-deep' },
  risky: { ring: '#b46a12', chip: 'bg-warn-soft text-warn', text: 'text-warn' },
  bad: { ring: '#c63e66', chip: 'bg-bad-soft text-bad', text: 'text-bad' },
};

export function ToneRadar({ children }: { children?: React.ReactNode }) {
  const [recipient, setRecipient] = useState<Recipient>('teammate');
  const [texts, setTexts] = useState(['', '']);
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState(0);
  const [focus, setFocus] = useState<{ index: number; nonce: number } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const activeDrafts = compare ? texts : texts.slice(0, 1);
  const sentenceCount = splitSentences(activeDrafts.join('\n')).length;
  const tooLong = activeDrafts.some((t) => t.length > MAX_CHARS);
  const canRun = !loading && activeDrafts.every((t) => t.trim()) && !tooLong;

  async function run(drafts: string[], who: Recipient) {
    setLoading(true);
    setError(null);
    setFocus(null);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ drafts, recipient: who }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed with ${res.status}.`);
      setResult(data as Result);
      setTab(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function loadSample(s: Sample) {
    const next = [s.draft, s.alt ?? ''];
    const both = Boolean(s.alt);
    setTexts(next);
    setRecipient(s.recipient);
    setCompare(both);
    run(both ? next : [s.draft], s.recipient);
  }

  const stale = result && (result.recipient !== recipient || result.drafts.length !== activeDrafts.length);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 sm:mb-12">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-display text-[22px] font-semibold leading-none tracking-tight">ToneRadar</p>
            <p className="mt-1 text-[13px] text-ink-soft">See how it lands before you hit send.</p>
          </div>
        </div>
        <p className="rounded-full border border-line bg-card/70 px-3 py-1.5 text-[12px] text-ink-soft backdrop-blur">
          Every number is scored by <span className="font-semibold text-ink">Jev</span>. Every word you read is ours.
        </p>
      </header>

      <section className="card p-5 sm:p-8">
        <div className="mb-6 max-w-[620px]">
          <h1 className="font-display text-[30px] font-semibold leading-[1.05] tracking-tight sm:text-[40px]">
            <span className="mb-2 block font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-violet-deep">
              Message tone checker
            </span>
            How will this message land?
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Paste an email, Slack message or text. We score it on eight tone axes, check every sentence for
            trouble, and tell you which lines to rewrite first.
          </p>
        </div>

        <fieldset className="mb-5">
          <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">It is going to</legend>
          <div className="inline-flex flex-wrap gap-1 rounded-[14px] border border-line bg-panel p-1">
            {RECIPIENTS.map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-[10px] px-3.5 py-2 text-[14px] font-medium transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet ${
                  recipient === r ? 'bg-white text-ink shadow-[0_2px_8px_-2px_rgb(60_48_140/0.25)]' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="recipient"
                  value={r}
                  checked={recipient === r}
                  onChange={() => setRecipient(r)}
                  className="sr-only"
                />
                {RECIPIENT_LABEL[r]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={`grid gap-4 ${compare ? 'md:grid-cols-2' : ''}`}>
          {(compare ? [0, 1] : [0]).map((i) => (
            <div key={i} className="anim-rise">
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor={`draft-${i}`} className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  {compare && <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />}
                  {compare ? NAMES[i] : 'Your message'}
                </label>
                <span className={`font-mono text-[11px] ${texts[i].length > MAX_CHARS ? 'text-bad' : 'text-ink-faint'}`}>
                  {texts[i].length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>
              <textarea
                id={`draft-${i}`}
                value={texts[i]}
                onChange={(e) => setTexts((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRun) run(activeDrafts, recipient);
                }}
                placeholder={i === 0 ? 'Hey, just following up on this again...' : 'Paste a rewrite to compare'}
                rows={compare ? 9 : 7}
                className="block w-full resize-y rounded-[16px] border border-line bg-white px-4 py-3.5 text-[15px] leading-relaxed text-ink shadow-[inset_0_1px_2px_rgb(30_20_80/0.04)] transition-colors placeholder:text-ink-faint/70 focus:border-violet focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-violet-soft"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canRun}
            onClick={() => run(activeDrafts, recipient)}
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(28_26_46/0.6)] transition-all hover:-translate-y-px hover:bg-violet-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink/35 disabled:shadow-none"
          >
            {loading ? <Spinner /> : <RadarGlyph />}
            {loading ? 'Reading the room' : compare ? 'Compare drafts' : 'Check tone'}
          </button>
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            className="rounded-full border border-line-strong bg-white px-4 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:border-violet hover:text-violet-deep"
          >
            {compare ? 'Check one draft' : 'Compare two drafts'}
          </button>
          {activeDrafts.some((t) => t.trim()) && (
            <span className="text-[12px] text-ink-faint">
              {sentenceCount} sentence{sentenceCount === 1 ? '' : 's'}
              {sentenceCount > 20 * activeDrafts.length ? ', only the first 20 per draft get scored' : ''}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <span className="mr-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Try a sample</span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={loading}
              onClick={() => loadSample(s)}
              className="rounded-full border border-line bg-violet-wash px-3.5 py-1.5 text-[13px] font-medium text-violet-deep transition-all hover:-translate-y-px hover:border-violet disabled:opacity-50"
            >
              {s.label}
              {s.alt && <span className="ml-1.5 text-ink-faint">with a rewrite</span>}
            </button>
          ))}
        </div>
      </section>

      <div ref={resultsRef} className="scroll-mt-6 pt-6">
        {stale && !loading && (
          <div className="anim-rise mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-warn/30 bg-warn-soft px-4 py-3 text-[14px] text-warn">
            <span>
              These results were scored for a {RECIPIENT_LABEL[result.recipient].toLowerCase()}
              {result.drafts.length !== activeDrafts.length ? ' with a different number of drafts' : ''}. Check again to
              score it for a {RECIPIENT_LABEL[recipient].toLowerCase()}.
            </span>
            <button
              type="button"
              disabled={!canRun}
              onClick={() => run(activeDrafts, recipient)}
              className="rounded-full bg-warn px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              Check again
            </button>
          </div>
        )}

        {error && !loading && (
          <div role="alert" className="card anim-rise mb-4 flex flex-wrap items-center justify-between gap-3 border-bad/30 p-5">
            <div>
              <p className="font-display text-[18px] font-semibold text-bad">That did not go through</p>
              <p className="mt-1 text-[14px] text-ink-soft">{error}</p>
            </div>
            <button
              type="button"
              disabled={!canRun}
              onClick={() => run(activeDrafts, recipient)}
              className="rounded-full border border-bad/40 px-4 py-2 text-[13px] font-semibold text-bad hover:bg-bad-soft disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <Placeholder loading sentences={sentenceCount} recipient={recipient} />
        ) : result ? (
          <Results result={result} tab={tab} setTab={setTab} focus={focus} setFocus={setFocus} />
        ) : (
          !error && <Placeholder recipient={recipient} />
        )}
      </div>

      {children}
    </main>
  );
}

function Placeholder({ loading, sentences = 0, recipient }: { loading?: boolean; sentences?: number; recipient: Recipient }) {
  return (
    <section className="card grid items-center gap-6 p-5 sm:p-8 lg:grid-cols-[1.1fr_1fr]" aria-busy={loading}>
      <div className={loading ? 'anim-pulse' : 'opacity-70'}>
        <Radar series={[]} recipient={recipient} idle />
      </div>
      <div className="max-w-[420px]">
        {loading ? (
          <>
            <p className="font-display text-[24px] font-semibold tracking-tight">Reading the room</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft" aria-live="polite">
              Scoring eight tone axes for the whole message and asking eight questions about each of{' '}
              {sentences || 'your'} sentence{sentences === 1 ? '' : 's'}. This takes a few seconds.
            </p>
            <div className="mt-5 space-y-2.5">
              {[0.8, 0.55, 0.7].map((w, i) => (
                <div key={i} className="h-3 animate-pulse rounded-full bg-violet-soft" style={{ width: `${w * 100}%`, animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-[24px] font-semibold tracking-tight">Nothing on the radar yet</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Paste a draft above, or try a sample. You will get a tone radar, a verdict for the person you picked, and
              your message with every sentence heat-marked. Hover or tap a sentence to see why.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Results({
  result,
  tab,
  setTab,
  focus,
  setFocus,
}: {
  result: Result;
  tab: number;
  setTab: (n: number) => void;
  focus: { index: number; nonce: number } | null;
  setFocus: (f: { index: number; nonce: number }) => void;
}) {
  const { recipient, drafts } = result;
  const series: Series[] = drafts.map((d, i) => ({ name: drafts.length > 1 ? NAMES[i] : 'Your message', values: d.axes, color: COLORS[i], dashed: i === 1 }));
  const verdicts = drafts.map((d) => verdict(d, recipient));
  const comparison = drafts.length === 2 ? compareDrafts(drafts[0], drafts[1], recipient) : null;
  const draft = drafts[tab] ?? drafts[0];
  const rewrites = useMemo(() => rewriteCandidates(draft.sentences), [draft]);
  const rank = useMemo(() => new Map(rewrites.map((r, i) => [r.index, i])), [rewrites]);
  const tips = useMemo(() => pickTips(rewrites), [rewrites]);

  return (
    <div className="space-y-6">
      {comparison && (
        <div className="card anim-rise flex flex-wrap items-center gap-4 p-5">
          <div className="flex items-center gap-2 font-mono text-[13px]">
            {drafts.map((d, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1">
                <span className="size-2 rounded-full" style={{ background: COLORS[i] }} />
                {NAMES[i]} {landingScore(d, recipient)}
              </span>
            ))}
          </div>
          <p className="text-[15px] text-ink">{comparison.summary}</p>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="card anim-rise relative z-10 p-5 sm:p-7">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[22px] font-semibold tracking-tight">Tone radar</h2>
              <p className="mt-1 text-[13px] text-ink-soft">Tap an axis for the detail. Green rings mark the ideal for a {RECIPIENT_LABEL[recipient].toLowerCase()}.</p>
            </div>
            {series.length > 1 && (
              <div className="flex gap-3 text-[12px] text-ink-soft">
                {series.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4" style={{ background: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Radar series={series} recipient={recipient} />
          <AxisTable drafts={drafts} />
        </div>

        <div className="space-y-6">
          {verdicts.map((v, i) => {
            const st = TIER_STYLE[v.tier];
            return (
              <div key={i} className="card anim-rise p-5 sm:p-7" style={{ animationDelay: `${120 + i * 80}ms` }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  How it lands{drafts.length > 1 ? `, ${NAMES[i]}` : ''} with a {RECIPIENT_LABEL[recipient].toLowerCase()}
                </p>
                <div className="mt-4 flex items-center gap-5">
                  <ScoreRing score={v.score} color={st.ring} />
                  <div>
                    <p className={`font-display text-[26px] font-semibold leading-tight tracking-tight ${st.text}`}>{v.headline}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink">{v.body}</p>
                  </div>
                </div>
                {v.note && <p className="mt-4 rounded-[12px] bg-panel px-4 py-3 text-[14px] leading-relaxed text-ink-soft">{v.note}</p>}
                <div className="mt-5">
                  <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                    <span className="font-medium">Odds of getting the reply you want</span>
                    <span className="font-mono text-[12px] text-ink-soft">{Math.round(drafts[i].getsReply * 100)} / 100</span>
                  </div>
                  <SegBar value={drafts[i].getsReply} color={i === 0 ? 'violet' : 'sky'} segments={30} label="Odds of getting the reply you want" />
                </div>
              </div>
            );
          })}
          <p className="px-2 text-[12px] text-ink-faint">
            {result.inputTokens.toLocaleString()} input tokens, about ${result.cost.toFixed(5)} on Jev.
          </p>
        </div>
      </section>

      <section className="card anim-rise relative z-20 p-5 sm:p-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-tight">Sentence by sentence</h2>
            <p className="mt-1 text-[13px] text-ink-soft">Hover or tap any sentence. Numbered ones are the first to rewrite.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {drafts.length > 1 && (
              <div role="tablist" className="inline-flex rounded-[12px] border border-line bg-panel p-1">
                {drafts.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={tab === i}
                    onClick={() => setTab(i)}
                    className={`rounded-[9px] px-3 py-1.5 text-[13px] font-medium ${tab === i ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
                  >
                    {NAMES[i]}
                  </button>
                ))}
              </div>
            )}
            <Legend />
          </div>
        </div>
        <HeatText key={tab} sentences={draft.sentences} rank={rank} focus={focus} />
        {draft.truncated && <p className="mt-3 text-[12px] text-ink-faint">Greyed sentences were past the 20 sentence limit and were not scored.</p>}
      </section>

      <section className="card anim-rise p-5 sm:p-8">
        <h2 className="font-display text-[22px] font-semibold tracking-tight">Rewrite these first</h2>
        {rewrites.length === 0 ? (
          <p className="mt-3 text-[15px] text-ink-soft">No sentence crosses the risk line. Nothing here needs a rewrite before you send it.</p>
        ) : (
          <ol className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rewrites.map((r, i) => {
              const band = riskBand(r.risk);
              return (
                <li key={r.index} className="flex flex-col rounded-[18px] border border-line bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="grid size-7 place-items-center rounded-full bg-ink font-mono text-[12px] font-semibold text-white">{i + 1}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${band.chip}`}>
                      {band.label}, {Math.round(r.risk * 100)}
                    </span>
                  </div>
                  <blockquote className="border-l-2 border-violet-soft pl-3 text-[15px] leading-relaxed text-ink">&quot;{r.text}&quot;</blockquote>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <span key={reason.key} className="rounded-full bg-panel px-2.5 py-1 text-[12px] font-medium text-ink">
                        {reason.label} <span className="font-mono text-[11px] text-ink-faint">{Math.round(reason.p * 100)}%</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{tips[i]}</p>
                  <button
                    type="button"
                    onClick={() => setFocus({ index: r.index, nonce: Date.now() })}
                    className="mt-auto self-start pt-4 text-[13px] font-semibold text-violet-deep underline-offset-4 hover:underline"
                  >
                    Show in message
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

// Each card gets the tip for its strongest reason that an earlier card has not used yet.
function pickTips(rewrites: ReturnType<typeof rewriteCandidates>) {
  const used = new Set<string>();
  return rewrites.map((r) => {
    const reason = r.reasons.find((x) => !used.has(x.key)) ?? r.reasons[0];
    if (!reason) return '';
    used.add(reason.key);
    return reason.tip;
  });
}

function AxisTable({ drafts }: { drafts: ApiDraft[] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-line pt-4 sm:grid-cols-4">
      {AXES.map((a) => (
        <div key={a.key} className="flex items-baseline justify-between gap-2 text-[12.5px]">
          <dt className="truncate text-ink-soft">{a.label}</dt>
          <dd className="font-mono text-[12px] text-ink">
            {drafts.map((d, i) => (
              <span key={i} style={{ color: drafts.length > 1 ? COLORS[i] : undefined }} className={i ? 'ml-1.5' : ''}>
                {Math.round(d.axes[a.key] * 100)}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Legend() {
  const items = [
    { label: 'Reads fine', bg: riskBand(0).bg },
    { label: 'Some risk', bg: riskBand(0.45).bg },
    { label: 'High risk', bg: riskBand(0.8).bg },
  ];
  return (
    <div className="flex gap-3 text-[12px] text-ink-soft">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[4px]" style={{ background: it.bg }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[88px] shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e3e1ea" strokeWidth="7" strokeDasharray="2 3" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <span className="font-display text-[28px] font-semibold tabular-nums" aria-label={`Score ${score} out of 100`}>
        {score}
      </span>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="size-11" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#6a5cf2" />
      <polygon points="32,10 49,20 52,38 38,52 22,50 12,34 18,18" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="3 3" />
      <polygon points="32,17 44,26 43,37 34,44 24,40 19,31 24,22" fill="#fff" fillOpacity="0.22" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="32" cy="17" r="3.2" fill="#fff" />
      <circle cx="44" cy="26" r="3.2" fill="#fff" />
      <circle cx="34" cy="44" r="3.2" fill="#fff" />
      <circle cx="19" cy="31" r="3.2" fill="#fff" />
    </svg>
  );
}

function RadarGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <polygon points="8,1.5 14,5 14,11 8,14.5 2,11 2,5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.5" />
      <polygon points="8,4 11.5,6.5 10,11 6,10.5 4.5,7" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />;
}
