# BizPilot API Contract

Exact request/response shapes for the Node API (`Backend/`) and the calls between Node and the AI service (`AI/`). The React frontend in `Frontend/` already expects these shapes; field names below match what its components use. Read `docs/BACKEND_AI_PLAN.md` first for architecture, decisions and rules. The Inventory-page slice has its own build brief: `docs/INVENTORY_BACKEND.md`.

## 1. Conventions

The endpoint list is the team's (`API endpoints.docx`), versioned under `/api/v1`, extended with what the agreed scope needs (bill entry, purchases, WhatsApp, AI). Behavior of existing code in `Backend/` (`src/app.js`, `src/utils/ApiError.js`, `src/middleware/requireBusinessContext.js`, `src/services/analytics.service.js`) is kept unless this document says otherwise.

- Base path `/api/v1`. `GET /health` (no auth, already exists) returns `{ "success": true, "message": "BizPilot API is running" }`. The WhatsApp webhook is `/webhooks/whatsapp` and internal service routes are under `/internal`; neither is versioned. Move the existing analytics router from `/api/analytics` to `/api/v1/analytics` in `src/app.js`.
- JSON bodies and responses use **camelCase**; database columns are `snake_case`; map in `src/models/*` or the service.
- **Success:** `{ "success": true, "data": <payload>, "message": "optional" }`, HTTP 200 (201 on create).
- **Error** (the existing envelope): `{ "success": false, "message": "human readable", "errors": [], "code": "OPTIONAL_MACHINE_CODE" }`. `errors` is an array (validation details: `[{ "field": "price", "message": "..." }]`). `code` is a new optional field: extend `ApiError` to `new ApiError(statusCode, message, errors = [], code)` and include `code` in both error handlers when set. 500 responses always say "Internal server error"; never leak stack traces or SQL.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | request validation failed |
| 401 | `UNAUTHENTICATED` | no or invalid access token, invalid refresh token |
| 401 | `TOKEN_EXPIRED` | access token expired (client should call `/auth/refresh`, then retry once) |
| 401 | `INVALID_CREDENTIALS` | wrong email or password (same message for both) |
| 403 | `FORBIDDEN` / `NO_BUSINESS` | not allowed; user has no business yet (from `requireBusinessContext`) |
| 404 | `NOT_FOUND` | unknown id, or id belongs to another business (never reveal which) |
| 409 | `CONFLICT` / `EMAIL_TAKEN` / `DUPLICATE_PRODUCT` / `INSUFFICIENT_STOCK` / `SALE_ALREADY_VOIDED` | uniqueness or rule violations |
| 413 | `PAYLOAD_TOO_LARGE` | upload over limit |
| 429 | `RATE_LIMITED` | rate limit hit |
| 500 | `INTERNAL_ERROR` | unexpected |
| 502 | `AI_UNAVAILABLE` | the AI service failed or timed out |

- **Tenant context:** owner routes run `auth.middleware` (verifies the access token, sets `req.user = { user_id }`) and then the existing `requireBusinessContext` (sets `req.businessId`; 403 `NO_BUSINESS` if the user has none). Exceptions: `/auth/*` and `POST /businesses` need only authentication (no business yet), and `GET /auth/me` works without a business. Never take a business id from a body or query string; use `req.businessId`.
- Numbers: `NUMERIC` columns come back from `pg` as strings; convert to JS numbers (money rounded to 2 decimals) in the mappers.
- Dates: ISO-8601 UTC strings in responses. New reporting code buckets days and months in `Asia/Kolkata` (the existing analytics SQL uses UTC; see section 8, "Known gaps").
- The frontend (`Frontend/src/utils/api.js`) must read `response.data`, send `credentials: 'include'`, and on a 401 with `code: "TOKEN_EXPIRED"` call `POST /auth/refresh` once and retry the original request.

## 2. Authentication (access token + refresh token)

