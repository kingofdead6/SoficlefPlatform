'use client';

import { useState, useTransition } from 'react';

import { askOrientation } from '@/app/actions/assistant';
import { Card, CardBody, CardTitle } from '@/components/ui';
import type { AgentAnswer } from '@/domain/assistant/agents';
import { Link } from '@/i18n/navigation';

/**
 * Agent 1 — "who do I talk to about X".
 *
 * Every answer names its sources, and a question with no match says so rather than
 * offering the nearest plausible person. That refusal is the feature: an invented contact
 * costs more than an admitted gap, because somebody acts on it.
 */

const EXAMPLES = [
  'Qui gère les compétences ?',
  'À qui parler de la fabrication ?',
  'Responsable HSE',
  'Qui contacter pour mon contrat ?',
];

export function AssistantPanel() {
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [asked, setAsked] = useState<string>('');
  const [pending, startTransition] = useTransition();

  function ask(formData: FormData) {
    const question = String(formData.get('question') ?? '');
    startTransition(async () => {
      setAsked(question);
      setAnswer(await askOrientation(null, formData));
    });
  }

  return (
    <div className="space-y-6">
      <form action={ask} className="flex flex-wrap gap-2">
        <label htmlFor="question" className="sr-only">
          Votre question
        </label>
        <input
          id="question"
          name="question"
          required
          minLength={2}
          maxLength={300}
          placeholder="Qui dois-je contacter pour…"
          className="min-w-0 flex-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Recherche…' : 'Demander'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <form key={example} action={ask}>
            <input type="hidden" name="question" value={example} />
            <button
              type="submit"
              className="text-text-muted rounded-full border border-(--border) px-3 py-1 text-[11px]"
            >
              {example}
            </button>
          </form>
        ))}
      </div>

      {answer ? (
        <Card accent={answer.answer ? 'red' : undefined}>
          <CardTitle>{asked}</CardTitle>

          {answer.answer ? (
            <>
              <CardBody className="mt-2 whitespace-pre-line">{answer.answer}</CardBody>

              <div className="mt-4 border-t border-(--border) pt-3">
                <p className="text-text-dim text-[11px] uppercase tracking-wide">Sources</p>
                <ul className="mt-1 space-y-1">
                  {answer.sources.map((source) => (
                    <li key={`${source.kind}-${source.id}`} className="text-[12px]">
                      {source.href ? (
                        <Link href={source.href} className="text-red-strong">
                          {source.label}
                        </Link>
                      ) : (
                        <span className="text-text-muted">{source.label}</span>
                      )}
                      <span className="text-text-dim ms-2">
                        {source.kind === 'position' ? 'organigramme' : 'annuaire'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <CardBody className="mt-2">
              Je n’ai rien trouvé qui corresponde dans votre périmètre. Plutôt que de vous
              proposer un nom au hasard : essayez d’autres mots, ou consultez l’annuaire des
              interlocuteurs.
            </CardBody>
          )}
        </Card>
      ) : null}
    </div>
  );
}
