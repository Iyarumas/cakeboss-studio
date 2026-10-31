/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        subtle: c('subtle'),
        line: c('border'),
        divider: c('divider'),
        ink: c('text'),
        muted: c('muted'),
        pink: { DEFAULT: c('pink'), soft: c('pink-soft') },
        lilac: { DEFAULT: c('lilac'), soft: c('lilac-soft') },
        profit: { DEFAULT: c('green'), soft: c('green-soft') },
        loss: { DEFAULT: c('red'), soft: c('red-soft') },
        warn: { DEFAULT: c('amber'), soft: c('amber-soft') },
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.03)',
        pop: '0 12px 32px -8px rgb(16 24 40 / 0.18), 0 2px 6px rgb(16 24 40 / 0.06)',
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
