import type { Env } from '../env';
import { newId } from './ids';

type Kind = 'photos' | 'logos';

interface Sniffed {
  ext: string;
  type: string;
}

const LIMITS: Record<Kind, number> = {
  photos: 5 * 1024 * 1024,
  logos: 2 * 1024 * 1024,
};

/** Identify an image by its magic bytes rather than trusting the browser-supplied type. */
function sniff(bytes: Uint8Array, allowSvg: boolean): Sniffed | null {
  const at = (i: number) => bytes[i] ?? -1;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (at(0) === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', type: 'image/png' };
  if (ascii(0, 4) === 'GIF8') return { ext: 'gif', type: 'image/gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  if (ascii(4, 12) === 'ftypavif' || ascii(4, 12) === 'ftypavis') return { ext: 'avif', type: 'image/avif' };
  if (allowSvg) {
    const head = new TextDecoder().decode(bytes.subarray(0, 1024)).trimStart().toLowerCase();
    if ((head.startsWith('<svg') || head.startsWith('<?xml')) && head.includes('<svg')) {
      return { ext: 'svg', type: 'image/svg+xml' };
    }
  }
  return null;
}

export function isFile(value: unknown): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value && 'size' in value;
}

export type UploadResult = { key: string } | { error: string };

export async function storeImage(env: Env, file: File, kind: Kind): Promise<UploadResult> {
  if (file.size === 0) return { error: 'That file is empty.' };
  if (file.size > LIMITS[kind]) {
    return { error: `Images must be under ${Math.round(LIMITS[kind] / 1024 / 1024)} MB.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kindInfo = sniff(bytes, kind === 'logos');
  if (!kindInfo) return { error: 'Please upload a JPG, PNG, WebP, GIF or AVIF image.' };

  const key = `${kind}/${newId(20)}.${kindInfo.ext}`;
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: kindInfo.type, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return { key };
}

export async function deleteMedia(env: Env, keys: Array<string | null | undefined>): Promise<void> {
  const real = keys.filter((k): k is string => Boolean(k));
  // R2 accepts at most 1000 keys per delete call.
  for (let i = 0; i < real.length; i += 1000) await env.MEDIA.delete(real.slice(i, i + 1000));
}

export function mediaUrl(origin: string, key: string | null): string | null {
  return key ? `${origin}/media/${key}` : null;
}
