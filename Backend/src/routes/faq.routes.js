
const express = require("express");
const router = express.Router();

const faqController = require("../controllers/faq.controller");

const {
  validateFaq,
  validateFaqId,
} = require("../validators/faq.validator");

// Authentication check
const requireBusinessAuth = (req, res, next) => {
  if (!req.user || !req.user.business_id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  next();
};

// Apply authentication to all FAQ routes
router.use(requireBusinessAuth);

// GET all active FAQs
router.get("/", faqController.getAllFaqs);

// GET a single FAQ
router.get("/:faqId", validateFaqId, faqController.getFaqById);

// CREATE a new FAQ
router.post("/", validateFaq, faqController.createFaq);

// UPDATE an existing FAQ
router.put("/:faqId", validateFaqId, validateFaq, faqController.updateFaq);

// DELETE an FAQ (soft delete)
router.delete("/:faqId", validateFaqId, faqController.deleteFaq);

module.exports = router;
