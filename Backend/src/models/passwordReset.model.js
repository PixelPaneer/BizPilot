import { pool } from "../config/db.js";

// `db` is the pool, or a client that is inside a transaction.

export async function findLatestForUser(userId, channel, db = pool) {
  const { rows } = await db.query(
    `SELECT otp_id, created_at
       FROM password_reset_otps
      WHERE user_id = $1 AND channel = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, channel]
  );
  return rows[0] || null;
}

// Only the newest OTP for a person is valid: sending a new one ends the older ones.
export async function invalidateOpenForUser(db, userId) {
  await db.query(
    `UPDATE password_reset_otps
        SET consumed_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId]
  );
}

export async function createOtp(db, { userId, channel, destination, otpHash, expiresAt }) {
  const { rows } = await db.query(
    `INSERT INTO password_reset_otps (user_id, channel, destination, otp_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING otp_id`,
    [userId, channel, destination, otpHash, expiresAt]
  );
  return rows[0];
}

export async function deleteOtp(otpId) {
  await pool.query("DELETE FROM password_reset_otps WHERE otp_id = $1", [otpId]);
}

// The OTP the person can still enter: not used, not expired, not yet verified.
export async function findEnterableOtp(userId, channel, destination) {
  const { rows } = await pool.query(
    `SELECT otp_id, otp_hash
       FROM password_reset_otps
      WHERE user_id = $1 AND channel = $2 AND destination = $3
        AND consumed_at IS NULL AND verified_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, channel, destination]
  );
  return rows[0] || null;
}

// Counts the try before the code is compared, so parallel guesses cannot dodge the limit.
export async function recordAttempt(otpId) {
  const { rows } = await pool.query(
    `UPDATE password_reset_otps
        SET attempts = attempts + 1
      WHERE otp_id = $1
      RETURNING attempts`,
    [otpId]
  );
  return rows[0]?.attempts ?? Infinity;
}

// Returns true only for the request that actually flipped it (a code can be accepted once).
export async function markVerified(otpId, resetTokenHash) {
  const { rowCount } = await pool.query(
    `UPDATE password_reset_otps
        SET verified_at = CURRENT_TIMESTAMP, reset_token_hash = $2
      WHERE otp_id = $1 AND verified_at IS NULL AND consumed_at IS NULL`,
    [otpId, resetTokenHash]
  );
  return rowCount === 1;
}

// Locks the row, so a reset token cannot be used twice at the same moment.
export async function findVerifiedByTokenForUpdate(client, resetTokenHash, windowMinutes) {
  const { rows } = await client.query(
    `SELECT otp_id, user_id
       FROM password_reset_otps
      WHERE reset_token_hash = $1
        AND verified_at IS NOT NULL AND consumed_at IS NULL
        AND verified_at > CURRENT_TIMESTAMP - make_interval(mins => $2::int)
      FOR UPDATE`,
    [resetTokenHash, windowMinutes]
  );
  return rows[0] || null;
}

export async function consumeAllForUser(db, userId) {
  await db.query(
    `UPDATE password_reset_otps
        SET consumed_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId]
  );
}

// Housekeeping: rows older than a day are of no use to anyone.
export async function deleteOld() {
  await pool.query(
    "DELETE FROM password_reset_otps WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day'"
  );
}
