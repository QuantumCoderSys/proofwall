import type { ImportSource, Space, SpaceSummary, Status } from '../../lib/db';
import { formatDate, timeAgo } from '../../lib/format';
import type { ExtractResult } from '../../lib/importer';
import { sourceLabel } from '../../shared/source';
import { FieldError, Stars } from '../components';
import { ActionForm } from '../forms';
import { Icon } from '../icons';
import { SpaceLayout } from '../space-layout';

export interface ManualValues {
  body: string;
  name: string;
  role: string;
  rating: string;
  sourceUrl: string;
  status: Status;
}

export type ManualErrors = Partial<Record<'body' | 'name' | 'role' | 'rating' | 'sourceUrl', string>>;

interface ImportProps {
  host: string;
  origin: string;
  spaces: SpaceSummary[];
  space: Space;
  sources: ImportSource[];
  toast?: string;
  url?: string;
  error?: string;
  preview?: ExtractResult;
  watchable?: boolean;
  manual?: ManualValues;
  manualErrors?: ManualErrors;
}

export const SpaceImportPage = (props: ImportProps) => {
  const base = `/app/spaces/${props.space.id}`;
  const m = props.manual ?? { body: '', name: '', role: '', rating: '', sourceUrl: '', status: 'approved' as Status };
  const me = props.manualErrors ?? {};
  const found = props.preview?.candidates.length ?? 0;

  return (
    <SpaceLayout
      host={props.host}
      origin={props.origin}
      spaces={props.spaces}
      space={props.space}
      tab="import"
      toast={props.toast}
    >
      <div class="stack">
        <section class="card">
          <header class="card-head">
            <div>
              <h2 class="card-title">Import from a link</h2>
              <p class="card-sub">
                Paste a review page, a post on X or Bluesky, or a page on your own site. ProofWall fetches it itself, so
                there's no scraping service or API bill.
              </p>
            </div>
          </header>
          <form class="card-body import-form" method="post" action={`${base}/import/preview`} data-submit-once>
            <div class={props.error ? 'field has-error' : 'field'}>
              <div class="link-field link-field-flush">
                <input
                  class="input"
                  type="url"
                  name="url"
                  value={props.url}
                  required
                  placeholder="https://x.com/jane/status/…  or  https://yoursite.com/customers"
                  aria-label="Link to import from"
                />
                <button type="submit" class="btn btn-primary" data-busy-label="Looking…">
                  Find testimonials
                </button>
              </div>
              <FieldError message={props.error} />
            </div>
            <ul class="import-hints">
              <li>
                <Icon name="star" size={14} />
                Review pages that publish review data (schema.org), which many review sites and shops do
              </li>
              <li>
                <Icon name="quote" size={14} />
                Posts on X and Bluesky. Paste the post's link.
              </li>
              <li>
                <Icon name="globe" size={14} />
                Testimonials on your own site in <code>&lt;blockquote&gt;</code> tags, including embedded posts
              </li>
            </ul>
          </form>
        </section>

        {props.preview && (
          <section class="card" id="preview">
            <header class="card-head">
              <div>
                <h2 class="card-title">
                  {found} testimonial{found === 1 ? '' : 's'} found
                </h2>
                <p class="card-sub">{props.preview.summary} Untick any you don't want.</p>
              </div>
            </header>
            <form method="post" action={`${base}/import`} data-submit-once>
              <input type="hidden" name="url" value={props.url} />
              <div class="candidates">
                {props.preview.candidates.map((c) => (
                  <label class="candidate">
                    <input type="checkbox" name="item" value={JSON.stringify(c)} checked />
                    <div class="candidate-main">
                      <div class="candidate-meta">
                        <span class="candidate-name">{c.name ?? 'Anonymous'}</span>
                        {c.role && <span class="candidate-role truncate">{c.role}</span>}
                        <Stars rating={c.rating} size={12} />
                      </div>
                      <p class="candidate-body">{c.body}</p>
                      <span class="candidate-source">
                        via {sourceLabel(c.source, c.sourceUrl)} · {formatDate(c.createdAt)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <div class="import-actions">
                {props.watchable && (
                  <label class="check-inline">
                    <input type="checkbox" name="watch" value="1" checked /> Check this page daily and import new ones
                  </label>
                )}
                <div class="row-sm push-right">
                  <select class="select" name="status" aria-label="Import as">
                    <option value="pending">Import as pending</option>
                    <option value="approved">Import as approved</option>
                  </select>
                  <button type="submit" class="btn btn-primary" data-busy-label="Importing…">
                    Import selected
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        <section class="card">
          <header class="card-head">
            <div>
              <h2 class="card-title">Checked daily</h2>
              <p class="card-sub">
                New testimonials on these pages arrive in your inbox as pending, so nothing goes public without you. A
                free Cloudflare cron trigger does the checking.
              </p>
            </div>
          </header>
          <div data-region="sources">
            {props.sources.length > 0 ? (
              props.sources.map((s) => (
                <div class="source-row" data-item>
                  <div class="share-icon">
                    <Icon name="globe" size={15} />
                  </div>
                  <div class="source-main">
                    <a class="source-url truncate" href={s.url} target="_blank" rel="noopener nofollow">
                      {s.url.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                    <div class="hint truncate">
                      {s.lastRunAt ? `Checked ${timeAgo(s.lastRunAt)} · ${s.lastStatus ?? ''}` : 'Waiting for its first check'}
                    </div>
                  </div>
                  <ActionForm action={`/app/sources/${s.id}/run`} next={`${base}/import`}>
                    <button type="submit" class="btn btn-secondary btn-sm">
                      <Icon name="refresh" size={14} />
                      <span class="hide-mobile">Check now</span>
                    </button>
                  </ActionForm>
                  <ActionForm
                    action={`/app/sources/${s.id}/delete`}
                    next={`${base}/import`}
                    confirm="Stop checking this link? Testimonials already imported stay put."
                  >
                    <button
                      type="submit"
                      class="btn btn-ghost btn-sm btn-icon btn-danger-hover"
                      title="Stop checking"
                      aria-label="Stop checking this link"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </ActionForm>
                </div>
              ))
            ) : (
              <p class="card-body hint">
                No links yet. When you import from a web page, tick “Check this page daily” and it will show up here.
              </p>
            )}
          </div>
        </section>

        <section class="card" id="manual">
          <header class="card-head">
            <div>
              <h2 class="card-title">Add one by hand</h2>
              <p class="card-sub">
                For places that block automated access, like LinkedIn, Google reviews or an email. Paste the words and
                link to the original.
              </p>
            </div>
          </header>
          <form method="post" action={`${base}/import`} class="card-body form-grid" data-submit-once>
            <input type="hidden" name="manual" value="1" />
            <div class={me.body ? 'field has-error' : 'field'}>
              <label class="label" for="manual-body">
                Testimonial
              </label>
              <textarea id="manual-body" name="body" class="textarea" rows={4} required maxlength={2000}>
                {m.body}
              </textarea>
              <FieldError message={me.body} />
            </div>
            <div class="grid-2">
              <div class={me.name ? 'field has-error' : 'field'}>
                <label class="label" for="manual-name">
                  Name <span class="opt">optional</span>
                </label>
                <input id="manual-name" name="name" class="input" value={m.name} maxlength={80} />
                <FieldError message={me.name} />
              </div>
              <div class={me.role ? 'field has-error' : 'field'}>
                <label class="label" for="manual-role">
                  Role & company <span class="opt">optional</span>
                </label>
                <input id="manual-role" name="role" class="input" value={m.role} maxlength={100} />
                <FieldError message={me.role} />
              </div>
            </div>
            <div class="grid-2">
              <div class={me.rating ? 'field has-error' : 'field'}>
                <label class="label" for="manual-rating">
                  Rating
                </label>
                <select id="manual-rating" name="rating" class="select">
                  <option value="" selected={m.rating === ''}>
                    No rating
                  </option>
                  {['5', '4', '3', '2', '1'].map((r) => (
                    <option value={r} selected={m.rating === r}>
                      {'★'.repeat(Number(r))} {r}
                    </option>
                  ))}
                </select>
                <FieldError message={me.rating} />
              </div>
              <div class={me.sourceUrl ? 'field has-error' : 'field'}>
                <label class="label" for="manual-source">
                  Link to original <span class="opt">optional</span>
                </label>
                <input
                  id="manual-source"
                  name="source_url"
                  type="url"
                  class="input"
                  value={m.sourceUrl}
                  placeholder="https://"
                />
                <FieldError message={me.sourceUrl} />
              </div>
            </div>
            <div class="form-actions">
              <select class="select" name="status" aria-label="Add as">
                <option value="approved" selected={m.status === 'approved'}>
                  Add as approved
                </option>
                <option value="pending" selected={m.status === 'pending'}>
                  Add as pending
                </option>
              </select>
              <button type="submit" class="btn btn-primary" data-busy-label="Adding…">
                Add testimonial
              </button>
            </div>
          </form>
        </section>
      </div>
    </SpaceLayout>
  );
};
