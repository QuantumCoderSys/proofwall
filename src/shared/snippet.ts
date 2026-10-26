// Builds the embed snippet shown in the dashboard. Shared so the server-rendered
// first paint and the live builder produce identical output.
import type { Layout, Theme } from './types';

export interface SnippetOptions {
  origin: string;
  slug: string;
  layout: Layout;
  theme: Theme;
}

export function buildSnippet({ origin, slug, layout, theme }: SnippetOptions): string {
  const attrs = [`src="${origin}/embed.js"`, `data-space="${slug}"`, `data-layout="${layout}"`];
  if (theme !== 'light') attrs.push(`data-theme="${theme}"`);
  return `<script ${attrs.join(' ')} async></script>`;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Lightweight syntax colouring for a single tag. Input is escaped before wrapping. */
export function highlightSnippet(snippet: string): string {
  return escapeHtml(snippet)
    .replace(/(&lt;\/?)(script)/g, '$1<span class="tok-tag">$2</span>')
    .replace(/ ([a-z-]+)=(&quot;[^&]*&quot;)/g, ' <span class="tok-attr">$1</span>=<span class="tok-str">$2</span>')
    .replace(/ (async)(?=&gt;)/, ' <span class="tok-attr">$1</span>');
}
