export const DEFAULT_ACCENT = '#171717';

export const ACCENT_PRESETS = [
  '#171717',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#e11d48',
  '#ea580c',
  '#16a34a',
  '#0d9488',
] as const;

export function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  let v = input.trim().toLowerCase();
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Readable text colour to place on top of the accent. */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.45 ? '#0a0a0a' : '#ffffff';
}

/** Inline CSS custom properties used by public pages. `hex` must already be normalised. */
export function accentVars(hex: string): string {
  return `--accent:${hex};--accent-fg:${contrastText(hex)}`;
}
