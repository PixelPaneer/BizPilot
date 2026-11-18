# BizPilot Express backend starter

This starter follows the team's agreed folder layout and uses PostgreSQL (`pg`), not MongoDB/Mongoose.

## Important integration notes
- The Analytics routes expect the existing authentication middleware to populate `req.user.businessId` (or `req.user.business_id`).
- Mount your team's authentication middleware **before** `/api/analytics`.
- Do not accept `businessId` from query parameters or request bodies. Scope every report to the authenticated business.
- Copy `.env.example` to `.env` and enter local PostgreSQL credentials. Never commit `.env`.
- The SQL assumes the supplied schema's `sales`, `sale_items` tables and `COMPLETED` status.

## Setup
```bash
npm install
copy .env.example .env
npm run dev
```

## Analytics endpoints
- `GET /api/analytics/category-sales?period=30days`
- `GET /api/analytics/sales-trend?period=30days&groupBy=daily`
- `GET /api/analytics/top-products?period=30days&limit=10`
- `GET /api/analytics/revenue-analysis?period=30days&groupBy=daily`

Supported periods: `7days`, `30days`, `90days`, `custom`.
For `custom`, provide `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
The end date is inclusive from the client's perspective; SQL uses an exclusive next-day boundary.

## Authentication integration
`src/middleware/requireBusinessContext.js` is a guard, not a login system. Replace or compose it with the team's real JWT/session authentication middleware. Until `req.user.businessId` is populated by trusted server-side authentication, analytics endpoints return 401.

## Run
```bash
npm run dev
```
Health check: `GET /health`
