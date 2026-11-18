# Copilot prompts: Inventory page backend

Paste one prompt at a time, in order, into Copilot (agent or chat mode with the workspace open). Review the diff and run the "done when" check before moving to the next prompt. All prompts assume `.github/copilot-instructions.md` and `docs/INVENTORY_BACKEND.md` are in the repo.

Before starting: make sure PostgreSQL is running, `Backend/.env` has a valid `DATABASE_URL` (never paste its contents into chat), and you have created an empty database for testing and set `TEST_DATABASE_URL` in `.env`.

---

## Prompt 1: foundation

```
Read .github/copilot-instructions.md and docs/INVENTORY_BACKEND.md (sections 2, 3, 8 step 1 and 9). Use only those two documents as your instructions. Then look at the existing code in Backend/ (src/app.js, src/config/db.js, src/config/env.js, src/utils/ApiError.js, src/middleware/*, package.json) so you extend it instead of rewriting it.

Implement only the "Setup tasks (foundation)" from section 3 of docs/INVENTORY_BACKEND.md:
1. Backend/scripts/migrate.js plus npm script "migrate": apply Backend/src/db/*.sql in filename order, record applied files in a schema_migrations table, safe to rerun. Do not modify the SQL files.
2. withTransaction(fn) in src/config/db.js.
3. Optional 4th "code" argument on ApiError, and include `code` in the JSON of both error handlers (src/app.js and src/middleware/error.middleware.js) only when it is set.
4. src/middleware/validate.middleware.js using express-validator (add the validate step that returns ApiError(400, "Validation failed", [{ field, message }], "VALIDATION_ERROR")).
5. Extra constants in src/constants/index.js (MOVEMENT_TYPES, MOVEMENT_SOURCES, UNITS, DEFAULT_CATEGORIES, STOCK_STATUS). Keep the existing exports.
6. src/middleware/auth.middleware.js exporting `authenticate`: a development stub that sets req.user = { user_id: env.devUserId } when NODE_ENV !== "production" and DEV_USER_ID is set; otherwise responds 401 with code UNAUTHENTICATED. Add devUserId to src/config/env.js (optional variable, not required), add DEV_USER_ID and TEST_DATABASE_URL to .env.example.
7. scripts/seed-dev.js plus npm script "seed:dev": idempotent; creates a dev user with a dummy password hash, a business "Demo Kirana Store" (business_settings is created by the database trigger), and about 30 products with inventory (a mix of in-stock, low-stock and out-of-stock, categories from DEFAULT_CATEGORIES plus Snacks), and prints the dev user's id. For now insert products and inventory with direct SQL in one transaction; add a TODO to switch to stock.service in the next step.
8. In package.json add a script "test" that runs only the new inventory tests with node --test (leave any existing test files and scripts alone). Add supertest as a dev dependency.

Rules: do not modify existing files except where a task above says to extend them; do not print or commit .env; use parameterised SQL only; keep the existing coding style (ES modules, asyncHandler).

When done, show me the list of changed files and the exact commands to run the check below. Do not start on products or inventory endpoints yet.

Done when: `npm run migrate` applies all the SQL files in Backend/src/db to an empty database and a second run does nothing; `npm run seed:dev` prints a user id (I will put it in DEV_USER_ID); `npm test` runs without failing; `npm run dev` starts and GET /health still returns success.
```

---

## Prompt 2: services and read endpoints

```
Read .github/copilot-instructions.md and docs/INVENTORY_BACKEND.md fully, especially sections 1, 4, 5 and 6. The foundation from the previous step is done (migrate script, withTransaction, ApiError code, validate middleware, authenticate stub, seed script).

Implement:
1. src/services/stock.service.js: applyStockChange(client, { businessId, productId, delta, movementType, source, userId, skipAudit }) exactly as specified in section 5 (lock the inventory row, reject delta 0 and negative results with INSUFFICIENT_STOCK, insert the stock_movements row, update inventory, call syncAlerts, write the audit_logs row unless skipAudit). Export it with exactly this signature.
2. src/services/alert.service.js: syncAlerts(client, businessId, productId) exactly as specified in section 5, including the settings flags and the ON CONFLICT insert on the partial unique index.
3. Models (src/models/): product.model.js, inventory.model.js, stockMovement.model.js, alert.model.js, audit.model.js, settings.model.js. SQL only, parameterised, camelCase mapping helpers, NUMERIC strings converted to numbers.
4. Read endpoints, mounted in src/app.js at /api/v1/products and /api/v1/inventory with authenticate then requireBusinessContext:
   GET /api/v1/products (filters search, category, status, sort, page, limit; use the SQL skeleton in section 6 including lastAdjustment and the whitelisted sort map), GET /api/v1/products/search, GET /api/v1/products/categories, GET /api/v1/products/:id (declare search and categories BEFORE :id), GET /api/v1/inventory (same as the products list), GET /api/v1/inventory/summary, GET /api/v1/inventory/alerts (declare summary and alerts before /:id), plus the route files, controllers (thin), services (product.service.js, inventory.service.js) and validators (express-validator for query parameters: status, sort, limit 1 to 500, page >= 1).
5. Update scripts/seed-dev.js so it creates products through stock.service (opening stock with source SYSTEM) instead of direct SQL, so alerts and ledger rows exist.
6. Tests with node:test and supertest against TEST_DATABASE_URL (tables cleaned between tests): stock.service cases, alert.service cases, list filters/sorts/search with a "%" in the text, summary counts equal list counts, categories merge, tenant isolation (a second business cannot read the first one's products by id).

Rules: stock changes only through stock.service; business id only from req.businessId; responses {success, data}; 404 NOT_FOUND for both unknown ids and other businesses' ids; never expose SQL errors; do not modify existing files unrelated to the inventory page.

When done, list changed files and give me the curl commands for the check below. Do not implement create, patch, delete or the inventory PATCH yet.

Done when: with DEV_USER_ID set and the seeded data, `curl localhost:5000/api/v1/products?status=low-stock&sort=price_asc` returns only low-stock items in price order; `/api/v1/inventory/summary` counts equal the number of items in each status tab; `/api/v1/inventory/alerts` lists the seeded low and out-of-stock products; `npm test` passes.
```

