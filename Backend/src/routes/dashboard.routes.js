import { Router } from "express";
import { getActivity, getSummary } from "../controllers/dashboard.controller.js";
import {
  validateActivityQuery,
  validateSummaryQuery,
} from "../validators/dashboard.validator.js";

const router = Router();

router.get("/summary", validateSummaryQuery, getSummary);
router.get("/activity", validateActivityQuery, getActivity);

export default router;
