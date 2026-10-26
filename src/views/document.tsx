import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';

export const ASSET_VERSION = '1.0.0';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap';

const TOASTS: Record<string, string> = {
  created: 'Space created — share your link to start collecting.',
  saved: 'Changes saved',
  approved: 'Testimonial approved',
  rejected: 'Testimonial rejected',
  pending: 'Moved back to pending',
  featured: 'Pinned to the top',
  unfeatured: 'Unpinned',
  deleted: 'Deleted',
  'space-deleted': 'Space deleted',
  imported: 'Imported — they’re waiting for your review',
  'imported-approved': 'Imported and published',
  'nothing-new': 'Nothing new — those were already imported',
  'nothing-selected': 'Nothing was selected to import',
  added: 'Testimonial added',
  checked: 'Checked for new testimonials',
  'source-removed': 'Stopped checking that link',
};

export function toastMessage(code: string | undefined): string | undefined {
  return code ? TOASTS[code] : undefined;
}

export interface DocumentProps {
  title: string;
  description?: string;
  noindex?: boolean;
  bodyClass?: string;
  bodyStyle?: string;
  toast?: string;
  head?: Child;
  children?: Child;
}

export const Document = (props: DocumentProps) => (
  <>
    {raw('<!doctype html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{props.title}</title>
        {props.description && <meta name="description" content={props.description} />}
        {props.description && <meta property="og:description" content={props.description} />}
        <meta property="og:title" content={props.title} />
        {props.noindex && <meta name="robots" content="noindex, nofollow" />}
        <meta name="theme-color" content="#fafafa" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href={FONTS} />
        <link rel="stylesheet" href={`/assets/app.css?v=${ASSET_VERSION}`} />
        {props.head}
      </head>
      <body class={props.bodyClass} style={props.bodyStyle} data-toast={toastMessage(props.toast)}>
        {props.children}
        <div class="toasts" id="toasts" role="status" aria-live="polite" />
        <script src={`/assets/app.js?v=${ASSET_VERSION}`} defer />
      </body>
    </html>
  </>
);
