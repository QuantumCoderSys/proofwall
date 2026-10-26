// Applies migrations/*.sql in order on startup (the Node equivalent of
// `wrangler d1 migrations apply`). Each file runs once, inside a transaction.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export function applyMigrations(sqlite: DatabaseSync, dir: string): string[] {
  sqlite.exec('CREATE TABLE IF NOT EXISTS _proofwall_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const done = new Set(
    (sqlite.prepare('SELECT name FROM _proofwall_migrations').all() as Array<{ name: string }>).map((r) => r.name),
  );
  const applied: string[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    const sql = readFileSync(join(dir, name), 'utf8');
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _proofwall_migrations (name, applied_at) VALUES (?, ?)').run(name, Date.now());
      sqlite.exec('COMMIT');
      applied.push(name);
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw new Error(`Migration ${name} failed: ${(err as Error).message}`);
    }
  }
  return applied;
}
