import { setRequestLocale } from 'next-intl/server';

import { scopeFilterFor } from '@/domain/auth/authorization';
import { Card, CardBody, EmptyState } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();

  let remarks: Awaited<ReturnType<typeof loadRemarks>> = [];

  try {
    if (user) remarks = await loadRemarks(user.id, scopeFilterFor(user, 'read', 'remark'));
  } catch (error) {
    console.error('Failed to load remarks data:', error);
  }

  if (remarks.length === 0) {
    return (
      <EmptyState
        title="Remarques"
        description="Aucune remarque n'a encore été consignée. Vos observations à la DRH et à la Direction Générale apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      {remarks.map((remark) => (
        <Card key={remark.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-text text-[13px] font-medium">{remark.author.displayName}</p>
            <p className="text-text-dim text-[11px]">
              {formatDate(remark.createdAt, locale as Locale)}
            </p>
          </div>
          <CardBody className="text-text mt-2">{remark.contentFr}</CardBody>
        </Card>
      ))}
    </div>
  );
}

async function loadRemarks(userId: string, scope: ReturnType<typeof scopeFilterFor>) {
  if (scope.kind === 'none') return [];

  const where =
    scope.kind === 'all' ? {} : { authorId: scope.kind === 'self' ? scope.userId : userId };

  return prisma.remark.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { displayName: true } } },
  });
}
