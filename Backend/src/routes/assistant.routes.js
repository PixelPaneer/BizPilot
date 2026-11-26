import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { callAi } from "../services/aiClient.js";

const router = Router();

// POST /api/v1/assistant/message
router.post(
  "/message",
  asyncHandler(async (req, res) => {
    const { message } = req.body;

    // Validate the incoming message
    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain between 1 and 1000 characters.",
      });
    }

    // Business ID comes from authenticated Node middleware.
    // Sender role is fixed as owner, not accepted from frontend.
    const result = await callAi(
      req.businessId,
      "/internal/orchestrate",
      {
        method: "POST",
        body: {
          message: message.trim(),
          senderRole: "owner",
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

export default router;