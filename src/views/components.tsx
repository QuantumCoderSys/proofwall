import type { Child } from 'hono/jsx';
import { avatarColors, initials } from '../shared/avatar';
import { sourceLabel } from '../shared/source';
import { contrastText } from '../lib/color';
import type { Space, Status } from '../lib/db';
import { mediaUrl } from '../lib/uploads';
import { Icon, LogoMark, StarGlyph, type IconName } from './icons';

/** Renders nothing for unrated testimonials (e.g. imported posts). */
export const Stars = (props: { rating: number | null; size?: number; class?: string }) => {
  const rating = props.rating;
  if (rating === null) return null;
  return (
    <span class={`stars ${props.class ?? ''}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarGlyph size={props.size ?? 14} class={n <= rating ? 'star is-on' : 'star'} />
      ))}
    </span>
  );
};

/** "via X ↗" link back to where an imported testimonial was found. */
export const SourceLink = (props: { source: string | null; url: string | null; class?: string }) => {
  const label = sourceLabel(props.source, props.url);
  if (!label || !props.url) return null;
  return (
    <a class={props.class ?? 'source-link'} href={props.url} target="_blank" rel="noopener nofollow" title={props.url}>
      via {label}
      <Icon name="external" size={11} />
    </a>
  );
};

export const Avatar = (props: { name: string; photoUrl: string | null; size?: number }) => {
  const size = props.size ?? 36;
  if (props.photoUrl) {
    return <img class="avatar" src={props.photoUrl} width={size} height={size} alt="" loading="lazy" decoding="async" />;
  }
  const { bg, fg } = avatarColors(props.name);
  return (
    <span
      class="avatar avatar-fallback"
      style={`width:${size}px;height:${size}px;background:${bg};color:${fg};font-size:${Math.round(size * 0.38)}px`}
      aria-hidden="true"
    >
      {initials(props.name)}
    </span>
  );
};

export const SpaceLogo = (props: { space: Pick<Space, 'name' | 'logoKey' | 'accentColor'>; size?: number }) => {
  const size = props.size ?? 32;
  const radius = Math.round(size * 0.28);
  const src = mediaUrl('', props.space.logoKey);
  if (src) {
    return (
      <img
        class="space-logo"
        src={src}
        width={size}
        height={size}
        alt=""
        style={`border-radius:${radius}px`}
      />
    );
  }
  return (
    <span
      class="space-logo space-logo-fallback"
      style={`width:${size}px;height:${size}px;border-radius:${radius}px;background:${props.space.accentColor};color:${contrastText(props.space.accentColor)};font-size:${Math.round(size * 0.46)}px`}
      aria-hidden="true"
    >
      {props.space.name.trim().charAt(0).toUpperCase() || '·'}
    </span>
  );
};

const STATUS_LABEL: Record<Status, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

export const StatusPill = (props: { status: Status }) => (
  <span class={`pill pill-${props.status}`}>
    <span class="dot" />
    {STATUS_LABEL[props.status]}
  </span>
);

export const EmptyState = (props: { icon: IconName; title: string; children?: Child; action?: Child }) => (
  <div class="empty">
    <div class="empty-icon">
      <Icon name={props.icon} size={20} />
    </div>
    <h3 class="empty-title">{props.title}</h3>
    {props.children && <p class="empty-text">{props.children}</p>}
    {props.action}
  </div>
);

export const CopyButton = (props: { value?: string; from?: string; label?: string; class?: string }) => (
  <button
    type="button"
    class={`btn btn-secondary ${props.class ?? ''}`}
    data-copy={props.value}
    data-copy-from={props.from}
  >
    <Icon name="copy" size={14} />
    <span data-copy-label>{props.label ?? 'Copy'}</span>
  </button>
);

export const PoweredBy = (props: { href: string }) => (
  <a class="powered" href={props.href} target="_blank" rel="noopener">
    <LogoMark size={14} />
    Powered by <strong>ProofWall</strong>
  </a>
);

export const FieldError = (props: { message?: string }) =>
  props.message ? <p class="error-text">{props.message}</p> : null;
