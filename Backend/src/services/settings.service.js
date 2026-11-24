import bcrypt from "bcryptjs";
import * as settingsModel from "../models/settings.model.js";
import { ApiError } from "../utils/ApiError.js";

function required(value, message) {
  if (!value) throw new ApiError(404, message);
  return value;
}

export async function getProfile(businessId) {
  return required(await settingsModel.getBusinessProfile(businessId), "Business profile not found");
}

// A duplicate email (unique index) is the owner's input problem, not a server fault.
async function orConflict(action, message) {
  try {
    return await action();
  } catch (error) {
    if (error.code === "23505") throw new ApiError(409, message);
    throw error;
  }
}

export async function saveProfile(businessId, data) {
  return required(
    await orConflict(
      () => settingsModel.updateBusinessProfile(businessId, data),
      "A business with these details already exists"
    ),
    "Business profile not found"
  );
}

export async function saveLogo(businessId, logoUrl) {
  return required(
    await settingsModel.updateBusinessLogo(businessId, logoUrl),
    "Business profile not found"
  );
}

export async function getPreferences(businessId) {
  return required(
    await settingsModel.getBusinessSettings(businessId),
    "Business settings not found"
  );
}

export async function patchPreferences(businessId, data) {
  return required(
    await settingsModel.patchBusinessSettings(businessId, data),
    "Business settings not found"
  );
}

export async function getAccountDetails(userId) {
  return required(await settingsModel.getAccount(userId), "Account not found");
}

export async function saveAccountDetails(userId, data) {
  return required(
    await orConflict(
      () => settingsModel.updateAccount(userId, data),
      "This email is already used by another account"
    ),
    "Account not found"
  );
}

export async function changePassword(userId, currentPassword, newPassword) {
  const account = required(await settingsModel.getPasswordHash(userId), "Account not found");

  const isValid = await bcrypt.compare(currentPassword, account.password_hash);
  if (!isValid) throw new ApiError(400, "Current password is incorrect");

  await settingsModel.updatePasswordHash(userId, await bcrypt.hash(newPassword, 12));
  return { message: "Password updated successfully" };
}
