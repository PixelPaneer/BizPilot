import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAiToken } from "../utils/serviceToken.js";

// Guards the /internal routes, which only the AI service may call. Sets req.serviceBusinessId to
// the shop named in the token: that is the only legitimate source of the tenant id on these routes
// (never a query or body value, and never an owner's sign-in token).
export const serviceAuth = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication required.", [], "UNAUTHENTICATED");
  }

  req.serviceBusinessId = verifyAiToken(token).businessId;
  next();
});
