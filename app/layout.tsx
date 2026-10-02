import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--nf-display' });
const body = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--nf-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--nf-mono' });

export const metadata: Metadata = {
  title: 'ToneRadar',
  description: 'Paste a message before you send it and see how it will land.',
};

export const viewport: Viewport = { themeColor: '#efedf8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