---

## Prompt 3: write endpoints

```
Read .github/copilot-instructions.md and docs/INVENTORY_BACKEND.md, sections 4, 5, 7 and 8. The services and read endpoints from the previous step exist and pass their tests.

Implement the write endpoints:
1. POST /api/v1/products: one transaction (insert products, insert inventory with quantity 0 and the threshold, then applyStockChange for the opening stock when quantity > 0 with movementType MANUAL_ADJUSTMENT, source SYSTEM, skipAudit true, then an audit_logs row PRODUCT_CREATED with description "<name>  •  ₹<price>"); map the unique-index violation on uq_products_active_name to 409 DUPLICATE_PRODUCT; return 201 with the Product. Validation exactly as in section 4 (name trimmed and collapsed, unit in UNITS, price >= 0, quantity and lowStockThreshold >= 0).
2. PATCH /api/v1/products/:id: any subset, at least one field; a changed quantity goes through applyStockChange (MANUAL_ADJUSTMENT, source MANUAL, userId from req.user); update products.updated_at; run syncAlerts after quantity or threshold changes; same duplicate and 404 rules.
3. DELETE /api/v1/products/:id: soft delete (is_active = false), resolve that product's active alerts, audit row PRODUCT_DELETED, return data null.
4. PATCH /api/v1/inventory/:id (the id is the product id): body is exactly one of { type: "add"|"remove", amount, reason? } or { quantity, reason? } as in section 4; reject both or neither with 400; INSUFFICIENT_STOCK 409 when removing more than available; return the updated Product including lastAdjustment.
5. GET /api/v1/inventory/:id/history with from, to (YYYY-MM-DD, inclusive, Asia/Kolkata) and limit (max 200), newest first.
6. Validators for all bodies and params, and tests: create with opening stock (one SYSTEM movement, lastAdjustment null), duplicate name (case-insensitive) gives 409, quantity PATCH creates a MANUAL movement, soft delete hides the product and resolves alerts, add and remove, exact quantity form, over-removal 409 with nothing written, both-or-neither body 400, alerts created at the threshold and removed after restocking, history order, tenant isolation for every write endpoint.

Rules: same as before. Do not modify the existing SQL files (if you believe a schema change is needed, stop and tell me instead of adding it). Do not touch the frontend in this step.

When done, list changed files, give the curl commands for the check below, and list anything in docs/INVENTORY_BACKEND.md that was ambiguous or that you had to decide yourself.

Done when: creating a product with quantity 5 and lowStockThreshold 10 makes a LOW_STOCK alert appear at /api/v1/inventory/alerts; PATCH /api/v1/inventory/<id> with {"type":"add","amount":20} removes that alert and the product's lastAdjustment shows {type:"add", amount:20}; {"type":"remove","amount":100} returns 409 INSUFFICIENT_STOCK and the quantity is unchanged; DELETE then GET /api/v1/products no longer lists it; `npm test` passes.
```

---

## Optional prompt 4: connect the frontend

Run only after prompt 3 passes and the API behaves correctly with curl.

```
Read docs/INVENTORY_BACKEND.md section 8 step 4 and the Inventory page components (Frontend/src/context/InventoryContext.jsx, Frontend/src/components/ProductInventory.jsx, ProductFormModal.jsx, StockAdjustmentModal.jsx, DeleteConfirmationModal.jsx, LowStockAlertModal.jsx, GlobalSearch.jsx, Frontend/src/utils/inventoryUtils.js).

Replace the localStorage state in InventoryContext with calls to the new API (/api/v1/products, /api/v1/inventory, /api/v1/products/categories, /api/v1/inventory/alerts). Add Frontend/src/utils/apiClient.js: fetch with credentials "include", unwrap response.data, throw an Error carrying message and code on failure. Keep the context's exported functions (addProduct, updateProduct, adjustStock, deleteProduct, openSummaryAlert, closeStockAlert) and the component props unchanged where possible; adjustStock now sends { type, amount } to PATCH /api/v1/inventory/:id and uses the returned product. Show API errors (for example DUPLICATE_PRODUCT or INSUFFICIENT_STOCK) in the existing form error areas. Keep the sample-data fallback out of this path. Do not change styling.

Done when: with the backend and the Vite dev server running (the proxy to port 5000 already exists in vite.config.js), adding, editing, adjusting and deleting a product on the Inventory page persists after a page reload, the tab counts match the table, and `npm run lint` in Frontend/ passes.
```
