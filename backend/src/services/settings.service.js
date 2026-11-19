
const bcrypt = require("bcrypt");
const settingsModel = require("../models/settings.model");

const getProfile = async (businessId) => {
  const profile = await settingsModel.getBusinessProfile(businessId);

  if (!profile) {
    throw new Error("Business profile not found");
  }

  return profile;
};

const saveProfile = async (businessId, data) => {
  const updated = await settingsModel.updateBusinessProfile(
    businessId,
    data
  );

  if (!updated) {
    throw new Error("Business profile not found");
  }

  return updated;
};

const saveLogo = async (businessId, logoUrl) => {
  const result = await settingsModel.updateBusinessLogo(
    businessId,
    logoUrl
  );

  if (!result) {
    throw new Error("Business profile not found");
  }

  return result;
};

const getPreferences = async (businessId) => {
  const preferences = await settingsModel.getBusinessSettings(businessId);

  if (!preferences) {
    throw new Error("Business settings not found");
  }

  return preferences;
};

const savePreferences = async (businessId, data) => {
  const updated = await settingsModel.updateBusinessSettings(
    businessId,
    data
  );

  if (!updated) {
    throw new Error("Business settings not found");
  }

  return updated;
};

const patchPreferences = async (businessId, data) => {
  const updated = await settingsModel.patchBusinessSettings(
    businessId,
    data
  );

  if (!updated) {
    throw new Error("Business settings not found");
  }

  return updated;
};

const getAccountDetails = async (userId) => {
  const account = await settingsModel.getAccount(userId);

  if (!account) {
    throw new Error("Account not found");
  }

  return account;
};

const saveAccountDetails = async (userId, data) => {
  const updated = await settingsModel.updateAccount(userId, data);

  if (!updated) {
    throw new Error("Account not found");
  }

  return updated;
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const account = await settingsModel.getPasswordHash(userId);

  if (!account) {
    throw new Error("Account not found");
  }

  const isValid = await bcrypt.compare(
    currentPassword,
    account.password_hash
  );

  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await settingsModel.updatePasswordHash(userId, passwordHash);

  return { message: "Password updated successfully" };
};

module.exports = {
  getProfile,
  saveProfile,
  saveLogo,
  getPreferences,
  savePreferences,
  patchPreferences,
  getAccountDetails,
  saveAccountDetails,
  changePassword,
};
