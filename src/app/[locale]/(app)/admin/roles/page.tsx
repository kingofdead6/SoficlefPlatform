import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRoles } from '@/application/admin/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  KpiTile,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { ACTIONS, RESOURCES, ROLE_PERMISSIONS, permission } from '@/domain/auth/permissions';
import { ROLE_CODES, ROLES } from '@/domain/auth/roles';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Roles and the permission matrix (`/admin/roles`).
 *
 * The matrix is rendered from `ROLE_PERMISSIONS` itself rather than from the database, so
 * what an administrator reads here is the table `can()` consults on every request. A screen
 * describing permissions from a second source can be wrong and still look right.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/roles');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const roles = await listRoles(user).catch(() => []);

  /*
   * One row per resource, one column per role. Actions are summarised as initials rather
   * than given a column each: resources x roles x nine actions is unreadable, and the
   * question this page answers is "who can touch what".
   */
  const matrix = RESOURCES.map((resource) => ({
    resource,
    byRole: Object.fromEntries(
      ROLE_CODES.map((role) => [
        role,
        ACTIONS.filter((action) => ROLE_PERMISSIONS[role].includes(permission(resource, action))),
      ]),
    ) as Record<string, readonly string[]>,
  }));

  const columns: Column<(typeof matrix)[number]>[] = [
    { key: 'resource', header: 'Ressource', render: (row) => row.resource },
    ...ROLE_CODES.map((role) => ({
      key: role,
      header: role,
      render: (row: (typeof matrix)[number]) => {
        const actions = row.byRole[role];
        if (actions.length === 0) return <span className="text-text-dim">—</span>;
        return (
          <span className="text-text-muted font-mono text-[11px]">
            {actions.map((action) => action.slice(0, 3)).join(' ')}
          </span>
        );
      },
    })),
  ];

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="La matrice lue par le moteur d’autorisation lui-même : ce tableau est la table que can() consulte à chaque requête, pas une description tenue à côté.">
          Rôles &amp; permissions
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={ROLE_CODES.length} label="Rôles" />
          <KpiTile value={RESOURCES.length} label="Ressources" />
          <KpiTile value={ACTIONS.length} label="Actions" />
          <KpiTile value={roles.length} label="Rôles en base" />
        </div>
      </section>

      <section>
        <SectionTitle level={2}>Les quatre rôles</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLE_CODES.map((code) => (
            <Card key={code}>
              <CardTitle>{ROLES[code].nameFr}</CardTitle>
              <CardBody className="mt-1">{ROLES[code].descriptionFr}</CardBody>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge label={code} tone="neutral" />
                <StatusBadge label={`Portée : ${ROLES[code].naturalScope}`} tone="neutral" />
                <StatusBadge label={`${ROLE_PERMISSIONS[code].length} permissions`} tone="neutral" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          level={2}
          lead="Trois lettres par action : rea(d), cre(ate), upd(ate), del(ete), val(idate)…"
        >
          Matrice
        </SectionTitle>
        <DataTable
          columns={columns}
          rows={matrix}
          getRowKey={(row) => row.resource}
          emptyLabel="Aucune ressource."
          caption="Matrice des permissions"
        />
      </section>

      <Card>
        <CardTitle>Rôles personnalisés</CardTitle>
        <CardBody className="mt-1">
          Non proposés. Les rôles sont déclarés dans le code parce que chaque permission y
          est vérifiée à la compilation ; un rôle créé à l’écran ne peut être qu’une liste de
          chaînes, où une faute de frappe devient un droit silencieusement absent. Ajouter un
          rôle est une modification du code, relue comme telle.
        </CardBody>
      </Card>
    </div>
  );
}
