-- Imported testimonials: ratings become optional (a post on X has no stars),
-- plus source attribution and a de-duplication key. SQLite can't relax a CHECK
-- constraint in place, so the table is rebuilt.

PRAGMA defer_foreign_keys = true;

CREATE TABLE testimonials_new (
  id          TEXT PRIMARY KEY,
  space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rating      INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL,
  author_name TEXT,
  author_role TEXT,
  photo_key   TEXT,
  featured    INTEGER NOT NULL DEFAULT 0,
  source      TEXT,  -- NULL = collection form; otherwise 'web', 'x' or 'bluesky'
  source_url  TEXT,
  external_id TEXT,
  created_at  INTEGER NOT NULL,
  reviewed_at INTEGER
);

INSERT INTO testimonials_new
  (id, space_id, status, rating, body, author_name, author_role, photo_key, featured, created_at, reviewed_at)
SELECT id, space_id, status, rating, body, author_name, author_role, photo_key, featured, created_at, reviewed_at
FROM testimonials;

DROP TABLE testimonials;
ALTER TABLE testimonials_new RENAME TO testimonials;

CREATE INDEX IF NOT EXISTS idx_testimonials_space_status
  ON testimonials (space_id, status, featured DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_testimonials_external
  ON testimonials (space_id, external_id) WHERE external_id IS NOT NULL;

-- Imported testimonials the founder deleted, so a re-check doesn't bring them back.
CREATE TABLE IF NOT EXISTS import_skips (
  space_id    TEXT NOT NULL,
  external_id TEXT NOT NULL,
  PRIMARY KEY (space_id, external_id)
);

-- Links that are re-checked daily by the cron trigger.
CREATE TABLE IF NOT EXISTS import_sources (
  id          TEXT PRIMARY KEY,
  space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  last_run_at INTEGER,
  last_status TEXT,
  last_added  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  UNIQUE (space_id, url)
);
