import * as faqService from "../services/faq.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getAllFaqs = asyncHandler(async (req, res) => {
  const data = await faqService.getAllFaqs(req.businessId, req.query.language);
  res.status(200).json({ success: true, count: data.length, data });
});

export const getFaqById = asyncHandler(async (req, res) => {
  const data = await faqService.getFaqById(req.businessId, req.params.faqId);
  res.status(200).json({ success: true, data });
});

export const createFaq = asyncHandler(async (req, res) => {
  const data = await faqService.createFaq(req.businessId, req.body);
  res.status(201).json({ success: true, message: "FAQ created successfully", data });
});

export const updateFaq = asyncHandler(async (req, res) => {
  const data = await faqService.updateFaq(req.businessId, req.params.faqId, req.body);
  res.status(200).json({ success: true, message: "FAQ updated successfully", data });
});

export const deleteFaq = asyncHandler(async (req, res) => {
  const data = await faqService.deleteFaq(req.businessId, req.params.faqId);
  res.status(200).json({ success: true, ...data });
});
