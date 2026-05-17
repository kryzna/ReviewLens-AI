CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  source         TEXT NOT NULL,
  source_url     TEXT,
  subject_name   TEXT NOT NULL,
  ingested_at    TEXT NOT NULL,
  review_count   INTEGER NOT NULL,
  verified_count INTEGER NOT NULL DEFAULT 0,
  date_min       TEXT,
  date_max       TEXT,
  rating_avg     REAL,
  rating_dist    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_review_id TEXT,
  author           TEXT,
  rating           INTEGER,
  date             TEXT,
  text             TEXT NOT NULL,
  source_url       TEXT,
  verified         INTEGER NOT NULL DEFAULT 0,
  extra            TEXT
);
CREATE INDEX IF NOT EXISTS idx_reviews_session ON reviews(session_id);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  citations  TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
