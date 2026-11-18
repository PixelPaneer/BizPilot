import { Router } from "express";
import { getProfile } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/", getProfile);

export default router;
