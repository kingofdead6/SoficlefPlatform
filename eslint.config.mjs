import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

/**
 * Lint is a CI gate (ADR-017). Two rules here are architectural rather than stylistic and
 * exist so a constraint is enforced instead of remembered:
 *
 *  1. Layering (ADR-019) — `src/domain` imports no framework: no Next, no Prisma, no React.
 *  2. RTL safety (ADR-029) — physical direction properties are banned in favour of logical
 *     ones, in CSS-in-JS style objects and in Tailwind class names alike, so every
 *     component is RTL-safe by construction rather than by review.
 */

/** Tailwind utilities that hardcode a physical side. `ms-`/`me-`/`ps-`/`pe-` replace them. */
const PHYSICAL_TAILWIND = String.raw`\b(?:ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|left|right|text-left|text-right|float-left|float-right)-`;

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/infrastructure/db/generated/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: `JSXAttribute[name.name=/^(className)$/] > Literal[value=/${PHYSICAL_TAILWIND}/]`,
          message:
            'Use logical Tailwind utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) so the layout mirrors in Arabic — ADR-029.',
        },
        {
          selector: `JSXAttribute[name.name=/^(className)$/] TemplateElement[value.raw=/${PHYSICAL_TAILWIND}/]`,
          message:
            'Use logical Tailwind utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) so the layout mirrors in Arabic — ADR-029.',
        },
        {
          selector:
            'Property[key.name=/^(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight|left|right)$/]',
          message:
            'Use logical CSS properties (margin-inline-start, padding-inline, inset-inline-start, …) so the layout mirrors in Arabic — ADR-029.',
        },
      ],
    },
  },
  {
    // The domain layer holds business rules and must stay framework-free (ADR-019).
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'next',
                'next/*',
                'react',
                'react-*',
                '@prisma/*',
                'server-only',
                '@/infrastructure/*',
              ],
              message:
                'src/domain must not import a framework or an adapter. Move the dependency to src/application or src/infrastructure — ADR-019.',
            },
          ],
        },
      ],
    },
  },
  {
    // Scripts, not application code: they report to a terminal.
    files: ['seed/**/*.ts', 'prisma/seed.ts', 'tests/**/*.ts', '*.config.ts', '*.config.mjs'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
