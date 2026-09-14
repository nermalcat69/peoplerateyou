-- Session hijack detection: a fingerprint captured at session-creation time
-- (see src/server/auth-instance.ts databaseHooks) plus better-auth's own
-- ipAddress column let every authenticated request be re-checked against
-- how the session started (see src/server/session-security.ts).
ALTER TABLE session ADD COLUMN deviceFingerprint TEXT;

CREATE TABLE security_events (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
	session_token TEXT NOT NULL,
	-- 'ip_mismatch' | 'fingerprint_mismatch'
	event_type TEXT NOT NULL,
	expected_ip TEXT,
	seen_ip TEXT,
	expected_fingerprint TEXT,
	seen_fingerprint TEXT,
	user_agent TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_security_events_user_id ON security_events (user_id);
