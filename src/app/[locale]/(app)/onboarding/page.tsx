import { getTranslations, setRequestLocale } from 'next-intl/server';

import { EmptyState, KpiTile, SectionTitle, StatusBadge, Timeline } from '@/components/ui';
import type { TimelineEntry } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('shell');

  const user = await getCurrentUser();

  let instance: Awaited<ReturnType<typeof loadInstance>> = null;

  try {
    if (user) instance = await loadInstance(user.id);
  } catch (error) {
    console.error('Failed to load onboarding checklist:', error);
  }

  if (!instance) {
    return <EmptyState title="Checklist 30 jours" description={t('noOnboarding')} />;
  }

  const milestones = instance.template.milestones.map((milestone) => {
    const completion = instance!.taskCompletions.find((task) => task.milestoneId === milestone.id);
    return { milestone, completion };
  });

  const completedCount = milestones.filter(({ completion }) => completion?.completedAt).length;

  const entries: TimelineEntry[] = milestones.map(({ milestone, completion }) => ({
    id: milestone.id,
    marker: milestone.dayLabelFr,
    title: milestone.titleFr,
    detail: milestone.detailFr,
    status: (
      <StatusBadge
        label={completion?.completedAt ? 'Fait' : 'À faire'}
        tone={completion?.completedAt ? 'green' : milestone.isRecommended ? 'gold' : 'neutral'}
      />
    ),
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile value={instance.template.titleFr} label="Parcours" />
        <KpiTile value={`${completedCount} / ${milestones.length}`} label="Étapes complétées" />
        <KpiTile
          value={formatDate(instance.startDate, locale as Locale)}
          label="Début du parcours"
        />
      </div>

      <section>
        <SectionTitle>Jalons</SectionTitle>
        <Timeline entries={entries} label="Checklist 30 jours" />
      </section>
    </div>
  );
}

async function loadInstance(userId: string) {
  return prisma.onboardingInstance.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      template: { include: { milestones: { orderBy: { order: 'asc' } } } },
      taskCompletions: true,
    },
  });
}
