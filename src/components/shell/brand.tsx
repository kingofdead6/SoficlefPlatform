import { getTranslations } from 'next-intl/server';

/**
 * The SOFICLEF logotype.
 *
 * It does **not** mirror in Arabic: layouts mirror, brand marks do not (CDC v0.1 §12.1).
 * The wordmark is set LTR explicitly so the letters keep their order inside an RTL
 * document.
 */
export async function Brand({ subtitle }: { subtitle?: string }) {
  const t = await getTranslations('app');

  return (
    <div>
      <div dir="ltr" className="font-display text-gold text-xl font-bold tracking-[0.04em]">
        {t('name')}
      </div>
      <div className="text-text-dim mt-0.5 text-[9.5px] tracking-[0.14em] uppercase">
        {subtitle ?? t('tagline')}
      </div>
    </div>
  );
}
