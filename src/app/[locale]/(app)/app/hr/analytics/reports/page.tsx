import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The report builder (`/app/hr/analytics/reports`).
 *
 * The specification asks for Agent 5: a natural-language question answered with a chart
 * and a narrative. That needs a language model, deferred by ADR-003 — so this page says
 * what exists today and what it would take, rather than presenting a prompt box that
 * cannot answer.
 *
 * The exports below are the part that does not need a model, and they are the part HR
 * actually asks for first.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/analytics');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/hr/analytics" className="text-text-muted text-[12px]">
          ← Indicateurs & reporting
        </Link>
        <SectionTitle className="mt-2" lead="Extraire les données, et les questions qu’on aimerait poser en français.">
          Générateur de rapports
        </SectionTitle>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Export des remarques</CardTitle>
          <CardBody className="mt-1">
            Le journal des observations, au format texte, avec sa trace d’export dans le
            journal d’audit — qui a exporté quoi, et quand.
          </CardBody>
          <Link href="/remarks" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
            Ouvrir les remarques →
          </Link>
        </Card>

        <Card>
          <CardTitle>Indicateurs consolidés</CardTitle>
          <CardBody className="mt-1">
            Durée moyenne d’intégration, taux de complétion, satisfaction, turnover et
            postes pourvus par structure, recalculés à chaque affichage.
          </CardBody>
          <Link href="/app/hr/analytics" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
            Voir les indicateurs →
          </Link>
        </Card>
      </section>

      <Card accent="red">
        <CardTitle>Questions en langage naturel</CardTitle>
        <CardBody className="mt-1">
          L’agent 5 du cahier des charges — poser une question en français et recevoir un
          graphique commenté — suppose un fournisseur de modèle de langage, écarté de cette
          phase par décision d’architecture : aucune fonction métier ne doit dépendre d’un
          fournisseur externe tant qu’il n’est pas contractualisé.
        </CardBody>
        <CardBody className="mt-2">
          Ce qui est déjà en place pour l’accueillir : les indicateurs sont calculés dans
          des fonctions isolées, et chaque lecture applique le périmètre de l’utilisateur.
          Un agent branché plus tard interrogerait ces mêmes fonctions — il ne verrait donc
          jamais plus que la personne qui l’interroge.
        </CardBody>
      </Card>

      <Card>
        <CardTitle>Exports PDF et Excel, rapports récurrents</CardTitle>
        <CardBody className="mt-1">
          Non implémentés. Un export planifié suppose de décider où le fichier est déposé et
          à qui il est envoyé — deux questions ouvertes (stockage, messagerie) qui ne se
          tranchent pas depuis cet écran.
        </CardBody>
      </Card>
    </div>
  );
}
