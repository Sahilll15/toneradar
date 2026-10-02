const FILL = {
  good: 'bg-good',
  bad: 'bg-bad',
  violet: 'bg-violet',
  sky: 'bg-sky',
} as const;

export function SegBar({
  value,
  color,
  segments = 24,
  label,
  compact = false,
}: {
  value: number;
  color: keyof typeof FILL;
  segments?: number;
  label?: string;
  compact?: boolean;
}) {
  const on = Math.round(Math.min(1, Math.max(0, value)) * segments);
  return (
    <div
      className={`flex gap-[2px] ${compact ? 'h-[12px]' : 'h-[18px]'}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`flex-1 rounded-[2px] transition-colors duration-300 ${i < on ? FILL[color] : 'bg-seg-off'}`}
          style={{ transitionDelay: `${i * 12}ms` }}
        />
      ))}
    </div>
  );
}
