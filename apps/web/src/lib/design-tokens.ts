/**
 * Velya Design Token Definitions — used by validation scripts and components.
 *
 * This is the runtime expression of the monochromatic hospital design standard.
 * Validation scripts import these constants to check compliance.
 */

/** Tailwind color families that are ALLOWED in TSX class strings */
export const ALLOWED_COLOR_FAMILIES = [
  'neutral',
  'white',
  'black',
  'inherit',
  'current',
  'transparent',
] as const;

/** Tailwind color families that are PROHIBITED — triggers validation failure */
export const PROHIBITED_COLOR_FAMILIES = [
  'red', 'blue', 'green', 'emerald', 'amber', 'yellow', 'orange',
  'sky', 'lime', 'teal', 'cyan', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'stone',
] as const;

/** Regex that matches any prohibited Tailwind color class */
export const PROHIBITED_COLOR_REGEX =
  /\b(?:bg|text|border|ring|outline|shadow|from|to|via|divide|placeholder|decoration|accent|caret|fill|stroke)-(?:red|blue|green|emerald|amber|yellow|orange|sky|lime|teal|cyan|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone)-\d{1,3}\b/g;

/** Unicode code points and emoji patterns that are prohibited in UI text */
export const PROHIBITED_EMOJI_REGEX = new RegExp(
  [
    '[\u{1F300}-\u{1F9FF}]',
    '[\u{2600}-\u{26FF}]',
    '[\u{2700}-\u{27BF}]',
    '[\u{FE00}-\u{FE0F}]',
    '[\u{1FA00}-\u{1FA9F}]',
    '\u{200D}',
    '\u{20E3}',
    '[\u{E0020}-\u{E007F}]',
    '\u2713', // ✓
    '\u2715', // ✕
    '\u2717', // ✗
    '\u2718', // ✘
    '\u2606', // ☆
    '\u2605', // ★
    '\u2610', // ☐
  ].join('|'),
  'gu',
);

/** Allowed neutral Tailwind shades */
export const ALLOWED_NEUTRAL_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Typography scale (Tailwind defaults) */
export const TYPOGRAPHY = {
  pageTitle: 'text-2xl font-semibold tracking-tight text-neutral-900',
  sectionHeader: 'text-lg font-semibold text-neutral-900',
  cardTitle: 'text-sm font-semibold text-neutral-900',
  body: 'text-sm text-neutral-700',
  muted: 'text-sm text-neutral-500',
  label: 'text-xs font-medium uppercase tracking-wider text-neutral-500',
  tableHeader: 'text-xs font-semibold uppercase tracking-wider text-neutral-500',
  kpiValue: 'text-3xl font-bold text-neutral-900',
} as const;

/** Badge standard — single variant for all statuses */
export const BADGE = {
  base: 'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium',
  default: 'border-neutral-300 bg-neutral-100 text-neutral-800',
} as const;

/** Button variants */
export const BUTTON = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-800',
  secondary: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
} as const;

/** Card standard */
export const CARD = {
  base: 'bg-white border border-neutral-200 rounded-lg',
  elevated: 'bg-white border border-neutral-200 rounded-lg shadow-sm',
} as const;

/** Table standard */
export const TABLE = {
  header: 'bg-neutral-50 text-neutral-500 uppercase text-xs font-semibold',
  row: 'bg-white hover:bg-neutral-50',
  cell: 'text-neutral-900',
  divider: 'divide-y divide-neutral-100',
} as const;

/** Alert/Banner standard */
export const ALERT = {
  base: 'bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-lg px-5 py-4',
} as const;

/** Spacing scale reference */
export const SPACING = {
  pageGutter: 'px-6',
  sectionGap: 'gap-6',
  cardPadding: 'p-5',
  cardGap: 'gap-4',
} as const;
