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

async function createUser({ firstName, lastName, email, passwordHash, whatsappNumber }) {
  const result = await pool.query(
    `INSERT INTO app_users
       (first_name, last_name, email, password_hash, whatsapp_number)
     VALUES ($1, $2, LOWER($3), $4, $5)
     RETURNING ${PUBLIC_USER_COLUMNS}`,
    [firstName, lastName, email, passwordHash, whatsappNumber]
  );
  return result.rows[0];
}

export { findUserByEmail, findPublicUserById, createUser };
