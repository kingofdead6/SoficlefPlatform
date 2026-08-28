import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * A trainingModule's quiz (`/app/hr/training/[id]/quiz`).
 *
 * The specification asks for Agent 3 to generate questions from the trainingModule content. That
 * needs a language model, which ADR-003 keeps out of this phase — so the questions are
 * shown, reviewed and scored here, and the generation step is the one thing missing. Said
 * plainly on the page rather than mocked with fake "generated" output, which would be worse
 * than absent: somebody would ship it.
 */
/**
 * Reads the options out of the JSON column without trusting its shape.
 *
 * It is `Json`, so a hand-edited row or an older writer can put anything there. An
 * unreadable value yields no options rather than throwing: a question that renders empty
 * is a visible defect, a page that crashes hides which question caused it.
 */
function optionsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/training');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const trainingModule = await prisma.trainingModule
    .findUnique({
      where: { id },
      select: {
        id: true,
        titleFr: true,
        code: true,
        passingScore: true,
        isPlaceholder: true,
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            promptFr: true,
            // `options` is a JSON array of labels; `correctOption` names the right one.
            options: true,
            correctOption: true,
            explanationFr: true,
          },
        },
        _count: { select: { attempts: true } },
        attempts: { where: { passed: true }, select: { id: true } },
      },
    })
    .catch(() => null);

  if (!trainingModule) notFound();

  const passRate =
    trainingModule._count.attempts === 0
      ? null
      : Math.round((trainingModule.attempts.length / trainingModule._count.attempts) * 100);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/hr/training" className="text-text-muted text-[12px]">
          ← Catalogue de formation
        </Link>
        <SectionTitle className="mt-2" lead={trainingModule.code}>
          Quiz · {trainingModule.titleFr}
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={trainingModule.questions.length} label="Questions" />
          <KpiTile value={`${trainingModule.passingScore}%`} label="Seuil de réussite" />
          <KpiTile
            value={passRate === null ? '—' : `${passRate}%`}
            label="Taux de réussite"
            hint={`${trainingModule._count.attempts} tentative${trainingModule._count.attempts > 1 ? 's' : ''}`}
          />
        </div>
      </div>

      {trainingModule.questions.length === 0 ? (
        <Card>
          <CardBody>
            Ce trainingModule n’a pas encore de questions. Un trainingModule sans quiz reste consultable mais
            ne délivre aucune attestation.
          </CardBody>
        </Card>
      ) : (
        <section>
          <SectionTitle level={2} lead="Les bonnes réponses sont visibles ici et jamais envoyées au navigateur de l’apprenant.">
            Questions
          </SectionTitle>

          <ol className="space-y-3">
            {trainingModule.questions.map((question, index) => (
              <li key={question.id}>
                <Card>
                  <CardTitle>
                    {index + 1}. {question.promptFr}
                  </CardTitle>
                  <ul className="mt-2 space-y-1">
                    {optionsOf(question.options).map((option) => (
                      <li key={option} className="flex items-center gap-2 text-[13px]">
                        <StatusBadge
                          label={option === question.correctOption ? 'Correcte' : 'Distracteur'}
                          tone={option === question.correctOption ? 'green' : 'neutral'}
                        />
                        <span className="text-text-muted">{option}</span>
                      </li>
                    ))}
                  </ul>
                  {question.explanationFr ? (
                    <CardBody className="mt-2">{question.explanationFr}</CardBody>
                  ) : null}
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Card accent="red">
        <CardTitle>Génération automatique</CardTitle>
        <CardBody className="mt-1">
          La génération de questions à partir du contenu du trainingModule (agent 3) demande un
          fournisseur de modèle de langage, écarté de cette phase par décision
          d’architecture. Les questions ci-dessus sont donc rédigées et relues à la main.
          Le jour où un fournisseur est raccordé, il alimentera cette même liste — rien à
          reprendre.
        </CardBody>
      </Card>
    </div>
  );
}
