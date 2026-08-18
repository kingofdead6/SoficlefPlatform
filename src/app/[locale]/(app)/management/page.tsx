import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Read the extracted seed payload from the database. Falls back to an empty
  // object when the row is missing so the page still renders.
  const record = await prisma.seedContent.findUnique({ where: { domain: 'management-team' } });
  const payload = record ? (record.data as any) : { message: 'No management data available' };

  return (
    <div className="prose max-w-none">
      <h1>Management Team</h1>
      <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}
