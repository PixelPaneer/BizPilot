import cloudinary from "../config/cloudinary.js";
import * as settingsService from "../services/settings.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// The business always comes from req.businessId (set by requireBusinessContext) and the user
// from req.user.user_id, never from the request body.

// GET /api/v1/settings
export const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getPreferences(req.businessId);
  res.status(200).json({ success: true, data });
});

// PATCH /api/v1/settings
export const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.patchPreferences(req.businessId, req.body);
  res.status(200).json({ success: true, message: "Settings updated successfully", data });
});

export const getBusinessProfile = asyncHandler(async (req, res) => {
  const data = await settingsService.getProfile(req.businessId);
  res.status(200).json({ success: true, data });
});

export const updateBusinessProfile = asyncHandler(async (req, res) => {
  const data = await settingsService.saveProfile(req.businessId, req.body);
  res.status(200).json({ success: true, message: "Business profile updated successfully", data });
});

export const uploadBusinessLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Please select a logo to upload");

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "bizpilot/business-logos", resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(req.file.buffer);
  });

  const saved = await settingsService.saveLogo(req.businessId, uploadResult.secure_url);
  res.status(200).json({
    success: true,
    message: "Business logo uploaded successfully",
    data: { business_id: saved.business_id, business_logo_url: saved.business_logo_url },
  });
});

export const getAccount = asyncHandler(async (req, res) => {
  const data = await settingsService.getAccountDetails(req.user.user_id);
  res.status(200).json({ success: true, data });
});

export const updateAccount = asyncHandler(async (req, res) => {
  const data = await settingsService.saveAccountDetails(req.user.user_id, req.body);
  res.status(200).json({ success: true, message: "Account details updated successfully", data });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await settingsService.changePassword(
    req.user.user_id,
    req.body.currentPassword,
    req.body.newPassword
  );
  res.status(200).json({ success: true, ...result });
});
