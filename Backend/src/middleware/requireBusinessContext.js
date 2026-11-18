
import { pool } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireBusinessContext = asyncHandler(
  async (req, res, next) => {
    // Authentication middleware must run before this middleware.
    const userId = req.user?.user_id;

    if (!userId) {
      throw new ApiError(
        401,
        "Authentication required. Please sign in."
      );
    }

    // Find the business owned by the authenticated user.
    const result = await pool.query(
      `SELECT business_id
         FROM businesses
        WHERE owner_user_id = $1
        LIMIT 2`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(
        403,
        "No business is associated with this account."
      );
    }

    // Protect against unexpected duplicate business records.
    if (result.rows.length > 1) {
      throw new ApiError(
        409,
        "Multiple businesses are associated with this account. Please contact support."
      );
    }

    // Attach the business ID for analytics controllers and services.
    req.businessId = result.rows[0].business_id;

    next();
  }
);
