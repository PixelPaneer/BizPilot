
import { pool } from "../config/db.js";

// Search only active FAQs belonging to the business authenticated by serviceAuth.
// The question and answer are searched, but relevance is primarily based on the question.
export async function searchActiveFaqs(businessId, { q, language, limit }) {
  const { rows } = await pool.query(
    `WITH search AS (
       SELECT plainto_tsquery('simple', $2) AS query
     )
     SELECT
       f.faq_id,
       f.question,
       f.answer,
       f.language,
       GREATEST(
         ts_rank_cd(f.search_vector, s.query),
         similarity(lower(f.question), lower($2))
       ) AS relevance
     FROM faqs f
     CROSS JOIN search s
     WHERE f.business_id = $1
       AND f.is_active = TRUE
       AND ($3::varchar IS NULL OR lower(f.language) = lower($3))
       AND (
         f.search_vector @@ s.query
         OR similarity(lower(f.question), lower($2)) >= 0.12
       )
     ORDER BY relevance DESC, f.updated_at DESC
     LIMIT $4`,
    [businessId, q, language || null, limit]
  );

  return rows.map((row) => ({
    faqId: row.faq_id,
    question: row.question,
    answer: row.answer,
    language: row.language,
    similarity: Math.round(Number(row.relevance) * 100) / 100,
  }));
}
