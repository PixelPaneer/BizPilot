-- Add the searchable text column required by the AI FAQ search route.

BEGIN;

ALTER TABLE faqs
    ADD COLUMN IF NOT EXISTS search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', question || ' ' || answer)
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_faqs_search_vector
ON faqs
USING GIN (search_vector);

COMMIT;
