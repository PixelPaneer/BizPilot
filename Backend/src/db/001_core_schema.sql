-- BIZPILOT: CORE DATABASE SCHEMA (11 TABLES) - REVIEWED COPY
-- Based on the team's BizPilot_Final_11_Table_Database_Schema.sql with fixes listed in
-- docs/BACKEND_AI_PLAN.md (section 3): duplicate index removed, soft-delete + timestamps on
-- products, sale/stock sources aligned to owner entry (MANUAL/VOICE/OCR), actor on stock_movements,
-- agent/token/cost columns on audit_logs, GSTIN format check, redundant email UNIQUE removed.
-- PostgreSQL baseline. Run once in a clean database/schema.
-- Creation order follows foreign-key dependencies.
-- This script does not include future modules such as orders, invoices, approvals,
-- business_members, WhatsApp channels, FAQs or AI execution tables.

BEGIN;



-- ========================================================================
-- 1. APP_USERS
-- ========================================================================

CREATE TABLE app_users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    email VARCHAR(150) NOT NULL, -- uniqueness enforced case-insensitively by uq_app_users_email_lower
    password_hash TEXT NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    whatsapp_verified_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ========================================================================
-- 2. BUSINESSES
-- ========================================================================

CREATE TABLE businesses (
    business_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    business_name VARCHAR(150) NOT NULL,
    business_type VARCHAR(100) NOT NULL,
    owner_name VARCHAR(120) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    business_email VARCHAR(150) NOT NULL,
    business_address TEXT NOT NULL,
    business_description TEXT,
    business_logo_url TEXT,
    gstin VARCHAR(15),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_business_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES app_users(user_id)
        ON DELETE RESTRICT,
    CONSTRAINT unique_business_gstin UNIQUE (gstin),
    CONSTRAINT chk_gstin_format
        CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')
);


-- ========================================================================
-- 3. BUSINESS_SETTINGS
-- ========================================================================

CREATE TABLE business_settings (
    business_id UUID PRIMARY KEY,
    stock_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    out_of_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    dashboard_language VARCHAR(20) NOT NULL DEFAULT 'English',
    appearance_theme VARCHAR(10) NOT NULL DEFAULT 'light',
    date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notification_low_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notification_out_of_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    report_frequency VARCHAR(20) NOT NULL DEFAULT 'Weekly',
    CONSTRAINT fk_business_settings
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE CASCADE,
    CONSTRAINT valid_dashboard_language
        CHECK (dashboard_language IN ('English', 'Hindi', 'Hinglish')),
    CONSTRAINT valid_appearance_theme
        CHECK (appearance_theme IN ('light', 'dark')),
    CONSTRAINT chk_report_frequency
        CHECK (report_frequency IN ('Daily', 'Weekly', 'Monthly'))
);

