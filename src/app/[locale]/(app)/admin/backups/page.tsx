import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Backups (`/admin/backups`).
 *
 * The platform does not take backups, and this page says so rather than showing an empty
 * schedule that implies it might. Backups belong to whoever runs the database: a
 * schedule configured here would be a promise the application cannot keep, and the worst
 * possible failure is a restore that turns out never to have been taken.
 *
 * What it can honestly show is what would have to be restored.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/backups');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [users, assignments, journeys, auditRows, documents] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.assignment.count().catch(() => 0),
    prisma.onboardingInstance.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.document.count().catch(() => 0),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="La plateforme ne sauvegarde rien elle-même. Cet écran dit ce qu’il y aurait à restaurer, et où la sauvegarde doit être organisée.">
          Sauvegardes
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={users} label="Comptes" />
          <KpiTile value={assignments} label="Affectations" />
          <KpiTile value={journeys} label="Parcours" />
          <KpiTile value={auditRows} label="Entrées d’audit" />
        </div>
      </section>

      <Card accent="red">
        <CardTitle>Aucune sauvegarde applicative</CardTitle>
        <CardBody className="mt-1">
          Programmer une sauvegarde depuis cet écran serait une promesse que l’application
          ne peut pas tenir : elle n’a pas la main sur le serveur de base de données, et la
          pire panne possible est une restauration dont on découvre qu’elle n’a jamais été
          prise. La sauvegarde relève de l’hébergement de la base — chez un hébergeur
          managé, elle est le plus souvent déjà en place et se vérifie dans sa console.
        </CardBody>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Ce qu’il faut sauvegarder</CardTitle>
          <CardBody className="mt-1">
            La base PostgreSQL entière. Tout est dedans : comptes, affectations, parcours,
            réponses aux enquêtes et journal d’audit. Aucun état n’est conservé ailleurs —
            pas de fichiers sur disque tant que le stockage n’est pas raccordé.
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Ce qu’une restauration défait</CardTitle>
          <CardBody className="mt-1">
            Le journal d’audit est en écriture seule dans l’application, mais une
            restauration le ramène à son état antérieur comme le reste : les événements
            postérieurs au point de restauration disparaissent. C’est la raison pour
            laquelle la fréquence de sauvegarde est une décision de conformité et pas
            seulement d’exploitation.
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody>
          Documents référencés : {documents}. Leur contenu n’est pas stocké par la
          plateforme tant que le connecteur de stockage n’est pas configuré ; seule leur
          fiche et les acceptations le sont.
        </CardBody>
      </Card>
    </div>
  );
}
