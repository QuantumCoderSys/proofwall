// Progressive enhancements for the dashboard and public pages.
// Every page works without this script; it only makes things smoother.
import { buildSnippet, highlightSnippet } from '../shared/snippet';
import type { Layout, MountOptions, Theme } from '../shared/types';

type ProofWallApi = { mount(el: HTMLElement, options: MountOptions): void };

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(sel),
];

const ICON_CHECK =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_ALERT =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';

// ── Toasts ────────────────────────────────────────────────────────────────

function toast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = kind === 'error' ? 'toast is-error' : 'toast';
  el.innerHTML = kind === 'error' ? ICON_ALERT : ICON_CHECK;
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  host.append(el);
  window.setTimeout(() => {
    el.classList.add('is-out');
    window.setTimeout(() => el.remove(), 220);
  }, 2800);
}

function initFlash(): void {
  const message = document.body.dataset.toast;
  if (message) toast(message);
  const url = new URL(location.href);
  if (url.searchParams.has('t')) {
    url.searchParams.delete('t');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
}

// ── Clipboard ─────────────────────────────────────────────────────────────

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

document.addEventListener('click', async (event) => {
  const target = event.target as Element;

  const copyBtn = target.closest<HTMLElement>('[data-copy], [data-copy-from]');
  if (copyBtn) {
    const from = copyBtn.dataset.copyFrom;
    const text = from ? ($(from)?.textContent ?? '').trim() : (copyBtn.dataset.copy ?? '');
    if (!text) return;
    if (!(await copyText(text))) return toast("Couldn't copy — select the text and copy it manually.", 'error');
    const label = $('[data-copy-label]', copyBtn);
    if (label) {
      const original = label.textContent;
      label.textContent = 'Copied';
      copyBtn.classList.add('is-on');
      window.setTimeout(() => {
        label.textContent = original;
        copyBtn.classList.remove('is-on');
      }, 1600);
    } else {
      toast('Copied to clipboard');
    }
    return;
  }

  if (target.closest('[data-nav-toggle]')) {
    document.body.classList.toggle('nav-open');
  }
});

document.addEventListener('focusin', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.matches?.('[data-select-on-focus]')) window.setTimeout(() => input.select(), 0);
});

// ── Forms ─────────────────────────────────────────────────────────────────

function setBusy(form: HTMLFormElement, busy: boolean): void {
  for (const btn of $$<HTMLButtonElement>('button[type="submit"]', form)) {
    btn.disabled = busy;
    btn.setAttribute('aria-busy', String(busy));
    const busyLabel = btn.dataset.busyLabel;
    if (busyLabel) {
      if (busy) {
        btn.dataset.idleLabel = btn.textContent ?? '';
        btn.textContent = busyLabel;
      } else if (btn.dataset.idleLabel) {
        btn.textContent = btn.dataset.idleLabel;
      }
    }
  }
}

/** Re-fetch the current page and swap every [data-region] so counts and lists stay in sync. */
async function refreshRegions(): Promise<void> {
  const res = await fetch(location.href, { headers: { Accept: 'text/html' }, credentials: 'same-origin' });
  if (!res.ok) return location.reload();
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  for (const region of $$('[data-region]')) {
    const fresh = doc.querySelector(`[data-region="${region.dataset.region}"]`);
    if (fresh) region.replaceWith(document.importNode(fresh, true));
  }
}

document.addEventListener('submit', async (event) => {
  const form = event.target as HTMLFormElement;
  if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
    event.preventDefault();
    return;
  }
  if (form.dataset.async === undefined) {
    if (form.dataset.submitOnce !== undefined) setBusy(form, true);
    return;
  }

  event.preventDefault();
  const item = form.closest<HTMLElement>('[data-item]');
  item?.classList.add('is-leaving');
  setBusy(form, true);
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; toast?: string; error?: string };
    if (res.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
    await refreshRegions();
    if (data.toast) toast(data.toast);
  } catch (err) {
    item?.classList.remove('is-leaving');
    setBusy(form, false);
    toast(err instanceof Error ? err.message : 'Something went wrong.', 'error');
  }
});

// Pages restored from the back/forward cache shouldn't keep spinners.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) for (const form of $$<HTMLFormElement>('form[data-submit-once]')) setBusy(form, false);
});

// ── Image helpers ─────────────────────────────────────────────────────────

/** Square-crops and downsizes a photo in the browser. Also strips EXIF/GPS metadata. */
async function resizeImage(file: File, max: number): Promise<File | null> {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const target = Math.min(max, side);
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target);
  bitmap.close();
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.88);
  if (!blob) return null;
  return new File([blob], blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg', { type: blob.type });
}

function showPreview(container: Element, file: File): void {
  const img = new Image();
  img.alt = '';
  img.src = URL.createObjectURL(file);
  img.onload = () => URL.revokeObjectURL(img.src);
  container.replaceChildren(img);
}

// ── Collection form ───────────────────────────────────────────────────────

const RATING_LABELS = ['', 'Not great', 'Could be better', 'Good', 'Great', 'Love it'];

