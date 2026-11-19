-- BIZPILOT: MIGRATION 005 - REFRESH TOKENS (stay signed in without a daily sign-in)
-- Run after 004_bill_idempotency.sql.

BEGIN;

-- One row per refresh token that was handed out. Only a hash of the token is stored, never the
-- token, so a copy of this table cannot be used to sign in.
--
-- A refresh token is used once: using it revokes it and issues the next one in the same family
-- (a family is one sign-in on one device). If a token that was already used shows up again, the
-- whole family is revoked, because that means a copy of the token was stolen.
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    family_id UUID NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES app_users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

COMMIT;
