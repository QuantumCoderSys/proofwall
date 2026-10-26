// A small R2-compatible store on the local filesystem for Node/Docker hosts.
// Files live under `root`, with a JSON sidecar holding content type and ETag.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

interface Meta {
  contentType?: string;
  cacheControl?: string;
  etag: string;
  size: number;
}

interface StoredObject {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

export class FileBucket {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Resolves a key inside the bucket directory; refuses anything that escapes it. */
  private path(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error(`Invalid key: ${key}`);
    return full;
  }

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<void> {
    const file = this.path(key);
    const bytes =
      typeof value === 'string'
        ? Buffer.from(value)
        : value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    const meta: Meta = {
      contentType: options?.httpMetadata?.contentType,
      cacheControl: options?.httpMetadata?.cacheControl,
      etag: createHash('md5').update(bytes).digest('hex'),
      size: bytes.byteLength,
    };
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.meta.json`, JSON.stringify(meta));
  }

  /** Mirrors R2: with `onlyIf` and a matching If-None-Match, returns the object without a body. */
  async get(key: string, options?: { onlyIf?: Headers }): Promise<(StoredObject & { body?: ReadableStream }) | null> {
    const file = this.path(key);
    let meta: Meta;
    try {
      meta = JSON.parse(await readFile(`${file}.meta.json`, 'utf8')) as Meta;
    } catch {
      return null;
    }
    const object: StoredObject = {
      key,
      size: meta.size,
      etag: meta.etag,
      httpEtag: `"${meta.etag}"`,
      writeHttpMetadata(headers) {
        if (meta.contentType) headers.set('Content-Type', meta.contentType);
        if (meta.cacheControl) headers.set('Cache-Control', meta.cacheControl);
      },
    };
    const ifNoneMatch = options?.onlyIf?.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\//, '') === object.httpEtag)) {
      return object;
    }
    return { ...object, body: Readable.toWeb(createReadStream(file)) as ReadableStream };
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const file = this.path(key);
      await rm(file, { force: true });
      await rm(`${file}.meta.json`, { force: true });
    }
  }
}
