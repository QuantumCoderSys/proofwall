-- ProofWall initial schema

-- A space is one collection: its own form link, wall and embeds.
CREATE TABLE IF NOT EXISTS spaces (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  logo_key      TEXT,
  accent_color  TEXT NOT NULL DEFAULT '#171717',
  headline      TEXT NOT NULL DEFAULT '',
  prompt        TEXT NOT NULL DEFAULT '',
  thank_you     TEXT NOT NULL DEFAULT '',
  collect_photo INTEGER NOT NULL DEFAULT 1,
  is_accepting  INTEGER NOT NULL DEFAULT 1,
  show_branding INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
  id          TEXT PRIMARY KEY,
  space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL,
  author_name TEXT,
  author_role TEXT,
  photo_key   TEXT,
  featured    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_testimonials_space_status
  ON testimonials (space_id, status, featured DESC, created_at DESC);

-- Fixed-window counters for login and submission throttling.
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
