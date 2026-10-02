'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FLAGS, riskOf, type SentenceResult } from '../../lib/tone';
import { SegBar } from './SegBar';

export function riskBand(r: number) {
  if (r >= 0.6) return { label: 'High risk', chip: 'bg-bad-soft text-bad', bg: `rgb(198 62 102 / ${0.14 + r * 0.22})` };
  if (r >= 0.35) return { label: 'Some risk', chip: 'bg-warn-soft text-warn', bg: `rgb(229 150 40 / ${0.12 + r * 0.2})` };
  return { label: 'Reads fine', chip: 'bg-good-soft text-good', bg: 'rgb(63 157 99 / 0.07)' };
}

type Pos = { top: number; left: number };
const POP_W = 312;

export function HeatText({
  sentences,
  rank,
  focus,
}: {
  sentences: SentenceResult[];
  rank: Map<number, number>;
  focus: { index: number; nonce: number } | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLSpanElement>());
  const [open, setOpen] = useState<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  const place = useCallback((index: number) => {
    const el = refs.current.get(index);
    const container = box.current;
    if (!el || !container) return;
    const rects = el.getClientRects();
    const last = rects[rects.length - 1] ?? el.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    const w = Math.min(POP_W, c.width);
    const left = Math.min(Math.max(0, last.left - c.left), c.width - w);
    setPos({ top: last.bottom - c.top + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (open === null) return;
    place(open);
    const onResize = () => place(open);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, place]);

  useEffect(() => {
    if (!focus) return;
    const el = refs.current.get(focus.index);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
    // Popover state is driven by an external "show me" request, not by render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(focus.index);
  }, [focus]);

  useEffect(() => {
    if (open === null) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(null);
      } else if (!box.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const paragraphs: SentenceResult[][] = [];
  for (const s of sentences) (paragraphs[s.paragraph] ??= []).push(s);

  const current = open !== null ? sentences[open] : null;

  return (
    <div ref={box} className="relative pb-2" onPointerLeave={() => window.clearTimeout(hoverTimer.current)}>
      <div className="space-y-4 text-[16px] leading-[2] text-ink sm:text-[17px]">
        {paragraphs.filter(Boolean).map((para, pi) => (
          <p key={pi}>
            {para.map((s) => {
              const risk = riskOf(s);
              const band = riskBand(risk);
              const r = rank.get(s.index);
              if (!s.flags) {
                return (
                  <span key={s.index} className="text-ink-faint">
                    {s.text}{' '}
                  </span>
                );
              }
              return (
                <span key={s.index}>
                  <span
                    ref={(el) => {
                      if (el) refs.current.set(s.index, el);
                      else refs.current.delete(s.index);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={open === s.index}
                    aria-label={`Sentence ${s.index + 1}, ${band.label.toLowerCase()}. Show details.`}
                    className="heat"
                    style={{ backgroundColor: band.bg }}
                    onClick={() => {
                      window.clearTimeout(hoverTimer.current);
                      setOpen(s.index);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(open === s.index ? null : s.index);
                      }
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'mouse') return;
                      window.clearTimeout(hoverTimer.current);
                      hoverTimer.current = window.setTimeout(() => setOpen(s.index), 180);
                    }}
                    onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
                  >
                    {s.text}
                    {r !== undefined && (
                      <sup className="ml-0.5 inline-grid size-[17px] place-items-center rounded-full bg-ink align-[0.35em] font-mono text-[10px] font-semibold leading-none text-white">
                        {r + 1}
                      </sup>
                    )}
                  </span>{' '}
                </span>
              );
            })}
          </p>
        ))}
      </div>

      {current?.flags && pos && (
        <div
          key={current.index}
          role="dialog"
          aria-label={`Sentence ${current.index + 1} details`}
          className="pop anim-pop absolute z-30 px-4 py-3.5"
          style={{ top: pos.top, left: pos.left, width: `min(${POP_W}px, 100%)` }}
          onPointerEnter={() => window.clearTimeout(hoverTimer.current)}
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2.5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <polygon points="8,1.5 14,5 14,11 8,14.5 2,11 2,5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Sentence {current.index + 1}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${riskBand(riskOf(current)).chip}`}>
              {riskBand(riskOf(current)).label}
            </span>
          </div>
          <FlagRows flags={current.flags} good={false} />
          <div className="my-2.5 border-t border-line" />
          <FlagRows flags={current.flags} good />
        </div>
      )}
    </div>
  );
}

function FlagRows({ flags, good }: { flags: NonNullable<SentenceResult['flags']>; good: boolean }) {
  return (
    <div className="space-y-2">
      {FLAGS.filter((f) => f.good === good).map((f) => (
        <div key={f.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="font-medium text-ink">{f.label}</span>
            <span className="font-mono text-[11.5px] text-ink-soft">{Math.round(flags[f.key] * 100)} / 100</span>
          </div>
          <SegBar value={flags[f.key]} color={good ? 'good' : 'violet'} segments={22} label={f.label} compact />
        </div>
      ))}
    </div>
  );
}
