import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { connectorStatuses } from '@/domain/admin/connectors';
import { LOCALE_DEFINITIONS } from '@/i18n/config';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { serverEnv } from '@/lib/env';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import {
  SETTING_KEYS,
  booleanSetting,
  numberSetting,
} from '@/infrastructure/settings/app-settings';

/**
 * Platform parameters (`/admin/settings`).
 *
 * The org-chart visibility depths are the ones that genuinely live in `AppSetting` and are
 * read on every tree query — so they are shown with their current values. Everything else
 * the specification lists is either configured at deployment or does not exist yet, and is
 * labelled as such rather than given an inert form.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/settings');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const env = serverEnv();

  const [depthUp, depthDown, showPeers] = await Promise.all([
    numberSetting(SETTING_KEYS.orgTreeDepthUp, { max: 12 }),
    numberSetting(SETTING_KEYS.orgTreeDepthDown, { max: 12 }),
    booleanSetting(SETTING_KEYS.orgTreeShowPeers),
  ]);

  const smtp = connectorStatuses(process.env).find((status) => status.definition.id === 'smtp');

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les paramètres administrables, et ceux qui relèvent du déploiement. La distinction n’est pas cosmétique : un réglage validé au démarrage ne peut pas changer à chaud sans contourner cette validation.">
          Paramètres
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={3} label="Paramètres administrables" />
          <KpiTile value={Object.keys(LOCALE_DEFINITIONS).length} label="Langues" />
          <KpiTile value={`${depthUp} / ${depthDown}`} label="Profondeur haut / bas" />
          <KpiTile value={env.DEMO_DATA ? 'Oui' : 'Non'} label="Données de démonstration" />
        </div>
      </section>

      <section>
        <SectionTitle level={2} lead="Lus à chaque requête d’organigramme. Les modifier change immédiatement ce qu’un collaborateur voit de la structure.">
          Visibilité de l’organigramme
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardTitle>Niveaux vers le haut</CardTitle>
            <CardBody className="mt-1">
              Un collaborateur voit {depthUp} niveau(x) au-dessus de son poste.
            </CardBody>
            <p className="text-text-dim mt-2 font-mono text-[11px]">
              {SETTING_KEYS.orgTreeDepthUp}
            </p>
          </Card>

          <Card>
            <CardTitle>Niveaux vers le bas</CardTitle>
            <CardBody className="mt-1">
              Il voit {depthDown} niveau(x) en dessous.
            </CardBody>
            <p className="text-text-dim mt-2 font-mono text-[11px]">
              {SETTING_KEYS.orgTreeDepthDown}
            </p>
          </Card>

          <Card>
            <CardTitle>Collègues</CardTitle>
            <CardBody className="mt-1">
              {showPeers
                ? 'Les collègues rattachés au même responsable sont visibles.'
                : 'Les collègues du même responsable ne sont pas montrés.'}
            </CardBody>
            <div className="mt-2">
              <StatusBadge
                label={showPeers ? 'Affichés' : 'Masqués'}
                tone={showPeers ? 'green' : 'neutral'}
              />
            </div>
          </Card>
        </div>

        <Card className="mt-4">
          <CardBody>
            Ces valeurs ne s’appliquent ni aux responsables, qui voient l’intégralité de
            leur sous-arbre, ni aux RH et à l’administration, qui voient tout. La restriction
            est appliquée dans la requête : un collaborateur ne reçoit jamais les lignes
            qu’il n’a pas le droit de voir, elles ne sont pas seulement masquées à l’écran.
          </CardBody>
          <Link href="/app/hr/organigram" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
            Voir l’organigramme complet →
          </Link>
        </Card>
      </section>

      <section>
        <SectionTitle level={2}>Langues</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {Object.values(LOCALE_DEFINITIONS).map((definition) => (
            <StatusBadge
              key={definition.code}
              label={`${definition.nativeName} (${definition.code})${definition.dir === 'rtl' ? ' · RTL' : ''}`}
              tone={definition.code === locale ? 'brand' : 'neutral'}
            />
          ))}
        </div>
        <Card className="mt-3">
          <CardBody>
            Les trois catalogues sont maintenus en parallèle et vérifiés à chaque
            construction : une clé présente dans l’un et absente d’un autre fait échouer la
            compilation. Le contenu métier, lui, n’est pas traduit automatiquement — une
            fiche de poste mal traduite est un document faux.
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionTitle level={2}>Réglés au déploiement</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>Jalons d’intégration</CardTitle>
            <CardBody className="mt-1">
              J+7, J+30, J+60 et J+90, fixés par le cahier des charges. Les rendre variables
              demanderait de décider ce qu’il advient des enquêtes déjà émises sous
              l’ancienne cadence.
            </CardBody>
          </Card>

          <Card accent={smtp?.mode === 'unconfigured' ? 'red' : undefined}>
            <CardTitle>Modèles d’e-mails</CardTitle>
            <CardBody className="mt-1">
              {smtp?.mode === 'unconfigured'
                ? 'Sans serveur de messagerie, aucun e-mail n’est envoyé : il n’y a pas encore de modèle à régler.'
                : 'Les modèles seront administrables ici une fois la messagerie raccordée.'}
            </CardBody>
          </Card>

          <Card>
            <CardTitle>Identité visuelle</CardTitle>
            <CardBody className="mt-1">
              Couleurs et typographies passent par une couche de jetons CSS, modifiable en
              un seul fichier. Elle n’est pas exposée ici : une palette changée à l’écran
              peut casser les contrastes, qui sont vérifiés à la construction.
            </CardBody>
          </Card>

          <Card>
            <CardTitle>Indicateurs de fonctionnalité</CardTitle>
            <CardBody className="mt-1">
              Deux seulement : les pages de développement et le bandeau de données de
              démonstration, tous deux réglés par variable d’environnement. Multiplier les
              interrupteurs multiplie les combinaisons que personne ne teste.
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
