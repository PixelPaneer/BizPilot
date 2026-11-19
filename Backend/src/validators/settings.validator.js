import { ApiError } from "../utils/ApiError.js";

const bad = (message) => new ApiError(400, message);

const SETTINGS_FIELDS = [
  "stock_alerts_enabled",
  "low_stock_alerts_enabled",
  "out_of_stock_alerts_enabled",
  "dashboard_language",
  "appearance_theme",
  "date_format",
  "in_app_notifications_enabled",
  "email_notifications_enabled",
  "notification_low_stock_enabled",
  "notification_out_of_stock_enabled",
  "report_frequency",
];

const BOOLEAN_FIELDS = [
  "stock_alerts_enabled",
  "low_stock_alerts_enabled",
  "out_of_stock_alerts_enabled",
  "in_app_notifications_enabled",
  "email_notifications_enabled",
  "notification_low_stock_enabled",
  "notification_out_of_stock_enabled",
];

export function validateBusinessProfile(req, res, next) {
  const body = req.body ?? {};
  const required = [
    "business_name",
    "business_type",
    "owner_name",
    "contact_number",
    "business_email",
    "business_address",
  ];

  for (const field of required) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return next(bad(`${field} is required`));
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.business_email.trim())) {
    return next(bad("Invalid business email"));
  }

  if (body.gstin && !/^[0-9A-Z]{15}$/.test(String(body.gstin).trim().toUpperCase())) {
    return next(bad("Invalid GSTIN format"));
  }

  const phoneLength = body.contact_number.trim().length;
  if (phoneLength < 10 || phoneLength > 20) {
    return next(bad("Invalid contact number"));
  }

  next();
}

export function validateAccount(req, res, next) {
  const body = req.body ?? {};

  for (const field of ["first_name", "last_name", "email", "whatsapp_number"]) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return next(bad(`${field} is required`));
    }
  }

  // Trimmed values are what get stored, so the model sees clean text.
  for (const field of ["first_name", "last_name", "email", "whatsapp_number"]) {
    body[field] = body[field].trim();
  }

  if (body.first_name.length > 60 || body.last_name.length > 60) {
    return next(bad("Names can be at most 60 characters"));
  }
  if (body.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return next(bad("Invalid email"));
  }
  if (!/^\+?[0-9]{10,19}$/.test(body.whatsapp_number)) {
    return next(bad("Invalid WhatsApp number"));
  }

  next();
}

export function validatePasswordChange(req, res, next) {
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || !currentPassword) {
    return next(bad("currentPassword is required"));
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return next(bad("New password must be at least 8 characters"));
  }
  // bcrypt only uses the first 72 bytes, so a longer password would be silently cut short.
  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    return next(bad("New password is too long (72 bytes at most)"));
  }
  if (newPassword === currentPassword) {
    return next(bad("New password must be different from the current password"));
  }

  next();
}

// Validates the body of PATCH /settings: only known fields, with the right types and values.
export function validateSettings(req, res, next) {
  const body = req.body;

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return next(bad("Request body must be a valid JSON object"));
  }

  if (Object.keys(body).length === 0) {
    return next(bad("Please provide at least one setting to update"));
  }

  const invalidFields = Object.keys(body).filter((field) => !SETTINGS_FIELDS.includes(field));
  if (invalidFields.length > 0) {
    return next(bad(`Unsupported settings fields: ${invalidFields.join(", ")}`));
  }

  for (const field of BOOLEAN_FIELDS) {
    if (Object.hasOwn(body, field) && typeof body[field] !== "boolean") {
      return next(bad(`${field} must be true or false`));
    }
  }

  if (
    body.dashboard_language !== undefined &&
    !["English", "Hindi", "Hinglish"].includes(body.dashboard_language)
  ) {
    return next(bad("Invalid dashboard language"));
  }

  if (body.appearance_theme !== undefined && !["light", "dark"].includes(body.appearance_theme)) {
    return next(bad("Appearance theme must be light or dark"));
  }

  if (
    body.report_frequency !== undefined &&
    !["Daily", "Weekly", "Monthly"].includes(body.report_frequency)
  ) {
    return next(bad("Invalid report frequency"));
  }

  if (
    body.date_format !== undefined &&
    (typeof body.date_format !== "string" ||
      body.date_format.trim() === "" ||
      body.date_format.length > 20)
  ) {
    return next(bad("Invalid date format"));
  }

  next();
}
