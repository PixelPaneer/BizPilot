# BizPilot Integrated Backend

This folder combines the supplied Authentication backend and Analytics backend in one Express application.

## Included API routes

### Public/authentication
- `GET /health`
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer JWT required)

### Analytics (Bearer JWT required)
- `GET /api/analytics/category-sales?period=last30`
- `GET /api/analytics/sales-trend?period=last30`
- `GET /api/analytics/top-products?period=last30&limit=10`
- `GET /api/analytics/revenue-analysis?period=last30`

Supported analytics periods: `last7`, `last30`, `last90`, `thisMonth`, `custom`.
For `custom`, supply `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.

## Setup (Windows PowerShell)

1. Extract this ZIP.
2. Open a terminal in this `Backend` folder.
3. Install dependencies:
   `npm install`
4. Copy `.env.example` to `.env`.
5. Fill in `DATABASE_URL` for your BizPilot PostgreSQL database.
6. Set `JWT_SECRET` to a private random value of at least 32 characters.
7. Confirm `FRONTEND_ORIGIN=http://localhost:5173` (adjust if your frontend uses another origin).
8. Start:
   `npm run dev`

Do not upload or commit `.env`. The ZIP intentionally excludes real environment secrets and `node_modules`.

## Login and analytics testing

Login:
- Method: POST
- URL: `http://localhost:5000/api/auth/login`
- Body (JSON):
  `{ "email": "registered@email.com", "password": "your-password" }`

Copy `data.accessToken` from the successful response. In Postman, set Authorization to Bearer Token and paste it for analytics requests.

The analytics middleware verifies the JWT, looks up the authenticated user's row, then resolves exactly one business using `businesses.owner_user_id`. It returns 403 if no business exists and 409 if more than one business exists.

## Integration notes

- Authentication is mounted at `/api/auth`.
- Analytics is mounted at `/api/analytics` behind JWT authentication and the business-context middleware.
- The Vite development proxy should forward `/api` to `http://localhost:5000`.
- This ZIP contains the two supplied modules merged together; it does not add the separate `/api/dashboard` endpoint requested by the frontend dashboard fallback code.
- Review your team's DB schema and run the appropriate migrations before using this with real data.
