import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/AuthContext.jsx';
import { ApiError } from '../../api/client.js';
import { LockKeyMark, MeshBackdrop, ParticleField } from '../../components/public/Visuals.jsx';

const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-dim/70 focus:border-red-brand';

/**
 * What the platform gives someone once they are through — shown on the brand panel.
 * Keys rather than literals, so the React key stays stable when the language changes.
 */
const HIGHLIGHT_KEYS = [
  'auth.login.highlight1',
  'auth.login.highlight2',
  'auth.login.highlight3',
];

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const reduce = useReducedMotion();

  if (user) {
    const to = location.state?.from?.pathname ?? '/app/me';
    return <Navigate to={to} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? '/app/me', { replace: true });
    } catch (err) {
      /*
       * `invalidCredentials` deliberately does not say which half was wrong: telling a
       * stranger that an address exists but the password does not is how an account list
       * gets enumerated. The rate-limit case is distinguished because a person locked out
       * needs to know waiting will help.
       */
      if (err instanceof ApiError && err.status === 429) {
        setError(t('auth.login.tooManyAttempts'));
      } else {
        setError(t('auth.login.invalidCredentials'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ------------------------------------------------------------ brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between">
        <MeshBackdrop />
        <div aria-hidden className="absolute inset-0 opacity-50">
          <ParticleField density={26} />
        </div>

        <div className="relative p-10">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-app bg-red-brand font-display text-sm text-white"
            >
              S
            </span>
            <span className="font-display text-lg leading-none text-red-deep">SOFICLEF</span>
          </Link>
        </div>

        <div className="relative px-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-[300px]"
          >
            <LockKeyMark className="w-full" />
          </motion.div>
        </div>

        <div className="relative p-10">
          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="font-display text-2xl leading-snug text-text"
            style={{ textWrap: 'balance' }}
          >
            {t('auth.login.panelTitle')}
          </motion.h2>

          <ul className="mt-4 space-y-2">
            {HIGHLIGHT_KEYS.map((itemKey, index) => (
              <motion.li
                key={itemKey}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                  delay: reduce ? 0 : 0.3 + index * 0.08,
                }}
                className="flex items-start gap-2.5 text-sm text-text-muted"
              >
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-brand" />
                {t(itemKey)}
              </motion.li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ------------------------------------------------------------------- form */}
      <main className="relative flex items-center justify-center bg-bg px-5 py-12">
        {/* The mobile header: the brand panel is hidden below lg, so the mark comes here. */}
        <Link
          to="/"
          className="absolute left-5 top-6 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-red-brand lg:hidden"
        >
          <span aria-hidden>←</span> {t('auth.login.backToSite')}
        </Link>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <h1 className="font-display text-3xl text-red-deep">{t('auth.login.title')}</h1>
          <p className="mt-1.5 text-sm text-text-dim">{t('auth.login.lede')}</p>

          <form onSubmit={handleSubmit} className="mt-8">
            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  role="alert"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-4 overflow-hidden rounded-app border border-status-red/30 bg-status-red/5 px-3 py-2 text-sm text-status-red"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-text">
                {t('auth.login.emailLabel')}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                className={FIELD}
                autoComplete="email"
                autoFocus
              />
            </label>

            <label className="mb-6 block">
              <span className="mb-1.5 block text-sm font-medium text-text">
                {t('auth.login.passwordLabel')}
              </span>
              <span className="relative block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${FIELD} pe-16`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-pressed={showPassword}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-text-dim transition-colors hover:text-red-brand"
                >
                  {showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                </button>
              </span>
            </label>

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={reduce || submitting ? undefined : { y: -1 }}
              whileTap={reduce || submitting ? undefined : { y: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full rounded-app bg-red-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
            </motion.button>
          </form>

          <div className="mt-8 border-t border-border pt-5 text-sm text-text-dim">
            <p>{t('auth.login.noAccessNote')}</p>
            <Link
              to="/"
              className="mt-3 hidden items-center gap-1.5 font-medium text-red-brand hover:underline lg:inline-flex"
            >
              <span aria-hidden>←</span> {t('auth.login.backToSite')}
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
