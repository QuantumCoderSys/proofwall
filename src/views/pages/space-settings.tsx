import { spaceCopy, type Space, type SpaceSummary } from '../../lib/db';
import { mediaUrl } from '../../lib/uploads';
import { FieldError } from '../components';
import { AccentField, LogoField, Toggle } from '../forms';
import { Icon } from '../icons';
import { SpaceLayout } from '../space-layout';

export interface SettingsValues {
  name: string;
  slug: string;
  accentColor: string;
  headline: string;
  prompt: string;
  thankYou: string;
  collectPhoto: boolean;
  isAccepting: boolean;
  showBranding: boolean;
}

export type SettingsErrors = Partial<Record<keyof SettingsValues | 'logo' | 'form', string>>;

interface SettingsProps {
  host: string;
  origin: string;
  spaces: SpaceSummary[];
  space: Space;
  values?: SettingsValues;
  errors?: SettingsErrors;
  toast?: string;
}

export const SpaceSettingsPage = (props: SettingsProps) => {
  const { space } = props;
  const v: SettingsValues = props.values ?? {
    name: space.name,
    slug: space.slug,
    accentColor: space.accentColor,
    headline: space.headline,
    prompt: space.prompt,
    thankYou: space.thankYou,
    collectPhoto: space.collectPhoto,
    isAccepting: space.isAccepting,
    showBranding: space.showBranding,
  };
  const e = props.errors ?? {};
  const defaults = spaceCopy({ ...v, headline: '', prompt: '', thankYou: '' });

  return (
    <SpaceLayout
      host={props.host}
      origin={props.origin}
      spaces={props.spaces}
      space={space}
      tab="settings"
      toast={props.toast}
    >
      <form
        method="post"
        action={`/app/spaces/${space.id}/settings`}
        enctype="multipart/form-data"
        class="stack"
        data-submit-once
      >
        {Object.keys(e).length > 0 && (
          <div class="alert" role="alert">
            {e.form ?? 'Please fix the highlighted fields below.'}
          </div>
        )}

        <section class="card settings-section">
          <div class="settings-aside">
            <h2 class="card-title">Branding</h2>
            <p class="card-sub">How this space looks on the collection form, Wall of Love and embeds.</p>
          </div>
          <div class="settings-fields">
            <div class={e.name ? 'field has-error' : 'field'}>
              <label class="label" for="name">
                Name
              </label>
              <input id="name" name="name" class="input" value={v.name} required maxlength={60} />
              <FieldError message={e.name} />
            </div>
            <LogoField logoUrl={mediaUrl('', space.logoKey)} error={e.logo} />
            <AccentField value={v.accentColor} error={e.accentColor} />
            <div class={e.slug ? 'field has-error' : 'field'}>
              <label class="label" for="slug">
                Public URL
              </label>
              <div class="input-affix">
                <span class="affix">{props.host}/c/</span>
                <input
                  id="slug"
                  name="slug"
                  class="input"
                  value={v.slug}
                  required
                  maxlength={48}
                  pattern="[a-z0-9](?:[a-z0-9\-]{0,46}[a-z0-9])?"
                  spellcheck={false}
                  autocomplete="off"
                />
              </div>
              <FieldError message={e.slug} />
              <p class="hint">Lowercase letters, numbers and dashes. Changing it breaks links you've already shared.</p>
            </div>
          </div>
        </section>

        <section class="card settings-section">
          <div class="settings-aside">
            <h2 class="card-title">Collection form</h2>
            <p class="card-sub">The words your customers see. Leave a field empty to use the default.</p>
          </div>
          <div class="settings-fields">
            <div class={e.headline ? 'field has-error' : 'field'}>
              <label class="label" for="headline">
                Headline
              </label>
              <input
                id="headline"
                name="headline"
                class="input"
                value={v.headline}
                placeholder={defaults.headline}
                maxlength={120}
              />
              <FieldError message={e.headline} />
            </div>
            <div class={e.prompt ? 'field has-error' : 'field'}>
              <label class="label" for="prompt">
                Prompt
              </label>
              <textarea id="prompt" name="prompt" class="textarea" rows={3} maxlength={500} placeholder={defaults.prompt}>
                {v.prompt}
              </textarea>
              <FieldError message={e.prompt} />
            </div>
            <div class={e.thankYou ? 'field has-error' : 'field'}>
              <label class="label" for="thank_you">
                Thank-you message
              </label>
              <textarea
                id="thank_you"
                name="thank_you"
                class="textarea"
                rows={2}
                maxlength={300}
                placeholder={defaults.thankYou}
              >
                {v.thankYou}
              </textarea>
              <FieldError message={e.thankYou} />
            </div>
            <div class="switches">
              <Toggle
                name="is_accepting"
                checked={v.isAccepting}
                title="Accept new testimonials"
                description="Turn off to pause the form. Your wall and embeds stay live."
              />
              <Toggle
                name="collect_photo"
                checked={v.collectPhoto}
                title="Ask for a photo"
                description="Let people add a headshot. Faces make testimonials more believable."
              />
            </div>
          </div>
        </section>

        <section class="card settings-section">
          <div class="settings-aside">
            <h2 class="card-title">Wall & embeds</h2>
            <p class="card-sub">Applies to the Wall of Love page and every embed.</p>
          </div>
          <div class="settings-fields">
            <div class="switches">
              <Toggle
                name="show_branding"
                checked={v.showBranding}
                title='Show "Powered by ProofWall"'
                description="A small, quiet link under your wall and widgets. Thanks for spreading the word!"
              />
            </div>
          </div>
        </section>

        <div class="form-actions">
          <a class="btn btn-ghost" href={`/app/spaces/${space.id}`}>
            Cancel
          </a>
          <button type="submit" class="btn btn-primary">
            Save changes
          </button>
        </div>
      </form>

      <section class="card settings-section danger-zone">
        <div class="settings-aside">
          <h2 class="card-title">Delete space</h2>
          <p class="card-sub">Removes the space, all of its testimonials and uploaded photos. Embeds will stop showing.</p>
        </div>
        <div class="settings-fields settings-fields-end">
          <form
            method="post"
            action={`/app/spaces/${space.id}/delete`}
            data-confirm={`Delete "${space.name}" and all of its testimonials? This can't be undone.`}
          >
            <button type="submit" class="btn btn-danger">
              <Icon name="trash" size={14} />
              Delete space
            </button>
          </form>
        </div>
      </section>
    </SpaceLayout>
  );
};
