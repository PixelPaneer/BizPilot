import express from "express";
import { example } from "../controllers/example.controller.js";

const router = express.Router();
router.get("/", example);

export default router;
