import {
  Inter,
  JetBrains_Mono,
  Noto_Kufi_Arabic,
  Noto_Sans_Arabic,
  Playfair_Display,
} from 'next/font/google';

/**
 * Font selection is bound to the locale, not chosen per component (ADR-018).
 *
 * Playfair Display carries no Arabic glyphs, so an Arabic page would silently fall back
 * to a system serif and lose the identity. Arabic therefore gets Noto Kufi Arabic for
 * display and Noto Sans Arabic for UI. Faces are self-hosted by `next/font`, so nothing
 * is fetched from a third party at runtime — which also matters if SOFICLEF deploys
 * on-premise behind a restricted network (OQ-15).
 */

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  weight: ['500', '700'],
  variable: '--font-noto-kufi',
  display: 'swap',
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-noto-sans-arabic',
  display: 'swap',
});

/** Every family is loaded on every page so a locale switch never waits for a font. */
export const fontVariables = [
  playfair.variable,
  inter.variable,
  jetbrainsMono.variable,
  notoKufiArabic.variable,
  notoSansArabic.variable,
].join(' ');
