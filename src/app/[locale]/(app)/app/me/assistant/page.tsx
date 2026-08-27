import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { AssistantPanel } from '@/components/me/assistant-panel';
import { Card, CardBody, CardTitle, SectionTitle } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The welcome assistant (`/app/me/assistant`), Agent 1 of CDC-2026 §4.
 *
 * No language model is involved (ADR-003). This is retrieval over the org chart the asker
 * can already see and the published directory, ranked and cited. The honesty about that is
 * on the page rather than hidden: somebody who thinks they are talking to an AI will trust
 * an answer differently from somebody who knows they are searching a directory.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/me/assistant');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  return (
    <div className="space-y-8">
      <SectionTitle lead="Posez une question sur qui fait quoi. Les réponses viennent de votre organigramme et de l’annuaire — chaque réponse cite ses sources, et vous pouvez les vérifier.">
        Assistant d’accueil
      </SectionTitle>

      <AssistantPanel />

      <Card>
        <CardTitle>Comment ça marche</CardTitle>
        <CardBody className="mt-1">
          L’assistant cherche dans les postes que vous êtes autorisé à voir et dans
          l’annuaire interne. Il ne consulte aucun service externe et n’invente pas de
          réponse : s’il ne trouve rien, il le dit. Les assistants RH, formation et
          reporting prévus au cahier des charges arriveront dans une phase ultérieure.
        </CardBody>
      </Card>
    </div>
  );
}
