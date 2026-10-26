import { sha256Hex } from './ids';

/**
 * Fixed-window counter stored in D1. Returns true while the caller is within `limit`
 * requests per `windowSeconds`. IPs are hashed before they are stored.
 */
export async function rateLimit(
  db: D1Database,
  scope: string,
  ip: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const key = `${scope}:${(await sha256Hex(ip)).slice(0, 32)}`;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count    = CASE WHEN reset_at <= ?3 THEN 1  ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
       RETURNING count`,
    )
    .bind(key, now + windowSeconds, now)
    .first<{ count: number }>();

  // Opportunistic cleanup so the table never grows unbounded.
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE reset_at <= ?1').bind(now).run();
  }
  return (row?.count ?? 0) <= limit;
}

export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}
