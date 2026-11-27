import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { callAi } from "../services/aiClient.js";

const router = Router();

router.post(
  "/message",
  asyncHandler(async (req, res) => {
    const message = req.body?.message;

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 1000
    ) {
      throw new ApiError(
        400,
        "Message must contain between 1 and 1000 characters.",
        [],
        "VALIDATION_ERROR"
      );
    }

    const result = await callAi(req.businessId, "/internal/orchestrate", {
      method: "POST",
      body: {
        message: message.trim(),
        senderRole: "owner",
      },
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

export default router;