- **Access token:** JWT HS256 signed with `JWT_SECRET`, claims `{ sub: user_id }`, lifetime 15 minutes, in the httpOnly cookie `bp_access` (`SameSite=Lax`, `Secure` when `NODE_ENV=production`, path `/`).
- **Refresh token:** 48 random bytes, base64url, lifetime 7 days, in the httpOnly cookie `bp_refresh` (same flags, path `/api/v1/auth`). Only its SHA-256 hash is stored, in `refresh_tokens` (migration 003).
- **Rotation:** every `/auth/refresh` revokes the presented token (`revoked_at`, `replaced_by`) and issues a new pair. If a revoked token is presented again, revoke all of that user's active refresh tokens and return 401 `UNAUTHENTICATED` (token theft signal).
- Email verification (`/auth/verify-email`) is **deferred**.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/signup` | register and sign in |
| POST | `/auth/login` | authenticate |
| POST | `/auth/refresh` | rotate tokens |
| POST | `/auth/logout` | revoke the refresh token, clear cookies (added to the team list) |
| GET | `/auth/me` | current user and business |

### `POST /auth/signup`
Body (rules mirror `Frontend/src/SignUp.jsx`):
```json
{ "firstName": "Ishan", "lastName": "Sharma", "email": "ishan@example.com", "whatsapp": "9876543210", "password": "min8chars" }
```
`whatsapp` must match `/^[6-9]\d{9}$/` and is stored as `+91` + number. Email is lower-cased; duplicate gives 409 `EMAIL_TAKEN`. Inserts `app_users` (bcryptjs hash, cost 12), sets both cookies, responds 201:
```json
{ "user": { "id": "uuid", "firstName": "Ishan", "lastName": "Sharma", "email": "ishan@example.com", "whatsapp": "+919876543210" }, "business": null }
```
No business is created here; the frontend sends the user to business onboarding (`POST /businesses`) when `business` is null.

### `POST /auth/login` body `{ "email", "password" }`
200 with `{ user, business }` (`business` null if not created yet) and both cookies. Wrong email or password gives 401 `INVALID_CREDENTIALS`. Rate limit 10 per 15 minutes per IP.

### `POST /auth/refresh`
No body; reads the `bp_refresh` cookie. 200 `{ user }` and a fresh cookie pair. Missing, unknown, expired or revoked token gives 401 `UNAUTHENTICATED` and clears both cookies. Rate limit 30 per 15 minutes per IP.

### `POST /auth/logout`
Revokes the presented refresh token (if any) and clears both cookies. Always 200, `data: null`.

### `GET /auth/me`
200 `{ user, business }` (shapes above and in section 3). 401 without a valid access token.

## 3. Business profile and settings

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/businesses` | create the business profile (once per owner) |
| GET | `/businesses/me` | current business |
| PATCH | `/businesses/me` | update business details |
| POST | `/businesses/me/logo` | upload the shop logo (multipart `logo`, image ≤ 2 MB, stored via Cloudinary) returns `{ "businessLogoUrl" }` |
| GET | `/settings` | retrieve settings |
| PATCH | `/settings` | update settings (any subset) |

### Business resource
```json
{ "id": "uuid", "businessName": "", "businessType": "", "ownerName": "", "contactNumber": "", "businessEmail": "",
  "businessAddress": "", "businessDescription": null, "businessLogoUrl": null, "gstin": null,
  "whatsappPhoneNumberId": null }
```
`POST /businesses` requires `businessName, businessType, ownerName, contactNumber, businessEmail, businessAddress`; the rest is optional. A user who already has a business gets 409 `CONFLICT`. The DB trigger creates default settings. `PATCH` accepts any subset (not `id`). `gstin` must match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` or be null. `whatsappPhoneNumberId` is the Meta phone-number ID of the shop's WhatsApp line; unique, so a duplicate gives 409 `CONFLICT`.

### Settings resource
```json
{ "stockAlertsEnabled": true, "lowStockAlertsEnabled": true, "outOfStockAlertsEnabled": true,
  "dashboardLanguage": "English", "appearanceTheme": "light", "dateFormat": "DD/MM/YYYY",
  "inAppNotificationsEnabled": true, "emailNotificationsEnabled": true,
  "notificationLowStockEnabled": true, "notificationOutOfStockEnabled": true, "reportFrequency": "Weekly" }
