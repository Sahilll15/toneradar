'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AXES, AXIS_KEYS, targetFor, type AxisKey, type AxisValues, type Recipient } from '../../lib/tone';
import { SegBar } from './SegBar';

export type Series = { name: string; values: AxisValues; color: string; dashed?: boolean };

const W = 520;
const H = 460;
const CX = W / 2;
const CY = H / 2;
const R = 158;
const RINGS = [0.25, 0.5, 0.75, 1];
const N = AXIS_KEYS.length;

const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
const pt = (i: number, r: number) => [CX + Math.cos(angle(i)) * r, CY + Math.sin(angle(i)) * r] as const;
const poly = (vals: number[]) => vals.map((v, i) => pt(i, Math.max(0.04, v) * R).join(',')).join(' ');

const ZERO = Object.fromEntries(AXIS_KEYS.map((k) => [k, 0])) as AxisValues;

function useTween(target: AxisValues | null, duration = 900) {
  const [shown, setShown] = useState<AxisValues>(ZERO);
  const from = useRef<AxisValues>(ZERO);
  const shownRef = useRef<AxisValues>(ZERO);

  useEffect(() => {
    const to = target ?? ZERO;
    from.current = shownRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const next = Object.fromEntries(
        AXIS_KEYS.map((k) => [k, from.current[k] + (to[k] - from.current[k]) * e]),
      ) as AxisValues;
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return shown;
}

function SeriesShape({ s, gradId, index }: { s: Series; gradId: string; index: number }) {
  const values = useTween(s.values, 900 + index * 250);
  const vals = AXIS_KEYS.map((k) => values[k]);
  return (
    <g>
      <polygon
        points={poly(vals)}
        fill={index === 0 ? `url(#${gradId})` : s.color}
        fillOpacity={index === 0 ? 1 : 0.1}
        stroke={s.color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeDasharray={s.dashed ? '6 4' : undefined}
      />
      {vals.map((v, i) => {
        const [x, y] = pt(i, Math.max(0.04, v) * R);
        return <circle key={i} cx={x} cy={y} r={4} fill="#fff" stroke={s.color} strokeWidth={2} />;
      })}
    </g>
  );
}

export function Radar({
  series,
  recipient,
  idle = false,
}: {
  series: Series[];
  recipient: Recipient;
  idle?: boolean;
}) {
  const gradId = useId().replace(/:/g, '');
  const [open, setOpen] = useState<AxisKey | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const openIdx = open ? AXIS_KEYS.indexOf(open) : -1;
  const openDef = open ? AXES[openIdx] : null;

  return (
    <div ref={wrap} className="relative mx-auto w-full max-w-[520px] select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Tone radar chart">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6a5cf2" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#6a5cf2" stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id={`${gradId}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6a5cf2" stopOpacity="0" />
            <stop offset="100%" stopColor="#6a5cf2" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {RINGS.map((r) => (
          <polygon
            key={r}
            points={poly(Array(N).fill(r))}
            fill={r === 1 ? '#f6f5fc' : 'none'}
            stroke="#b9b3da"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        {AXIS_KEYS.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#cfcae6" strokeDasharray="3 4" />;
        })}
        <polygon points={poly(Array(N).fill(0.16))} fill="#fff" stroke="#8d84d9" strokeWidth={1.4} />

        {idle && (
          <g className="anim-sweep" style={{ transformOrigin: `${CX}px ${CY}px` }}>
            <path d={`M${CX},${CY} L${CX + R},${CY} A${R},${R} 0 0,0 ${CX + R * Math.SQRT1_2},${CY - R * Math.SQRT1_2} Z`} fill={`url(#${gradId}-sweep)`} />
          </g>
        )}

        {AXIS_KEYS.map((k, i) => {
          const t = targetFor(k, recipient);
          if (t === null || idle) return null;
          const [x, y] = pt(i, t * R);
          return <circle key={k} cx={x} cy={y} r={7} fill="none" stroke="#3f9d63" strokeWidth={1.5} strokeDasharray="2 2" />;
        })}

        {!idle && series.map((s, i) => <SeriesShape key={s.name} s={s} gradId={gradId} index={i} />)}

        {AXIS_KEYS.map((k, i) => {
          const [x, y] = pt(i, R);
          return (
            <circle
              key={k}
              cx={x}
              cy={y}
              r={6}
              fill="#fff"
              stroke={open === k ? '#4f40d6' : '#8d84d9'}
              strokeWidth={open === k ? 2.5 : 1.5}
            />
          );
        })}
      </svg>

      {AXES.map((a, i) => {
        const [x, y] = pt(i, R + 30);
        const cos = Math.cos(angle(i));
        const align = Math.abs(cos) < 0.2 ? '-translate-x-1/2' : cos > 0 ? '' : '-translate-x-full';
        return (
          <button
            key={a.key}
            type="button"
            disabled={idle}
            onClick={() => setOpen(open === a.key ? null : a.key)}
            aria-expanded={open === a.key}
            className={`absolute -translate-y-1/2 ${align} rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors sm:text-[11px] ${
              open === a.key ? 'bg-violet-soft text-violet-deep' : 'text-ink-faint hover:text-ink'
            } disabled:cursor-default disabled:hover:text-ink-faint`}
            style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
          >
            {a.label}
          </button>
        );
      })}

      {openDef && (
        <div
          role="dialog"
          aria-label={`${openDef.label} details`}
          className="pop anim-pop absolute left-1/2 top-1/2 z-20 w-[min(300px,calc(100%-16px))] -translate-x-1/2 -translate-y-1/2 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{openDef.label}</p>
            {targetFor(openDef.key, recipient) !== null && (
              <span className="rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold text-good">
                ideal {Math.round((targetFor(openDef.key, recipient) ?? 0) * 100)}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {series.map((s) => {
              const v = s.values[openDef.key];
              const level = Math.round(v * (openDef.criteria.length - 1));
              return (
                <div key={s.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium text-ink">
                      <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-mono text-[12px] text-ink-soft">{Math.round(v * 100)} / 100</span>
                  </div>
                  <SegBar value={v} color={openDef.polarity === 'bad' ? 'bad' : openDef.polarity === 'good' ? 'good' : 'violet'} />
                  <p className="mt-1.5 text-[12px] text-ink-soft">
                    Level {level + 1} of {openDef.criteria.length}, {openDef.criteria[level]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
