import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Card, CardBody, CardTitle, EmptyState, SectionTitle, Timeline } from '@/components/ui';
import type { TimelineEntry } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';
import { canOpen } from '@/application/navigation/build-navigation';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020). The layout checks too, but a
  // page that trusts its layout has no defence if that layout is ever bypassed.
  const item = navItemByHref('/management');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  let data: Awaited<ReturnType<typeof loadManagement>> | null = null;

  try {
    data = await loadManagement();
  } catch (error) {
    console.error('Failed to load management data:', error);
  }

  if (
    !data ||
    (data.members.length === 0 && data.actions.length === 0 && data.orgChart.length === 0)
  ) {
    return (
      <EmptyState
        title="Équipe encadrement"
        description="L'équipe d'encadrement n'est pas encore disponible."
      />
    );
  }

  const { members, actions, orgChart } = data;

  const timelineEntries: TimelineEntry[] = actions.map((action) => ({
    id: action.id,
    marker: action.dayLabelFr,
    title: action.textFr,
  }));

  const rootNodes = orgChart.filter((node) => !node.parentId);
  const childrenOf = (parentId: string) => orgChart.filter((node) => node.parentId === parentId);

  return (
    <div className="space-y-8">
      {members.length > 0 && (
        <section>
          <SectionTitle>Responsables de structure</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {members.map((member) => (
              <Card key={member.id}>
                <CardTitle>
                  {member.nameFr} · {member.initials}
                </CardTitle>
                <CardBody className="text-text space-y-1">
                  <p className="font-medium">{member.roleFr}</p>
                  <p className="text-text-muted text-[12.5px]">{member.scopeFr}</p>
                  <p className="text-text-muted text-[12px]">{member.tagFr}</p>
                  <p className="mt-2">{member.perimeterFr}</p>
                  <p className="text-red-brand mt-1 text-[12.5px]">
                    Priorité 30 jours : {member.priorityJ30Fr}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {rootNodes.length > 0 && (
        <section>
          <SectionTitle>Organigramme</SectionTitle>
          <div className="space-y-3">
            {rootNodes.map((node) => (
              <Card key={node.id}>
                <CardTitle>{node.labelFr}</CardTitle>
                <CardBody className="text-text">{node.roleFr}</CardBody>
                {childrenOf(node.id).length > 0 && (
                  <ul className="mt-3 space-y-2 border-s-2 border-(--border) ps-4">
                    {childrenOf(node.id).map((child) => (
                      <li key={child.id} className="text-text text-[13px]">
                        <span className="font-medium">{child.labelFr}</span>
                        {' — '}
                        <span className="text-text-muted">{child.roleFr}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {timelineEntries.length > 0 && (
        <section>
          <SectionTitle>Actions recommandées</SectionTitle>
          <Timeline entries={timelineEntries} label="Actions recommandées" />
        </section>
      )}
    </div>
  );
}

async function loadManagement() {
  const [members, actions, orgChart] = await Promise.all([
    prisma.managementMember.findMany({ orderBy: { order: 'asc' } }),
    prisma.managementRecommendedAction.findMany({ orderBy: { order: 'asc' } }),
    prisma.orgChartNode.findMany({ orderBy: { order: 'asc' } }),
  ]);

  return { members, actions, orgChart };
}
