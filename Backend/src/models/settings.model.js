import { pool } from "../config/db.js";

// Read inside a stock change's transaction, so the alert rules use the owner's current choices.
export async function getStockAlertSettings(client, businessId) {
  const { rows } = await client.query(
    `SELECT stock_alerts_enabled, low_stock_alerts_enabled,
            out_of_stock_alerts_enabled
       FROM business_settings
      WHERE business_id = $1`,
    [businessId]
  );
  return rows[0] ?? null;
}

// ---- Settings page (merged from Backend-Settings-Kanishk, ported to ES modules) ----

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

export async function getBusinessProfile(businessId) {
  const result = await pool.query(
    `SELECT business_id, business_name, business_type, owner_name,
            contact_number, business_email, business_address,
            business_description, business_logo_url, gstin,
            created_at, updated_at
       FROM businesses
      WHERE business_id = $1`,
    [businessId]
  );
  return result.rows[0];
}

export async function updateBusinessProfile(businessId, data) {
  const result = await pool.query(
    `UPDATE businesses
        SET business_name = $1, business_type = $2, owner_name = $3,
            contact_number = $4, business_email = $5, business_address = $6,
            business_description = $7, gstin = $8,
            updated_at = CURRENT_TIMESTAMP
      WHERE business_id = $9
      RETURNING *`,
    [
      data.business_name,
      data.business_type,
      data.owner_name,
      data.contact_number,
      data.business_email,
      data.business_address,
      data.business_description ?? null,
      data.gstin || null,
      businessId,
    ]
  );
  return result.rows[0];
}

export async function updateBusinessLogo(businessId, logoUrl) {
  const result = await pool.query(
    `UPDATE businesses
        SET business_logo_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE business_id = $2
      RETURNING business_id, business_logo_url`,
    [logoUrl, businessId]
  );
  return result.rows[0];
}

export async function getBusinessSettings(businessId) {
  const result = await pool.query(
    "SELECT * FROM business_settings WHERE business_id = $1",
    [businessId]
  );
  return result.rows[0];
}

// Updates only the listed settings (column names come from SETTINGS_FIELDS, never from input).
export async function patchBusinessSettings(businessId, data) {
  const fields = Object.keys(data).filter((field) => SETTINGS_FIELDS.includes(field));
  if (fields.length === 0) return null;

  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");
  const values = [...fields.map((field) => data[field]), businessId];

  const result = await pool.query(
    `UPDATE business_settings
        SET ${setClause}
      WHERE business_id = $${fields.length + 1}
      RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function getAccount(userId) {
  const result = await pool.query(
    `SELECT user_id, first_name, last_name, email, whatsapp_number,
            whatsapp_verified_at, is_active, created_at
       FROM app_users
      WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function updateAccount(userId, data) {
  const result = await pool.query(
    `UPDATE app_users
        SET first_name = $1, last_name = $2, email = $3,
            -- a changed number must be verified again
            whatsapp_verified_at = CASE
              WHEN whatsapp_number IS DISTINCT FROM $4 THEN NULL
              ELSE whatsapp_verified_at
            END,
            whatsapp_number = $4, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5
      RETURNING user_id, first_name, last_name, email, whatsapp_number, is_active`,
    [data.first_name, data.last_name, data.email.toLowerCase(), data.whatsapp_number, userId]
  );
  return result.rows[0];
}

export async function getPasswordHash(userId) {
  const result = await pool.query(
    "SELECT password_hash FROM app_users WHERE user_id = $1",
    [userId]
  );
  return result.rows[0];
}

export async function updatePasswordHash(userId, passwordHash) {
  const result = await pool.query(
    `UPDATE app_users
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING user_id`,
    [passwordHash, userId]
  );
  return result.rows[0];
}
