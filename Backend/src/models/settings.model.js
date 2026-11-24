
import pool from "../config/db.js";

// BUSINESS PROFILE

const getBusinessProfile = async (businessId) => {
  const query = `
    SELECT
      business_id,
      business_name,
      business_type,
      owner_name,
      contact_number,
      business_email,
      business_address,
      business_description,
      business_logo_url,
      gstin,
      created_at,
      updated_at
    FROM businesses
    WHERE business_id = $1
  `;

  const result = await pool.query(query, [businessId]);
  return result.rows[0];
};

const updateBusinessProfile = async (businessId, data) => {
  const query = `
    UPDATE businesses
    SET
      business_name = $1,
      business_type = $2,
      owner_name = $3,
      contact_number = $4,
      business_email = $5,
      business_address = $6,
      business_description = $7,
      gstin = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE business_id = $9
    RETURNING *
  `;

  const values = [
    data.business_name,
    data.business_type,
    data.owner_name,
    data.contact_number,
    data.business_email,
    data.business_address,
    data.business_description ?? null,
    data.gstin || null,
    businessId,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateBusinessLogo = async (businessId, logoUrl) => {
  const query = `
    UPDATE businesses
    SET business_logo_url = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE business_id = $2
    RETURNING business_id, business_logo_url
  `;

  const result = await pool.query(query, [logoUrl, businessId]);
  return result.rows[0];
};

// BUSINESS SETTINGS

const getBusinessSettings = async (businessId) => {
  const query = `
    SELECT *
    FROM business_settings
    WHERE business_id = $1
  `;

  const result = await pool.query(query, [businessId]);
  return result.rows[0];
};

const updateBusinessSettings = async (businessId, data) => {
  const query = `
    UPDATE business_settings
    SET
      stock_alerts_enabled = $1,
      low_stock_alerts_enabled = $2,
      out_of_stock_alerts_enabled = $3,
      dashboard_language = $4,
      appearance_theme = $5,
      date_format = $6,
      in_app_notifications_enabled = $7,
      email_notifications_enabled = $8,
      notification_low_stock_enabled = $9,
      notification_out_of_stock_enabled = $10,
      report_frequency = $11
    WHERE business_id = $12
    RETURNING *
  `;

  const values = [
    data.stock_alerts_enabled,
    data.low_stock_alerts_enabled,
    data.out_of_stock_alerts_enabled,
    data.dashboard_language,
    data.appearance_theme,
    data.date_format,
    data.in_app_notifications_enabled,
    data.email_notifications_enabled,
    data.notification_low_stock_enabled,
    data.notification_out_of_stock_enabled,
    data.report_frequency,
    businessId,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const patchBusinessSettings = async (businessId, data) => {
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
    "report_frequency",
  ];

  const fields = Object.keys(data).filter(
    (field) => allowedFields.includes(field)
  );

  if (fields.length === 0) {
    return null;
  }

  const values = fields.map((field) => data[field]);

  const setClause = fields
    .map((field, index) => `${field} = $${index + 1}`)
    .join(", ");

  const query = `
    UPDATE business_settings
    SET ${setClause}
    WHERE business_id = $${fields.length + 1}
    RETURNING *
  `;

  values.push(businessId);

  const result = await pool.query(query, values);
  return result.rows[0];
};

// ACCOUNT DETAILS

const getAccount = async (userId) => {
  const query = `
    SELECT
      user_id,
      first_name,
      last_name,
      email,
      whatsapp_number,
      whatsapp_verified_at,
      is_active,
      created_at
    FROM app_users
    WHERE user_id = $1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

const updateAccount = async (userId, data) => {
  const query = `
    UPDATE app_users
    SET
      first_name = $1,
      last_name = $2,
      email = $3,
      whatsapp_number = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $5
    RETURNING
      user_id, first_name, last_name,
      email, whatsapp_number, is_active
  `;

  const result = await pool.query(
    query,
    [
      data.first_name,
      data.last_name,
      data.email.toLowerCase(),
      data.whatsapp_number,
      userId,
    ]
  );

  return result.rows[0];
};

const updatePasswordHash = async (userId, passwordHash) => {
  const query = `
    UPDATE app_users
    SET password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $2
    RETURNING user_id
  `;

  const result = await pool.query(query, [passwordHash, userId]);
  return result.rows[0];
};

const getPasswordHash = async (userId) => {
  const result = await pool.query(
    "SELECT password_hash FROM app_users WHERE user_id = $1",
    [userId]
  );

  return result.rows[0];
};

const settingsModel = {
  getBusinessProfile,
  updateBusinessProfile,
  updateBusinessLogo,
  getBusinessSettings,
  updateBusinessSettings,
  patchBusinessSettings,
  getAccount,
  updateAccount,
  updatePasswordHash,
  getPasswordHash,
};

export default settingsModel;
