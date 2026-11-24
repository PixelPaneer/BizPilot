# BizPilot Authentication Backend

Express + PostgreSQL authentication module using native ES Modules (ESM), following the agreed backend folder layout.

## Important database alignment

The BizPilot database design is PostgreSQL with 11 core tables. This project therefore uses `pg` and parameterized SQL. The `app_users` table must already exist before registering users.

The registration fields map to the schema as follows:

| Frontend field | PostgreSQL column |
|---|---|
| firstName | first_name |
| lastName | last_name |
| email | email |
| password | password_hash (bcrypt hash only) |
| whatsappNumber | whatsapp_number |

`whatsapp_verified_at` remains NULL. The current schema does not include email-verification tokens/OTP storage, so this implementation does not claim email verification.


The server starts at `http://localhost:5000`.

## Endpoints

### POST `/api/auth/register`

```json
{
  "firstName": "Ishan",
  "lastName": "Sharma",
  "email": "ishan@example.com",
  "whatsappNumber": "+919876543210",
  "password": "at-least-8-characters"
}
```

Returns 201 with a public user object. It does not return a token; the UI then asks the user to sign in.

### POST `/api/auth/login`

```json
{
  "email": "ishan@example.com",
  "password": "at-least-8-characters"
}
```

Returns `{ data: { user, accessToken } }`.

Sign-in also accepts `"whatsappNumber"` (with or without +91) instead of `"email"`. A WhatsApp number
is not unique in the schema, so the password decides which account is meant; if it fits none or more
than one, the sign-in fails.

### POST `/api/auth/whatsapp/send-otp` and `/api/auth/whatsapp/verify-otp`

Verify the WhatsApp number on the sign-up page, before the account exists. Bodies: `{ "whatsappNumber" }`
and `{ "whatsappNumber", "otp" }`. The OTP is valid for 10 minutes, five wrong tries lock it, and
asking again within 60 seconds answers 429. Register does not require it (the page does), but if the
number was verified in the last hour the new account gets `whatsapp_verified_at`. Register stores
the number as `+<country code><number>` (a bare 10-digit number is taken as Indian).

### Forgot password (three calls, no token needed)

1. `POST /api/auth/forgot-password` with `{ "channel": "email", "email" }` or
   `{ "channel": "whatsapp", "whatsappNumber" }` sends a 6-digit OTP. The answer (status, body and
   roughly the time taken) is the same whether or not an account exists, and a delivery problem is
   only logged, so it cannot be used to find out who has an account. An OTP is valid for 10 minutes,
   a new one ends the older ones, and asking again within 60 seconds sends nothing. If the channel
   is not set up at all, every address gets 503 in production.
2. `POST /api/auth/forgot-password/verify-otp` with the same fields plus `otp` returns `{ resetToken }`.
   Five wrong tries lock that OTP; a locked, expired or unknown OTP all answer the same 400.
3. `POST /api/auth/reset-password` with `{ "resetToken", "password" }` (8 to 72 letters and numbers, at
   least one of each) sets the new password, within 10 minutes of step 2. The token works once.

Every route above is also served under `/api/v1/auth/...`, which is what the frontend calls.

Setup: run `psql "$DATABASE_URL" -f src/db/otp_tables.sql` once to create the two OTP tables, then set
up delivery. Email uses SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`). WhatsApp uses the WhatsApp Cloud API (`WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
and an approved authentication template named `WHATSAPP_OTP_TEMPLATE`, default `bizpilot_otp`,
language `WHATSAPP_TEMPLATE_LANGUAGE`, default `en`). With a channel not set up, outside production
the OTP is printed in the server log.

Sign-in tokens here are stateless (no refresh tokens in this branch), so a password reset does not
end tokens that were already issued; they expire on their own (`JWT_EXPIRES_IN`).

### GET `/api/auth/me`

Requires `Authorization: Bearer <accessToken>`. Returns the current public user.

### GET `/api/health`

Checks API availability. Server startup also tests the PostgreSQL connection.

## Security notes

- Passwords are hashed with bcryptjs (12 rounds).
- JWT is verified on protected routes.
- SQL queries are parameterized.
- Login errors do not disclose whether an email exists.
- Authentication endpoints are rate-limited.
- Never commit `.env`.
- For production, consider an HttpOnly Secure SameSite cookie session, HTTPS, refresh-token rotation, email verification, password reset, and account lockout policy.

## Folder conventions

The requested `config/`, `controllers/`, `models/`, `routes/`, `middleware/`, `services/`, `utils/`, `validators/`, and `constants/` structure is retained. `models/user.model.js` contains PostgreSQL data-access functions.

## JavaScript module system

This backend uses native Node.js ES Modules throughout (`import` / `export`). The package.json declares `type: module`, and all relative imports include `.js` extensions. Do not use `require()` or `module.exports` in this backend.