```
Enums: `dashboardLanguage` is `English|Hindi|Hinglish`; `appearanceTheme` is `light|dark`; `reportFrequency` is `Daily|Weekly|Monthly`.

## 4. Products

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/products` | list products |
| POST | `/products` | add product |
| GET | `/products/search` | search products (declare this route before `/products/:id`) |
| GET | `/products/:id` | product details |
| PATCH | `/products/:id` | edit product |
| DELETE | `/products/:id` | deactivate product (added to the team list; soft delete) |
| GET | `/products/categories` | distinct categories merged with the defaults (added; declare before `/products/:id`) |

### Product resource (matches `Frontend/src/components/ProductFormModal.jsx`)
```json
{ "id": "uuid", "name": "Parle-G", "category": "Snacks", "unit": "packet", "price": 10,
  "costPrice": 8, "quantity": 45, "lowStockThreshold": 20, "status": "in-stock",
  "isActive": true, "lastUpdated": "2026-11-18T10:00:00.000Z",
  "lastAdjustment": { "type": "add", "amount": 5, "date": "2026-11-18T10:00:00.000Z" } }
```
`lastAdjustment` is the newest manual stock adjustment (`stock_movements` with `source = 'MANUAL'` and type `MANUAL_ADJUSTMENT`, `CORRECTION` or `DAMAGE`; `type` is `add` or `remove`), or `null`. Mapping: `name` = `products.product_name`; `price` = `selling_price`; `costPrice` = `cost_price` (nullable); `quantity` = `inventory.available_quantity`; `lowStockThreshold` = `inventory.reorder_threshold`; `lastUpdated` = `inventory.last_updated`. `status` rule (same as `getStockStatus` in `Frontend/src/utils/inventoryUtils.js`): `quantity === 0` is `out-of-stock`; `quantity <= lowStockThreshold` is `low-stock`; otherwise `in-stock`. The API uses only this shape (ignore the legacy `stock`/`reorderLevel` shape in the frontend sample data). `unit` is one of `piece, kg, g, L, ml, dozen, packet`.

