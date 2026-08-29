import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Personal-data handling (`/admin/gdpr`).
 *
 * An inventory rather than a control panel. Erasure and portability are not offered as
 * buttons because they are not one-click operations here: an account is referenced by
 * assignments, journeys, survey responses and the audit trail, and each of those answers
 * "delete" differently — some must go, some must be anonymised, and the audit trail must
 * survive precisely so that the erasure itself is provable.
 *
 * Naming what is held, and what each category would require, is the useful half of that
 * work and the half that can be done honestly today.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/gdpr');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [users, responses, acknowledgements, personalFiles, auditRows, assessments] =
    await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.surveyResponse.count().catch(() => 0),
      prisma.documentAcknowledgement.count().catch(() => 0),
      prisma.personalFile.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
      prisma.assessment.count().catch(() => 0),
    ]);

  const CATEGORIES = [
    {
      titleFr: 'Identité et coordonnées',
      countFr: `${users} compte(s)`,
      holdsFr: 'Nom, e-mail professionnel, téléphone, date d’embauche, rattachement.',
      erasureFr:
        'Anonymisation plutôt que suppression : le compte est référencé par des affectations et des parcours dont l’historique doit rester cohérent.',
    },
    {
      titleFr: 'Réponses aux enquêtes',
      countFr: `${responses} réponse(s)`,
      holdsFr:
        'Les réponses individuelles, déjà inaccessibles à tous — y compris aux RH et au responsable.',
      erasureFr:
        'Suppression possible sans effet de bord : seuls les agrégats sont exploités, et ils se recalculent.',
    },
    {
      titleFr: 'Évaluations et compétences',
      countFr: `${assessments} évaluation(s) de compétence`,
      holdsFr: 'Niveaux évalués, auteur de l’évaluation, commentaires.',
      erasureFr:
        'À arbitrer : ce sont aussi des actes de gestion, dont la conservation peut être requise par le droit du travail.',
    },
    {
      titleFr: 'Acceptations de documents',
      countFr: `${acknowledgements} acceptation(s)`,
      holdsFr: 'Qui a accepté quel document, et quand.',
      erasureFr:
        'Conservation probable : c’est la preuve qu’un règlement intérieur a été porté à la connaissance de la personne.',
    },
    {
      titleFr: 'Pièces administratives',
      countFr: `${personalFiles} pièce(s) suivie(s)`,
      holdsFr:
        'Aujourd’hui uniquement l’état (demandée, transmise, validée) : aucun fichier n’est stocké tant que le connecteur ne l’est pas.',
      erasureFr: 'Suppression simple aujourd’hui ; à revoir quand les fichiers seront stockés.',
    },
    {
      titleFr: 'Journal d’audit',
      countFr: `${auditRows} entrée(s)`,
      holdsFr: 'Auteur, action, horodatage, adresse IP.',
      erasureFr:
        'Doit survivre : c’est ce qui rend une suppression prouvable. L’auteur y est écrit tel qu’il était au moment des faits, ce qui limite déjà la donnée conservée.',
    },
  ];

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Ce que la plateforme détient sur les personnes, catégorie par catégorie, et ce qu’une demande d’effacement impliquerait pour chacune.">
          Données personnelles
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={users} label="Personnes concernées" />
          <KpiTile value={CATEGORIES.length} label="Catégories de données" />
          <KpiTile value={responses} label="Réponses d’enquête" />
          <KpiTile value={auditRows} label="Entrées d’audit" />
        </div>
      </section>

      <ul className="space-y-3">
        {CATEGORIES.map((category) => (
          <li key={category.titleFr}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle>{category.titleFr}</CardTitle>
                <span className="text-text-dim shrink-0 font-mono text-[11px]">
                  {category.countFr}
                </span>
              </div>
              <CardBody className="mt-1">{category.holdsFr}</CardBody>
              <CardBody className="mt-1">
                <span className="text-text-dim">Effacement : </span>
                {category.erasureFr}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card accent="red">
          <CardTitle>Demandes d’effacement et de portabilité</CardTitle>
          <CardBody className="mt-1">
            Non automatisées. Chaque catégorie ci-dessus répond différemment à
            « supprimer », et un bouton unique appliquerait la mauvaise règle à cinq d’entre
            elles. Les arbitrages — ce qui s’anonymise, ce qui se conserve, et pour combien
            de temps — sont à fixer avec le responsable du traitement avant d’être codés.
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Durées de conservation</CardTitle>
          <CardBody className="mt-1">
            Aucune purge automatique n’est en place : rien n’est effacé sans décision. C’est
            le comportement prudent par défaut, mais il n’est pas conforme indéfiniment —
            une donnée conservée sans durée définie est une donnée conservée trop longtemps.
          </CardBody>
          <Link href="/admin/settings" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
            Paramètres →
          </Link>
        </Card>
      </div>

      <Card>
        <CardTitle>Registre des consentements</CardTitle>
        <CardBody className="mt-1">
          La plateforme ne recueille pas de consentement : le traitement repose sur la
          relation de travail, pas sur un consentement révocable. Les acceptations de
          documents en sont distinctes — elles prouvent une prise de connaissance, elles
          n’autorisent pas un traitement.
        </CardBody>
      </Card>
    </div>
  );
}
