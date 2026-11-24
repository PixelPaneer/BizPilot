import { Router } from "express";
import * as controller from "../controllers/faq.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { createFaqValidator, faqIdValidator, updateFaqValidator } from "../validators/faq.validator.js";

const router = Router();

router.get("/", controller.getAllFaqs);
router.get("/:faqId", faqIdValidator, validate, controller.getFaqById);
router.post("/", createFaqValidator, validate, controller.createFaq);
router.put("/:faqId", faqIdValidator, updateFaqValidator, validate, controller.updateFaq);
router.delete("/:faqId", faqIdValidator, validate, controller.deleteFaq);

export default router;
