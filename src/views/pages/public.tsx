import { accentVars } from '../../lib/color';
import { displayName, spaceCopy, type Space, type Testimonial } from '../../lib/db';
import { mediaUrl } from '../../lib/uploads';
import { Avatar, FieldError, PoweredBy, SpaceLogo, Stars } from '../components';
import { Document } from '../document';
import { Icon, StarGlyph } from '../icons';

export const RATING_LABELS = ['', 'Not great', 'Could be better', 'Good', 'Great', 'Love it'] as const;

export interface CollectValues {
  rating: number;
  body: string;
  name: string;
  role: string;
  consent: boolean;
}

export type CollectErrors = Partial<Record<'rating' | 'body' | 'name' | 'role' | 'photo' | 'consent' | 'form', string>>;

const BODY_MAX = 2000;

const SpaceBrand = (props: { space: Space; size?: number }) => (
  <div class="collect-brand">
    <SpaceLogo space={props.space} size={props.size ?? 44} />
    <span>{props.space.name}</span>
  </div>
);

export const CollectPage = (props: {
  space: Space;
  poweredByUrl: string;
  values?: CollectValues;
  errors?: CollectErrors;
}) => {
  const { space } = props;
  const copy = spaceCopy(space);
  const v = props.values ?? { rating: 5, body: '', name: '', role: '', consent: false };
  const e = props.errors ?? {};

  return (
    <Document
      title={`${copy.headline}`}
      description={`Leave a testimonial for ${space.name}.`}
      bodyClass="public"
      bodyStyle={accentVars(space.accentColor)}
    >
      <div class="dots" aria-hidden="true" />
      <main class="public-wrap">
        <SpaceBrand space={space} />
        <h1 class="collect-title">{copy.headline}</h1>
        <p class="collect-prompt">{copy.prompt}</p>

        {!space.isAccepting ? (
          <div class="card collect-card closed">
            <Icon name="pause" size={20} />
            <p>
              {space.name} isn't collecting testimonials right now. Thanks for stopping by — please check back later.
            </p>
            <a class="btn btn-secondary" href={`/w/${space.slug}`}>
              <Icon name="heart" size={14} /> Read what others said
            </a>
          </div>
        ) : (
          <form
            class="card collect-card form-grid"
            method="post"
            action={`/c/${space.slug}`}
            enctype="multipart/form-data"
            data-collect-form
            data-submit-once
          >
            {e.form && (
              <div class="alert" role="alert">
                {e.form}
              </div>
            )}

            <fieldset class="field fieldset">
              <legend class="label">How would you rate your experience?</legend>
              <div class="rating-row">
                <div class="rating-stars">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <>
                      <input
                        type="radio"
                        id={`rating-${n}`}
                        name="rating"
                        value={String(n)}
                        checked={v.rating === n}
                        class="sr-only"
                        required
                      />
                      <label for={`rating-${n}`} title={RATING_LABELS[n]}>
                        <StarGlyph size={30} />
                        <span class="sr-only">
                          {n} star{n > 1 ? 's' : ''}
                        </span>
                      </label>
                    </>
                  ))}
                </div>
                <span class="rating-label" data-rating-label aria-hidden="true">
                  {RATING_LABELS[v.rating] ?? ''}
                </span>
              </div>
              <FieldError message={e.rating} />
            </fieldset>

            <div class={e.body ? 'field has-error' : 'field'}>
              <label class="label" for="body">
                Your testimonial
              </label>
              <textarea
                id="body"
                name="body"
                class="textarea"
                rows={5}
                required
                minlength={10}
                maxlength={BODY_MAX}
                placeholder="What did you like most? What changed for you?"
                data-count
              >
                {v.body}
              </textarea>
              <div class="field-foot">
                <FieldError message={e.body} />
                <span class="hint counter" data-counter>
                  {v.body.length}/{BODY_MAX}
                </span>
              </div>
            </div>

            <div class="grid-2">
              <div class={e.name ? 'field has-error' : 'field'}>
                <label class="label" for="author_name">
                  Your name <span class="opt">optional</span>
                </label>
                <input
                  id="author_name"
                  name="name"
                  class="input"
                  value={v.name}
                  maxlength={80}
                  autocomplete="name"
                  placeholder="Jane Cooper"
                />
                <FieldError message={e.name} />
              </div>
              <div class={e.role ? 'field has-error' : 'field'}>
                <label class="label" for="author_role">
                  Role & company <span class="opt">optional</span>
                </label>
                <input
                  id="author_role"
                  name="role"
                  class="input"
                  value={v.role}
                  maxlength={100}
                  autocomplete="organization-title"
                  placeholder="Founder at Acme"
                />
                <FieldError message={e.role} />
              </div>
            </div>

            {space.collectPhoto && (
              <div class={e.photo ? 'field has-error' : 'field'}>
                <div class="photo-field">
                  <div class="photo-preview" data-photo-preview>
                    <Icon name="user" size={22} />
                  </div>
                  <div class="photo-copy">
                    <span class="label">
                      Your photo <span class="opt">optional</span>
                    </span>
                    <span class="hint">A friendly face makes your words more believable.</span>
                    <div class="row-sm">
                      <label class="btn btn-secondary btn-sm file-btn">
                        <Icon name="upload" size={14} />
                        <span data-photo-label>Upload photo</span>
                        <input type="file" name="photo" accept="image/*" data-photo-input />
                      </label>
                      <button type="button" class="btn btn-ghost btn-sm" data-photo-remove hidden>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                <FieldError message={e.photo} />
              </div>
            )}

            {/* Honeypot: real people never see or fill this. */}
            <div class="hp" aria-hidden="true">
              <label>
                Leave this empty
                <input type="text" name="website" tabindex={-1} autocomplete="off" />
              </label>
            </div>

            <label class={e.consent ? 'consent has-error' : 'consent'}>
              <input type="checkbox" name="consent" value="1" required checked={v.consent} />
              <span>
                I'm happy for {space.name} to share this testimonial publicly, along with my name
                {space.collectPhoto ? ' and photo' : ''}.
              </span>
            </label>
            <FieldError message={e.consent} />

            <button class="btn btn-accent btn-lg btn-block" type="submit" data-busy-label="Sending…">
              Submit testimonial
            </button>
          </form>
        )}

        <footer class="public-foot">{space.showBranding && <PoweredBy href={props.poweredByUrl} />}</footer>
      </main>
    </Document>
  );
};

