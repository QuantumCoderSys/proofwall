import type { Child } from 'hono/jsx';
import { displayName, type SpaceSummary, type TestimonialWithSpace } from '../../lib/db';
import { formatRating, timeAgo } from '../../lib/format';
import { mediaUrl } from '../../lib/uploads';
import { AppShell } from '../app-shell';
import { Avatar, EmptyState, SpaceLogo, Stars } from '../components';
import { ActionForm } from '../forms';
import { Icon, StarGlyph } from '../icons';

interface OverviewProps {
  host: string;
  spaces: SpaceSummary[];
  pending: TestimonialWithSpace[];
  toast?: string;
}

export const OverviewPage = (props: OverviewProps) => {
  const total = props.spaces.reduce((n, s) => n + s.total, 0);
  const pending = props.spaces.reduce((n, s) => n + s.pending, 0);
  const approved = props.spaces.reduce((n, s) => n + s.approved, 0);
  const ratingSum = props.spaces.reduce((n, s) => n + s.approvedRatingSum, 0);
  const newThisWeek = props.spaces.reduce((n, s) => n + s.newThisWeek, 0);
  const average = approved > 0 ? ratingSum / approved : 0;

  return (
    <AppShell
      title="Overview"
      host={props.host}
      spaces={props.spaces}
      activeNav="overview"
      crumbs={[{ label: 'Overview' }]}
      toast={props.toast}
      actions={
        props.spaces.length > 0 && (
          <a class="btn btn-primary btn-sm" href="/app/spaces/new">
            <Icon name="plus" size={14} />
            New space
          </a>
        )
      }
    >
      {props.spaces.length === 0 ? (
        <Welcome />
      ) : (
        <>
          <div class="page-head">
            <div>
              <h1 class="page-title">Overview</h1>
              <p class="page-sub">Here's how your social proof is doing across every space.</p>
            </div>
          </div>

          <section class="stats" aria-label="Totals" data-region="stats">
            <Stat label="Testimonials" icon="quote" value={total.toLocaleString('en')}>
              {newThisWeek > 0 ? <span class="up">+{newThisWeek} this week</span> : 'No new ones this week'}
            </Stat>
            <Stat label="Waiting for review" icon="clock" value={pending.toLocaleString('en')}>
              {pending > 0 ? 'Approve them to go live' : 'Inbox zero'}
            </Stat>
            <Stat label="On your walls" icon="heart" value={approved.toLocaleString('en')}>
              Approved & public
            </Stat>
            <Stat label="Average rating" icon="star" value={formatRating(average)}>
              {approved > 0 ? (
                <span class="stat-stars">
                  <Stars rating={Math.round(average)} size={11} />
                </span>
              ) : (
                'From approved testimonials'
              )}
            </Stat>
          </section>

          <div class="overview-grid">
            <section class="card">
              <header class="card-head">
                <div>
                  <h2 class="card-title">Waiting for review</h2>
                  <p class="card-sub">The newest submissions across all spaces.</p>
                </div>
              </header>
              <div data-region="pending">
                {props.pending.length > 0 ? (
                  props.pending.map((t) => <ReviewRow t={t} />)
                ) : (
                  <EmptyState icon="check" title="You're all caught up">
                    New testimonials land here first. Share your collection link to get more.
                  </EmptyState>
                )}
              </div>
            </section>

            <section class="card">
              <header class="card-head">
                <h2 class="card-title">Spaces</h2>
                <a class="btn btn-ghost btn-sm" href="/app/spaces/new">
                  <Icon name="plus" size={14} />
                  New
                </a>
              </header>
              <div data-region="spaces">
                {props.spaces.map((s) => (
                  <a class="space-row" href={`/app/spaces/${s.id}`}>
                    <SpaceLogo space={s} size={34} />
                    <div class="space-row-main">
                      <div class="space-row-name truncate">{s.name}</div>
                      <div class="space-row-meta">
                        {s.approved} live
                        <span class="sep">·</span>
                        {s.pending > 0 ? <span class="attention">{s.pending} pending</span> : `${s.pending} pending`}
                      </div>
                    </div>
                    <Icon name="chevronRight" size={16} class="muted-icon" />
                  </a>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
};

const Stat = (props: { label: string; icon: 'quote' | 'clock' | 'heart' | 'star'; value: string; children?: Child }) => (
  <div class="card stat">
    <div class="stat-label">
      <Icon name={props.icon} size={14} />
      {props.label}
    </div>
    <div class="stat-value">{props.value}</div>
    <div class="stat-meta">{props.children}</div>
  </div>
);

const ReviewRow = ({ t }: { t: TestimonialWithSpace }) => {
  const name = displayName(t);
  return (
    <article class="review-row" data-item>
      <Avatar name={name} photoUrl={mediaUrl('', t.photoKey)} size={36} />
      <div class="review-main">
        <div class="review-meta">
          <span class="review-name truncate">{name}</span>
          <Stars rating={t.rating} size={12} />
          <span class="review-time">{timeAgo(t.createdAt)}</span>
        </div>
        <p class="review-text">{t.body}</p>
        <a class="review-space" href={`/app/spaces/${t.spaceId}`}>
          <SpaceLogo space={{ name: t.spaceName, logoKey: t.spaceLogoKey, accentColor: t.spaceAccent }} size={14} />
          {t.spaceName}
        </a>
      </div>
      <div class="review-actions">
        <ActionForm action={`/app/testimonials/${t.id}/status`} next="/app" fields={{ status: 'rejected' }}>
          <button type="submit" class="btn btn-secondary btn-sm btn-icon" title="Reject" aria-label="Reject">
            <Icon name="x" size={14} />
          </button>
        </ActionForm>
        <ActionForm action={`/app/testimonials/${t.id}/status`} next="/app" fields={{ status: 'approved' }}>
          <button type="submit" class="btn btn-primary btn-sm">
            <Icon name="check" size={14} />
            Approve
          </button>
        </ActionForm>
      </div>
    </article>
  );
};

const Welcome = () => (
  <div class="welcome">
    <div class="welcome-hero">
      <div class="welcome-art" aria-hidden="true">
        <div class="mini-card mini-1">
          <span class="mini-stars">
            {[1, 2, 3, 4, 5].map(() => (
              <StarGlyph size={10} />
            ))}
          </span>
          <span class="mini-line" />
          <span class="mini-line short" />
        </div>
        <div class="mini-card mini-2">
          <span class="mini-stars">
            {[1, 2, 3, 4, 5].map(() => (
              <StarGlyph size={10} />
            ))}
          </span>
          <span class="mini-line" />
          <span class="mini-line" />
          <span class="mini-line short" />
        </div>
        <div class="mini-card mini-3">
          <span class="mini-stars">
            {[1, 2, 3, 4, 5].map(() => (
              <StarGlyph size={10} />
            ))}
          </span>
          <span class="mini-line" />
          <span class="mini-line short" />
        </div>
      </div>
      <h1 class="page-title">Let's collect your first testimonial</h1>
      <p class="page-sub">
        Create a space for your product. You'll get a link to share with customers, a Wall of Love page and a
        one-line embed for your site.
      </p>
      <a class="btn btn-primary btn-lg" href="/app/spaces/new">
        Create your first space
        <Icon name="arrowRight" size={16} />
      </a>
    </div>
    <ol class="steps">
      <li class="card step">
        <span class="step-num">1</span>
        <h3>Create a space</h3>
        <p>Give it a name, a logo and an accent colour. Takes about thirty seconds.</p>
      </li>
      <li class="card step">
        <span class="step-num">2</span>
        <h3>Share your link</h3>
        <p>Customers leave a rating, a few words and a photo. No account needed.</p>
      </li>
      <li class="card step">
        <span class="step-num">3</span>
        <h3>Approve & embed</h3>
        <p>Approve the best ones and drop a single script tag anywhere on your site.</p>
      </li>
    </ol>
  </div>
);
