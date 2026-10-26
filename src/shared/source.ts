// Attribution for imported testimonials. Shared by the Worker and the widget.

export type ImportKind = 'web' | 'x' | 'bluesky';

/** Short label for where a testimonial came from, e.g. "X" or "trustpilot.com". */
export function sourceLabel(source: string | null, url: string | null): string | null {
  if (!source) return null;
  if (source === 'x') return 'X';
  if (source === 'bluesky') return 'Bluesky';
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}
