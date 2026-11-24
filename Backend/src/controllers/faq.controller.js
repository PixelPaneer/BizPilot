
import faqService from "../services/faq.service.js";

// 1. GET ALL FAQs
const getAllFaqs = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { language } = req.query;

    const result = await faqService.getAllFaqs(
      businessId,
      language
    );

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET FAQ BY ID
const getFaqById = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { faqId } = req.params;

    const result = await faqService.getFaqById(
      businessId,
      faqId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 3. CREATE FAQ
const createFaq = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;

    const result = await faqService.createFaq(
      businessId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 4. UPDATE FAQ
const updateFaq = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { faqId } = req.params;

    const result = await faqService.updateFaq(
      businessId,
      faqId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 5. DELETE FAQ
const deleteFaq = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { faqId } = req.params;

    const result = await faqService.deleteFaq(
      businessId,
      faqId
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const faqController = {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
};

export default faqController;
