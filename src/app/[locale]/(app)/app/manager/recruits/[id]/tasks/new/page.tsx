import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadRecruit } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { NewTaskForm } from '@/components/manager/new-task-form';
import { Card, CardBody, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { isStorageConfigured } from '@/infrastructure/storage/file-storage';

/**
 * Adding an ad-hoc task to somebody's path
 * (`/app/manager/recruits/[id]/tasks/new`).
 *
 * Separate from editing the template on purpose: a manager adds a task for one person,
 * while changing the template changes it for everybody hired afterwards. Those are
 * different decisions with different owners, and merging them into one screen is how a
 * one-off instruction becomes company policy by accident.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/recruits');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const recruit = await loadRecruit(user, id).catch(() => null);
  if (!recruit) notFound();

  const instance = recruit.onboardingInstances[0] ?? null;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/app/manager/recruits/${recruit.id}`} className="text-text-muted text-[12px]">
          &larr; {recruit.displayName}
        </Link>
        <SectionTitle
          className="mt-2"
          lead="Une consigne ponctuelle, ajoutee au parcours de cette personne seulement. Le parcours type reste inchange."
        >
          Nouvelle tache
        </SectionTitle>
      </div>

      {instance ? (
        <NewTaskForm
          instanceId={instance.id}
          recruitId={recruit.id}
          storageConfigured={isStorageConfigured()}
        />
      ) : (
        <Card>
          <CardBody>
            Cette personne n&rsquo;a pas de parcours ouvert : une tache ponctuelle se
            rattache a un parcours, il faut donc qu&rsquo;il existe.
          </CardBody>
        </Card>
      )}
    </div>
  );
}
