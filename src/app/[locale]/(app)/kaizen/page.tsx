import { setRequestLocale } from 'next-intl/server';

import { ModulePlaceholder } from '@/components/shell/page-shell';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ModulePlaceholder href="/kaizen" />;
}
