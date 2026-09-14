-- Replaces strict per-IP session binding with region-level matching: an IP
-- changing within the same country+region (wifi -> cellular, ISP rotating
-- addresses, a VPN exit in the same area) is normal and shouldn't force a
-- re-login. A session actually moving to a different region is what gets
-- flagged. See src/server/session-security.ts.
ALTER TABLE session ADD COLUMN geoCountry TEXT;
ALTER TABLE session ADD COLUMN geoRegion TEXT;

ALTER TABLE security_events ADD COLUMN expected_region TEXT;
ALTER TABLE security_events ADD COLUMN seen_region TEXT;
