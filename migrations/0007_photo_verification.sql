ALTER TABLE profiles ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
-- 'unverified' | 'pending' | 'verified'
ALTER TABLE profiles ADD COLUMN verified_at TEXT;

-- One "this is me" reference photo per user, captured live at setup time and
-- used only to face-match future verification selfies against. Deliberately
-- separate from the `photos` table (rateable feed posts) so a post submitted
-- for rating can never become someone's identity reference.
CREATE TABLE verification_photos (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL UNIQUE REFERENCES "user" (id) ON DELETE CASCADE,
	r2_key TEXT NOT NULL,
	embedding TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail for verification attempts, mirroring security_events: store the
-- decision and scores, never the raw selfie/video used to compute them.
CREATE TABLE verification_attempts (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
	decision TEXT NOT NULL,
	similarity REAL,
	liveness_passed INTEGER NOT NULL DEFAULT 0,
	ip_address TEXT,
	device_fingerprint TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_verification_attempts_user_id ON verification_attempts (user_id);
