'use client';

import { useRef, useState, useTransition } from 'react';

import { addRemark } from '@/app/actions/remarks';

/**
 * Files a remark. The textarea keeps its content when the mutation fails — losing what
 * somebody just wrote is the worst possible response to a transient error.
 */
export function RemarkComposer() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addRemark(null, formData);
      if (result.ok) {
        formRef.current?.reset();
      } else {
        setError(
          result.reason === 'invalid'
            ? (result.fieldErrors?.contentFr?.[0] ?? 'Remarque invalide.')
            : result.reason === 'forbidden'
              ? "Vous n'avez pas le droit de déposer une remarque."
              : "La remarque n'a pas pu être enregistrée.",
        );
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="remark-content" className="text-text block text-[12px] font-medium">
          Nouvelle remarque
        </label>
        <textarea
          id="remark-content"
          name="contentFr"
          rows={4}
          required
          maxLength={5000}
          placeholder="Saisissez votre remarque ou recommandation…"
          className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      {error ? (
        <p role="alert" className="text-red text-[12px]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-(--gold) px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