export const ThanksPage = (props: { space: Space; poweredByUrl: string }) => {
  const copy = spaceCopy(props.space);
  return (
    <Document
      title={`Thank you · ${props.space.name}`}
      bodyClass="public"
      bodyStyle={accentVars(props.space.accentColor)}
      noindex
    >
      <div class="dots" aria-hidden="true" />
      <main class="public-wrap">
        <SpaceBrand space={props.space} />
        <div class="card collect-card thanks-card">
          <div class="thanks-icon">
            <Icon name="check" size={24} stroke={2.25} />
          </div>
          <h1 class="collect-title">Thank you!</h1>
          <p class="collect-prompt">{copy.thankYou}</p>
          <a class="btn btn-secondary" href={`/w/${props.space.slug}`}>
            <Icon name="heart" size={14} />
            See the Wall of Love
          </a>
        </div>
        <footer class="public-foot">
          {props.space.showBranding && <PoweredBy href={props.poweredByUrl} />}
        </footer>
      </main>
    </Document>
  );
};

export const QuoteCard = ({ t }: { t: Testimonial }) => {
  const name = displayName(t);
  return (
    <figure class={t.featured ? 'q-card is-featured' : 'q-card'}>
      <Stars rating={t.rating} size={15} class="accent-stars" />
      <blockquote class="q-body">{t.body}</blockquote>
      <figcaption class="q-author">
        <Avatar name={name} photoUrl={mediaUrl('', t.photoKey)} size={38} />
        <div class="q-who">
          <div class="q-name">{name}</div>
          {t.authorRole && <div class="q-role">{t.authorRole}</div>}
        </div>
      </figcaption>
    </figure>
  );
};

export const WallPage = (props: {
  space: Space;
  items: Testimonial[];
  stats: { count: number; average: number };
  poweredByUrl: string;
}) => {
  const { space, stats } = props;
  return (
    <Document
      title={`Wall of Love · ${space.name}`}
      description={`What people are saying about ${space.name}.`}
      bodyClass="public"
      bodyStyle={accentVars(space.accentColor)}
    >
      <div class="dots dots-tall" aria-hidden="true" />
      <header class="wall-hero">
        <SpaceBrand space={space} size={40} />
        <h1 class="wall-title">Wall of Love</h1>
        <p class="wall-sub">What people are saying about {space.name}.</p>
        {stats.count > 0 && (
          <div class="rating-summary">
            <Stars rating={Math.round(stats.average)} size={14} class="accent-stars" />
            <strong>{stats.average.toFixed(1)}</strong>
            <span>
              from {stats.count} review{stats.count === 1 ? '' : 's'}
            </span>
          </div>
        )}
        {space.isAccepting && (
          <div class="wall-cta">
            <a class="btn btn-accent" href={`/c/${space.slug}`}>
              Share your experience
              <Icon name="arrowRight" size={14} />
            </a>
          </div>
        )}
      </header>

      {props.items.length > 0 ? (
        <main class="masonry">
          {props.items.map((t) => (
            <QuoteCard t={t} />
          ))}
        </main>
      ) : (
        <main class="public-wrap wall-empty">
          <div class="card collect-card">
            <h2 class="empty-title">No testimonials yet</h2>
            <p class="empty-text">Be the first to share what you think of {space.name}.</p>
          </div>
        </main>
      )}

      <footer class="public-foot">{space.showBranding && <PoweredBy href={props.poweredByUrl} />}</footer>
    </Document>
  );
};

export const MessagePage = (props: { title: string; message: string; code?: string; action?: { href: string; label: string } }) => (
  <Document title={`${props.title} · ProofWall`} bodyClass="public" noindex>
    <div class="dots" aria-hidden="true" />
    <main class="auth-wrap">
      <div class="auth-card center">
        {props.code && <p class="eyebrow">{props.code}</p>}
        <h1 class="auth-title">{props.title}</h1>
        <p class="auth-sub">{props.message}</p>
        {props.action && (
          <a class="btn btn-secondary" href={props.action.href}>
            {props.action.label}
          </a>
        )}
      </div>
    </main>
  </Document>
);
