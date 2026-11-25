import { pool } from "../config/db.js";

export async function findLatest(number) {
  const { rows } = await pool.query(
    `SELECT otp_id, created_at FROM whatsapp_signup_otps
      WHERE whatsapp_number = $1
      ORDER BY created_at DESC LIMIT 1`,
    [number]
  );
  return rows[0] || null;
}

// Only the newest OTP for a number is valid.
export async function replaceOtp(db, { number, otpHash, expiresAt }) {
  await db.query(
    `UPDATE whatsapp_signup_otps SET consumed_at = CURRENT_TIMESTAMP
      WHERE whatsapp_number = $1 AND consumed_at IS NULL AND verified_at IS NULL`,
    [number]
  );
  const { rows } = await db.query(
    `INSERT INTO whatsapp_signup_otps (whatsapp_number, otp_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING otp_id`,
    [number, otpHash, expiresAt]
  );
  return rows[0];
}

export async function deleteOtp(otpId) {
  await pool.query("DELETE FROM whatsapp_signup_otps WHERE otp_id = $1", [otpId]);
}

export async function findEnterable(number) {
  const { rows } = await pool.query(
    `SELECT otp_id, otp_hash FROM whatsapp_signup_otps
      WHERE whatsapp_number = $1 AND consumed_at IS NULL AND verified_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC LIMIT 1`,
    [number]
  );
  return rows[0] || null;
}

// Counts the try before the code is compared, so parallel guesses cannot dodge the limit.
export async function recordAttempt(otpId) {
  const { rows } = await pool.query(
    "UPDATE whatsapp_signup_otps SET attempts = attempts + 1 WHERE otp_id = $1 RETURNING attempts",
    [otpId]
  );
  return rows[0]?.attempts ?? Infinity;
}

export async function markVerified(otpId) {
  const { rowCount } = await pool.query(
    `UPDATE whatsapp_signup_otps SET verified_at = CURRENT_TIMESTAMP
      WHERE otp_id = $1 AND verified_at IS NULL AND consumed_at IS NULL`,
    [otpId]
  );
  return rowCount === 1;
}

// Locks and returns a verification made recently for this number, if there is one.
export async function takeRecentVerification(client, number, windowMinutes) {
  const { rows } = await client.query(
    `UPDATE whatsapp_signup_otps SET consumed_at = CURRENT_TIMESTAMP
      WHERE otp_id = (
        SELECT otp_id FROM whatsapp_signup_otps
         WHERE whatsapp_number = $1 AND verified_at IS NOT NULL AND consumed_at IS NULL
           AND verified_at > CURRENT_TIMESTAMP - make_interval(mins => $2::int)
         ORDER BY verified_at DESC LIMIT 1
         FOR UPDATE)
      RETURNING otp_id`,
    [number, windowMinutes]
  );
  return rows.length === 1;
}

export async function deleteOld() {
  await pool.query(
    "DELETE FROM whatsapp_signup_otps WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day'"
  );
}
