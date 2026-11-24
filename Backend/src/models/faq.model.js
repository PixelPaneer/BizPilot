import { pool } from "../config/db.js";

export async function createSignupFaqs(client, businessId, faqs) {
  for (const faq of faqs) {
    await client.query(
      `INSERT INTO faqs (business_id, question, answer, language)
       VALUES ($1, $2, $3, 'en')`,
      [businessId, faq.question, faq.answer]
    );
  }
}

export async function getAllFaqs(businessId, language) {
  const values = [businessId];
  let query = `
    SELECT faq_id, business_id, question, answer, language, is_active, created_at, updated_at
      FROM faqs
     WHERE business_id = $1
       AND is_active = TRUE
  `;
  if (language) {
    values.push(language);
    query += " AND language = $2";
  }
  query += " ORDER BY created_at DESC";
  const result = await pool.query(query, values);
  return result.rows;
}

export async function getFaqById(businessId, faqId) {
  const result = await pool.query(
    `SELECT * FROM faqs
      WHERE business_id = $1 AND faq_id = $2 AND is_active = TRUE`,
    [businessId, faqId]
  );
  return result.rows[0] || null;
}

export async function createFaq(businessId, data) {
  const result = await pool.query(
    `INSERT INTO faqs (business_id, question, answer, language)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [businessId, data.question.trim(), data.answer.trim(), data.language || "en"]
  );
  return result.rows[0];
}

export async function updateFaq(businessId, faqId, data) {
  const result = await pool.query(
    `UPDATE faqs
        SET question = $1,
            answer = $2,
            language = COALESCE($3, language),
            updated_at = CURRENT_TIMESTAMP
      WHERE business_id = $4
        AND faq_id = $5
        AND is_active = TRUE
     RETURNING *`,
    [data.question.trim(), data.answer.trim(), data.language ?? null, businessId, faqId]
  );
  return result.rows[0] || null;
}

export async function deleteFaq(businessId, faqId) {
  const result = await pool.query(
    `UPDATE faqs
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE business_id = $1
        AND faq_id = $2
        AND is_active = TRUE
     RETURNING faq_id`,
    [businessId, faqId]
  );
  return result.rows[0] || null;
}
