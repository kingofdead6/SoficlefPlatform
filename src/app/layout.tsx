import type { Metadata } from 'next';

import { fontVariables } from '@/lib/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'SOFICLEF · Plateforme Compétences & Emplois',
  description:
    "Plateforme SOFICLEF de gestion des structures, emplois, compétences et parcours d'intégration.",
};

/**
 * Root layout. Locale-aware `lang` and `dir` arrive in Part 4 with the `[locale]`
 * segment; until then the shell is French, which is the platform's default locale.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
