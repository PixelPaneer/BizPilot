
import faqModel from "../models/faq.model.js";

// GET ALL FAQs
const getAllFaqs = async (businessId, language) => {
  return await faqModel.getAllFaqs(businessId, language);
};

// GET FAQ BY ID
const getFaqById = async (businessId, faqId) => {
  const faq = await faqModel.getFaqById(businessId, faqId);

  if (!faq) {
    throw new Error("FAQ not found");
  }

  return faq;
};

// CREATE FAQ
const createFaq = async (businessId, data) => {
  return await faqModel.createFaq(businessId, data);
};

// UPDATE FAQ
const updateFaq = async (businessId, faqId, data) => {
  const updatedFaq = await faqModel.updateFaq(
    businessId,
    faqId,
    data
  );

  if (!updatedFaq) {
    throw new Error("FAQ not found");
  }

  return updatedFaq;
};

// DELETE FAQ
const deleteFaq = async (businessId, faqId) => {
  const deletedFaq = await faqModel.deleteFaq(
    businessId,
    faqId
  );

  if (!deletedFaq) {
    throw new Error("FAQ not found");
  }

  return { message: "FAQ deleted successfully" };
};

const faqService = {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
};

export default faqService;
