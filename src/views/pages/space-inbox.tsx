import { displayName, type Space, type SpaceSummary, type Status, type Testimonial } from '../../lib/db';
import { formatDate, timeAgo } from '../../lib/format';
import { mediaUrl } from '../../lib/uploads';
import { Avatar, EmptyState, StatusPill, Stars } from '../components';
import { ActionForm } from '../forms';
import { Icon } from '../icons';
import { SpaceLayout } from '../space-layout';

export type InboxFilter = Status | 'all';

interface InboxProps {
  host: string;
  origin: string;
  spaces: SpaceSummary[];
  space: Space;
  filter: InboxFilter;
  page: number;
  items: Testimonial[];
  hasMore: boolean;
  toast?: string;
}

const FILTERS: Array<{ key: InboxFilter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const HINTS: Record<InboxFilter, string> = {
  pending: 'New submissions wait here until you approve them.',
  approved: 'Live on your wall and embeds. Pinned ones show first.',
  rejected: 'Hidden from the public. You can still approve them later.',
  all: 'Everything submitted to this space.',
};

export const SpaceInboxPage = (props: InboxProps) => {
  const summary = props.spaces.find((s) => s.id === props.space.id);
  const counts: Record<InboxFilter, number> = {
    pending: summary?.pending ?? 0,
    approved: summary?.approved ?? 0,
    rejected: summary?.rejected ?? 0,
    all: summary?.total ?? 0,
  };
  const base = `/app/spaces/${props.space.id}`;
  const here = `${base}?status=${props.filter}${props.page > 1 ? `&page=${props.page}` : ''}`;

  return (
    <SpaceLayout
      host={props.host}
      origin={props.origin}
      spaces={props.spaces}
      space={props.space}
      tab="testimonials"
      toast={props.toast}
    >
      <div class="toolbar" data-region="filters">
        <nav class="segmented" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <a
              href={`${base}?status=${f.key}`}
              class={f.key === props.filter ? 'seg-item is-active' : 'seg-item'}
              aria-current={f.key === props.filter ? 'page' : undefined}
            >
              {f.label}
              <span class="seg-count">{counts[f.key]}</span>
            </a>
          ))}
        </nav>
        <p class="hint hide-mobile">{HINTS[props.filter]}</p>
      </div>

      <div data-region="inbox">
        {props.items.length > 0 ? (
          <div class="t-list">
            {props.items.map((t) => (
              <AdminCard t={t} next={here} />
            ))}
          </div>
        ) : (
          <div class="card">
            <InboxEmpty filter={props.filter} space={props.space} total={counts.all} />
          </div>
        )}

        {(props.page > 1 || props.hasMore) && (
          <nav class="pager" aria-label="Pagination">
            {props.page > 1 ? (
              <a class="btn btn-secondary btn-sm" href={`${base}?status=${props.filter}&page=${props.page - 1}`}>
                <Icon name="chevronLeft" size={14} /> Newer
              </a>
            ) : (
              <span />
            )}
            <span class="hint">Page {props.page}</span>
            {props.hasMore ? (
              <a class="btn btn-secondary btn-sm" href={`${base}?status=${props.filter}&page=${props.page + 1}`}>
                Older <Icon name="chevronRight" size={14} />
              </a>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </SpaceLayout>
  );
};

const InboxEmpty = (props: { filter: InboxFilter; space: Space; total: number }) => {
  if (props.total === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="No testimonials yet"
        action={
          <a class="btn btn-primary" href={`/app/spaces/${props.space.id}/share`}>
            <Icon name="link" size={14} /> Get your collection link
          </a>
        }
      >
        Share your collection link with a few happy customers. Their testimonials will land here for review.
      </EmptyState>
    );
  }
  const copy: Record<InboxFilter, [string, string]> = {
    pending: ['Inbox zero', 'Nothing waiting for review. Nice work.'],
    approved: ['Nothing approved yet', 'Approve a pending testimonial to put it on your wall.'],
    rejected: ['Nothing rejected', 'Testimonials you reject are kept here, out of public view.'],
    all: ['Nothing here', ''],
  };
  const [title, text] = copy[props.filter];
  return (
    <EmptyState icon={props.filter === 'pending' ? 'check' : 'inbox'} title={title}>
      {text}
    </EmptyState>
  );
};

export const AdminCard = ({ t, next }: { t: Testimonial; next: string }) => {
  const name = displayName(t);
  const statusUrl = `/app/testimonials/${t.id}/status`;
  return (
    <article class={`card t-card is-${t.status}`} id={`t-${t.id}`} data-item>
      <header class="t-head">
        <Avatar name={name} photoUrl={mediaUrl('', t.photoKey)} size={40} />
        <div class="t-who">
          <div class="t-name">
            <span class="truncate">{name}</span>
            {t.featured && t.status === 'approved' && (
              <span class="pill pill-featured" title="Pinned to the top of your wall">
                <Icon name="pin" size={11} /> Pinned
              </span>
            )}
          </div>
          {t.authorRole && <div class="t-role truncate">{t.authorRole}</div>}
        </div>
        <Stars rating={t.rating} size={14} />
      </header>

      <p class="t-body">{t.body}</p>

      <footer class="t-foot">
        <StatusPill status={t.status} />
        <time class="t-date" datetime={new Date(t.createdAt).toISOString()} title={formatDate(t.createdAt)}>
          {timeAgo(t.createdAt)}
        </time>

        <div class="t-actions">
          <ActionForm
            action={`/app/testimonials/${t.id}/delete`}
            next={next}
            confirm="Delete this testimonial permanently? This can't be undone."
          >
            <button type="submit" class="btn btn-ghost btn-sm btn-icon btn-danger-hover" title="Delete" aria-label="Delete">
              <Icon name="trash" size={14} />
            </button>
          </ActionForm>

          {t.status === 'approved' && (
            <ActionForm
              action={`/app/testimonials/${t.id}/feature`}
              next={next}
              fields={{ featured: t.featured ? '0' : '1' }}
            >
              <button
                type="submit"
                class={t.featured ? 'btn btn-secondary btn-sm is-on' : 'btn btn-secondary btn-sm'}
                title={t.featured ? 'Unpin' : 'Pin to the top of your wall'}
              >
                <Icon name="pin" size={14} />
                {t.featured ? 'Unpin' : 'Pin'}
              </button>
            </ActionForm>
          )}

          {t.status !== 'pending' && (
            <ActionForm action={statusUrl} next={next} fields={{ status: 'pending' }}>
              <button type="submit" class="btn btn-secondary btn-sm" title="Move back to pending">
                <Icon name="undo" size={14} />
                <span class="hide-mobile">To pending</span>
              </button>
            </ActionForm>
          )}

          {t.status !== 'rejected' && (
            <ActionForm action={statusUrl} next={next} fields={{ status: 'rejected' }}>
              <button type="submit" class="btn btn-secondary btn-sm">
                <Icon name="x" size={14} />
                {t.status === 'approved' ? 'Hide' : 'Reject'}
              </button>
            </ActionForm>
          )}

          {t.status !== 'approved' && (
            <ActionForm action={statusUrl} next={next} fields={{ status: 'approved' }}>
              <button type="submit" class="btn btn-primary btn-sm">
                <Icon name="check" size={14} />
                Approve
              </button>
            </ActionForm>
          )}
        </div>
      </footer>
    </article>
  );
};