function initCollectForm(): void {
  const form = $<HTMLFormElement>('[data-collect-form]');
  if (!form) return;

  const ratingLabel = $('[data-rating-label]', form);
  const stars = $('.rating-stars', form);
  const checkedRating = () => $<HTMLInputElement>('input[name="rating"]:checked', form)?.value ?? '';
  const showRating = (value: string) => {
    if (ratingLabel) ratingLabel.textContent = RATING_LABELS[Number(value)] ?? '';
  };
  form.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'rating') showRating(input.value);
  });
  stars?.addEventListener('mouseover', (e) => {
    const label = (e.target as Element).closest('label');
    const input = label && $<HTMLInputElement>(`#${label.htmlFor}`, form);
    if (input) showRating(input.value);
  });
  stars?.addEventListener('mouseleave', () => showRating(checkedRating()));

  const textarea = $<HTMLTextAreaElement>('textarea[data-count]', form);
  const counter = $('[data-counter]', form);
  textarea?.addEventListener('input', () => {
    if (counter) counter.textContent = `${textarea.value.length}/${textarea.maxLength}`;
  });

  const photo = $<HTMLInputElement>('[data-photo-input]', form);
  const preview = $('[data-photo-preview]', form);
  const remove = $<HTMLButtonElement>('[data-photo-remove]', form);
  const photoLabel = $('[data-photo-label]', form);
  if (photo && preview) {
    const placeholder = preview.innerHTML;
    const reset = () => {
      photo.value = '';
      preview.innerHTML = placeholder;
      if (remove) remove.hidden = true;
      if (photoLabel) photoLabel.textContent = 'Upload photo';
    };
    photo.addEventListener('change', async () => {
      const file = photo.files?.[0];
      if (!file) return reset();
      if (!file.type.startsWith('image/')) {
        toast('Please choose an image file.', 'error');
        return reset();
      }
      const resized = await resizeImage(file, 480).catch(() => null);
      if (resized) {
        const transfer = new DataTransfer();
        transfer.items.add(resized);
        photo.files = transfer.files;
      }
      const final = photo.files?.[0] ?? file;
      if (final.size > 5 * 1024 * 1024) {
        toast('That photo is too large — please pick one under 5 MB.', 'error');
        return reset();
      }
      showPreview(preview, final);
      if (remove) remove.hidden = false;
      if (photoLabel) photoLabel.textContent = 'Change';
    });
    remove?.addEventListener('click', reset);
  }
}

// ── Space settings ────────────────────────────────────────────────────────

function normalizeHex(value: string): string | null {
  let v = value.trim().toLowerCase();
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

function initAccentFields(): void {
  for (const field of $$('[data-accent-field]')) {
    const hex = $<HTMLInputElement>('[data-hex-input]', field);
    const color = $<HTMLInputElement>('[data-color-input]', field);
    if (!hex || !color) continue;
    const apply = (value: string, source: 'hex' | 'color' | 'swatch') => {
      const v = normalizeHex(value);
      if (!v) return;
      if (source !== 'hex') hex.value = v;
      if (source !== 'color') color.value = v;
      for (const s of $$('[data-swatch]', field)) s.setAttribute('aria-pressed', String(s.dataset.swatch === v));
    };
    field.addEventListener('click', (e) => {
      const swatch = (e.target as Element).closest<HTMLElement>('[data-swatch]');
      if (swatch?.dataset.swatch) apply(swatch.dataset.swatch, 'swatch');
    });
    color.addEventListener('input', () => apply(color.value, 'color'));
    hex.addEventListener('input', () => apply(hex.value, 'hex'));
  }
}

function initLogoInputs(): void {
  for (const input of $$<HTMLInputElement>('[data-logo-input]')) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      const preview = input.closest('.upload')?.querySelector('[data-logo-preview]');
      if (file && preview) showPreview(preview, file);
    });
  }
}

// ── Embed builder ─────────────────────────────────────────────────────────

function initEmbedBuilder(): void {
  const root = $('[data-embed-builder]');
  if (!root) return;
  const origin = root.dataset.origin ?? location.origin;
  const slug = root.dataset.slug ?? '';
  const code = $('[data-embed-code]', root);
  const preview = $('[data-embed-preview]', root);
  const value = (name: string) => $<HTMLInputElement>(`input[name="${name}"]:checked`, root)?.value;

  const render = () => {
    const layout = (value('layout') ?? 'wall') as Layout;
    const theme = (value('theme') ?? 'light') as Theme;
    if (code) code.innerHTML = highlightSnippet(buildSnippet({ origin, slug, layout, theme }));
    if (!preview) return;
    const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    preview.classList.toggle('is-dark', dark);
    const mount = () =>
      (window as unknown as { ProofWall?: ProofWallApi }).ProofWall?.mount(preview, {
        space: slug,
        layout,
        theme,
        preview: true,
      });
    if ((window as unknown as { ProofWall?: ProofWallApi }).ProofWall) mount();
    else window.addEventListener('proofwall:ready', mount, { once: true });
  };

  root.addEventListener('change', render);
  render();
}

// ── Boot ──────────────────────────────────────────────────────────────────

initFlash();
initCollectForm();
initAccentFields();
initLogoInputs();
initEmbedBuilder();
