import { setRequestLocale } from 'next-intl/server';

import SignOutButton from '@/components/auth/sign-out-button';
import { EmptyState } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();

  let welcome: Awaited<ReturnType<typeof loadWelcome>> = null;

  try {
    if (user) welcome = await loadWelcome(user.id);
  } catch (error) {
    console.error('Failed to load welcome data:', error);
  }

  if (!welcome) {
    return (
      <EmptyState
        title="Bienvenue"
        description="Votre page d'accueil affichera le message du Directeur Général, les indicateurs clés et votre agenda du premier jour lorsque votre parcours d'intégration sera actif."
      />
    );
  }

  return (
    <div className="prose max-w-none">
      <header className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{welcome.recipientFr}</h1>
          <p className="text-text-muted mt-1 text-[13.5px]">{welcome.recipientRoleFr}</p>

          <p className="mt-2 text-lg">{welcome.greetingFr}</p>

          <p className="text-muted-foreground text-sm">
            Début : {formatDate(welcome.startDate, locale as Locale)}
            {welcome.startDateSourceFr ? ` · ${welcome.startDateSourceFr}` : ''}
          </p>
        </div>

        <div>
          <SignOutButton />
        </div>
      </header>

      <main className="mt-6">
        {welcome.messageFr && (
          <div
            dangerouslySetInnerHTML={{
              __html: welcome.messageFr,
            }}
          />
        )}

        {welcome.stats.length > 0 && (
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {welcome.stats.map((stat) => (
              <div key={stat.id} className="rounded-md border p-4">
                <div className="text-2xl font-bold">{stat.valueFr}</div>
                <div className="text-muted-foreground text-sm">{stat.labelFr}</div>
              </div>
            ))}
          </section>
        )}

        {welcome.agenda.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-medium">Programme</h2>

            <ol className="mt-3 list-decimal">
              {welcome.agenda.map((item) => (
                <li key={item.id}>
                  <div className="font-semibold">{item.titleFr}</div>
                  <div className="text-muted-foreground text-sm">{item.detailFr}</div>
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

async function loadWelcome(userId: string) {
  return prisma.welcome.findUnique({
    where: { userId },
    include: {
      stats: { orderBy: { order: 'asc' } },
      agenda: { orderBy: { order: 'asc' } },
    },
  });
}
