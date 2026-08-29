import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { serverEnv } from '@/lib/env';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Security policy (`/admin/security`).
 *
 * Reports the values actually in force, read from the parsed environment rather than from
 * a settings table that could disagree with it. A security page showing what somebody
 * *intended* to configure is worse than none.
 *
 * Nothing is editable here: these values are parsed once at start-up and validated, so a
 * runtime change would either be ignored until the next deploy or bypass that validation.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/security');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const env = serverEnv();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);

  const [failedLogins, revokedSessions, activeSessions] = await Promise.all([
    prisma.auditLog
      .count({ where: { action: 'auth.login_failed', createdAt: { gte: dayAgo } } })
      .catch(() => 0),
    prisma.session.count({ where: { revokedAt: { not: null } } }).catch(() => 0),
    prisma.session
      .count({ where: { revokedAt: null, expiresAt: { gt: now } } })
      .catch(() => 0),
  ]);

  const sessionHours = Math.round(env.AUTH_SESSION_TTL_SECONDS / 3600);
  const renewMinutes = Math.round(env.AUTH_SESSION_RENEW_WINDOW_SECONDS / 60);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les valeurs réellement appliquées, lues dans la configuration validée au démarrage — pas dans une table qui pourrait la contredire.">
          Sécurité
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={activeSessions} label="Sessions ouvertes" />
          <KpiTile value={revokedSessions} label="Sessions révoquées" />
          <KpiTile value={failedLogins} label="Échecs de connexion" hint="24 h" />
          <KpiTile value={`${sessionHours} h`} label="Durée de session" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Mots de passe</CardTitle>
          <CardBody className="mt-1">
            Longueur minimale : {env.AUTH_PASSWORD_MIN_LENGTH} caractères. Les mots de passe
            sont hachés avec Argon2id et ne sont jamais stockés ni journalisés sous une
            autre forme.
          </CardBody>
          <p className="text-text-dim mt-2 font-mono text-[11px]">
            Argon2id · mémoire {env.AUTH_ARGON2_MEMORY_KIB} Kio · {env.AUTH_ARGON2_ITERATIONS}{' '}
            itération(s) · parallélisme {env.AUTH_ARGON2_PARALLELISM}
          </p>
        </Card>

        <Card>
          <CardTitle>Sessions</CardTitle>
          <CardBody className="mt-1">
            Durée de {sessionHours} heures, prolongée au plus une fois par fenêtre de{' '}
            {renewMinutes} minutes. La session vit côté serveur : elle est relue à chaque
            requête, donc une révocation prend effet à la requête suivante plutôt qu’à
            l’expiration du cookie.
          </CardBody>
          <div className="mt-2">
            <StatusBadge label="Révocation immédiate" tone="green" />
          </div>
        </Card>

        <Card>
          <CardTitle>Chiffrement</CardTitle>
          <CardBody className="mt-1">
            Les échanges avec la base sont chiffrés en transit (TLS exigé par la chaîne de
            connexion). Le chiffrement au repos dépend de l’hébergeur et n’est pas
            vérifiable depuis l’application — affirmer ici qu’il est actif serait une
            affirmation invérifiable.
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Protection contre le rejeu</CardTitle>
          <CardBody className="mt-1">
            Chaque mutation exige un jeton CSRF, et les tentatives de connexion sont
            limitées en fréquence. Les refus d’accès sont journalisés — y compris quand un
            administrateur tente d’élargir ses propres droits.
          </CardBody>
        </Card>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card accent="red">
          <CardTitle>Authentification multifacteur</CardTitle>
          <CardBody className="mt-1">
            Non disponible. Elle est prévue via Entra ID plutôt que réimplémentée ici :
            gérer des seconds facteurs à côté de l’annuaire de l’entreprise revient à tenir
            deux référentiels d’identité qui finiront par diverger.
          </CardBody>
        </Card>

        <Card accent="red">
          <CardTitle>Restrictions par adresse IP</CardTitle>
          <CardBody className="mt-1">
            Non disponible. Le filtrage par adresse se pose au niveau du réseau ou du
            reverse proxy, où il s’applique avant que la requête n’atteigne l’application —
            l’implémenter ici le rendrait contournable en changeant de point d’entrée.
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          Ces valeurs se modifient dans la configuration de déploiement, pas depuis cet
          écran : elles sont analysées et validées au démarrage, et un réglage changé à
          chaud serait soit ignoré jusqu’au prochain déploiement, soit appliqué sans cette
          validation.
        </CardBody>
      </Card>
    </div>
  );
}
