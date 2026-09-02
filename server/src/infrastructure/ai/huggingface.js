import { env } from '../../config/env.js';

/**
 * The Hugging Face Inference client — the platform's only outbound call to a language model.
 *
 * The router at HF_BASE_URL exposes an OpenAI-compatible `/chat/completions` endpoint, which
 * is why the request below has that shape rather than HF's older task-specific one: it means
 * swapping provider later is a base-URL change, not a rewrite.
 *
 * Two rules govern this module, and both exist because everything above it must degrade
 * rather than fail:
 *
 *   1. **It never throws.** Every failure — no key, timeout, 429, cold start, malformed
 *      response — comes back as `{ ok: false, reason }`. The assistant then answers from
 *      retrieval alone, which is a slightly plainer answer, not an error page.
 *   2. **It never queries the database.** Context is assembled by the retrievers, under the
 *      asker's own scope, and passed in as text. The model is a phrasing step over rows the
 *      caller could already read.
 */

/** Whether a key is present. Absent is a supported configuration, not a broken one. */
export function isConfigured() {
  return Boolean(env.HF_API_KEY && env.HF_API_KEY.trim());
}

/** The model name, for the UI to state what is answering. Null when nothing is configured. */
export function modelName() {
  return isConfigured() ? env.HF_MODEL : null;
}

/**
 * One chat completion.
 *
 * `temperature: 0.2` is deliberate and should not be raised. This is an extractive
 * assistant: its job is to rephrase retrieved rows about someone's own evaluation, journey
 * or org chart. Creativity here is indistinguishable from invention, and an invented
 * contact or deadline is the one failure that costs the reader more than silence.
 */
export async function chat({ system, user, signal }) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };

  // A hung model request must not hold an Express handler open until the socket dies.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.HF_TIMEOUT_MS);

  // Let a caller-supplied signal (a disconnecting client) abort us too.
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(`${env.HF_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.HF_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: env.HF_MAX_TOKENS,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');

      if (response.status === 429) return { ok: false, reason: 'rate_limited' };

      /*
       * HF answers 503 with an `estimated_time` while a model cold-starts. That is worth
       * telling apart from a real failure: "the model is warming up, try again in ~20 s" is
       * an instruction the reader can act on, where "it failed" is not.
       */
      if (response.status === 503) {
        const warming = /estimated_time|loading|currently loading/i.test(body);
        return { ok: false, reason: warming ? 'model_loading' : 'error' };
      }

      return { ok: false, reason: 'error' };
    }

    const payload = await response.json().catch(() => null);
    const text = payload?.choices?.[0]?.message?.content;

    if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'error' };

    return { ok: true, text: text.trim() };
  } catch (error) {
    // AbortError covers both our own timeout and a caller-cancelled request.
    if (error?.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'error' };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}
