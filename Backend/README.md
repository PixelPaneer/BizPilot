# BizPilot backend

Express + PostgreSQL (`pg`) API using native ES modules. Layers: routes, controllers, services,
models (SQL).

## Setup

```bash
npm install
copy .env.example .env
npm run migrate
npm run dev
```

The API runs at `http://localhost:5000`. Health checks are available at `GET /health` and
`GET /api/v1/health`.

## Authentication

- `POST /api/v1/auth/register` creates an owner and business in one transaction.
- `POST /api/v1/auth/login` accepts email and password or a WhatsApp number and password.
- `POST /api/v1/auth/whatsapp/send-otp` and `/whatsapp/verify-otp` verify a sign-up number.
- `POST /api/v1/auth/forgot-password`, `/forgot-password/verify-otp`, and `/reset-password`
  implement password reset with email or WhatsApp OTP delivery.
- `POST /api/v1/auth/refresh` rotates the refresh token; `POST /api/v1/auth/logout` ends the
  sign-in; `GET /api/v1/auth/me` returns the current owner.

JWT and refresh-token settings are documented in `.env.example`. Never commit `.env`.

OTP delivery uses SMTP or the WhatsApp Cloud API. In development, OTP codes may be printed by the
server when no provider is configured. In production, unconfigured OTP delivery answers 503.

Run migrations after pulling:

```bash
npm run migrate
```

Every owner route uses `authenticate` and `requireBusinessContext`; the tenant id comes only from
`req.businessId`. Stock-changing operations use `applyStockChange`.
