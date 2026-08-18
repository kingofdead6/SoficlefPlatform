import { setRequestLocale } from 'next-intl/server';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="prose max-w-none">
      <h1>Remarks</h1>
      <p>No mock data available for Remarks yet.</p>
    </div>
  );
}
