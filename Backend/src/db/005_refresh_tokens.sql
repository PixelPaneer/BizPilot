-- BIZPILOT: MIGRATION 005 - REFRESH TOKEN FAMILIES (stay signed in without a daily sign-in)
-- Run after 004_bill_idempotency.sql.
--
-- The refresh_tokens table already exists (migration 003: only a hash of each token is stored, and
-- a used token points to its replacement through replaced_by). This adds what rotation with theft
-- detection needs.
--
-- A "family" is one sign-in on one device. Using a refresh token revokes it and issues the next one
-- in the same family. If a token that was already used shows up again, the whole family is revoked,
-- because that means a copy of the token was stolen.

BEGIN;

ALTER TABLE refresh_tokens ADD COLUMN family_id UUID;

-- Tokens that exist already each become a family of their own.
UPDATE refresh_tokens SET family_id = token_id WHERE family_id IS NULL;

ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

COMMIT;
