import { pool } from "../config/db.js";

const PUBLIC_USER_COLUMNS = `
  user_id, first_name, last_name, email, whatsapp_number,
  whatsapp_verified_at, is_active, created_at, updated_at
`;

async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT user_id, first_name, last_name, email, password_hash,
            whatsapp_number, whatsapp_verified_at, is_active,
            created_at, updated_at
       FROM app_users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findPublicUserById(userId) {
  const result = await pool.query(
    `SELECT ${PUBLIC_USER_COLUMNS}
       FROM app_users
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// `db` is the pool, or a client that is inside a transaction.
async function createUser(
  { firstName, lastName, email, passwordHash, whatsappNumber, whatsappVerified = false },
  db = pool
) {
  const result = await db.query(
    `INSERT INTO app_users
       (first_name, last_name, email, password_hash, whatsapp_number, whatsapp_verified_at)
     VALUES ($1, $2, LOWER($3), $4, $5, CASE WHEN $6::boolean THEN CURRENT_TIMESTAMP END)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [firstName, lastName, email, passwordHash, whatsappNumber, whatsappVerified]
  );
  return result.rows[0];
}

// A WhatsApp number can in principle be on more than one account, so this returns all of them.
// `variants` are the spellings the number may have been stored in (+91…, 91…, the bare 10 digits).
async function findUsersByWhatsappNumber(variants) {
  const result = await pool.query(
    `SELECT user_id, first_name, email, whatsapp_number, is_active
       FROM app_users
      WHERE whatsapp_number = ANY($1::text[])`,
    [variants]
  );
  return result.rows;
}

// Accounts that sign in with this WhatsApp number, with what is needed to check the password.
async function findLoginCandidatesByWhatsappNumber(variants) {
  const result = await pool.query(
    `SELECT user_id, password_hash, is_active
       FROM app_users
      WHERE whatsapp_number = ANY($1::text[])`,
    [variants]
  );
  return result.rows;
}

async function updatePasswordHash(db, userId, passwordHash) {
  await db.query(
    `UPDATE app_users
        SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1`,
    [userId, passwordHash]
  );
}

export {
  findUserByEmail,
  findPublicUserById,
  createUser,
  findUsersByWhatsappNumber,
  findLoginCandidatesByWhatsappNumber,
  updatePasswordHash
};
