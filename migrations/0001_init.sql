CREATE TABLE users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	password_salt TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
	token TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE TABLE photos (
	id TEXT PRIMARY KEY,
	owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	r2_key TEXT NOT NULL,
	-- 'active' | 'rejected'
	status TEXT NOT NULL DEFAULT 'active',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_photos_owner_id ON photos (owner_id);
CREATE INDEX idx_photos_status ON photos (status);

CREATE TABLE ratings (
	photo_id TEXT NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
	rater_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (photo_id, rater_id)
);
CREATE INDEX idx_ratings_photo_id ON ratings (photo_id);

CREATE TABLE comments (
	id TEXT PRIMARY KEY,
	photo_id TEXT NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
	author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	body TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comments_photo_id ON comments (photo_id);
