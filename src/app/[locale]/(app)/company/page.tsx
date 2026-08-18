import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let payload: unknown = { message: 'No company data available' };

  try {
    const record = await prisma.seedContent.findUnique({
      where: { domain: 'company' },
    });

    if (record) {
      payload = record.data;
    }
  } catch (error) {
    console.error('Failed to load company data:', error);
    payload = { message: 'No company data available' };
  }

  return (
    <div className="prose max-w-none">
      <h1>Company</h1>
      <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}