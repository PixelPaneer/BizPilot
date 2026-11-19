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
