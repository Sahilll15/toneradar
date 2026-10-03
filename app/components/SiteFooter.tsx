import { REPO_URL, TOOLS } from '../site';

const link = 'font-medium text-violet-deep underline-offset-4 hover:underline';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line pt-8 text-[13px] leading-relaxed text-ink-soft">
      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <p>ToneRadar asks Jev typed questions and turns the numbers into this page.</p>
          <p>
            What you paste is sent to the Jev model from TypeSafe to be scored. This app does not save it. It only keeps a short-lived
            request count per IP address to rate limit the free checks.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Built by{' '}
              <a href="https://sahilchalke.com" className={link}>
                Sahil Chalke
              </a>
            </span>
            <a href={REPO_URL} className={link}>
              Source code on GitHub
            </a>
          </p>
        </div>
        <nav aria-labelledby="more-tools">
          <h2 id="more-tools" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            More tools
          </h2>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <li key={t.url}>
                <a href={t.url} className={link}>
                  {t.name}
                </a>
                <span className="text-ink-faint">, {t.blurb}</span>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
