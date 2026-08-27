'use server';

import { z } from 'zod';

import { answerOrientation } from '@/application/assistant/orientation';
import type { AgentAnswer } from '@/domain/assistant/agents';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Asking Agent 1 a question.
 *
 * A read, not a mutation, so it does not go through `mutate()` — but it still resolves the
 * caller server-side and answers from *their* visible tree. No LLM is involved (ADR-003);
 * this is retrieval over rows the asker may already see.
 */

const Ask = z.object({ question: z.string().trim().min(2).max(300) });

export async function askOrientation(
  _previous: AgentAnswer | null,
  formData: FormData,
): Promise<AgentAnswer> {
  const user = await getCurrentUser();
  // No session: answer nothing rather than throwing. The page behind this is already
  // gated, so this is the belt to that braces.
  if (!user) return { agent: 'orientation', answer: null, sources: [] };

  const parsed = Ask.safeParse({ question: formData.get('question') });
  if (!parsed.success) return { agent: 'orientation', answer: null, sources: [] };

  return answerOrientation(user, parsed.data.question);
}
