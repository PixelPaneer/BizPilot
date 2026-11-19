# BizPilot backend

Express + PostgreSQL (`pg`) API using native ES modules. Layers: routes, controllers, services,
models (SQL). Setup and commands are in the repository's `CLAUDE.md`.

## Setup
```bash
npm install
copy .env.example .env     # then fill in DATABASE_URL (and JWT_SECRET for real sign-in)
npm run migrate
npm run dev
```
Health check: `GET /health`

## Authentication
Sign-in uses a Bearer token (JWT, signed with `JWT_SECRET`, at least 32 characters).

- `POST /api/v1/auth/register` with `firstName`, `lastName`, `email`, `whatsappNumber` (with country
  code), `password` (8 to 72 characters) and `business` (`name`, `type`, `address`). It creates the
  owner and their business in one transaction (so there is never an account without a business;
  the business starts with the owner's name, number and email as contact details) and returns
  `{ user, business }`; no token (the user then signs in). Passwords are stored as bcrypt hashes. Email verification is not built: the schema has
  no verification table, so nothing claims an email is verified.
- `POST /api/v1/auth/login` with `email` and `password` returns `{ user, accessToken }`. A wrong
  email or password gets the same message. Register and login are rate-limited (20 per 15 minutes).
- `GET /api/v1/auth/me` with `Authorization: Bearer <accessToken>` returns the signed-in user.
- `POST /api/v1/auth/refresh` exchanges the refresh cookie for a new access token and a new
  refresh cookie; `POST /api/v1/auth/logout` ends the sign-in and clears the cookie.

The access token is short-lived (`JWT_EXPIRES_IN`, default 15 minutes). Login also sets an
httpOnly refresh cookie (`bizpilot_refresh`, path `/api/v1/auth`, `REFRESH_TOKEN_DAYS`, default 30),
so the owner stays signed in without signing in daily. Only a hash of each refresh token is stored
(`refresh_tokens`, migration 005). A refresh token works once: using it issues the next one. If an
already-used token shows up again later (a copy was stolen) the whole sign-in is revoked; a second
tab refreshing within `REFRESH_REUSE_GRACE_SECONDS` (default 10) is allowed. Refresh and logout
refuse a request whose `Origin` is not in `FRONTEND_ORIGIN`.

Every owner route (`/api/v1/*`, `/api/v1/analytics`) goes through `authenticate`, which verifies the
token and sets `req.user`, then `requireBusinessContext`, which finds the owner's business and sets
`req.businessId`. The business id is never read from a request body or query.

Development shortcut: outside production, if `DEV_USER_ID` is set (see `npm run seed:dev`), requests
need no token and act as that user. Leave it empty to use real sign-in. Production ignores it and
requires `JWT_SECRET`.

## Analytics
`GET /api/v1/analytics/{category-sales,sales-trend,top-products,revenue-analysis}` with
`period=last7|last30|last90|thisMonth|custom` (and `startDate`/`endDate` as `YYYY-MM-DD` for
`custom`). Only completed sales are counted.

## More
Endpoint reference: `docs/API_CONTRACT.md`.
