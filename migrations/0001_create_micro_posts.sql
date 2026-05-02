CREATE TABLE IF NOT EXISTS micro_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')),
  syndicated_to TEXT NOT NULL DEFAULT '[]'
);
