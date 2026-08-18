import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TranslatableText } from '@/components/i18n/translation-pending';
import { Card, CardBody, CardTitle, EmptyState, SectionTitle, StatusBadge } from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { prisma } from '@/infrastructure/db/client';

const OCCUPANCY_TONE: Record<string, StatusTone> = {
  VACANT: 'red',
  TO_FILL: 'gold',
  OCCUPIED: 'green',
};

const OCCUPANCY_KEY: Record<string, 'vacant' | 'toFill' | 'occupied'> = {
  VACANT: 'vacant',
  TO_FILL: 'toFill',
  OCCUPIED: 'occupied',
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('status');

  let units: Awaited<ReturnType<typeof loadUnits>> = [];

  try {
    units = await loadUnits();
  } catch (error) {
    console.error('Failed to load organization data:', error);
  }

  const direction = units.find((unit) => unit.type === 'DIRECTION');
  const structures = units.filter((unit) => unit.type === 'STRUCTURE');
  const productionUnits = units.filter((unit) => unit.type === 'UNITE_PRODUCTION');
  const cells = units.filter((unit) => unit.type === 'CELLULE');

  if (units.length === 0) {
    return (
      <EmptyState
        title="Structures & Organisation"
        description="L'organigramme n'est pas encore disponible."
      />
    );
  }

  return (
    <div className="space-y-8">
      {direction && (
        <Card accent="gold">
          <CardTitle>{direction.code}</CardTitle>
          <CardBody className="text-text text-[13.5px] font-medium">
            <TranslatableText
              field={{ fr: direction.nameFr, ar: direction.nameAr, en: direction.nameEn }}
              locale={locale as Locale}
            />
          </CardBody>
        </Card>
      )}

      {structures.length > 0 && (
        <section>
          <SectionTitle>Structures</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {structures.map((structure) => (
              <Card key={structure.id}>
                <CardTitle>
                  {structure.icon ? `${structure.icon} ` : ''}
                  <TranslatableText
                    field={{ fr: structure.nameFr, ar: structure.nameAr, en: structure.nameEn }}
                    locale={locale as Locale}
                  />
                </CardTitle>
                <CardBody className="text-text space-y-2">
                  {structure.descriptionFr && <p>{structure.descriptionFr}</p>}
                  {structure.headOccupancy && (
                    <StatusBadge
                      label={`${t(OCCUPANCY_KEY[structure.headOccupancy])}${structure.headLabelFr ? ` · ${structure.headLabelFr}` : ''}`}
                      tone={OCCUPANCY_TONE[structure.headOccupancy]}
                    />
                  )}
                  {structure.criticalNoteFr && (
                    <p className="text-red text-[12.5px] font-medium">{structure.criticalNoteFr}</p>
                  )}
                  {productionUnits
                    .filter((unit) => unit.parentId === structure.id)
                    .map((unit) => (
                      <div key={unit.id} className="mt-2 border-s-2 border-(--border) ps-3">
                        <p className="text-text text-[12.5px] font-medium">{unit.nameFr}</p>
                        {unit.descriptionFr && (
                          <p className="text-text-muted text-[12px]">{unit.descriptionFr}</p>
                        )}
                      </div>
                    ))}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {cells.length > 0 && (
        <section>
          <SectionTitle>Cellules fonctionnelles</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cells.map((cell) => (
              <Card key={cell.id}>
                <CardTitle>
                  {cell.icon ? `${cell.icon} ` : ''}
                  {cell.nameFr}
                </CardTitle>
                <CardBody className="text-text space-y-1">
                  {cell.descriptionFr && <p>{cell.descriptionFr}</p>}
                  {cell.staffingFr && (
                    <p className="text-text-muted text-[12px]">{cell.staffingFr}</p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function loadUnits() {
  return prisma.organizationUnit.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}
