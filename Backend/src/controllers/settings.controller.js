
const cloudinary = require("../config/cloudinary");
const settingsService = require("../services/settings.service");

const getBusinessProfile = async (req, res, next) => {
  try {
    const result = await settingsService.getProfile(req.user.business_id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateBusinessProfile = async (req, res, next) => {
  try {
    const result = await settingsService.saveProfile(
      req.user.business_id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Business profile updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const uploadBusinessLogo = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a logo to upload",
      });
    }

    // Upload image buffer to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "bizpilot/business-logos",
          resource_type: "image",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    // Save Cloudinary URL in PostgreSQL
    const savedLogo = await settingsService.saveLogo(
      businessId,
      uploadResult.secure_url
    );

    return res.status(200).json({
      success: true,
      message: "Business logo uploaded successfully",
      data: {
        business_id: savedLogo.business_id,
        business_logo_url: savedLogo.business_logo_url,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getInventoryPreferences = async (req, res, next) => {
  try {
    const result = await settingsService.getPreferences(
      req.user.business_id
    );

    res.status(200).json({
      success: true,
      data: {
        stock_alerts_enabled: result.stock_alerts_enabled,
        low_stock_alerts_enabled: result.low_stock_alerts_enabled,
        out_of_stock_alerts_enabled: result.out_of_stock_alerts_enabled,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateInventoryPreferences = async (req, res, next) => {
  try {
    const current = await settingsService.getPreferences(
      req.user.business_id
    );

    const result = await settingsService.savePreferences(
      req.user.business_id,
      { ...current, ...req.body }
    );

    res.status(200).json({
      success: true,
      message: "Inventory preferences updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getLanguagePreferences = async (req, res, next) => {
  try {
    const result = await settingsService.getPreferences(
      req.user.business_id
    );

    res.status(200).json({
      success: true,
      data: {
        dashboard_language: result.dashboard_language,
        appearance_theme: result.appearance_theme,
        date_format: result.date_format,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateLanguagePreferences = async (req, res, next) => {
  try {
    const current = await settingsService.getPreferences(
      req.user.business_id
    );

    const result = await settingsService.savePreferences(
      req.user.business_id,
      { ...current, ...req.body }
    );

    res.status(200).json({
      success: true,
      message: "Language preferences updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getNotificationPreferences = async (req, res, next) => {
  try {
    const result = await settingsService.getPreferences(
      req.user.business_id
    );

    res.status(200).json({
      success: true,
      data: {
        in_app_notifications_enabled: result.in_app_notifications_enabled,
        email_notifications_enabled: result.email_notifications_enabled,
        notification_low_stock_enabled: result.notification_low_stock_enabled,
        notification_out_of_stock_enabled: result.notification_out_of_stock_enabled,
        report_frequency: result.report_frequency,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateNotificationPreferences = async (req, res, next) => {
  try {
    const current = await settingsService.getPreferences(
      req.user.business_id
    );

    const result = await settingsService.savePreferences(
      req.user.business_id,
      { ...current, ...req.body }
    );

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getAccount = async (req, res, next) => {
  try {
    const result = await settingsService.getAccountDetails(
      req.user.user_id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const result = await settingsService.saveAccountDetails(
      req.user.user_id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Account details updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const result = await settingsService.changePassword(
      req.user.user_id,
      req.body.currentPassword,
      req.body.newPassword
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};


// GET /api/v1/settings
const getSettings = async (req, res, next) => {
  try {
    const result = await settingsService.getPreferences(
      req.user.business_id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


// PATCH /api/v1/settings
const updateSettings = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;

    const result = await settingsService.patchPreferences(
      businessId, 
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
  getInventoryPreferences,
  updateInventoryPreferences,
  getLanguagePreferences,
  updateLanguagePreferences,
  getNotificationPreferences,
  updateNotificationPreferences,
  getAccount,
  updateAccount,
  changePassword,
  getSettings,
  updateSettings,
};
