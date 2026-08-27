import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadTaskDetail } from '@/application/me/task-detail';
import { canOpen } from '@/application/navigation/build-navigation';
import { TaskRow } from '@/components/onboarding/task-row';
import { Card, CardBody, CardTitle, SectionTitle, StatusBadge, Timeline } from '@/components/ui';
import type { TimelineEntry } from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import type { OnboardingTaskStatus } from '@/domain/onboarding/task';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate, formatDateTime } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * One task of the recruit's own journey (`/app/me/journey/[taskId]`).
 *
 * The status history is real: it is read from the audit trail, which records every change
 * in the same transaction as the change itself. Nothing here is reconstructed or guessed.
 */

const STATUS_LABEL: Record<OnboardingTaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloquée',
  DONE: 'Terminée',
  VALIDATED: 'Validée',
};

const DEPARTMENT: Record<string, string> = {
  HR: 'Ressources humaines',
  IT: 'Informatique',
  HSE: 'HSE',
  QUALITY: 'Qualité',
  MANAGER: 'Votre responsable',
  EMPLOYEE: 'Vous',
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; taskId: string }>;
}) {
  const { locale, taskId } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/journey');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const detail = await loadTaskDetail(user, taskId).catch(() => null);

  /*
   * A task outside the caller's own journey answers 404, not 403.
   *
   * `loadTaskDetail` goes through the scoped journey loader, so a task that is not theirs
   * simply is not found — and telling somebody "this exists but is not yours" leaks more
   * than refusing to acknowledge it (ADR-021).
   */
  if (!detail) notFound();

  const { task } = detail;

  const history: TimelineEntry[] = detail.history.map((entry, index) => ({
    id: `${entry.at.toISOString()}-${index}`,
    marker: formatDateTime(entry.at, locale as Locale),
    title: entry.from
      ? `${STATUS_LABEL[entry.from]} → ${STATUS_LABEL[entry.to]}`
      : STATUS_LABEL[entry.to],
    body: entry.actorLabel,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/me/journey" className="text-text-muted text-[12px]">
          ← Mon parcours
        </Link>
        <SectionTitle className="mt-2" lead={task.detailFr}>
          {task.titleFr}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-red-strong rounded bg-(--red-dim) px-1.5 py-0.5 font-mono text-[10px]">
            {task.dayLabelFr}
          </span>
          <StatusBadge
            label={STATUS_LABEL[task.status]}
            tone={
              task.status === 'VALIDATED' || task.status === 'DONE'
                ? 'green'
                : task.status === 'BLOCKED'
                  ? 'red'
                  : 'neutral'
            }
          />
          {task.overdue ? <StatusBadge label="En retard" tone="red" /> : null}
          {task.dueDate ? (
            <span className="text-text-dim font-mono text-[11px]">
              Échéance · {formatDate(task.dueDate, locale as Locale)}
            </span>
          ) : null}
        </div>
      </div>

      <section>
        <SectionTitle level={2}>Mettre à jour</SectionTitle>
        <TaskRow
          instanceId={detail.instanceId}
          milestoneId={task.milestoneId}
          dayLabelFr={task.dayLabelFr}
          titleFr={task.titleFr}
          detailFr={task.detailFr}
          isRecommended={task.isRecommended}
          status={task.status}
          dueLabel={task.dueDate ? formatDate(task.dueDate, locale as Locale) : null}
          overdue={task.overdue}
          dueSoon={task.dueSoon}
          canUpdate={can(user, 'update', 'onboarding_task', { ownerUserId: user.id })}
          canValidate={can(user, 'validate', 'onboarding_task', { ownerUserId: user.id })}
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Service responsable</CardTitle>
          <CardBody className="mt-1">
            {task.ownerDepartment
              ? (DEPARTMENT[task.ownerDepartment] ?? task.ownerDepartment)
              : 'Non précisé sur cette étape.'}
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Caractère</CardTitle>
          <CardBody className="mt-1">
            {task.isRecommended
              ? 'Recommandée — utile, mais votre parcours peut se terminer sans elle.'
              : 'Obligatoire — nécessaire pour valider votre intégration.'}
          </CardBody>
        </Card>
      </div>

      {task.noteFr ? (
        <section>
          <SectionTitle level={2}>Note</SectionTitle>
          <Card>
            <CardBody>{task.noteFr}</CardBody>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle
          level={2}
          lead="Chaque changement d’état est enregistré au moment où il se produit, avec son auteur."
        >
          Historique
        </SectionTitle>
        {history.length === 0 ? (
          <Card>
            <CardBody>Cette étape n’a pas encore bougé.</CardBody>
          </Card>
        ) : (
          <Timeline entries={history} label="Historique de la tâche" />
        )}
      </section>

      <nav className="flex justify-between gap-4 border-t border-(--border) pt-4">
        {detail.previousId ? (
          <Link
            href={`/app/me/journey/${detail.previousId}`}
            className="text-text-muted text-[12px]"
          >
            ← Étape précédente
          </Link>
        ) : (
          <span />
        )}
        {detail.nextId ? (
          <Link href={`/app/me/journey/${detail.nextId}`} className="text-text-muted text-[12px]">
            Étape suivante →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
