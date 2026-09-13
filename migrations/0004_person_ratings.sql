CREATE TABLE profiles (
	user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
	username TEXT NOT NULL UNIQUE,
	bio TEXT NOT NULL DEFAULT '',
	location TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE person_ratings (
	rater_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
	ratee_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
	score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (rater_id, ratee_id)
);
CREATE INDEX idx_person_ratings_ratee_id ON person_ratings (ratee_id);
CREATE INDEX idx_person_ratings_rater_id ON person_ratings (rater_id);

CREATE TABLE profile_views (
	viewer_id TEXT REFERENCES "user" (id) ON DELETE SET NULL,
	viewed_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_profile_views_viewed_id ON profile_views (viewed_id);
