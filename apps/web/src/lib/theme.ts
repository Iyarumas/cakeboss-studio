/**
 * Brand colors chosen in Configurações. The app's accent comes from two CSS variables,
 * --pink (main color: buttons, active menu, highlights) and --lilac (second color of
 * gradients and secondary highlights), each with a "-soft" tint for backgrounds.
 * A palette here rewrites those variables for light and dark mode.
 */

type RGB = [number, number, number];

export interface AccentPreset {
  id: string;
  label: string;
  primary: string;
  secondary: string;
}

// pairs picked by hand so the gradient between the two reads well; red, green and amber
// are left out on purpose because they already mean loss, profit and warning in the app
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'rosa', label: 'Rosa', primary: '#DB2777', secondary: '#8B5CF6' },
  { id: 'framboesa', label: 'Framboesa', primary: '#BE185D', secondary: '#E11D48' },
  { id: 'chocolate', label: 'Chocolate', primary: '#8A4B2A', secondary: '#C2410C' },
  { id: 'caramelo', label: 'Caramelo', primary: '#A1572B', secondary: '#9C6644' },
  { id: 'lavanda', label: 'Lavanda', primary: '#7C3AED', secondary: '#C084FC' },
  { id: 'azul', label: 'Azul', primary: '#2563EB', secondary: '#7C3AED' },
  { id: 'menta', label: 'Menta', primary: '#0F766E', secondary: '#0EA5E9' },
  { id: 'grafite', label: 'Grafite', primary: '#3F3F46', secondary: '#71717A' },
];

export const DEFAULT_ACCENT = 'rosa';

const hexToRgb = (hex: string): RGB | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const DARK_SURFACE: RGB = [27, 22, 19]; // --surface in dark mode

const luminance = ([r, g, b]: RGB) => {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
export const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Darkens until white text on it reaches 4.5:1 (buttons and badges use white text). */
const readableOnWhiteText = (c: RGB): RGB => {
  let out = c;
  for (let i = 0; i < 20 && contrast(out, WHITE) < 4.5; i++) out = mix(out, BLACK, 0.08);
  return out;
};
/** Lightens until text in this colour reads on the dark surface (4.5:1). */
const visibleOnDark = (c: RGB): RGB => {
  let out = c;
  for (let i = 0; i < 20 && contrast(out, DARK_SURFACE) < 4.5; i++) out = mix(out, WHITE, 0.08);
  return out;
};
/** Darkens until text in this colour reads on its own pale tint (4.5:1). */
const readableOnTint = (c: RGB, tint: RGB): RGB => {
  let out = c;
  for (let i = 0; i < 20 && contrast(out, tint) < 4.5; i++) out = mix(out, BLACK, 0.06);
  return out;
};

/** A second color for a custom choice: the same color turned toward violet, so gradients stay in the family. */
const companion = (c: RGB): RGB => mix(c, [139, 92, 246], 0.45);

export interface ResolvedAccent {
  primary: string;
  secondary: string;
  /** true when the chosen color was darkened so white text stays readable */
  adjusted: boolean;
}

/** `choice` is a preset id or a "#RRGGBB" color; anything unknown falls back to the default. */
export function resolveAccent(choice: string | undefined): ResolvedAccent {
  const preset = ACCENT_PRESETS.find((p) => p.id === choice);
  if (preset) return { primary: preset.primary, secondary: preset.secondary, adjusted: false };
  const rgb = choice ? hexToRgb(choice) : null;
  if (!rgb) return resolveAccent(DEFAULT_ACCENT);
  const safe = readableOnWhiteText(rgb);
  return { primary: rgbToHex(safe), secondary: rgbToHex(companion(safe)), adjusted: rgbToHex(safe) !== rgbToHex(rgb) };
}

const triplet = (c: RGB) => c.map((v) => Math.round(v)).join(' ');

/** CSS that overrides the accent variables for light and dark mode. */
export function accentCss(choice: string | undefined): string {
  const { primary, secondary } = resolveAccent(choice);
  const p = hexToRgb(primary)!;
  const s = hexToRgb(secondary)!;
  // --pink is the fill behind white text; --pink-ink is the colour used as text (see index.css)
  const pSoft = mix(p, WHITE, 0.88);
  const sSoft = mix(s, WHITE, 0.88);
  const light = [
    `--pink: ${triplet(p)}`, `--pink-soft: ${triplet(pSoft)}`, `--pink-ink: ${triplet(readableOnTint(p, pSoft))}`, `--pink-deep: ${triplet(mix(p, BLACK, 0.3))}`,
    `--lilac: ${triplet(s)}`, `--lilac-soft: ${triplet(sSoft)}`, `--lilac-ink: ${triplet(readableOnTint(s, sSoft))}`,
  ];
  const dp = visibleOnDark(p);
  const ds = visibleOnDark(s);
  const dark = [
    `--pink: ${triplet(p)}`, `--pink-soft: ${triplet(mix(DARK_SURFACE, dp, 0.28))}`, `--pink-ink: ${triplet(dp)}`, `--pink-deep: ${triplet(mix(p, BLACK, 0.3))}`,
    `--lilac: ${triplet(ds)}`, `--lilac-soft: ${triplet(mix(DARK_SURFACE, ds, 0.28))}`, `--lilac-ink: ${triplet(ds)}`,
  ];
  // "html …" outranks the defaults in index.css (":root, [data-theme]"); the descendant form covers
  // areas that pin their own theme, like the store's always-light wrapper
  return `html:not([data-theme]), html[data-theme='light'], html [data-theme='light'] { ${light.join('; ')}; }\nhtml[data-theme='dark'], html [data-theme='dark'] { ${dark.join('; ')}; }`;
}

/** Writes (or replaces) the accent style tag; one tag per area so the store and the admin never mix. */
export function applyAccent(choice: string | undefined) {
  if (typeof document === 'undefined') return;
  let tag = document.getElementById('accent-colors') as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'accent-colors';
    document.head.appendChild(tag);
  }
  tag.textContent = accentCss(choice);
}
