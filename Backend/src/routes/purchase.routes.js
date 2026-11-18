import { Router } from "express";
import { recordPurchase } from "../controllers/purchase.controller.js";
import { validateRecordPurchase } from "../validators/sale.validator.js";

const router = Router();

router.post("/", validateRecordPurchase, recordPurchase);

export default router;
