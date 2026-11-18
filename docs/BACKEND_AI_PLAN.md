# BizPilot Backend Plan (Node API, PostgreSQL, AI Service)

This is the master document for building the backend. It is written to be implemented without any other context. Companion documents:

- `docs/API_CONTRACT.md`: exact endpoint request/response shapes (Node API under `/api/v1`, based on the team's endpoint list; internal calls; WhatsApp webhook).
- `docs/AI_SERVICE_SPEC.md`: the Python AI service (flows, prompts rules, tests).
- `Backend/src/db/001_core_schema.sql`, `002_prototype_additions.sql`, `003_auth_and_void.sql`: the database (already written and tested on PostgreSQL 18).
- `Backend/`: a starter Express app **already exists** (analytics endpoints, error handling, DB pool). Section 3 lists what exists and what to build on. Extend it; do not rewrite it.
- `Frontend/`: the existing React app. It currently uses `localStorage` and sample data; the backend replaces those.

Where this plan and the contract disagree, the contract wins for shapes and this plan wins for behavior.

## 1. Product

BizPilot is an AI assistant for small business owners (kirana and similar shops in India) to keep track of inventory.

- **Owner (web dashboard):** manages products and stock; enters bills by OCR photo, voice or manual entry; gets low-stock alerts; sees sales, stock and profit insights; can ask insight questions in Hindi, English or Hinglish.
- **Customers (WhatsApp only):** send *queries* such as "Parle-G available hai kya?". The bot answers from inventory. **There are no customer accounts, no orders, no billing, no GST, no invoices.** Each shop has its own WhatsApp Business number and customers message it directly.
- **Bills are not stored.** A bill photo or voice note is read for its lines (item, quantity, price), shown to the owner as an editable draft, and only the confirmed lines are saved as stock movements (and sales records for sale bills). The photo or audio is discarded after processing. A bill is either a **sale** (stock decreases) or a **purchase** (stock increases).
- **Bot replies** give availability status (`available` / `limited` / `out`) and price. If a name matches several products or prices, list all of them unless the customer asked for a specific one. Never reveal cost price or exact quantities.

## 2. Hard rules (never violate)

1. **No customer data is persisted or logged:** no phone number, WhatsApp id, name or message text, in the database, logs, error reports or traces. There is no customer table.
2. **Bill images and audio are never stored** (memory only, then discarded). Extract only items, quantities and prices; ignore personal details on bills.
3. **Stock changes happen only through `src/services/stock.service.js`.** Nothing else updates `inventory` or inserts `stock_movements`.
4. **The AI service never writes to the database** and has no database credentials. It reads via Node's `/internal/*` endpoints and only proposes data.
5. **Every query is scoped by `business_id`** taken from the authenticated token (owner cookie or service token), never from request input. Every SQL statement is parameterised.
6. **The customer flow can only see name, price and status** (never cost price or quantity) through `/internal/catalog/search`.
7. **Money and facts come from code and the database, never from the model.** Totals, profit and stock numbers are computed in SQL/Node; the model only phrases them.
8. **Owner confirms before saving a bill.** `POST /bills/extract` writes nothing; `POST /sales` and `POST /purchases` are the only writes of bill data.
9. Secrets only in environment variables; never commit `.env`.

## 3. Backend: what already exists, and technology decisions

### 3.1 Already in `Backend/` (keep and extend)

- `server.js` (DB check, graceful shutdown), `src/app.js` (helmet, cors, JSON, cookie-parser, `GET /health`, 404 handler, global error handler), `src/config/db.js` (shared `pg` pool, `pool` and `checkDatabaseConnection`), `src/config/env.js` (exports `env`; currently requires only `DATABASE_URL`).
- `src/utils/ApiError.js` (`new ApiError(statusCode, message, errors = [])`), `src/utils/asyncHandler.js`, `src/middleware/error.middleware.js`.
- `src/middleware/requireBusinessContext.js`: expects `req.user.user_id` from an auth middleware (**not written yet**) and sets `req.businessId` from `businesses.owner_user_id`. Every owner route uses it.
- Analytics: `src/routes/analytics.routes.js`, `src/controllers/analytics.controller.js`, `src/services/analytics.service.js`, `src/validators/analytics.validator.js`, `src/constants/index.js`. Endpoints and shapes are in `docs/API_CONTRACT.md` section 8.
- `src/db/001_core_schema.sql`, `src/db/002_prototype_additions.sql`.
- `tests/analytics.test.js`: a plain Node script that asserts against a live local database with a specific seeded business (hard-coded id). Keep it, but run it as a separate script (`npm run test:analytics`) so it does not break the default test run.
- Installed dependencies: `express@4`, `cors`, `helmet`, `cookie-parser`, `express-rate-limit`, `express-validator`, `bcryptjs`, `jsonwebtoken`, `pg`, `dotenv`; dev `nodemon`. `.env` is gitignored and holds local credentials: never read, print or commit it.
- Missing (this plan adds them): authentication (signup, login, refresh, logout), business/settings/products/inventory/bills/sales/purchases/expenses/dashboard endpoints, the internal and WhatsApp routes, AI client, scheduler, migration runner and seed script.
- Known issues in existing code (fix opportunistically): analytics buckets use UTC instead of `Asia/Kolkata`; `Backend/README.md` documents obsolete period names; `server.js` has no `unhandledRejection` handler (optional).

### 3.2 Decisions (fixed; do not substitute)

| Area | Choice |
| --- | --- |
| Node API | Node.js 20+, JavaScript with ES modules (`"type": "module"`), Express 4 (as installed) |
| Database access | `pg` with hand-written parameterised SQL (no ORM); the existing pool in `src/config/db.js`; add a `withTransaction(fn)` helper there |
| Migrations | plain `.sql` files in `Backend/src/db/`, applied in filename order by a new `Backend/scripts/migrate.js` (records applied files in a `schema_migrations` table; each file already contains its own `BEGIN`/`COMMIT`) |
| Validation | `express-validator` for new endpoints (a shared `validate` middleware turns failures into `ApiError(400, "Validation failed", errors, "VALIDATION_ERROR")`); the existing hand-written analytics validator stays |
| Auth | `bcryptjs` (cost 12) password hashes; `jsonwebtoken` HS256 access token (15 min, cookie `bp_access`) plus an opaque rotating refresh token (7 days, cookie `bp_refresh`, SHA-256 hash stored in `refresh_tokens`); details in `docs/API_CONTRACT.md` section 2. Email verification is deferred. |
| Security middleware | existing `helmet`, `cors`; set `credentials: true` on cors (origin from `env.frontendOrigin`); `express-rate-limit`; `cookie-parser` |
| Uploads | add `multer` with memory storage; limits: image 10 MB, audio 5 MB |
| Logging | the existing `console` usage; never log request bodies, message text or sender numbers; on the WhatsApp route log only `error.message` and a code |
| Scheduling | add `node-cron` |
| Email | add `nodemailer` (SMTP env vars) |
| Shop logo uploads | add `cloudinary` (only for the shop logo; bills are never stored) |
| Tests | Node's built-in test runner (`node --test tests/`) plus `supertest` (add as dev dependency) against a separate test database (`TEST_DATABASE_URL`) |
| AI service | Python 3.12, FastAPI, Pydantic v2, LangGraph, Gemini (see `docs/AI_SERVICE_SPEC.md`) |
| WhatsApp | Meta WhatsApp Cloud API (Graph API v21.0) |
| Frontend | existing React + Vite app; dev server proxies `/api` to `http://localhost:5000` (already configured in `Frontend/vite.config.js`) |
| Ports | Node `5000`, AI `8000`, PostgreSQL `5432`, frontend `5173` |
| Timezone | `Asia/Kolkata` for all new reporting boundaries; store `timestamptz` |

## 4. Architecture

```
Owner browser (React) ──REST + cookie──► Node API (Express) ◄── webhook / replies ──► WhatsApp Cloud API
  voice / bill photo                      │         │                                      ▲
                                          │         └─► PostgreSQL                         │ customers
                                          │ service JWT (60 s)
                                          ▼
                                   AI service (FastAPI + LangGraph + Gemini)
                                   customer query · bill extraction · insight questions
                                          │
                                          └─► Node /internal/* (service JWT) for catalog and insight data
```

- The browser and WhatsApp reach only Node. The AI service is internal-only.
- Node → AI calls carry a short-lived JWT with `business_id`; AI → Node calls carry one too (see `docs/API_CONTRACT.md` §9 to §10). The model never chooses the business.
- Owner chat questions: `POST /api/v1/analytics/ask` → Node → AI → Node `/internal/insights/snapshot` → AI answers.

## 5. Repository layout

```
BizPilot/
├── Frontend/                 # existing React app
├── Backend/                  # Node API (this plan)
├── AI/                       # FastAPI service (docs/AI_SERVICE_SPEC.md)
├── docs/
└── .github/copilot-instructions.md
```

`Backend/` follows the team's responsibility-based layout: `config` connections and settings; `controllers` handle requests and send responses (thin: no SQL, no rules); `models` SQL per table with snake_case to camelCase mapping; `routes` define endpoints; `middleware` auth, errors, uploads, rate limits; `services` business logic and external integrations; `utils` helpers; `validators` request validation; `constants` shared constants. Files marked (exists) are already in the repo; everything else is to be created. Name new files in the existing style (`<name>.controller.js`, `<name>.routes.js`, `<name>.service.js`, `<name>.validator.js`).

```
Backend/
├── scripts/
│   ├── migrate.js                     # applies src/db/*.sql in order
│   └── seed.js                        # demo data (section 9)
├── src/
│   ├── db/                            # (exists) 001_core_schema.sql, 002_prototype_additions.sql
│   ├── config/                        # (exists) db.js, env.js; add cloudinary.js
│   ├── controllers/                   # (exists) analytics.controller.js; add auth, business, settings, product, inventory, bill
│   │                                  #   (extract), sale, purchase, expense, dashboard, whatsapp, internal
│   ├── models/                        # add: user, refreshToken, business, settings, product, inventory, stockMovement, alert, sale,
│   │                                  #   purchaseBatch, expense, audit
│   ├── routes/                        # (exists) analytics.routes.js; add one file per controller, mounted in app.js:
│   │                                  #   under /api/v1: /auth, /businesses, /settings, /products, /inventory, /bills,
│   │                                  #   /sales, /purchases, /expenses, /dashboard, /analytics (move the existing router here);
│   │                                  #   plus /webhooks/whatsapp and /internal/* (unversioned)
│   ├── middleware/                    # (exists) error.middleware.js, requireBusinessContext.js; add auth.middleware.js,
│   │                                  #   serviceAuth.middleware.js, upload.middleware.js, rateLimit.middleware.js, validate.middleware.js
│   ├── services/                      # (exists) analytics.service.js; add auth.service.js, stock.service.js, alert.service.js, sale.service.js,
│   │                                  #   purchase.service.js,
│   │                                  #   dashboard.service.js, ai.client.js, whatsapp.service.js, email.service.js, scheduler.service.js
│   ├── utils/                         # (exists) ApiError.js (add optional 4th arg `code`), asyncHandler.js; add dates.js (IST helpers), tokens.js (access/refresh token helpers)
│   ├── validators/                    # (exists) analytics.validator.js; add auth, business, settings, product, inventory, sale, purchase, expense
│   ├── constants/                     # (exists) index.js; add movement types, sources, statuses, units, default categories
│   └── app.js                         # (exists) mount new routers; keep the global error handler (it must also emit `code`)
├── tests/                             # (exists) analytics.test.js; add new tests (section 11)
├── server.js                          # (exists)
├── .env.example                       # (exists) extend with the variables in section 8
├── package.json                       # (exists) add scripts: migrate, seed, test, test:analytics
└── README.md                          # (exists) update to match this plan
```

Code conventions: async route handlers wrapped in `asyncHandler`; throw `ApiError`; JSON keys camelCase; database access only inside `models/` or the existing service SQL (services call models; controllers call services); transactions via `withTransaction`; owner routes always run `auth.middleware` then `requireBusinessContext`; use `req.businessId`, never client input, for tenant scoping.
Dependencies to add: `multer node-cron nodemailer cloudinary`; dev: `supertest`.

## 6. Database

`001_core_schema.sql` is the team's 11-table schema with fixes (verified on PostgreSQL 18): `app_users`, `businesses`, `business_settings` (auto-created by trigger), `products`, `inventory`, `stock_movements`, `inventory_alerts`, `sales`, `sale_items`, `expenses`, `audit_logs`. `002_prototype_additions.sql` adds: `pg_trgm` and a trigram index on product names, a unique active product name per business, `businesses.whatsapp_phone_number_id`, and the `purchase_batches` table (idempotency for purchase bills). `003_auth_and_void.sql` adds the `refresh_tokens` table and the `sales.voided_at`, `void_reason`, `voided_by` columns with a consistency check.

Key constraints to rely on (do not duplicate in code unless noted): stock ledger arithmetic (`previous_quantity + quantity_change = new_quantity`), non-negative quantities, one active alert per `(business, product, alert_type)`, `sales` unique `(business_id, idempotency_key)`, sale amount checks, soft-delete via `products.is_active`. Not enforced by the schema (enforce in Node): sale totals equal the sum of item lines.

Enumerations: movement types `PURCHASE, SALE, RETURN, MANUAL_ADJUSTMENT, DAMAGE, CORRECTION`; movement/sale sources `MANUAL, VOICE, OCR` (movements also `SYSTEM`); sale status `COMPLETED, VOIDED`; alert types `LOW_STOCK, OUT_OF_STOCK`; audit outcome `SUCCESS, FAILED, BLOCKED`.

## 7. Core behavior (implement exactly)

### 7.1 `stock.service.js`: `applyStockChange(client, { businessId, productId, delta, movementType, source, userId, referenceId })`
Must be called inside a transaction (`withTransaction`). Steps:
1. `SELECT … FROM inventory WHERE business_id=$1 AND product_id=$2 FOR UPDATE`; also verify the product is active. Missing → `NOT_FOUND`.
2. `previous = available_quantity`; `next = previous + delta`. If `next < 0` throw `INSUFFICIENT_STOCK` (callers that allow overselling clamp before calling, see 7.3).
3. Insert `stock_movements` (`quantity_change = delta`, `previous_quantity`, `new_quantity = next`, `movement_type`, `source`, `user_id`, `reference_id`). `delta` must not be 0.
4. `UPDATE inventory SET available_quantity = next, last_updated = now()`.
5. Call `alert.service.syncAlerts(client, businessId, productId)` (7.2).
6. Insert an `audit_logs` row (`action_type` `STOCK_ADDED` if delta > 0 else `STOCK_REMOVED`; `entity_type` `PRODUCT`; `entity_id` = product id; `description` = `"<product name>  •  +50 units (New stock: 200)"` / `"…  •  -10 units (New stock: 15)"`; `outcome` `SUCCESS`). Bill confirmation adds its own `BILL_CONFIRMED` audit row and the stock rows for bill lines do not add per-line audit rows (pass `skipAudit: true`).
7. Return `{ previous, next, productName }`.

### 7.2 `alert.service.js`: `syncAlerts(client, businessId, productId)`
Read quantity and `reorder_threshold` and the business settings. Desired alert: quantity = 0 → `OUT_OF_STOCK`; `0 < quantity ≤ threshold` → `LOW_STOCK`; else none.
- Resolve (`status='RESOLVED'`, `resolved_at=now()`) any active alert whose type is not the desired one.
- If a desired alert exists and is enabled (`stock_alerts_enabled` and the type's own flag `low_stock_alerts_enabled` / `out_of_stock_alerts_enabled`), insert with `ON CONFLICT (business_id, product_id, alert_type) WHERE status = 'ACTIVE' DO NOTHING`, then update `current_quantity` and `reorder_threshold` on the active row.

### 7.3 Sales, purchases and voiding (`sale.service.js`, `purchase.service.js`)

All three run in one transaction (`withTransaction`). First take `pg_advisory_xact_lock(hashtext(businessId::text))` to serialise bill operations per business. Request and response shapes are in `docs/API_CONTRACT.md` section 6.

**`recordSale(businessId, userId, payload)`** (`POST /sales`)
1. **Idempotency:** look up `sales` by `(business_id, idempotency_key)`; if found, rebuild and return the stored result with HTTP 200 and change nothing.
2. Load all products in the lines (active, this business). Any missing gives `NOT_FOUND` listing the ids.
3. Compare each line's `quantity` with current stock. If any line exceeds stock and `allowOversell` is false, throw `INSUFFICIENT_STOCK` (409) with details and write nothing.
4. Create `sales`: `sale_number` = `SL-YYYYMMDD-NNNN` (IST date; NNNN = 1 + the count of that business's sales that day, zero-padded to 4), `source`, `subtotal` = sum of `round(quantity x unitPrice, 2)`, `discount_amount` 0, `tax_amount` 0, `total_amount` = `subtotal`, `status` `COMPLETED`, `idempotency_key`.
5. For each line insert `sale_items`: snapshots `product_name_snapshot`, `category_snapshot`, `quantity`, `unit_selling_price` = unitPrice, `unit_cost_at_sale` = current `products.cost_price` (null if unknown), `discount_amount` 0, `tax_amount` 0, `revenue` = `round(quantity x unitPrice, 2)`.
6. Stock: for each line `delta = -min(quantity, available)`; if `delta` is not 0 call `applyStockChange` (`SALE`, `referenceId = sale_id`, `skipAudit: true`). For an oversold line the sale item still records the full quantity, stock goes to 0, the shortfall `quantity - available` is returned and a warning is added ("Stock for X was lower than recorded; set to 0, please verify stock."). Never write a negative stock or a zero-delta movement.
7. Verify `total_amount` equals the sum of `sale_items.revenue`.
8. Insert one `audit_logs` row `BILL_CONFIRMED` (description `"SL-20261118-0001  •  5 items  •  ₹560"`) and return the contract response.

**`recordPurchase(businessId, userId, payload)`** (`POST /purchases`)
1. Idempotency via `purchase_batches (business_id, idempotency_key)`; a repeat returns the stored result with HTTP 200.
2. Load and validate products as above (no stock-sufficiency check).
3. Insert `purchase_batches`; for each line call `applyStockChange` (`PURCHASE`, `delta = +quantity`, `referenceId = batch_id`, `skipAudit: true`), then set `products.cost_price = unitPrice` and `updated_at = now()` (latest purchase price; averaging is deferred). Purchases create no `sales` rows.
4. Insert one `audit_logs` row `BILL_CONFIRMED` (description `"Purchase  •  3 items"`) and return the contract response.

**`voidSale(businessId, userId, saleId, reason)`** (`POST /sales/:id/void`)
1. Load the sale (this business); missing gives `NOT_FOUND`; status already `VOIDED` gives `SALE_ALREADY_VOIDED` (409).
2. For each product, restore exactly what the sale deducted: the sum of `-quantity_change` over `stock_movements` where `reference_id = sale_id` and `movement_type = 'SALE'`. Call `applyStockChange` with `RETURN`, `+restored`, `source MANUAL`, `referenceId = sale_id`, `userId`, `skipAudit: true`. Lines that deducted nothing (fully oversold) restore nothing.
3. Update the sale: `status = 'VOIDED'`, `voided_at = now()`, `void_reason`, `voided_by`, `updated_at = now()`.
4. Insert an `audit_logs` row `SALE_VOIDED` (description `"SL-... voided  •  <reason>"`). Alerts are re-synced by `applyStockChange`.
Reports ignore voided sales because they read `COMPLETED` rows only. Voiding purchases is not supported.

### 7.4 Product operations
- Create: insert product + inventory (threshold from input; quantity starts 0), then if `quantity > 0` call `applyStockChange` (`MANUAL_ADJUSTMENT`, `+quantity`, source `MANUAL`) so the ledger shows opening stock. Write an `audit_logs` row `PRODUCT_CREATED` (`description` `"<name>  •  ₹<price>"`). Map unique-name violations to `DUPLICATE_PRODUCT`.
- Update with changed `quantity`: apply the difference as a `MANUAL_ADJUSTMENT` via `applyStockChange` (negative deltas below 0 are rejected). Threshold or price changes call `syncAlerts`.
- Deactivate: set `is_active=false` and resolve active alerts.

### 7.5 Insights and profit
Defined by SQL over `sales`/`sale_items` (COMPLETED only), as specified in `docs/API_CONTRACT.md` sections 7 and 8. The four existing analytics endpoints stay as they are (fix their known gaps: IST boundaries, hourly view, minimum bucket counts); add slow movers, profit and ask. Profit uses the formula in the contract. Lines with unknown cost are excluded from profit and counted; never estimate a cost. Use `date_trunc` / `AT TIME ZONE 'Asia/Kolkata'` in SQL and fill empty buckets with 0 in `insights.service.js`.

### 7.6 WhatsApp handling
`whatsapp.controller.js` verifies and acknowledges; `whatsapp.service.js` does the work asynchronously: resolve business by `whatsapp_phone_number_id` → rate limit and dedupe (in memory) → `ai.client.customerQuery({ message, shopName })` → send the reply via Graph API. Details and privacy rules in `docs/API_CONTRACT.md` §11. If the AI call fails, reply with a fixed apology ("Sorry, I could not check right now. Please try again in a moment." plus Hindi), never an error detail.

### 7.7 Scheduled jobs (`scheduler.service.js`, `node-cron`, timezone `Asia/Kolkata`)
- Nightly 02:00: for each business, run `syncAlerts` for all active products (repairs any drift).
- Reports (stretch goal, after phase 4): per `report_frequency`, if `email_notifications_enabled`, email a plain-text summary built from `insights.service` snapshot data (no AI call needed).

## 8. Configuration

`Backend/.env.example` (create it with these keys; real values only in `.env`):
```
NODE_ENV=development
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@localhost:5432/BIZPILOT_DB
PGSSL=false
TEST_DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@localhost:5432/BIZPILOT_TEST_DB
JWT_EXPIRES_IN=7d
JWT_SECRET=change-me-long-random
SERVICE_JWT_SECRET=change-me-different-long-random
AI_SERVICE_URL=http://localhost:8000
WHATSAPP_VERIFY_TOKEN=change-me
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SEED_EMAIL=owner@bizpilot.test
SEED_PASSWORD=ChangeMe123!
```
Extend `src/config/env.js` (plain checks, no extra library): it already fails fast on a missing `DATABASE_URL`; require `JWT_SECRET` and `SERVICE_JWT_SECRET` once auth exists, and require the WhatsApp variables only when the WhatsApp routes are enabled. The existing `.env.example` also uses `PGSSL`; keep it, and keep `JWT_EXPIRES_IN` (default `7d`). `AI/.env.example` is listed in `docs/AI_SERVICE_SPEC.md`. `SERVICE_JWT_SECRET` must be identical in both services.

## 9. Seed data (`scripts/seed.js`)

Idempotent (safe to rerun). Creates one owner from `SEED_EMAIL`/`SEED_PASSWORD`, a business "Demo Kirana Store", and products based on `Frontend/src/data/products.js` (base names such as Parle-G, Amul Milk 1L, Aashirvaad Atta, Maggi Noodles, Tata Salt, with the "Pack of 2 / Family Pack / Value Pack" variants; about 128 products), assigning each a sensible category (Snacks, Dairy, Staples, Beverages, Personal Care, Household), unit, price, cost price (about 70 to 85 percent of price), opening quantity and `reorderThreshold` 20, with some products low and a few out of stock. Then generates about 60 days of sales by calling `bill.service.confirmBill` (random sale bills of 1 to 5 lines per day, a few purchase bills) so analytics have data, and a few expenses. Seed through the services, not raw inserts, so ledger, alerts and audit rows stay consistent.

## 10. Frontend integration (separate task after phase 1)

Replace the `localStorage` state with API calls; keep component props unchanged where possible. Add `src/utils/api.js` helpers using `fetch` with `credentials: 'include'` and unwrapping `response.data`.
- `AuthContext`: call `/auth/login`, `/auth/signup`, `/auth/logout`, `/auth/me`; `SignIn.jsx` and `SignUp.jsx` currently only simulate. A user with `business: null` must be sent to a business onboarding step (`POST /businesses`, reusing the Business Profile form). The API helper retries a request once after `POST /auth/refresh` when it receives 401 `TOKEN_EXPIRED`.
- `InventoryContext`: products from `GET /products`; add/update via `POST`/`PATCH /products`; delete via `DELETE /products/:id`; stock adjustments via `PATCH /inventory/:id`; alerts from `GET /inventory/alerts`; counts from `GET /inventory/summary`.
- Dashboard: `GET /dashboard/summary` and `GET /dashboard/activity`. `Frontend/src/pages/Dashboard.jsx` and `utils/api.js` currently expect one object `{ revenue: { amount, changePercent }, inventory: { total, inStock, low, out }, activities }` from `/api/dashboard`; adapt them to the two endpoints (`totalRevenue`, `revenueChangePercent`, `inStockProducts`, `lowStockProducts`, `outOfStockProducts`) and map the week/month/year toggle to `this_week|this_month|this_year`. Analytics (`components/sales/*`): the `/api/v1/analytics/*` endpoints instead of `data/salesData.js`.
- Settings pages: `/businesses/me` and `/settings`. New pages needed: Bill Entry (upload photo / record voice / manual; editable draft table; confirm via `POST /sales` or `POST /purchases`; handle `INSUFFICIENT_STOCK` by showing the warning and resubmitting with `allowOversell: true`), Sales history with void, and Expenses.

## 11. Testing (`node --test` + Supertest; each test starts from a clean test database)

Required tests:
- Stock service: add/remove, negative rejected, ledger rows correct, alerts created/resolved at the threshold and zero, one active alert per type, alert flags in settings respected.
- Sales and purchases: SALE creates sale + items + movements and correct totals; PURCHASE raises stock and sets cost price; oversell returns 409 without `allowOversell` and records warnings with it; the same idempotency key returns the first result and changes nothing (both sale and purchase); duplicate `productId` rejected.
- Void: restores exactly the deducted stock as `RETURN` movements (including an oversold sale), marks the sale `VOIDED`, a second void returns 409, voided sales disappear from analytics and dashboard revenue, a missing reason is rejected.
- Tenant isolation: a second business cannot read, update or adjust the first one's products, alerts, movements or insights (404, never 403 leaks).
- Auth: signup/login/logout/me, duplicate email, bad password, cookie flags; expired access token returns `TOKEN_EXPIRED`; refresh rotates the token; reusing a rotated refresh token revokes all of that user's refresh tokens; a user without a business gets `NO_BUSINESS` on owner routes.
- Insights: range resolution, bucket counts (weekly ≥ 4, monthly ≥ 6, hourly for one day), previous-period shift, profit excludes unknown cost lines.
- `/internal/catalog/search`: fuzzy match ("parle g" finds "Parle-G"), never returns `costPrice` or `quantity`, rejects owner cookies, requires a valid service token.
- WhatsApp: valid and invalid signature, verification handshake, dedupe, unknown phone number id ignored, privacy canary (a unique message string and sender number must not appear in any table or captured log output).

## 12. Build order (each phase ends with a runnable check)

**Phase 0: foundation.** In `Backend/`: add `scripts/migrate.js`, `withTransaction`, the optional `code` on `ApiError` and in both error handlers, the validate middleware, the `test` and `test:analytics` scripts. Create `AI/` (FastAPI with `/health` and token verification). Done when: `npm run migrate` applies 001 and 002 to an empty database and is safe to rerun; `curl localhost:5000/health` still works; `curl localhost:8000/health` returns `{"status":"ok"}`; `npm test` runs.

**Phase 1: owner core.** Auth (signup, login, refresh, logout, me, plus `auth.middleware`, which unblocks the existing analytics routes), business, settings, products (CRUD, search), inventory (list, summary, alerts, update stock, history), dashboard summary and activity (revenue 0 until sales exist), seed script (products only at first). Done when: signup then `POST /products` then `POST /products/:id/adjust` via curl shows the expected `status`, a LOW_STOCK alert appears at the threshold, and `GET /stock-movements` lists the ledger; stock/alert/auth/isolation tests pass.

**Phase 2: customer queries on WhatsApp.** `/internal/catalog/search`, service JWT middleware, AI customer flow, WhatsApp webhook and replies (use a tunnel such as ngrok and the Meta sandbox number). Done when: posting a signed sample webhook payload to `/webhooks/whatsapp` produces the correct reply text in the Graph API call (mocked in tests); with real credentials, "Parle-G available hai kya?" gets a correct Hinglish reply from live data; the privacy canary test passes.

**Phase 3: bill entry.** `POST /sales`, `POST /purchases`, sales list/detail/void (manual entry) first, then `POST /bills/extract` for photo, then voice. Done when: recording a sale and a purchase via curl changes stock correctly and is idempotent, and voiding the sale restores the stock; extracting a sample bill photo returns a draft with matched lines and warnings for unmatched ones.

**Phase 4: sales, expenses and insights.** Slow movers, profit and ask endpoints next to the existing analytics (router moved to `/api/v1/analytics`); fix the analytics known gaps (IST, hourly view, minimum buckets); expenses; dashboard revenue; seed with 60 days of sales; optional report emails. Done when: the Analytics page shows seeded data from the API, `/api/analytics/profit` equals a hand-computed value for a small fixture, and `/api/analytics/ask` answers "is hafte kya sabse zyada bika?" from the snapshot.

**Phase 5: evaluation and polish.** A fixture set of about 50 Hinglish/Hindi/English customer queries (with misspellings) and 30 real shop bill photos/voice notes for measuring matching accuracy; fix prompts and thresholds; demo data and README run instructions.

## 13. Deferred (not in the prototype)

Product groups/variants and an alias table (fuzzy search covers the prototype); voiding purchases; sale PDF receipts (`GET /sales/:id/pdf` in the team's list); email verification (`/auth/verify-email`); average-cost purchasing; staff accounts and roles; password reset and owner WhatsApp OTP verification; WhatsApp alert templates sent to the owner; row-level security; stale-stock reminders; shop FAQs and timings; unit conversion; evaluation tables in the database; stronger duplicate-bill detection; privacy/legal review (India DPDP Act).

## 14. External prerequisites (not code)

A Gemini API key; a Meta WhatsApp Business app, test phone number, verify token and app secret (business verification takes time, start early); sample shop bills and customer queries for testing; a public HTTPS URL for the webhook during development (tunnel tool).
