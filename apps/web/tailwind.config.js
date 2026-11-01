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
        pink: { DEFAULT: c('pink'), soft: c('pink-soft'), deep: c('pink-deep'), ink: c('pink-ink') },
        cacau: { DEFAULT: c('cacau'), soft: c('cacau-soft'), ink: c('cacau-ink') },
        profit: { DEFAULT: c('green'), soft: c('green-soft') },
        loss: { DEFAULT: c('red'), soft: c('red-soft') },
        warn: { DEFAULT: c('amber'), soft: c('amber-soft') },
      },
      // pink and cacau used as TEXT take the ink tone, so text-pink stays AA on white, on its soft tint and in dark mode
      textColor: {
        pink: { DEFAULT: c('pink-ink'), soft: c('pink-soft'), deep: c('pink-deep'), ink: c('pink-ink') },
        cacau: { DEFAULT: c('cacau-ink'), soft: c('cacau-soft'), ink: c('cacau-ink') },
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'none',
        // only what truly floats (menus, dialogs, toasts) casts a shadow
        pop: '0 12px 32px -8px rgb(31 24 20 / 0.20), 0 2px 6px rgb(31 24 20 / 0.06)',
      },
      borderRadius: { card: '10px', sheet: '16px', control: '8px' },
      transitionTimingFunction: { out: 'var(--ease-out)', 'in-out-strong': 'var(--ease-in-out)', drawer: 'var(--ease-drawer)' },
      transitionDuration: { press: '120ms', fast: '160ms', base: '220ms', slow: '320ms' },
    },
  },
  plugins: [],
};
