import { Router } from "express";
import { body } from "express-validator";
import { extractBill } from "../controllers/bill.controller.js";
import { uploadAudio } from "../middleware/audioUpload.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// multipart/form-data: `audio` (the voice note) and an optional `type` hint, SALE or PURCHASE.
// Photos of bills are not read yet.
router.post(
  "/extract",
  uploadAudio,
  body("type").optional().isIn(["SALE", "PURCHASE"]),
  validate,
  extractBill
);

export default router;
