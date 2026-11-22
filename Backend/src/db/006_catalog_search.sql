-- BIZPILOT: MIGRATION 006 - CATALOG SEARCH BY APPROXIMATE NAME
-- Run after 005_refresh_tokens.sql.

BEGIN;

-- pg_trgm adds similarity(): how alike two pieces of text are, tolerant of typos, so a customer
-- who writes "parle g" or "magi" still finds "Parle-G" or "Maggi". The customer-facing product
-- search (GET /internal/catalog/search) uses it.
--
-- No index is added: a shop's catalog is small (hundreds to a few thousand products, always
-- filtered to one business first), and similarity() cannot use a trigram index anyway.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMIT;
