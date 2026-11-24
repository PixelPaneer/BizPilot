-- BizPilot authentication OTP tables for sign-up verification and password reset.

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_otps (
    otp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    channel VARCHAR(10) NOT NULL,
    destination VARCHAR(150) NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    reset_token_hash CHAR(64),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_otp_user
        FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_password_reset_otp_channel
        CHECK (channel IN ('email', 'whatsapp'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user
ON password_reset_otps (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_otps_token
ON password_reset_otps (reset_token_hash)
WHERE reset_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_signup_otps (
    otp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(20) NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_otps_number
ON whatsapp_signup_otps (whatsapp_number, created_at DESC);

COMMIT;