-- Automatically create default settings for each newly inserted business.
CREATE OR REPLACE FUNCTION create_default_business_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO business_settings (business_id)
    VALUES (NEW.business_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_business_settings
AFTER INSERT ON businesses
FOR EACH ROW
EXECUTE FUNCTION create_default_business_settings();

-- Backfill settings for businesses that already exist (safe to rerun).
INSERT INTO business_settings (business_id)
SELECT business_id FROM businesses
ON CONFLICT (business_id) DO NOTHING;


-- ========================================================================
-- 4. PRODUCTS
-- ========================================================================

CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    selling_price NUMERIC(12,2) NOT NULL,
    cost_price NUMERIC(12,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- soft delete: products with history cannot be hard-deleted
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_business
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_selling_price
        CHECK (selling_price >= 0),
    CONSTRAINT chk_product_cost_price
        CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT unique_business_product
        UNIQUE (business_id, product_id)
);


-- ========================================================================
-- 5. INVENTORY
-- ========================================================================

CREATE TABLE inventory (
    business_id UUID NOT NULL,
    product_id UUID NOT NULL,
    available_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    reorder_threshold NUMERIC(12,3) NOT NULL DEFAULT 5,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory
        PRIMARY KEY (business_id, product_id),
    CONSTRAINT chk_available_quantity
        CHECK (available_quantity >= 0),
    CONSTRAINT chk_reorder_threshold
        CHECK (reorder_threshold >= 0),
    CONSTRAINT fk_inventory_product
        FOREIGN KEY (business_id, product_id)
        REFERENCES products(business_id, product_id)
        ON DELETE CASCADE
);


-- ========================================================================
-- 6. STOCK_MOVEMENTS
-- ========================================================================

CREATE TABLE stock_movements (
    movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    product_id UUID NOT NULL,
    movement_type VARCHAR(30) NOT NULL,
    quantity_change NUMERIC(12,3) NOT NULL,
    previous_quantity NUMERIC(12,3) NOT NULL,
    new_quantity NUMERIC(12,3) NOT NULL,
    source VARCHAR(50) NOT NULL,
    user_id UUID, -- acting owner/operator; NULL for system or agent-initiated changes
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movement_user
        FOREIGN KEY (user_id)
        REFERENCES app_users(user_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_movement_source
        CHECK (source IN ('MANUAL', 'VOICE', 'OCR', 'SYSTEM')),
    CONSTRAINT chk_movement_type
        CHECK (movement_type IN (
            'PURCHASE', 'SALE', 'RETURN',
            'MANUAL_ADJUSTMENT', 'DAMAGE', 'CORRECTION'
        )),
    CONSTRAINT chk_quantity_change
        CHECK (quantity_change <> 0),
    CONSTRAINT chk_stock_calculation
        CHECK (previous_quantity + quantity_change = new_quantity),
    CONSTRAINT chk_new_quantity
        CHECK (new_quantity >= 0),
    CONSTRAINT fk_movement_product
        FOREIGN KEY (business_id, product_id)
        REFERENCES products(business_id, product_id)
        ON DELETE RESTRICT
);


-- ========================================================================
-- 7. AUDIT_LOGS
-- ========================================================================

CREATE TABLE audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    user_id UUID,
    request_id UUID,
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    description TEXT,
    outcome VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    latency_ms INTEGER,
    error_code VARCHAR(100),
    agent_name VARCHAR(50),
    model_name VARCHAR(80),
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost NUMERIC(10,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_business
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id)
        REFERENCES app_users(user_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_audit_outcome
        CHECK (outcome IN ('SUCCESS', 'FAILED', 'BLOCKED')),
    CONSTRAINT chk_audit_latency
        CHECK (latency_ms IS NULL OR latency_ms >= 0)
);


-- ========================================================================
-- 8. INVENTORY_ALERTS
-- ========================================================================

CREATE TABLE inventory_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    product_id UUID NOT NULL,
    alert_type VARCHAR(30) NOT NULL,
    current_quantity NUMERIC(12,3) NOT NULL,
    reorder_threshold NUMERIC(12,3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_alert_type
        CHECK (alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK')),
    CONSTRAINT chk_alert_status
        CHECK (status IN ('ACTIVE', 'RESOLVED')),
    CONSTRAINT chk_alert_quantity
        CHECK (current_quantity >= 0),
    CONSTRAINT chk_alert_threshold
        CHECK (reorder_threshold >= 0),
    CONSTRAINT chk_alert_resolution
        CHECK (
            (status = 'ACTIVE' AND resolved_at IS NULL)
            OR (status = 'RESOLVED' AND resolved_at IS NOT NULL)
        ),
    CONSTRAINT fk_alert_inventory
        FOREIGN KEY (business_id, product_id)
        REFERENCES inventory(business_id, product_id)
        ON DELETE RESTRICT
);

-- Only one active alert of each type per product/business.
CREATE UNIQUE INDEX uq_active_inventory_alert
ON inventory_alerts (business_id, product_id, alert_type)
WHERE status = 'ACTIVE';


-- ========================================================================
-- 9. SALES
-- ========================================================================

CREATE TABLE sales (
    sale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    sale_number VARCHAR(50) NOT NULL,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    idempotency_key VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_business
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_sales_business_number
        UNIQUE (business_id, sale_number),
    CONSTRAINT uq_sales_business_sale
        UNIQUE (business_id, sale_id),
    CONSTRAINT uq_sales_idempotency
        UNIQUE (business_id, idempotency_key),
    CONSTRAINT chk_sales_source
        CHECK (source IN ('MANUAL', 'VOICE', 'OCR')),
    CONSTRAINT chk_sales_status
        CHECK (status IN ('COMPLETED', 'VOIDED')),
    CONSTRAINT chk_sales_amounts
        CHECK (
            subtotal >= 0
            AND discount_amount >= 0
            AND discount_amount <= subtotal
            AND tax_amount >= 0
            AND total_amount = subtotal - discount_amount + tax_amount
        )
);


-- ========================================================================
-- 10. SALE_ITEMS
-- ========================================================================

CREATE TABLE sale_items (
    sale_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name_snapshot VARCHAR(150) NOT NULL,
    category_snapshot VARCHAR(100) NOT NULL,
    quantity NUMERIC(12,3) NOT NULL,
    unit_selling_price NUMERIC(12,2) NOT NULL,
    unit_cost_at_sale NUMERIC(12,2),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    revenue NUMERIC(12,2) NOT NULL,
    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (business_id, sale_id)
        REFERENCES sales(business_id, sale_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_sale_items_product
        FOREIGN KEY (business_id, product_id)
        REFERENCES products(business_id, product_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_sale_quantity
        CHECK (quantity > 0),
    CONSTRAINT chk_sale_selling_price
        CHECK (unit_selling_price >= 0),
    CONSTRAINT chk_sale_cost
        CHECK (unit_cost_at_sale IS NULL OR unit_cost_at_sale >= 0),
    CONSTRAINT chk_sale_item_amounts
        CHECK (
            discount_amount >= 0
            AND discount_amount <= quantity * unit_selling_price
            AND tax_amount >= 0
            AND revenue >= 0
            AND revenue = ROUND(
                quantity * unit_selling_price - discount_amount, 2
            )
        )
);


-- ========================================================================
-- 11. EXPENSES
-- ========================================================================

CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_business
        FOREIGN KEY (business_id)
        REFERENCES businesses(business_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_expense_amount
        CHECK (amount > 0)
);


-- ========================================================================
-- POST-CREATION INDEXES
-- ========================================================================

CREATE INDEX idx_businesses_owner
ON businesses (owner_user_id);

CREATE UNIQUE INDEX uq_app_users_email_lower
ON app_users (LOWER(email));

CREATE INDEX idx_products_business_category
ON products (business_id, category);

CREATE INDEX idx_inventory_business_quantity
ON inventory (business_id, available_quantity);

CREATE INDEX idx_stock_movements_product_date
ON stock_movements (business_id, product_id, created_at DESC);

CREATE INDEX idx_audit_logs_business_date
ON audit_logs (business_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity
ON audit_logs (business_id, entity_type, entity_id);

CREATE INDEX idx_inventory_alerts_business_status
ON inventory_alerts (business_id, status, created_at DESC);

CREATE INDEX idx_sales_business_date
ON sales (business_id, sale_date DESC);

CREATE INDEX idx_sales_business_status
ON sales (business_id, status);

CREATE INDEX idx_sale_items_business_sale
ON sale_items (business_id, sale_id);

CREATE INDEX idx_sale_items_product
ON sale_items (business_id, product_id);

CREATE INDEX idx_sale_items_category
ON sale_items (business_id, category_snapshot);

CREATE INDEX idx_expenses_business_date
ON expenses (business_id, expense_date DESC);


COMMIT;
