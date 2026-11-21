import { Router } from "express";
import { recordSale, voidSale } from "../controllers/sale.controller.js";
import { validateRecordSale, validateVoidSale } from "../validators/sale.validator.js";

const router = Router();

router.post("/", validateRecordSale, recordSale);
router.post("/:id/void", validateVoidSale, voidSale);

export default router;
