import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The anonymous surface.
 *
 * Two claims are being tested, and the second matters more than the first: the public
 * pages render without a session, and *only* those pages do. A public route group sitting
 * beside the authenticated one is exactly the kind of change that quietly widens what an
 * anonymous visitor can reach, so the negative case is asserted explicitly.
 */

const PUBLIC_ROUTES = ['/', '/entreprise', '/strategie', '/carrieres'] as const;

/** Routes that must stay behind the session, checked with no cookie at all. */
const PRIVATE_ROUTES = [
  '/dashboard',
  '/admin',
  '/remarks',
  '/onboarding',
  '/competencies',
  '/organization',
  '/welcome',
  '/job-description',
  '/kaizen',
  '/contacts',
] as const;

test.describe('the public pages need no account', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`serves ${route} to an anonymous visitor`, async ({ page }) => {
      const response = await page.goto(`/fr${route}`);
      expect(response?.status(), `GET /fr${route}`).toBe(200);

      // Still on the requested page — not bounced to the sign-in form.
      await expect(page).toHaveURL(new RegExp(`/fr${route === '/' ? '$' : route}$`));

      const main = page.locator('#public-content');
      await expect(main).toBeVisible();
      expect((await main.innerText()).trim().length, `empty page at ${route}`).toBeGreaterThan(60);
    });
  }

  test('offers a way in without revealing anything behind it', async ({ page }) => {
    await page.goto('/fr');

    // The sign-in call to action is present…
    await expect(page.getByRole('link', { name: /espace collaborateur/i }).first()).toBeVisible();

    // …and nothing from the authenticated shell leaks onto the page.
    await expect(page.getByRole('navigation', { name: /navigation principale/i })).toHaveCount(0);
    await expect(page.getByText(/journal d'audit|checklist 30 jours/i)).toHaveCount(0);
  });
});

test.describe('everything else still requires a session', () => {
  for (const route of PRIVATE_ROUTES) {
    test(`sends an anonymous visitor from ${route} to the sign-in form`, async ({ page }) => {
      await page.goto(`/fr${route}`);
      await expect(page).toHaveURL(/\/fr\/login$/);
    });
  }
});

test.describe('the public pages are translated and mirror correctly', () => {
  for (const locale of ['fr', 'ar', 'en']) {
    test(`renders in ${locale} without horizontal overflow`, async ({ page }) => {
      await page.goto(`/${locale}/entreprise`);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        locale === 'ar' ? 'rtl' : 'ltr',
      );

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow in ${locale}`).toBeLessThanOrEqual(1);
    });
  }

  test('keeps French business text left-to-right inside the Arabic layout', async ({ page }) => {
    await page.goto('/ar/entreprise');

    // Without dir="ltr" the bidi algorithm moves a French full stop to the wrong end of
    // the line, which is the visible symptom of untagged source text.
    const french = page.locator('[lang="fr"][dir="ltr"]').first();
    await expect(french).toBeVisible();
  });
});

test('no accessibility violations on the public home page', async ({ page }) => {
  await page.goto('/fr');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
