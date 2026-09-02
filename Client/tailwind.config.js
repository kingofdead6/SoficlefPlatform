/**
 * Tailwind v4 is configured primarily via the `@theme` block in src/index.css (the
 * design tokens ported from SoficlefPlatform/src/styles/tokens.css). This file exists
 * for tooling that still reads a JS config and to document the same values in one place.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'red-brand': '#c8102e',
        'red-strong': '#a00c24',
        'red-deep': '#7f0a1d',
        'red-light': '#e11d38',
        'red-accent': '#f2879a',
        bg: '#fbfafa',
        surface: '#ffffff',
        'surface-2': '#f4f1f1',
        border: '#e6e0e1',
        'status-green': '#116b41',
        'status-red': '#8b0012',
        'status-amber': '#8a5a00',
        'status-blue': '#1e4d8c',
        text: '#171314',
        'text-muted': '#4e4547',
        'text-dim': '#6b6164',
      },
      borderRadius: {
        app: '10px',
      },
      boxShadow: {
        app: '0 1px 4px rgba(23, 19, 20, 0.07)',
        'app-lifted': '0 6px 20px -6px rgba(127, 10, 29, 0.18)',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
};
