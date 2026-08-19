import { expect, test } from '@playwright/test';

/**
 * Locale routing, direction and typography (Part 4 acceptance).
 *
 * The screenshots are the deliverable the client reviews; the assertions are what stops a
 * regression between two reviews.
 */

const LOCALES = [
  { code: 'fr', dir: 'ltr' },
  { code: 'ar', dir: 'rtl' },
  { code: 'en', dir: 'ltr' },
] as const;

test.describe('locale routing', () => {
  test('negotiates a locale at the root', async ({ page }) => {
    await page.goto('/');
    // The unprefixed root negotiates a language and keeps the visitor on the public home
    // page. It used to bounce to the sign-in form, which is right for a private tool and
    // wrong for the front door of a company that publishes this material anyway.
    await expect(page).toHaveURL(/\/(fr|ar|en)$/);
  });

  for (const { code, dir } of LOCALES) {
    test(`/${code} sets lang and dir`, async ({ page }) => {
      await page.goto(`/${code}/login`);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', code);
      await expect(html).toHaveAttribute('dir', dir);
    });
  }

  test('an unknown locale is a 404, not a page in an invented language', async ({ page }) => {
    const response = await page.goto('/de');
    expect(response?.status()).toBe(404);
  });
});

test.describe('typography per locale', () => {
  test('Arabic uses an Arabic-capable display face, not Playfair', async ({ page }) => {
    await page.goto('/ar/dev/tokens');

    const displayFamily = await page.evaluate(() => {
      const probe = document.createElement('h2');
      probe.style.fontFamily = 'var(--type-display)';
      document.body.append(probe);
      const resolved = getComputedStyle(probe).fontFamily;
      probe.remove();
      return resolved;
    });

    // Playfair Display carries no Arabic glyphs (ADR-018).
    expect(displayFamily).toContain('Noto Kufi Arabic');
    expect(displayFamily).not.toContain('Playfair');
  });

  test('French uses Playfair for display', async ({ page }) => {
    await page.goto('/fr/dev/tokens');

    const displayFamily = await page.evaluate(() => {
      const probe = document.createElement('h2');
      probe.style.fontFamily = 'var(--type-display)';
      document.body.append(probe);
      const resolved = getComputedStyle(probe).fontFamily;
      probe.remove();
      return resolved;
    });

    expect(displayFamily).toContain('Playfair Display');
  });
});

test.describe('RTL mirroring', () => {
  test('a start-anchored border moves to the right in Arabic', async ({ page }) => {
    await page.goto('/ar/dev/tokens');

    // The token page renders the same block in both directions. Selecting by test id
    // rather than by `[dir="rtl"]`: on /ar the whole document is RTL, so that selector
    // would also match the LTR demo nested inside it.
    const rtlBlock = page.getByTestId('dir-demo-rtl').locator('.border-s-4');
    await expect(rtlBlock).toBeVisible();

    const borders = await rtlBlock.evaluate((element) => {
      const style = getComputedStyle(element);
      return { left: style.borderLeftWidth, right: style.borderRightWidth };
    });

    expect(borders.right).not.toBe('0px');
    expect(borders.left).toBe('0px');

    // …and the mirror image in the LTR demo on the same page.
    const ltrBorders = await page
      .getByTestId('dir-demo-ltr')
      .locator('.border-s-4')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { left: style.borderLeftWidth, right: style.borderRightWidth };
      });
    expect(ltrBorders.left).not.toBe('0px');
    expect(ltrBorders.right).toBe('0px');
  });

  test('the page never scrolls horizontally in Arabic', async ({ page }) => {
    await page.goto('/ar/dev/tokens');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('screenshots for visual comparison', () => {
  for (const { code } of LOCALES) {
    test(`design tokens · ${code}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.goto(`/${code}/dev/tokens`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `docs/screenshots/part4-tokens-${code}.png`,
        fullPage: true,
      });
    });
  }
});
