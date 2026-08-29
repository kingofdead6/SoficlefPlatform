import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  CardTitle,
  KpiTile,
  SectionTitle,
  StatusBadge,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { getVisibleTree } from '@/infrastructure/repositories/position-repository';

/**
 * The team as people rather than as a chart (`/app/manager/team`).
 *
 * The org chart answers "how does this fit together"; this page answers "who is in my
 * team and how do I reach them". Same rows, different question — which is why it is a
 * separate page rather than a tab.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/team');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const nodes = await getVisibleTree(user).catch(() => []);

  const filled = nodes.filter((node) => node.holder !== null);
  const vacant = nodes.filter((node) => node.isVacant);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les personnes de votre périmètre, leurs postes, et les sièges encore vides.">
          Mon équipe
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={filled.length} label="Personnes" />
          <KpiTile value={vacant.length} label="Postes vacants" />
          <KpiTile value={nodes.length} label="Postes au total" />
        </div>
      </section>

      <section>
        <SectionTitle level={2}>Membres</SectionTitle>

        {filled.length === 0 ? (
          <Card>
            <CardBody>
              Aucune personne dans votre périmètre. Les collaborateurs y apparaissent dès que
              les RH les affectent à un poste de votre structure.
            </CardBody>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filled.map((node) => (
              <li key={node.id}>
                <Card>
                  <CardTitle>{node.holder?.displayName}</CardTitle>
                  <CardBody className="mt-0.5">{node.titleFr}</CardBody>
                  <Link
                    href={`/app/manager/recruits/${node.holder?.id ?? ''}`}
                    className="text-red-strong mt-2 inline-block text-[12px] font-medium"
                  >
                    Ouvrir le dossier →
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle level={2} lead="Un siège vide est une charge répartie sur les autres : c’est la raison de le suivre ici.">
          Postes à pourvoir
        </SectionTitle>

        {vacant.length === 0 ? (
          <Card>
            <CardBody>Tous les postes de votre périmètre sont pourvus.</CardBody>
          </Card>
        ) : (
          <ul className="space-y-2">
            {vacant.map((node) => (
              <li key={node.id}>
                <Card accent="red">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-text text-[13px] font-medium">{node.titleFr}</span>
                    <StatusBadge label={node.occupancyFr ?? 'Vacant'} tone="red" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardTitle>Fiches de poste</CardTitle>
        <CardBody className="mt-1">
          Le contenu des fiches — mission, compétences attendues, équipement — est administré
          par les RH et la direction Compétences & Emplois. Vous les consultez depuis le
          référentiel ; les modifier depuis ici reviendrait à redéfinir un poste pour toute
          l’entreprise depuis l’écran d’une seule équipe.
        </CardBody>
        <Link href="/job-description" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
          Consulter une fiche de poste →
        </Link>
      </Card>
    </div>
  );
}
