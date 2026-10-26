import type { Child } from 'hono/jsx';
import { ACCENT_PRESETS } from '../lib/color';
import { FieldError } from './components';
import { Icon } from './icons';

/** A POST form that the client script submits in the background (falls back to a normal POST). */
export const ActionForm = (props: {
  action: string;
  next: string;
  fields?: Record<string, string>;
  confirm?: string;
  children?: Child;
}) => (
  <form method="post" action={props.action} data-async data-confirm={props.confirm}>
    <input type="hidden" name="next" value={props.next} />
    {Object.entries(props.fields ?? {}).map(([name, value]) => (
      <input type="hidden" name={name} value={value} />
    ))}
    {props.children}
  </form>
);

export const LogoField = (props: { logoUrl: string | null; error?: string }) => (
  <div class="field">
    <span class="label">
      Logo <span class="opt">optional</span>
    </span>
    <div class="upload">
      <div class="upload-preview" data-logo-preview>
        {props.logoUrl ? <img src={props.logoUrl} alt="" /> : <Icon name="image" size={20} />}
      </div>
      <div class="upload-actions">
        <div class="row-sm">
          <label class="btn btn-secondary btn-sm file-btn">
            <Icon name="upload" size={14} />
            {props.logoUrl ? 'Replace' : 'Upload'}
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
              data-logo-input
            />
          </label>
          {props.logoUrl && (
            <label class="check-inline">
              <input type="checkbox" name="remove_logo" value="1" /> Remove
            </label>
          )}
        </div>
        <p class="hint">Square PNG, JPG, WebP or SVG · up to 2 MB</p>
      </div>
    </div>
    <FieldError message={props.error} />
  </div>
);

export const AccentField = (props: { value: string; error?: string }) => (
  <div class="field" data-accent-field>
    <span class="label">Accent colour</span>
    <div class="swatches">
      {ACCENT_PRESETS.map((c) => (
        <button
          type="button"
          class="swatch"
          style={`--c:${c};background:${c}`}
          data-swatch={c}
          aria-pressed={c === props.value ? 'true' : 'false'}
          aria-label={`Use ${c}`}
          title={c}
        />
      ))}
      <span class="swatch-divider" aria-hidden="true" />
      <label class="color-pick" title="Custom colour">
        <input type="color" value={props.value} data-color-input aria-label="Pick a custom colour" />
      </label>
      <input
        class="input hex-input"
        name="accent_color"
        value={props.value}
        maxlength={7}
        spellcheck={false}
        autocomplete="off"
        aria-label="Accent colour hex value"
        data-hex-input
      />
    </div>
    <p class="hint">Used for stars, buttons and highlights on your public pages.</p>
    <FieldError message={props.error} />
  </div>
);

export const Toggle = (props: { name: string; checked: boolean; title: string; description: string }) => (
  <label class="switch-row">
    <span>
      <span class="switch-title">{props.title}</span>
      <span class="hint">{props.description}</span>
    </span>
    <input type="checkbox" class="switch" name={props.name} value="1" checked={props.checked} role="switch" />
  </label>
);
