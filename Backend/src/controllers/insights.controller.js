import { asyncHandler } from "../utils/asyncHandler.js";
import { callAi } from "../services/aiClient.js";

export const askInsights = asyncHandler(async (req, res) => {
  const result = await callAi(
    req.businessId,
    "/internal/insights/ask",
    {
      method: "POST",
      body: req.insightsRequest,
      timeoutMs: 35000,
    }
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});
