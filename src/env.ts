export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  POWERED_BY_URL?: string;
}

export type AppEnv = { Bindings: Env };
