-- FAQ entries for the Settings page.

BEGIN;

CREATE TABLE IF NOT EXISTS faqs (
    faq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faq_business
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_faqs_business_active
ON faqs (business_id, is_active, created_at DESC);

COMMIT;
