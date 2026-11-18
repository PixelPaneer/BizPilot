-- BIZPILOT: MIGRATION 002 - PROTOTYPE ADDITIONS
-- Run after 001_core_schema.sql.

BEGIN;

-- Fuzzy product-name search (customer WhatsApp queries and bill-line matching).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_name_trgm
ON products USING gin (LOWER(product_name) gin_trgm_ops);

-- One active product per name per business (variants are named, e.g. "Parle-G 10rs").
CREATE UNIQUE INDEX uq_products_active_name
ON products (business_id, LOWER(product_name))
WHERE is_active;

-- Resolves the shop from the WhatsApp number a customer messaged (Meta phone_number_id).
ALTER TABLE businesses
    ADD COLUMN whatsapp_phone_number_id VARCHAR(40);

CREATE UNIQUE INDEX uq_businesses_whatsapp_phone_number_id
ON businesses (whatsapp_phone_number_id)
WHERE whatsapp_phone_number_id IS NOT NULL;

-- Idempotency for purchase bills. Purchases create no sales row; their stock_movements
-- rows carry batch_id in reference_id. (Sales bills use sales.idempotency_key.)
CREATE TABLE purchase_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    idempotency_key VARCHAR(150) NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchase_batch_business
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_purchase_batch_idempotency
        UNIQUE (business_id, idempotency_key),
    CONSTRAINT chk_purchase_batch_source
        CHECK (source IN ('MANUAL', 'VOICE', 'OCR'))
);

COMMIT;
