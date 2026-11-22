import { Router } from "express";
import { body } from "express-validator";
import { extractBill } from "../controllers/bill.controller.js";
import { uploadBillFile } from "../middleware/billUpload.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();

// multipart/form-data: exactly one of `audio` (a voice note) or `image` (a photo of a bill, from a
// file or straight from the camera), and an optional `type` hint, SALE or PURCHASE.
router.post(
  "/extract",
  uploadBillFile,
  body("type").optional().isIn(["SALE", "PURCHASE"]),
  validate,
  extractBill
);

export default router;
