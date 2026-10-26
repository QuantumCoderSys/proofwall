import type { Space, SpaceSummary } from '../../lib/db';
import { buildSnippet, highlightSnippet } from '../../shared/snippet';
import type { Layout, Theme } from '../../shared/types';
import { CopyButton } from '../components';
import { ASSET_VERSION } from '../document';
import { Icon, type IconName } from '../icons';
import { SpaceLayout } from '../space-layout';

interface ShareProps {
  host: string;
  origin: string;
  spaces: SpaceSummary[];
  space: Space;
  toast?: string;
}

const LAYOUTS: Array<{ value: Layout; label: string }> = [
  { value: 'wall', label: 'Wall' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'card', label: 'Single card' },
];

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
];

export const SpaceSharePage = (props: ShareProps) => {
  const { space, origin } = props;
  const approved = props.spaces.find((s) => s.id === space.id)?.approved ?? 0;
  const snippet = buildSnippet({ origin, slug: space.slug, layout: 'wall', theme: 'light' });

  return (
    <SpaceLayout
      host={props.host}
      origin={origin}
      spaces={props.spaces}
      space={space}
      tab="share"
      toast={props.toast}
    >
      <div class="stack">
        <section class="card">
          <ShareRow
            icon="link"
            title="Collection form"
            description="Send this to customers — by email, in your app, or right after a great support chat."
            url={`${origin}/c/${space.slug}`}
          />
          <ShareRow
            icon="heart"
            title="Wall of Love"
            description="A public page with every approved testimonial. Link it from your site's footer."
            url={`${origin}/w/${space.slug}`}
          />
        </section>

        <section class="card" data-embed-builder data-origin={origin} data-slug={space.slug}>
          <header class="card-head">
            <div>
              <h2 class="card-title">Embed on your site</h2>
              <p class="card-sub">
                Paste one script tag where testimonials should appear. Only approved testimonials are shown, and new
                approvals appear automatically.
              </p>
            </div>
          </header>

          <div class="card-body embed-builder">
            <div class="embed-options">
              <Segmented name="layout" label="Layout" options={LAYOUTS} value="wall" />
              <Segmented name="theme" label="Theme" options={THEMES} value="light" />
            </div>
            <div class="code-wrap">
              <pre class="code" id="embed-code">
                <code data-embed-code dangerouslySetInnerHTML={{ __html: highlightSnippet(snippet) }} />
              </pre>
              <CopyButton from="#embed-code" class="btn-sm code-copy" />
            </div>
          </div>

          <div class="preview-head">
            <span class="label">Live preview</span>
            <span class="hint">
              {approved === 0
                ? 'Approve a testimonial to see it here.'
                : `${approved} approved testimonial${approved === 1 ? '' : 's'}`}
            </span>
          </div>
          <div class="preview" data-embed-preview />
        </section>

        <section class="card">
          <header class="card-head">
            <div>
              <h2 class="card-title">JSON API</h2>
              <p class="card-sub">Building your own layout? Approved testimonials as JSON, CORS-enabled and cached for 60s.</p>
            </div>
          </header>
          <div class="card-body">
            <LinkField value={`${origin}/api/v1/spaces/${space.slug}`} />
          </div>
        </section>
      </div>
      <script src={`/embed.js?v=${ASSET_VERSION}`} defer />
    </SpaceLayout>
  );
};

const ShareRow = (props: { icon: IconName; title: string; description: string; url: string }) => (
  <div class="share-row">
    <div class="share-icon">
      <Icon name={props.icon} size={16} />
    </div>
    <div class="share-main">
      <h2 class="card-title">{props.title}</h2>
      <p class="card-sub">{props.description}</p>
      <LinkField value={props.url} open />
    </div>
  </div>
);

const LinkField = (props: { value: string; open?: boolean }) => (
  <div class="link-field">
    <input class="input mono" value={props.value} readonly aria-label="URL" data-select-on-focus />
    <CopyButton value={props.value} />
    {props.open && (
      <a class="btn btn-secondary btn-icon" href={props.value} target="_blank" rel="noopener" title="Open" aria-label="Open">
        <Icon name="external" size={14} />
      </a>
    )}
  </div>
);

const Segmented = <T extends string>(props: {
  name: string;
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
}) => (
  <fieldset class="field fieldset">
    <legend class="label">{props.label}</legend>
    <div class="segmented">
      {props.options.map((o) => (
        <label class="seg-radio">
          <input type="radio" name={props.name} value={o.value} checked={o.value === props.value} class="sr-only" />
          <span class="seg-item">{o.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);
