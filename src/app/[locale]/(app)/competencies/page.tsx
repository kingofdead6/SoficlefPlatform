import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const record = await prisma.seedContent.findUnique({ where: { domain: 'values' } });
  const payload = record ? (record.data as any) : { message: 'No values data available' };

  return (
    <div className="prose max-w-none">
      <h1>Competencies (mocked from values)</h1>
      <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}
