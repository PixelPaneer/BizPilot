import * as faqModel from "../models/faq.model.js";
import { ApiError } from "../utils/ApiError.js";

export function getAllFaqs(businessId, language) {
  return faqModel.getAllFaqs(businessId, language);
}

export async function getFaqById(businessId, faqId) {
  const faq = await faqModel.getFaqById(businessId, faqId);
  if (!faq) throw new ApiError(404, "FAQ not found", [], "NOT_FOUND");
  return faq;
}

export function createFaq(businessId, data) {
  return faqModel.createFaq(businessId, data);
}

export async function updateFaq(businessId, faqId, data) {
  const faq = await faqModel.updateFaq(businessId, faqId, data);
  if (!faq) throw new ApiError(404, "FAQ not found", [], "NOT_FOUND");
  return faq;
}

export async function deleteFaq(businessId, faqId) {
  const faq = await faqModel.deleteFaq(businessId, faqId);
  if (!faq) throw new ApiError(404, "FAQ not found", [], "NOT_FOUND");
  return { message: "FAQ deleted successfully" };
}
