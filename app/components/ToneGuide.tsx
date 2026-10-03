import { AXES, AXIS_KEYS, FLAGS, RECIPIENTS, RECIPIENT_LABEL, TIER_HEADLINE, WEIGHTS, targetFor, type AxisDef, type Recipient } from '../../lib/tone';

const POLARITY_NOTE = {
  good: 'Higher is better.',
  bad: 'Lower is better.',
  target: 'Neither end is best. The right level depends on who the message is for.',
} as const;

// Show a 0..1 target as the nearest word on the axis's own five step scale.
const nearestLevel = (axis: AxisDef, target: number) => axis.criteria[Math.round(target * (axis.criteria.length - 1))];

const heaviestAxis = (r: Recipient) => AXIS_KEYS.reduce((best, k) => (WEIGHTS[r][k] > WEIGHTS[r][best] ? k : best), AXIS_KEYS[0]);

export function ToneGuide() {
  const targetAxes = AXES.filter((a) => a.polarity === 'target');
  return (
    <section aria-labelledby="guide-title" className="card mt-16 p-5 sm:p-8">
      <h2 id="guide-title" className="font-display text-[26px] font-semibold tracking-tight">
        What ToneRadar checks
      </h2>
      <p className="mt-2 max-w-[680px] text-[15px] leading-relaxed text-ink-soft">
        The whole message is scored on eight tone axes, and each sentence is checked for five warning signs and two good ones. Jev
        answers every question with a number. The explanations on the page, including this one, are written by hand.
      </p>

      <h3 className="mt-8 font-display text-[19px] font-semibold tracking-tight">The eight tone axes</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {AXES.map((a) => (
          <div key={a.key} className="rounded-[16px] border border-line bg-panel px-4 py-3.5">
            <dt className="font-semibold text-ink">{a.label}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              {a.instructions} The scale runs from &quot;{a.criteria[0]}&quot; to &quot;{a.criteria[a.criteria.length - 1]}&quot;.{' '}
              {POLARITY_NOTE[a.polarity]}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 font-display text-[19px] font-semibold tracking-tight">Who it is for changes the target</h3>
      <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-ink-soft">
        {targetAxes.map((a) => a.label).join(' and ')} have no right answer on their own, so ToneRadar compares them with a target for
        the person you picked. Each axis also counts for more or less depending on the recipient.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[14px]">
          <thead className="text-[12px] uppercase tracking-[0.12em] text-ink-faint">
            <tr>
              <th scope="col" className="py-2 pr-4 font-semibold">Recipient</th>
              {targetAxes.map((a) => (
                <th key={a.key} scope="col" className="py-2 pr-4 font-semibold">
                  Target {a.label.toLowerCase()}
                </th>
              ))}
              <th scope="col" className="py-2 font-semibold">Counts most</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            {RECIPIENTS.map((r) => (
              <tr key={r} className="border-t border-line">
                <th scope="row" className="py-2 pr-4 font-semibold text-ink">{RECIPIENT_LABEL[r]}</th>
                {targetAxes.map((a) => (
                  <td key={a.key} className="py-2 pr-4">{nearestLevel(a, targetFor(a.key, r) ?? 0.5)}</td>
                ))}
                <td className="py-2">{AXES.find((a) => a.key === heaviestAxis(r))!.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 font-display text-[19px] font-semibold tracking-tight">Sentence by sentence</h3>
      <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-ink-soft">
        {FLAGS.filter((f) => !f.good).map((f) => (
          <li key={f.key}>
            <span className="font-semibold text-ink">{f.label}.</span> {f.tip}
          </li>
        ))}
        <li>
          <span className="font-semibold text-ink">Good signs.</span> Each sentence is also checked for whether it{' '}
          {FLAGS.filter((f) => f.good)
            .map((f) => f.label.toLowerCase())
            .join(' and whether it ')}
          .
        </li>
      </ul>

      <h3 className="mt-8 font-display text-[19px] font-semibold tracking-tight">How the score out of 100 works</h3>
      <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-ink-soft">
        72% of the score comes from the eight axes, weighted for the recipient. The other 28% comes from the two riskiest sentences, so
        one sharp line can pull down an otherwise friendly message. 78 and up reads as &quot;{TIER_HEADLINE.good}&quot;, 63 to 77 as
        &quot;{TIER_HEADLINE.ok}&quot;, 48 to 62 as &quot;{TIER_HEADLINE.risky}&quot;, and anything lower as &quot;{TIER_HEADLINE.bad}&quot;.
      </p>
    </section>
  );
}
