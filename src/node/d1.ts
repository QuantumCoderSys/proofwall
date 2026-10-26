// A small D1-compatible wrapper around Node's built-in SQLite (node:sqlite), so the
// Worker code runs unchanged on any Node/Docker host. Only the parts ProofWall uses.
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

type Row = Record<string, unknown>;

interface RunResult {
  success: true;
  results: [];
  meta: { changes: number; last_row_id: number };
}

const toValue = (v: unknown): SQLInputValue => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint' || v instanceof Uint8Array) return v;
  return String(v);
};

export class NodeD1Statement {
  constructor(
    private readonly db: NodeD1,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}

  bind(...params: unknown[]): NodeD1Statement {
    return new NodeD1Statement(this.db, this.sql, params.map(toValue));
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.db.statement(this.sql).get(...this.params) as Row | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Row>(): Promise<{ results: T[]; success: true; meta: Record<string, never> }> {
    return { results: this.db.statement(this.sql).all(...this.params) as T[], success: true, meta: {} };
  }

  async run(): Promise<RunResult> {
    return this.runSync();
  }

  runSync(): RunResult {
    const r = this.db.statement(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export class NodeD1 {
  private readonly cache = new Map<string, StatementSync>();

  constructor(readonly sqlite: DatabaseSync) {}

  statement(sql: string): StatementSync {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = this.sqlite.prepare(sql);
      this.cache.set(sql, stmt);
    }
    return stmt;
  }

  prepare(sql: string): NodeD1Statement {
    return new NodeD1Statement(this, sql);
  }

  /** Like D1: all statements run in one transaction. */
  async batch(statements: NodeD1Statement[]): Promise<RunResult[]> {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map((s) => s.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }
}

export function openDatabase(file: string): NodeD1 {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  return new NodeD1(sqlite);
}
