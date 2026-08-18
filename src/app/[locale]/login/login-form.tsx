'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { signIn, type SignInState } from '@/app/actions/auth';
import { useRouter } from '@/i18n/navigation';

const INITIAL: SignInState = { status: 'idle' };

/**
 * The sign-in form.
 *
 * Errors are announced with `role="alert"` so a screen reader hears the failure rather
 * than the user rediscovering an unchanged screen. On success the router refreshes, which
 * lets the authenticated layout take over.
 */
export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(signIn, INITIAL);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        // The action sets the session cookie; refreshing lets the authenticated layout
        // take over, and a failed attempt simply re-renders with its message.
        router.replace('/welcome');
        router.refresh();
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-text text-[12px] font-medium">
          {t('email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          dir="ltr"
          className="text-text rounded-md border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-text text-[12px] font-medium">
          {t('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="text-text rounded-md border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
        />
      </div>

      {state.status === 'error' ? (
        <p
          role="alert"
          className="text-red rounded-md border border-(--red) bg-white px-3 py-2 text-[12.5px]"
        >
          {state.reason === 'rate-limited' ? t('rateLimited') : t('invalidCredentials')}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-md bg-(--gold) px-4 py-2.5 text-[13px] font-medium text-white hover:bg-(--gold-light) disabled:opacity-60"
      >
        {isPending ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
