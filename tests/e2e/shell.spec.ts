import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The application shell, end to end (Part 5 acceptance).
 *
 * Sign in, walk every route, switch locale, sign out — plus an accessibility scan of the
 * chrome and a keyboard pass, because "reachable" and "usable" are different claims.
 */

const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'Soficlef-Test-2026!';

const ROUTES = [
  '/welcome',
  '/company',
  '/strategy',
  '/job-description',
  '/organization',
  '/management',
  '/recruitment',
  '/kaizen',
  '/qms',
  '/hse',
  '/contacts',
  '/documents',
  '/onboarding',
  '/competencies',
  '/remarks',
] as const;

async function signIn(page: Page, email: string, locale = 'fr'): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(/e-?mail|البريد/i).fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /connecter|sign in|تسجيل/i }).click();
  await page.waitForURL(`**/${locale}/welcome`);
}

test.describe('authentication', () => {
  test('an anonymous visitor is sent to the sign-in form', async ({ page }) => {
    await page.goto('/fr/welcome');
    await expect(page).toHaveURL(/\/fr\/login$/);
  });

  test('a wrong password is refused, and says so out loud', async ({ page }) => {
    await page.goto('/fr/login');
    await page.locator('#email').fill('djaoudi@soficlef.local');
    await page.locator('#password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: /connecter/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signing in lands on the welcome route inside the shell', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');
    await expect(page.getByRole('navigation', { name: /navigation/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('every route is reachable and real', () => {
  test('all fifteen routes render a named page with an empty state, not a placeholder', async ({
    page,
  }) => {
    await signIn(page, 'chanane@soficlef.local');

    for (const route of ROUTES) {
      const response = await page.goto(`/fr${route}`);
      expect(response?.status(), `GET /fr${route}`).toBe(200);

      // A meaningful empty state names what will live here — never "Coming soon".
      const main = page.locator('#main-content');
      await expect(main).toBeVisible();
      await expect(main).not.toContainText(/bientôt disponible|coming soon/i);

      const body = await main.innerText();
      expect(body.trim().length, `empty page at ${route}`).toBeGreaterThan(60);
    }
  });

  test('the active entry is marked for assistive technology, not only in colour', async ({
    page,
  }) => {
    await signIn(page, 'chanane@soficlef.local');
    await page.goto('/fr/kaizen');

    const current = page.locator('nav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(/kaizen/i);
  });

  test('navigating resets the scroll position', async ({ page }) => {
    await signIn(page, 'chanane@soficlef.local');
    await page.goto('/fr/documents');
    await page.locator('#main-content').evaluate((element) => element.scrollTo(0, 400));
    await page.getByRole('link', { name: /interlocuteurs/i }).click();
    await page.waitForURL('**/contacts');

    const scrollTop = await page.locator('#main-content').evaluate((element) => element.scrollTop);
    expect(scrollTop).toBe(0);
  });
});

test.describe('navigation reflects the signed-in role', () => {
  test('a reader does not see the routes they cannot open', async ({ page }) => {
    await signIn(page, 'charikhi@soficlef.local');

    const nav = page.getByRole('navigation', { name: /navigation/i });
    await expect(nav.getByRole('link', { name: /structures/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /kaizen/i })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /remarques/i })).toHaveCount(0);
  });

  test('a business administrator sees all fifteen', async ({ page }) => {
    await signIn(page, 'chanane@soficlef.local');
    const links = page.getByRole('navigation', { name: /navigation/i }).getByRole('link');
    await expect(links).toHaveCount(15);
  });

  test('a hidden route is still refused when typed directly', async ({ page }) => {
    await signIn(page, 'charikhi@soficlef.local');
    const response = await page.goto('/fr/remarks');
    // Hiding the link is a courtesy; the route is the boundary (ADR-020, ADR-031).
    expect(response?.status()).toBe(404);
  });
});

test.describe('locale switching', () => {
  test('keeps the page and applies RTL', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');
    await page.goto('/fr/organization');

    await page.getByRole('button', { name: /العربية/ }).click();
    await page.waitForURL('**/ar/organization');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    // Same page, in Arabic — the switch is not a trip back to the home screen.
    await expect(page).toHaveURL(/\/ar\/organization$/);
  });

  test('works in all three locales without horizontal overflow', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');

    for (const locale of ['fr', 'ar', 'en']) {
      await page.goto(`/${locale}/welcome`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow in ${locale}`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('keyboard and accessibility', () => {
  test('focus is always visible and the skip link comes first', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');

    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(firstFocused).toMatch(/contenu principal|main content|المحتوى/i);

    const outline = await page.evaluate(() => {
      const active = document.activeElement;
      return active ? getComputedStyle(active).outlineStyle : 'none';
    });
    expect(outline).not.toBe('none');
  });

  test('the navigation can be walked with the keyboard alone', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');

    const firstLink = page
      .getByRole('navigation', { name: /navigation/i })
      .getByRole('link')
      .first();
    await firstLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/fr\/welcome$/);
  });

  for (const locale of ['fr', 'ar']) {
    test(`no accessibility violations on the shell · ${locale}`, async ({ page }) => {
      await signIn(page, 'djaoudi@soficlef.local', 'fr');
      await page.goto(`/${locale}/welcome`);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual(
        [],
      );
    });
  }

  test('no accessibility violations on the sign-in form', async ({ page }) => {
    await page.goto('/fr/login');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe('responsive', () => {
  test('the sidebar collapses into a drawer below tablet width', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('/fr/welcome');

    const menuButton = page.getByRole('button', { name: /ouvrir le menu/i });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: /entreprise/i })).toBeVisible();
  });
});

test.describe('sign out', () => {
  test('revokes the session and returns to the sign-in form', async ({ page }) => {
    await signIn(page, 'djaoudi@soficlef.local');

    await page.getByRole('button', { name: /djaoudi.*menu utilisateur/i }).click();
    await page.getByRole('menuitem', { name: /déconnecter/i }).click();

    await page.waitForURL(/\/login$/);
    // Going back must not resurrect the session: it was revoked server-side.
    await page.goto('/fr/welcome');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('screenshots for the checkpoint', () => {
  const REPRESENTATIVE = ['/welcome', '/organization', '/onboarding'] as const;

  for (const locale of ['fr', 'ar']) {
    for (const route of REPRESENTATIVE) {
      test(`${route} · ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await signIn(page, 'djaoudi@soficlef.local', 'fr');
        await page.goto(`/${locale}${route}`);
        await page.waitForLoadState('networkidle');
        await page.screenshot({
          path: `docs/screenshots/part5-${route.replace('/', '')}-${locale}.png`,
        });
      });
    }
  }

  test('component gallery', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/fr/dev/components');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/part5-components-fr.png', fullPage: true });
  });
});
