import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { pool, withTransaction } from "../config/db.js";
import * as userModel from "../models/user.model.js";
import * as refreshModel from "../models/refreshToken.model.js";
import { generateAccessToken } from "../utils/token.js";
import * as businessModel from "../models/business.model.js";
import { hashPassword } from "../utils/password.js";
import { ApiError } from "../utils/ApiError.js";
import { canonicalWhatsapp } from "../utils/phone.js";
import * as whatsappSignupService from "./whatsappSignup.service.js";

// Creates the owner and their business together. If either insert fails, neither is kept, so there
// is never an account without a business.
export async function registerOwner({ firstName, lastName, email, whatsappNumber, password, business }) {
  const normalizedEmail = email.trim().toLowerCase();
  const first = firstName.trim();
  const last = lastName.trim();
  const whatsapp = canonicalWhatsapp(whatsappNumber);

  if (await userModel.findUserByEmail(normalizedEmail)) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);

  try {
    return await withTransaction(async (client) => {
      const whatsappVerified = await whatsappSignupService.takeVerification(client, whatsapp);
      const user = await userModel.createUser(
        { firstName: first, lastName: last, email: normalizedEmail, passwordHash, whatsappNumber: whatsapp, whatsappVerified },
        client
      );
      const createdBusiness = await businessModel.createBusiness(client, {
        ownerUserId: user.user_id,
        name: business.name.trim(),
        type: business.type,
        // The owner's own details are the starting contact details; they can be changed in Settings.
        ownerName: `${first} ${last}`.slice(0, 120),
        contactNumber: whatsapp,
        email: normalizedEmail,
        address: business.address.trim(),
      });
      return { user, business: createdBusiness };
    });
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the unique index decides.
    if (error.code === "23505") {
      throw new ApiError(409, "An account with this email already exists.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Sessions: a short-lived access token plus a long-lived, single-use refresh token.
// ---------------------------------------------------------------------------------------------

const REFRESH_ERROR = () =>
  new ApiError(401, "Your session has ended. Please sign in again.", [], "INVALID_REFRESH_TOKEN");

// Only this hash is stored; the token itself exists only in the owner's cookie.
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function newRefreshToken() {
  return randomBytes(32).toString("base64url");
}

function expiryFromNow() {
  return new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);
}

// Called after a correct password. Returns the access token for the response body and the refresh
// token for the cookie.
export async function startSession(user) {
  const refreshToken = newRefreshToken();
  const refreshExpiresAt = expiryFromNow();

  await refreshModel.createRefreshToken(pool, {
    userId: user.user_id,
    familyId: randomUUID(),
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
  });
  refreshModel.deleteLongExpired().catch((error) => console.error("Token cleanup failed:", error));

  return { accessToken: generateAccessToken(user), refreshToken, refreshExpiresAt };
}

// Swaps a refresh token for a new access token and a new refresh token. The old one stops working.
export async function refreshSession(presentedToken) {
  if (!presentedToken) throw REFRESH_ERROR();

  // Failures are returned, not thrown, inside the transaction: a throw would roll back the
  // revocation that has to be kept.
  const outcome = await withTransaction(async (client) => {
    const row = await refreshModel.findByHashForUpdate(client, hashToken(presentedToken));
    if (!row) return { failed: true };

    if (row.revoked_at) {
      const sinceRevoked = (Date.now() - new Date(row.revoked_at).getTime()) / 1000;
      const justRotated = row.replaced_by !== null && sinceRevoked <= env.refreshReuseGraceSeconds;
      if (!justRotated) {
        // A token that was already used came back later: treat it as stolen and end the sign-in.
        await refreshModel.revokeFamily(client, row.family_id);
        return { failed: true };
      }
      // Otherwise it is a second tab that refreshed a moment ago; carry on without revoking.
    }

    if (new Date(row.expires_at) <= new Date()) return { failed: true };

    const user = await userModel.findPublicUserById(row.user_id);
    if (!user || !user.is_active) {
      await refreshModel.revokeFamily(client, row.family_id);
      return { failed: true };
    }

    const refreshToken = newRefreshToken();
    const refreshExpiresAt = expiryFromNow();
    const created = await refreshModel.createRefreshToken(client, {
      userId: user.user_id,
      familyId: row.family_id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
    });
    if (!row.revoked_at) await refreshModel.markRotated(client, row.token_id, created.token_id);

    return { user, refreshToken, refreshExpiresAt };
  });

  if (outcome.failed) throw REFRESH_ERROR();

  return {
    user: outcome.user,
    accessToken: generateAccessToken(outcome.user),
    refreshToken: outcome.refreshToken,
    refreshExpiresAt: outcome.refreshExpiresAt,
  };
}

// Ends this sign-in on the server. Does nothing for a token it does not know.
export async function endSession(presentedToken) {
  if (!presentedToken) return;
  const familyId = await refreshModel.findFamilyByHash(hashToken(presentedToken));
  if (familyId) await refreshModel.revokeFamily(pool, familyId);
}
