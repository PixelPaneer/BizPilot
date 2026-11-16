import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

// Kept as a separate controller to match the agreed team folder structure.
// Authentication profile retrieval is currently handled by auth.controller.js.
const health = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, { status: "ok" }, "User module is ready."));
});

export { health };
