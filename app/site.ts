export const SITE_URL = 'https://toneradar.vercel.app';
export const SITE_NAME = 'ToneRadar';
export const SITE_TITLE = 'ToneRadar: check the tone of a message before you send';
export const SITE_DESCRIPTION =
  'Free message tone checker. Paste an email, Slack message or text and see how it reads for warmth, clarity and passive aggression before you send it.';
export const SITE_KEYWORDS = ['tone checker', 'message tone checker', 'email tone checker', 'Slack message tone', 'passive aggressive email checker', 'tone analyzer', 'rewrite email tone', 'workplace communication'];

const AUTHOR = {
  '@type': 'Person',
  name: 'Sahil Chalke',
  url: 'https://sahilchalke.com',
  sameAs: ['https://github.com/Sahilll15', 'https://x.com/chalke1015'],
};

export const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: AUTHOR,
  creator: AUTHOR,
};

export function jsonLdScript(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
