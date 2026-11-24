import { pool } from "../config/db.js";

// `db` is the pool, or a client that is inside a transaction.

export async function createRefreshToken(db, { userId, familyId, tokenHash, expiresAt }) {
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING token_id`,
    [userId, familyId, tokenHash, expiresAt]
  );
  return rows[0];
}

// Locks the row, so two requests using the same token cannot both rotate it.
export async function findByHashForUpdate(client, tokenHash) {
  const { rows } = await client.query(
    `SELECT token_id, user_id, family_id, expires_at, revoked_at, replaced_by
       FROM refresh_tokens
      WHERE token_hash = $1
      FOR UPDATE`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function markRotated(client, tokenId, replacedBy) {
  await client.query(
    `UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP, replaced_by = $2
      WHERE token_id = $1`,
    [tokenId, replacedBy]
  );
}

// Ends a whole sign-in (every token handed out since it began).
export async function revokeFamily(db, familyId) {
  await db.query(
    `UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
      WHERE family_id = $1 AND revoked_at IS NULL`,
    [familyId]
  );
}

export async function findFamilyByHash(tokenHash) {
  const { rows } = await pool.query(
    "SELECT family_id FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash]
  );
  return rows[0]?.family_id ?? null;
}

// Housekeeping: tokens that expired more than a day ago are of no use to anyone.
export async function deleteLongExpired() {
  await pool.query(
    "DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'"
  );
}
