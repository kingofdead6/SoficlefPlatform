import Link from 'next/link';

/**
 * Placeholder root. Part 4 replaces it with a redirect to the negotiated locale
 * (`/fr`, `/ar`, `/en`); Part 5 puts the application shell behind it.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
      <p className="text-text-dim font-mono text-xs tracking-widest uppercase">SOFICLEF SARL</p>
      <h1 className="text-text text-3xl">Plateforme Compétences &amp; Emplois</h1>
      <p className="text-text-muted">
        Fondations en place : Next.js, PostgreSQL, Prisma, et le jeu de tokens issu de la charte
        graphique validée.
      </p>
      <Link className="text-gold underline underline-offset-4" href="/dev/tokens">
        Voir les tokens du design system
      </Link>
    </main>
  );
}
