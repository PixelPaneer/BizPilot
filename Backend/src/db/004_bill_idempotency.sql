-- BIZPILOT: MIGRATION 004 - SALE/PURCHASE IDEMPOTENT REPLAY AND VOID LOOKUP
-- Run after 003_auth_and_void.sql.

BEGIN;

-- The API response of a recorded sale / purchase, stored so that a retry with the same
-- idempotency key returns exactly the same result without changing anything.
ALTER TABLE sales ADD COLUMN response JSONB;
ALTER TABLE purchase_batches ADD COLUMN response JSONB;

-- Voiding a sale finds the stock it deducted through stock_movements.reference_id.
CREATE INDEX idx_stock_movements_reference
ON stock_movements (business_id, reference_id)
WHERE reference_id IS NOT NULL;

COMMIT;
