import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { PositionTree, buildPositionForest } from '@/components/me/position-tree';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { getVisibleTree } from '@/infrastructure/repositories/position-repository';

/**
 * The manager's org chart (`/app/manager/organigram`).
 *
 * `getVisibleTree` already gives a manager their whole sub-tree without a depth limit —
 * their perimeter *is* what hangs beneath them, while a collaborator gets a small window.
 *
 * What this page adds is context the chart alone does not carry: who in it is currently
 * mid-integration and how far along, and which seats are empty. Both are listed beside the
 * tree rather than badged onto its nodes, so the tree component stays the same one the
 * collaborator renders.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/organigram');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [nodes, recruits] = await Promise.all([
    getVisibleTree(user).catch(() => []),
    listRecruits(user).catch(() => []),
  ]);

  const forest = buildPositionForest(nodes);

  /*
   * Who in the chart is mid-integration, listed beside it rather than badged onto the
   * nodes. The tree component is shared with the recruit's own view, and giving it an
   * onboarding-aware prop would put a manager's concern into a component a collaborator
   * also renders.
   */
  const holderIds = new Set(nodes.map((node) => node.holder?.id).filter(Boolean));
  const onboarding = recruits.filter((recruit) => holderIds.has(recruit.userId));
  const vacant = nodes.filter((node) => node.isVacant);

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Votre périmètre : votre poste, ceux qui en dépendent, et la ligne hiérarchique au-dessus de vous. Les autres branches ne vous sont pas montrées.">
          Mon organigramme
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={nodes.length} label="Postes visibles" />
          <KpiTile
            value={nodes.filter((node) => node.holder !== null).length}
            label="Occupés"
          />
          <KpiTile
            value={vacant.length}
            label="Vacants"
            hint={vacant.length > 0 ? 'À pourvoir' : undefined}
          />
          <KpiTile value={recruits.length} label="En intégration" />
        </div>
      </section>

      {forest.length === 0 ? (
        <Card>
          <CardBody>
            Aucun poste visible. Votre organigramme se construit à partir du poste que vous
            occupez : sans affectation, il n’y a pas de point de départ.
          </CardBody>
        </Card>
      ) : (
        <PositionTree nodes={forest} />
      )}

      {onboarding.length > 0 ? (
        <Card>
          <CardTitle>En cours d’intégration</CardTitle>
          <ul className="mt-2 space-y-1">
            {onboarding.map((recruit) => (
              <li key={recruit.userId} className="text-[12px]">
                <Link
                  href={`/app/manager/recruits/${recruit.userId}`}
                  className="text-red-strong font-medium"
                >
                  {recruit.displayName}
                </Link>
                <span className="text-text-muted">
                  {' '}
                  — {recruit.positionFr ?? 'poste non renseigné'} · {recruit.percent}% (jour{' '}
                  {recruit.dayNumber})
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {vacant.length > 0 ? (
        <Card accent="red">
          <CardTitle>Postes vacants dans votre périmètre</CardTitle>
          <ul className="mt-2 space-y-1">
            {vacant.map((node) => (
              <li key={node.id} className="text-text-muted text-[12px]">
                {node.titleFr}
                {node.occupancyFr ? ` — ${node.occupancyFr}` : ''}
              </li>
            ))}
          </ul>
          <CardBody className="mt-2">
            Le recrutement se demande aux RH : vous ne pouvez pas créer de compte, et un
            poste vacant n’est pas un compte manquant.
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
