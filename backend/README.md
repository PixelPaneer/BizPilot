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
