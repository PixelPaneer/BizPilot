
import { searchActiveFaqs } from "../models/internalFaq.model.js";

export const DEFAULT_FAQ_LIMIT = 5;
export const MAX_FAQ_LIMIT = 5;

export async function searchFaqs(businessId, { q, language, limit }) {
  const faqs = await searchActiveFaqs(businessId, {
    q: q.trim(),
    language: language || null,
    limit: Math.min(limit || DEFAULT_FAQ_LIMIT, MAX_FAQ_LIMIT),
  });

  return { faqs };
}
