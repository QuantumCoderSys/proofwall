import { DEFAULT_ACCENT } from '../../lib/color';
import type { SpaceSummary } from '../../lib/db';
import { AppShell } from '../app-shell';
import { FieldError } from '../components';
import { AccentField, LogoField } from '../forms';
import { Icon } from '../icons';

export interface NewSpaceErrors {
  name?: string;
  accentColor?: string;
  logo?: string;
}

interface NewSpaceProps {
  host: string;
  spaces: SpaceSummary[];
  values?: { name: string; accentColor: string };
  errors?: NewSpaceErrors;
}

export const NewSpacePage = (props: NewSpaceProps) => {
  const v = props.values ?? { name: '', accentColor: DEFAULT_ACCENT };
  const e = props.errors ?? {};
  return (
    <AppShell
      title="New space"
      host={props.host}
      spaces={props.spaces}
      activeNav="new-space"
      crumbs={[{ label: 'Spaces', href: '/app' }, { label: 'New space' }]}
    >
      <div class="narrow">
        <div class="page-head">
          <div>
            <h1 class="page-title">Create a space</h1>
            <p class="page-sub">
              A space is one product or brand. It gets its own collection link, Wall of Love and embeds.
            </p>
          </div>
        </div>

        <form method="post" action="/app/spaces" enctype="multipart/form-data" class="card card-body form-grid" data-submit-once>
          <div class={e.name ? 'field has-error' : 'field'}>
            <label class="label" for="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              class="input input-lg"
              value={v.name}
              placeholder="Acme Analytics"
              required
              maxlength={60}
              autofocus
            />
            <FieldError message={e.name} />
            <p class="hint">Usually your product or company name. Shown to customers.</p>
          </div>
          <LogoField logoUrl={null} error={e.logo} />
          <AccentField value={v.accentColor} error={e.accentColor} />
          <div class="form-actions form-actions-flush">
            <a class="btn btn-ghost" href="/app">
              Cancel
            </a>
            <button type="submit" class="btn btn-primary">
              Create space
              <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};
