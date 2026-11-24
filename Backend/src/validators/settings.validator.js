
const validateBusinessProfile = (req, res, next) => {
  const {
    business_name,
    business_type,
    owner_name,
    contact_number,
    business_email,
    business_address,
    gstin
  } = req.body;

  const requiredFields = {
    business_name,
    business_type,
    owner_name,
    contact_number,
    business_email,
    business_address
  };

  for (const [field, value] of Object.entries(requiredFields)) {
    if (typeof value !== "string" || !value.trim()) {
      return res.status(400).json({
        success: false,
        message: `${field} is required`
      });
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(business_email.trim())) {
    return res.status(400).json({
      success: false,
      message: "Invalid business email"
    });
  }

  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: "Invalid GSTIN format"
    });
  }

  if (
    contact_number.trim().length < 10 ||
    contact_number.trim().length > 20
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact number"
    });
  }

  next();
};

// Validate Settings PATCH request
const validateSettings = (req, res, next) => {
  const allowedFields = [
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
    "report_frequency"
  ];

  const booleanFields = [
    "stock_alerts_enabled",
    "low_stock_alerts_enabled",
    "out_of_stock_alerts_enabled",
    "in_app_notifications_enabled",
    "email_notifications_enabled",
    "notification_low_stock_enabled",
    "notification_out_of_stock_enabled"
  ];

  if (
    typeof req.body !== "object" ||
    req.body === null ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      success: false,
      message: "Request body must be a valid JSON object"
    });
  }

  // Check for empty request
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide at least one setting to update"
    });
  }

  // Reject unsupported fields
  const invalidFields = Object.keys(req.body).filter(
    field => !allowedFields.includes(field)
  );

  if (invalidFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unsupported settings fields: ${invalidFields.join(", ")}`
    });
  }

  // Validate boolean fields
  for (const field of booleanFields) {
    if (
      Object.prototype.hasOwnProperty.call(req.body, field) &&
      typeof req.body[field] !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: `${field} must be true or false`
      });
    }
  }

  // Validate dashboard language
  if (
    req.body.dashboard_language !== undefined &&
    !["English", "Hindi", "Hinglish"].includes(req.body.dashboard_language)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid dashboard language"
    });
  }

  // Validate appearance theme
  if (
    req.body.appearance_theme !== undefined &&
    !["light", "dark"].includes(req.body.appearance_theme)
  ) {
    return res.status(400).json({
      success: false,
      message: "Appearance theme must be light or dark"
    });
  }

  // Validate report frequency
  if (
    req.body.report_frequency !== undefined &&
    !["Daily", "Weekly", "Monthly"].includes(req.body.report_frequency)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid report frequency"
    });
  }

  // Validate date format
  if (
    req.body.date_format !== undefined &&
    (
      typeof req.body.date_format !== "string" ||
      req.body.date_format.trim() === "" ||
      req.body.date_format.length > 20
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format"
    });
  }

  next();
};

export {
  validateBusinessProfile,
  validateSettings
};


