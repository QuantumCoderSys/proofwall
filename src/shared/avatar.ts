// Deterministic, soft-toned fallback avatars. Used on the server and in the widget
// so the same person gets the same colours everywhere.

const PALETTE: ReadonlyArray<readonly [bg: string, fg: string]> = [
  ['#fef3c7', '#92400e'],
  ['#dcfce7', '#166534'],
  ['#dbeafe', '#1e40af'],
  ['#fce7f3', '#9d174d'],
  ['#ede9fe', '#5b21b6'],
  ['#ffedd5', '#9a3412'],
  ['#cffafe', '#155e75'],
  ['#f5f5f4', '#44403c'],
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export function avatarColors(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [bg, fg] = PALETTE[hash % PALETTE.length]!;
  return { bg, fg };
}

export const ANONYMOUS = 'Anonymous';
