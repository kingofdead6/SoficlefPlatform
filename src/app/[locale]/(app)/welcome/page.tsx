import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/infrastructure/db/client';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import SignOutButton from '@/components/auth/sign-out-button';

type Stat = {
  id: string;
  valueFr?: string;
  labelFr?: string;
};

type AgendaItem = {
  id: string;
  titleFr?: string;
  detailFr?: string;
};

type WelcomeData = {
  recipientFr?: string;
  greetingFr?: string;
  startDate?: string;
  messageFr?: string;
  stats?: Stat[];
  agenda?: AgendaItem[];
  signatureFr?: string;
};

type WelcomePayload = {
  data?: WelcomeData;
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);

  const record = await prisma.seedContent.findUnique({ where: { domain: 'welcome' } });
  const welcome = record ? ((record.data as WelcomePayload).data ?? null) : null;

  if (locale === 'fr' && welcome) {
    const user = await getCurrentUser();
    return (
      <div className="prose max-w-none">
        <header className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-semibold">{welcome.recipientFr ?? 'Bienvenue'}</h1>

            {welcome.greetingFr && <p className="mt-2 text-lg">{welcome.greetingFr}</p>}

            {welcome.startDate && (
              <p className="text-sm text-muted-foreground">Début : {welcome.startDate}</p>
            )}
          </div>

          {user && (
            <div>
              <SignOutButton />
            </div>
          )}
        </header>

        <main className="mt-6">
          {welcome.messageFr && (
            <div
              dangerouslySetInnerHTML={{
                __html: welcome.messageFr,
              }}
            />
          )}

          {welcome.stats && welcome.stats.length > 0 && (
            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {welcome.stats.map((stat) => (
                <div
                  key={stat.id}
                  className="rounded-md border p-4"
                >
                  <div className="text-2xl font-bold">
                    {stat.valueFr ?? '—'}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {stat.labelFr ?? ''}
                  </div>
                </div>
              ))}
            </section>
          )}

          {welcome.agenda && welcome.agenda.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-medium">Programme</h2>

              <ol className="mt-3 list-decimal ">
                {welcome.agenda.map((item) => (
                  <li key={item.id}>
                    <div className="font-semibold">
                      {item.titleFr ?? ''}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {item.detailFr ?? ''}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>

        {welcome.signatureFr && (
          <footer className="mt-8">
            <p className="italic">{welcome.signatureFr}</p>
          </footer>
        )}
      </div>
    );
  }

  return (
    <div className="prose max-w-none">
      <h1>Welcome</h1>

      <p>
        Your home page will show the General Manager&apos;s welcome
        message, key indicators and your first-day agenda when the
        Onboarding module is active.
      </p>
    </div>
  );
}