- `GET /products?search=&category=&status=&sort=newest|name|price_asc|price_desc|quantity&page=1&limit=100`: active products; `status` is `in-stock|low-stock|out-of-stock`; `limit` max 500; returns `{ "items": [Product], "total": 128, "page": 1, "limit": 100 }`.
- `GET /products/search?q=parle&limit=10`: fuzzy name search (same trigram matching as the internal catalog search, but returns full Product resources); returns `{ "items": [Product] }`.
- `GET /products/categories` returns `["Dairy", "Snacks", ...]` (this business's distinct categories merged with `Fruits, Dairy, Bakery, Vegetables, Meat, Beverages`).
- `POST /products` body `{ name, category, unit, price, costPrice?, quantity, lowStockThreshold }`. Validation: name 1 to 150 chars; price ≥ 0; quantity ≥ 0; threshold ≥ 0. Creates `products` + `inventory`; if `quantity > 0` also writes one `MANUAL_ADJUSTMENT` movement (previous 0, source `SYSTEM`, so it is not shown as a last adjustment) through `stock.service`. Duplicate active name (case-insensitive) gives 409 `DUPLICATE_PRODUCT`. 201 with the Product.
- `PATCH /products/:id` any subset of `{ name, category, unit, price, costPrice, quantity, lowStockThreshold }`. If `quantity` is present and differs, `stock.service` applies a `MANUAL_ADJUSTMENT` for the difference. Recompute alerts after a threshold or quantity change.
- `DELETE /products/:id` sets `is_active = false` (products with history cannot be hard-deleted) and resolves that product's active alerts. `data: null`.

## 5. Inventory

`:id` in these routes is the **product id** (inventory rows are keyed by business + product).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/inventory` | stock list |
| GET | `/inventory/summary` | stock counts |
| GET | `/inventory/alerts` | low and out-of-stock alerts (declare before `/inventory/:id`) |
| PATCH | `/inventory/:id` | update stock |
| GET | `/inventory/:id/history` | stock movements for a product |

- `GET /inventory?status=&category=&search=&sort=newest|name|price_asc|price_desc|quantity&page=1&limit=100`: same Product resource as section 4, intended for stock screens. Returns `{ "items": [Product], "total", "page", "limit" }`.
- `GET /inventory/summary` returns `{ "total": 128, "inStock": 117, "lowStock": 8, "outOfStock": 3 }` over active products (the counts the frontend `getStockCounts` uses).
- `GET /inventory/alerts?status=ACTIVE` returns
```json
{ "items": [ { "id": "uuid", "productId": "uuid", "productName": "", "type": "LOW_STOCK",
  "currentQuantity": 5, "reorderThreshold": 20, "status": "ACTIVE", "createdAt": "..." } ] }
```
- `PATCH /inventory/:id` updates stock manually through `stock.service` (source `MANUAL`, with `user_id`). The body is **exactly one** of:
  - `{ "type": "add" | "remove", "amount": 5, "reason"?: "MANUAL_ADJUSTMENT" | "DAMAGE" | "CORRECTION" }` (matches `StockAdjustmentModal.jsx`; `amount` > 0; reason defaults to `MANUAL_ADJUSTMENT`; `DAMAGE` only with `remove`).
  - `{ "quantity": 40, "reason"?: "CORRECTION" }` sets an exact count; the delta is applied as a `CORRECTION` movement (delta 0 changes nothing and returns 200).
  Removing more than the current quantity gives 409 `INSUFFICIENT_STOCK` (manual updates never oversell). Returns the updated Product.
- `GET /inventory/:id/history?from=&to=&limit=50` returns
```json
{ "items": [ { "id": "uuid", "productId": "uuid", "productName": "Parle-G", "type": "SALE",
  "quantityChange": -5, "previousQuantity": 50, "newQuantity": 45, "source": "OCR", "createdAt": "..." } ] }
```
  newest first.

## 6. Bill entry, sales and purchases

Bills are not stored. A bill photo or voice note is extracted into a draft; the owner edits it; only the confirmed lines are saved as a sale (stock down) or a purchase (stock up). Manual entry skips extraction and posts the lines directly.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/bills/extract` | read a bill photo or voice note into an editable draft (writes nothing) |
| POST | `/sales` | record a sale |
| GET | `/sales` | list sales |
| GET | `/sales/:id` | sale details |
| POST | `/sales/:id/void` | void a sale and restore its stock |
| POST | `/purchases` | record a purchase (stock received) |

`GET /sales/:id/pdf` from the team list is **deferred**.

### `POST /bills/extract` (multipart/form-data)
Fields: exactly one of `image` (jpeg/png/webp, ≤ 10 MB) or `audio` (webm/ogg/mp3/m4a/wav, ≤ 5 MB); optional `type` hint `SALE|PURCHASE`. Node forwards the file to the AI service (`POST {AI_SERVICE_URL}/internal/bills/extract`) and returns its draft:
```json
{ "type": "PURCHASE",
  "lines": [ { "rawText": "PARLE-G BISC 50G x 24", "quantity": 24, "unit": "packet", "price": 8,
      "matchedProductId": "uuid-or-null", "matchedProductName": "Parle-G", "confidence": 0.86,
      "candidates": [ { "productId": "uuid", "name": "Parle-G", "price": 10 } ] } ],
  "warnings": [ "Line 3 could not be matched to a product." ] }
```
`type` is the detected type or `null` if unclear. `confidence` is 0 to 1. `matchedProductId` is null when there is no catalog match; `quantity`/`price` may be null when unreadable (the owner fills them in). AI failure gives 502 `AI_UNAVAILABLE`.

### `POST /sales`
```json
{ "idempotencyKey": "client-generated-uuid", "source": "OCR", "allowOversell": false,
  "lines": [ { "productId": "uuid", "quantity": 5, "unitPrice": 10 } ] }
```
Rules: `source` is `MANUAL|VOICE|OCR`; 1 to 100 lines; `quantity` > 0; `unitPrice` ≥ 0; no repeated `productId` (400). Behavior is in `docs/BACKEND_AI_PLAN.md` sections 7.1 to 7.3. Response 201 (200 with the same body when the idempotency key was already used):
```json
{ "saleId": "uuid", "saleNumber": "SL-20261118-0001", "status": "COMPLETED", "totalAmount": 50,
  "lines": [ { "productId": "uuid", "productName": "Parle-G", "quantity": 5, "unitPrice": 10,
               "newQuantity": 40, "shortfall": 0 } ],
  "warnings": [] }
```
A sale exceeding recorded stock with `allowOversell: false` gives 409 `INSUFFICIENT_STOCK` with `errors: [ { "productId", "productName", "requested", "available" } ]` and nothing is written. With `allowOversell: true` the sale is recorded, the affected stock goes to 0, each such line reports `shortfall` > 0, and a warning is added.

### `GET /sales?from=YYYY-MM-DD&to=YYYY-MM-DD&status=COMPLETED|VOIDED&page=1&limit=50`
`{ "items": [ { "id", "saleNumber", "saleDate", "source", "itemCount", "totalAmount", "status" } ], "total", "page", "limit" }`, newest first.

### `GET /sales/:id`
```json
{ "id": "uuid", "saleNumber": "SL-20261118-0001", "saleDate": "...", "source": "OCR", "status": "COMPLETED",
  "subtotal": 50, "totalAmount": 50, "voidedAt": null, "voidReason": null,
  "items": [ { "productId": "uuid", "productName": "Parle-G", "category": "Snacks", "quantity": 5,
               "unitSellingPrice": 10, "unitCostAtSale": 8, "revenue": 50 } ] }
```

### `POST /sales/:id/void`
Body `{ "reason": "Entered 50 instead of 5" }` (3 to 200 characters, required). Safeguards: owner of the business only; only `COMPLETED` sales (an already voided sale gives 409 `SALE_ALREADY_VOIDED`); runs in one transaction under the per-business advisory lock; the reason is mandatory and audited. Effects: stock is restored by exactly what the sale deducted (sum of the sale's `SALE` movements per product, found by `reference_id = sale_id`; oversold lines restore only what was actually deducted) through `stock.service` as `RETURN` movements (source `MANUAL`, `reference_id = sale_id`, `user_id`); the sale becomes `status = 'VOIDED'` with `voided_at`, `void_reason`, `voided_by` (migration 003); alerts are re-synced; an `audit_logs` row `SALE_VOIDED` is written (description `"SL-... voided  •  <reason>"`). Voided sales are excluded from every report (reports read `COMPLETED` only). Returns the updated sale (shape of `GET /sales/:id`).

### `POST /purchases`
```json
{ "idempotencyKey": "client-generated-uuid", "source": "OCR",
  "lines": [ { "productId": "uuid", "quantity": 24, "unitPrice": 8 } ] }
```
Same line rules as `/sales`. Creates a `purchase_batches` row, a `PURCHASE` movement per line (`reference_id = batch_id`) and sets each product's `cost_price` to the line's `unitPrice` (latest purchase price). Response 201 (200 on an idempotent repeat):
```json
{ "purchaseId": "uuid", "totalAmount": 192,
  "lines": [ { "productId": "uuid", "productName": "Parle-G", "quantity": 24, "unitPrice": 8, "newQuantity": 69 } ],
  "warnings": [] }
```
Voiding purchases is not supported in the prototype (correct mistakes with `PATCH /inventory/:id`).

## 7. Dashboard and expenses

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard/summary` | dashboard cards |
| GET | `/dashboard/activity` | recent activity |
| GET | `/expenses` | list expenses |
| POST | `/expenses` | add expense |
| PATCH | `/expenses/:id` | edit expense |
| DELETE | `/expenses/:id` | delete expense (added to the team list) |

### `GET /dashboard/summary?period=this_week|this_month|this_year` (default `this_month`)
```json
{ "totalProducts": 1247, "lowStockProducts": 34, "outOfStockProducts": 12,
  "inStockProducts": 1201, "totalRevenue": 124350, "previousRevenue": 111027,
  "revenueChangePercent": 12, "period": "this_month" }
```
- Revenue is the sum of `sales.total_amount` with `status = 'COMPLETED'` (voided sales excluded) from the start of the calendar period (week starts Monday; month the 1st; year 1 January; all in `Asia/Kolkata`) up to now. `previousRevenue` covers the immediately preceding window of equal length. `revenueChangePercent` is `round((totalRevenue - previousRevenue) / previousRevenue * 100)`, or 0 when `previousRevenue` is 0.
- Stock counts reflect current inventory of active products, regardless of the period.
- The frontend maps its week/month/year toggle to `this_week`/`this_month`/`this_year`.

### `GET /dashboard/activity?limit=5`
```json
{ "items": [ { "id": "uuid", "type": "stock_added", "title": "Stock updated",
               "detail": "Parle-G  •  +50 units (New stock: 200)", "createdAt": "..." } ] }
```
The most recent `audit_logs` rows (max 20) with `action_type` in: `PRODUCT_CREATED` (type `product_added`, title "Product added", detail `"<product>  •  ₹65"`), `STOCK_ADDED` (`stock_added`, "Stock updated"), `STOCK_REMOVED` (`stock_removed`, "Stock updated"), `BILL_CONFIRMED` (`bill_generated`, "Bill recorded", detail `"SL-20261118-0001  •  5 items  •  ₹560"` or `"Purchase  •  3 items"`), `SALE_VOIDED` (`sale_voided`, "Sale voided"). `detail` is `audit_logs.description`, written by the services in these formats.

### Expenses
Expense: `{ "id", "expenseDate", "category", "description", "amount", "paymentMethod", "createdAt" }`; `amount` > 0.
- `GET /expenses?from=YYYY-MM-DD&to=YYYY-MM-DD` returns `{ "items": [Expense], "total": 1234.5 }`.
- `POST /expenses` body `{ "expenseDate": "2026-11-18", "category": "Rent", "description"?: "", "amount": 5000, "paymentMethod"?: "Cash" }` returns 201 Expense.
- `PATCH /expenses/:id` any subset of those fields. `DELETE /expenses/:id` returns `data: null`.

## 8. Analytics and insights (powers `Frontend/src/components/sales/*`)

Mounted at `/api/v1/analytics` (the router exists in `Backend/src/routes/analytics.routes.js` and is currently mounted at `/api/analytics`; move it to `/api/v1/analytics`). Four endpoints **already exist** with the behavior below; keep them as they are and add the new ones next to them. The team's list names `sales-trend`, `category-sales`, `top-products` and `profit`; `revenue-analysis` (already built, used by the revenue chart), `slow-movers` and `ask` are additions.

Common query parameters (validated by `validateAnalyticsQuery`; extend it for the new endpoints): `period` one of `last7|last30|last90|thisMonth|custom` (default `last30`); for `custom`, `startDate` and `endDate` as `YYYY-MM-DD` (inclusive; `startDate` <= `endDate`; not allowed with other periods); `limit` 1 to 50 where relevant. Data source: `sales` with `status = 'COMPLETED'` joined to `sale_items`, using the snapshot columns (`product_name_snapshot`, `category_snapshot`), never the live `products` row. The previous period is the immediately preceding window of equal length.

**Existing endpoints**
- `GET /api/v1/analytics/category-sales` returns `{ "period": "last30", "categories": [ { "category", "revenue", "unitsSold", "revenuePercentage", "unitsPercentage" } ] }`, by revenue descending.
- `GET /api/v1/analytics/sales-trend` returns `{ "daily": [Row], "weekly": [Row], "monthly": [Row] }` with `Row = { "period", "currentPeriodSales", "previousPeriodSales" }`. Calendar buckets via `generate_series`, so empty buckets are 0. Labels: daily `12 Nov`, weekly `Week of 10 Nov`, monthly `Nov 2026`.
- `GET /api/v1/analytics/revenue-analysis` returns the same three views with `Row = { "period", "selectedPeriodRevenue", "previousPeriodRevenue" }`.
- `GET /api/v1/analytics/top-products?limit=14` (default 14, max 50) returns `{ "products": [ { "productName", "category", "unitsSold", "revenue" } ] }`, by revenue then units descending.

**New endpoints to add**
- `GET /api/v1/analytics/slow-movers?days=30&limit=10` returns `[ { "productId", "name", "category", "unitsSold", "quantity", "lastSoldAt" } ]`: active products with `quantity > 0`, ordered by units sold ascending (zero sold first), then `quantity` descending.
- `GET /api/v1/analytics/profit` (common range params) returns
```json
{ "revenue": 124350, "costOfGoodsSold": 90000, "grossProfit": 34350, "expenses": 12000, "netProfit": 22350,
  "linesMissingCost": 3, "revenueMissingCost": 450 }
```
  `revenue` = sum of `sale_items.revenue`. `costOfGoodsSold` = sum of `quantity x unit_cost_at_sale` over lines with a known cost. `grossProfit` = (`revenue` - `revenueMissingCost`) - `costOfGoodsSold`. `expenses` = sum of `expenses.amount` with `expense_date` in range. `netProfit` = `grossProfit` - `expenses`. Lines with `unit_cost_at_sale` null are excluded from profit and counted in `linesMissingCost` / `revenueMissingCost`; never guess a cost.
- `POST /api/v1/analytics/ask` body `{ "question": "is hafte kya sabse zyada bika?" }` returns `{ "answer": "..." }`. Node forwards to the AI service (section 10). 502 `AI_UNAVAILABLE` on failure. Rate limit 20/minute per user.

**Known gaps in the existing analytics (separate follow-up; do not block other work)**
1. Buckets use UTC; Indian shops need `Asia/Kolkata` day boundaries (use `AT TIME ZONE 'Asia/Kolkata'` and compute range start/end in IST).
2. For a single-day range the frontend shows hourly buckets (8 AM to 9 PM, labels `8 AM`, `1 PM`); add an hourly grouping.
3. The frontend charts expect at least 4 weekly and 6 monthly points; extend the calendar series to those minimums, ending at the range end.
4. `Backend/README.md` still documents the old period names (`30days`); the validator and this document are the source of truth (`last30`).

## 9. Internal endpoints (AI service → Node)

Authenticated with a service token, not the owner cookie. Header `Authorization: Bearer <jwt>`; JWT HS256 signed with `SERVICE_JWT_SECRET`; claims `{ iss: "bizpilot-ai", aud: "bizpilot-node", business_id, exp }` with `exp` ≤ 60 seconds from issue. `business_id` in the token decides the tenant; ignore any `businessId` parameter. Routes under `/internal` are not reachable with owner cookies and not exposed publicly.

### `GET /internal/catalog/search?q=parle%20g&limit=5`
```json
{ "items": [ { "productId": "uuid", "name": "Parle-G", "category": "Snacks", "unit": "packet",
               "price": 10, "status": "available", "similarity": 0.92 } ] }
```
`status` ∈ `available|limited|out` (`out`: quantity 0; `limited`: quantity ≤ threshold; else `available`). **Never return cost price or quantity from this endpoint** (the customer flow uses it). Active products only. Matching (parameterised SQL, `pg_trgm`): score = `GREATEST(similarity(LOWER(product_name), LOWER($q)), CASE WHEN LOWER(product_name) LIKE '%' || LOWER($q) || '%' THEN 0.9 ELSE 0 END)`; keep rows with score > 0.25; order by score desc, then name; escape `%` and `_` in `q`. `limit` max 10.

### `GET /internal/insights/snapshot?period=last30` (+ `startDate`/`endDate` for custom)
```json
{ "range": { "start": "2026-10-20", "end": "2026-11-18", "days": 30 },
  "revenue": { "amount": 124350, "previous": 111027, "changePercent": 12 },
  "profit": { "...same shape as /api/v1/analytics/profit..." },
  "topProducts": [ { "productName": "", "category": "", "unitsSold": 0, "revenue": 0 } ],
  "slowMovers": [ { "name": "", "unitsSold": 0, "quantity": 0 } ],
  "lowStock": [ { "name": "", "quantity": 0, "lowStockThreshold": 0, "status": "low-stock" } ],
  "salesByCategory": [ { "category": "", "revenue": 0, "unitsSold": 0 } ] }
```
Top 5 products, 5 slow movers, up to 10 low/out-of-stock items. This endpoint may include owner-only data (it is used only for the owner-facing `/api/v1/analytics/ask` flow, never for customer queries).

## 10. Node → AI service

AI service base URL `AI_SERVICE_URL` (default `http://localhost:8000`). Token as in section 9 but `iss: "bizpilot-node"`, `aud: "bizpilot-ai"`, 60 s expiry, claim `business_id`. Timeout 30 s for bills, 15 s otherwise. Full AI-side behaviour is in `docs/AI_SERVICE_SPEC.md`.

| Call | Request | Response |
| --- | --- | --- |
| `POST /internal/customer-query` | `{ "message": "Parle-G available hai kya", "shopName": "Ishan's Shop" }` | `{ "reply": "...", "language": "hinglish", "matchedCount": 2 }` |
| `POST /internal/bills/extract` | multipart: `image` or `audio`, optional `type` | the draft in section 6 |
| `POST /internal/insights/ask` | `{ "question": "...", "language"?: "hinglish" }` | `{ "answer": "..." }` |
| `GET /health` | none | `{ "status": "ok" }` |

`language` ∈ `english|hindi|hinglish`.

## 11. WhatsApp webhook (Meta WhatsApp Cloud API, Graph API v21.0)

- `GET /webhooks/whatsapp`: verification. If `hub.mode === "subscribe"` and `hub.verify_token === WHATSAPP_VERIFY_TOKEN`, respond 200 with the raw `hub.challenge` text; otherwise 403.
- `POST /webhooks/whatsapp`: capture the **raw body** (use `express.raw` or the `verify` callback of `express.json`) and check header `X-Hub-Signature-256` equals `"sha256=" + HMAC_SHA256(rawBody, WHATSAPP_APP_SECRET)` using a timing-safe comparison; mismatch → 403. Respond `200` immediately, then process asynchronously.
- Fields used: `entry[].changes[].value.metadata.phone_number_id` (identifies the shop via `businesses.whatsapp_phone_number_id`; unknown → ignore), `value.messages[].id`, `.from`, `.type`, `.text.body`. Ignore `statuses` (delivery receipts).
- Only `type === "text"` is answered by the AI. Other types get the fixed reply "Please send your question as a text message." (and the Hindi version).
- Dedupe by `messages[].id` using an in-memory TTL cache (10 minutes). Per-sender rate limit: 10 messages per minute, keyed by an in-memory hash of `from`; over the limit → silently drop.
- Reply: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` with `Authorization: Bearer WHATSAPP_ACCESS_TOKEN` and body `{ "messaging_product": "whatsapp", "to": "<from>", "type": "text", "text": { "body": "<reply>" } }`.
- **Privacy:** `from` and `text.body` live only in memory for the duration of the request. Never write them to the database, logs, error reports or traces. Do not log the request body on this route.
