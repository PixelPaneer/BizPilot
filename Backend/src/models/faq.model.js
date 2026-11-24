
import pool from "../config/db.js";

// 1. GET ALL ACTIVE FAQs FOR A BUSINESS
const getAllFaqs = async (businessId, language) => {
  let query = `
    SELECT
      faq_id,
      business_id,
      question,
      answer,
      language,
      is_active,
      created_at,
      updated_at
    FROM faqs
    WHERE business_id = $1
      AND is_active = TRUE
  `;

  const values = [businessId];

  if (language) {
    query += ` AND language = $2`;
    values.push(language);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, values);
  return result.rows;
};

// 2. GET ONE FAQ
const getFaqById = async (businessId, faqId) => {
  const query = `
    SELECT *
    FROM faqs
    WHERE business_id = $1
      AND faq_id = $2
      AND is_active = TRUE
  `;

  const result = await pool.query(query, [businessId, faqId]);
  return result.rows[0];
};

// 3. CREATE FAQ
const createFaq = async (businessId, data) => {
  const query = `
    INSERT INTO faqs (
      business_id,
      question,
      answer,
      language
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      faq_id,
      business_id,
      question,
      answer,
      language,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    businessId,
    data.question.trim(),
    data.answer.trim(),
    data.language || "en",
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// 4. UPDATE FAQ
const updateFaq = async (businessId, faqId, data) => {
  const query = `
    UPDATE faqs
    SET
      question = $1,
      answer = $2,
      language = COALESCE($3, language),
      updated_at = CURRENT_TIMESTAMP
    WHERE business_id = $4
      AND faq_id = $5
      AND is_active = TRUE
    RETURNING *
  `;

  const values = [
    data.question.trim(),
    data.answer.trim(),
    data.language ?? null,
    businessId,
    faqId,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// 5. SOFT DELETE FAQ
const deleteFaq = async (businessId, faqId) => {
  const query = `
    UPDATE faqs
    SET
      is_active = FALSE,
      updated_at = CURRENT_TIMESTAMP
    WHERE business_id = $1
      AND faq_id = $2
      AND is_active = TRUE
    RETURNING faq_id
  `;

  const result = await pool.query(query, [businessId, faqId]);
  return result.rows[0];
};

const faqModel = {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
};

export default faqModel;
