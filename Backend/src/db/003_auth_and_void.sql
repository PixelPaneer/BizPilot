-- BIZPILOT: MIGRATION 003 - REFRESH TOKENS AND SALE VOIDING
-- Run after 001_core_schema.sql and 002_prototype_additions.sql.

BEGIN;

-- Refresh tokens (access + refresh login). Only a SHA-256 hash of the token is stored.
-- Each refresh rotates the token: the old row is revoked and points to its replacement.
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_token_user
        FOREIGN KEY (user_id)
        REFERENCES app_users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_refresh_token_replaced_by
        FOREIGN KEY (replaced_by)
        REFERENCES refresh_tokens(token_id)
        ON DELETE SET NULL,
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_active_user
ON refresh_tokens (user_id)
WHERE revoked_at IS NULL;

-- Voiding a sale (status VOIDED already exists in sales.status).
ALTER TABLE sales
    ADD COLUMN voided_at TIMESTAMPTZ,
    ADD COLUMN void_reason TEXT,
    ADD COLUMN voided_by UUID;

ALTER TABLE sales
    ADD CONSTRAINT fk_sales_voided_by
        FOREIGN KEY (voided_by)
        REFERENCES app_users(user_id)
        ON DELETE SET NULL,
    ADD CONSTRAINT chk_sales_void_fields
        CHECK (
            (status = 'VOIDED' AND voided_at IS NOT NULL)
            OR (status <> 'VOIDED' AND voided_at IS NULL AND void_reason IS NULL)
        );

COMMIT;
