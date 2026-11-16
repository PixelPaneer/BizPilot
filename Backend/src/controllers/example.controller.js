import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

const example = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, { example: true }, "Example route."));
});

export { example };
