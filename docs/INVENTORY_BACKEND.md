# Inventory Page Backend: implementation brief

This brief covers the backend for the **Inventory page** (`Frontend/src/components/ProductInventory.jsx` and the components it uses). It is self-contained: build only what is listed here, and nothing for any other page.

## 1. What the Inventory page needs

| UI feature (file) | Backend support |
| --- | --- |
| Summary cards and tab counts (`InventorySummary.jsx`, `InventoryTabs.jsx`) | `GET /inventory/summary` |
| Product table with tabs All / In Stock / Low Stock / Out of Stock, search box, category filter, sort by price (`ProductInventory.jsx`, `InventoryToolbar.jsx`, `inventoryUtils.filterProducts`) | `GET /products` with `status`, `search`, `category`, `sort` |
| Client-side pagination of 10 rows, and PDF/Excel export of **all** filtered rows (`ExportMenu.jsx`, `exportUtils.js`) | `GET /products?limit=500` (one call returns every filtered row; the frontend paginates and exports) |
| Add / edit product (`ProductFormModal.jsx`) and category dropdown with custom categories | `POST /products`, `PATCH /products/:id`, `GET /products/categories` |
| Delete confirmation (`DeleteConfirmationModal.jsx`) | `DELETE /products/:id` (soft delete) |
| Stock adjustment modal: add or remove units (`StockAdjustmentModal.jsx`) and "last adjustment" in the actions modal (`ProductActionsModal.jsx`) | `PATCH /inventory/:id`, `lastAdjustment` on the product |
| Low-stock alert modal and header alert count (`LowStockAlertModal.jsx`, header) | `GET /inventory/alerts` |
| Header global search over products (`GlobalSearch.jsx`) | `GET /products/search?q=` |
| (Future) stock history screen | `GET /inventory/:id/history` |

## 2. Login stub

`requireBusinessContext` (already in `Backend/src/middleware/`) needs `req.user.user_id`, and login is not part of this work. Create `src/middleware/auth.middleware.js` exporting `authenticate`. Its body is a **development stub**: if `NODE_ENV !== 'production'` and `DEV_USER_ID` is set in `.env`, set `req.user = { user_id: DEV_USER_ID }`; otherwise respond 401 with code `UNAUTHENTICATED`. Real login can replace the body later without changing the export, so the inventory routes never change. The stub must never run in production.

## 3. Setup tasks (foundation)

1. `Backend/scripts/migrate.js` and `npm run migrate`: applies every `src/db/*.sql` file in filename order, recording applied files in a `schema_migrations` table; safe to rerun.
2. `src/config/db.js`: add `withTransaction(fn)` (gets a client, `BEGIN`, runs `fn(client)`, `COMMIT`, `ROLLBACK` on error, always releases).
3. `src/utils/ApiError.js`: optional 4th argument `code`; both error handlers (`app.js`, `error.middleware.js`) include `code` in the JSON when set. Error envelope: `{ success:false, message, errors:[], code? }`.
4. `src/middleware/validate.middleware.js`: runs `express-validator` results; on failure `ApiError(400, "Validation failed", [{field, message}], "VALIDATION_ERROR")`.
5. `src/constants/index.js`: add `MOVEMENT_TYPES` (`MANUAL_ADJUSTMENT, CORRECTION, DAMAGE`), `MOVEMENT_SOURCES` (`MANUAL, SYSTEM`), `UNITS` (`piece, kg, g, L, ml, dozen, packet`), `DEFAULT_CATEGORIES` (`Fruits, Dairy, Bakery, Vegetables, Meat, Beverages`), `STOCK_STATUS`.
6. `.env`: `DEV_USER_ID` (and `.env.example` entry). `scripts/seed-dev.js` (`npm run seed:dev`): creates a dev user (dummy password hash; it cannot log in), a business "Demo Kirana Store", and about 30 products through `stock.service` (mix of in-stock, low, out), then prints the user id to put in `DEV_USER_ID`. Safe to rerun.
7. Mount in `src/app.js`: `app.use("/api/v1/products", authenticate, requireBusinessContext, productRoutes)` and the same for `/api/v1/inventory`.

## 4. Endpoints

All responses use `{ success: true, data }`; JSON is camelCase; money and quantities are JS numbers (convert the `pg` strings). Every query is scoped by `req.businessId` and uses parameters.

### Product resource
```json
{ "id": "uuid", "name": "Parle-G", "category": "Snacks", "unit": "packet", "price": 10,
  "costPrice": 8, "quantity": 45, "lowStockThreshold": 20, "status": "in-stock", "isActive": true,
  "lastUpdated": "2026-11-18T10:00:00.000Z",
  "lastAdjustment": { "type": "add", "amount": 5, "date": "2026-11-18T10:00:00.000Z" } }
```
- Mapping: `name` = `products.product_name`; `price` = `selling_price`; `costPrice` = `cost_price` (nullable); `quantity` = `inventory.available_quantity`; `lowStockThreshold` = `inventory.reorder_threshold`; `lastUpdated` = `inventory.last_updated`.
- `status`: `quantity === 0` is `out-of-stock`; `quantity <= lowStockThreshold` is `low-stock`; otherwise `in-stock` (same rule as `getStockStatus` in `Frontend/src/utils/inventoryUtils.js`).
- `lastAdjustment`: the newest `stock_movements` row for the product with `source = 'MANUAL'` and `movement_type` in (`MANUAL_ADJUSTMENT`, `CORRECTION`, `DAMAGE`); `type` is `add` if `quantity_change > 0` else `remove`; `amount` is the absolute change; `date` is `created_at`. `null` if none. (Opening stock written when a product is created uses `source = 'SYSTEM'`, so it never appears here.)
- Validation (mirrors `ProductFormModal.jsx`; the backend also allows up to 3 decimals for future kg items): `name` 1 to 150 chars after trimming and collapsing spaces; `category` 1 to 100 chars (a custom category is just a new string, up to 30 chars as in the UI); `unit` in `UNITS`; `price` a number ≥ 0 (2 decimals); `costPrice` null or ≥ 0; `quantity` and `lowStockThreshold` numbers ≥ 0.

### `GET /products`
Query: `search` (case-insensitive contains, like the frontend filter; escape `%` and `_`), `category`, `status` (`in-stock|low-stock|out-of-stock`), `sort` (`newest` default, `name`, `price_asc`, `price_desc`, `quantity`), `page` (default 1), `limit` (default 100, max 500). Active products only. Response:
`{ "items": [Product], "total": 128, "page": 1, "limit": 100 }`. Use one SQL statement (skeleton in section 6).

### `GET /products/search?q=parle&limit=10`
Fuzzy search for the header search and any "find product" UI: score = `GREATEST(similarity(LOWER(product_name), LOWER($q)), 0.9 if the lower-cased name contains the lower-cased query)`; keep score > 0.25; order by score desc then name; `limit` max 20. Returns `{ "items": [Product] }`. Declare this route **before** `/products/:id`.

### `GET /products/categories`
`{ "items": ["Dairy", "Snacks", ...] }`: this business's distinct active-product categories merged with `DEFAULT_CATEGORIES`, sorted case-insensitively. Declare before `/products/:id`.

### `GET /products/:id`
One Product. Unknown id or another business's id gives 404 `NOT_FOUND` (same response for both).

### `POST /products`
Body `{ name, category, unit, price, costPrice?, quantity, lowStockThreshold }`. In one transaction: insert `products`; insert `inventory` with quantity 0 and the threshold; if `quantity > 0` call `applyStockChange` (`delta = +quantity`, `MANUAL_ADJUSTMENT`, source `SYSTEM`, `skipAudit: true`); write an `audit_logs` row `PRODUCT_CREATED` (`entity_type` `PRODUCT`, description `"<name>  •  ₹<price>"`); sync alerts. Duplicate active name (case-insensitive; the unique index `uq_products_active_name`) gives 409 `DUPLICATE_PRODUCT`. Returns 201 with the Product.

### `PATCH /products/:id`
Any subset of `{ name, category, unit, price, costPrice, quantity, lowStockThreshold }`; at least one field. If `quantity` is present and differs from the current value, apply the difference through `applyStockChange` (`MANUAL_ADJUSTMENT`, source `MANUAL`; a result below 0 is rejected). Update `products.updated_at`. After any quantity or threshold change run `syncAlerts`. Same 404 and duplicate-name rules. Returns the Product.

### `DELETE /products/:id`
Soft delete: `is_active = false`, resolve that product's active alerts (`status='RESOLVED'`, `resolved_at = now()`), audit row `PRODUCT_DELETED`. Returns `data: null`. Already inactive or unknown gives 404. (Hard delete is impossible once a product has stock history.)

### `GET /inventory`
Same query and response as `GET /products` (alias intended for stock screens).

### `GET /inventory/summary`
`{ "total": 128, "inStock": 117, "lowStock": 8, "outOfStock": 3 }` over active products, one SQL aggregate using the status rule. Declare before `/inventory/:id`.

### `GET /inventory/alerts?status=ACTIVE`
`{ "items": [ { "id", "productId", "productName", "type": "LOW_STOCK|OUT_OF_STOCK", "currentQuantity", "reorderThreshold", "status", "createdAt" } ] }`, newest first, `status` defaults to `ACTIVE` (also accepts `RESOLVED`). Only active products. Declare before `/inventory/:id`.

### `PATCH /inventory/:id` (`:id` is the product id)
Body is **exactly one** of:
- `{ "type": "add" | "remove", "amount": 5, "reason"?: "MANUAL_ADJUSTMENT" | "DAMAGE" | "CORRECTION" }`: `amount` > 0 (whole number in the UI; decimals allowed up to 3); `reason` defaults to `MANUAL_ADJUSTMENT`; `DAMAGE` only with `remove`.
- `{ "quantity": 40, "reason"?: "CORRECTION" }`: sets an exact count; the difference is applied as one `CORRECTION` movement (difference 0 changes nothing, returns 200).
Both call `applyStockChange` with source `MANUAL`, `userId = req.user.user_id`. Removing more than the current quantity gives 409 `INSUFFICIENT_STOCK`. Returns the updated Product (including the new `lastAdjustment`).

### `GET /inventory/:id/history?from=&to=&limit=50`
`{ "items": [ { "id", "productId", "productName", "type", "quantityChange", "previousQuantity", "newQuantity", "source", "createdAt" } ] }`, newest first; `from`/`to` are `YYYY-MM-DD` (inclusive, IST); `limit` max 200.

## 5. Services (the part that must be exactly right)

### `src/services/stock.service.js`: `applyStockChange(client, { businessId, productId, delta, movementType, source, userId, skipAudit })`
Must run inside `withTransaction`. Steps:
1. `SELECT ... FROM inventory WHERE business_id=$1 AND product_id=$2 FOR UPDATE` and confirm the product is active; otherwise `ApiError(404, ..., [], "NOT_FOUND")`.
2. `previous = available_quantity`; `next = previous + delta`. `delta` must not be 0. If `next < 0` throw `ApiError(409, "Insufficient stock", [{productId, requested, available}], "INSUFFICIENT_STOCK")`.
3. Insert `stock_movements` (`quantity_change = delta`, `previous_quantity`, `new_quantity = next`, `movement_type`, `source`, `user_id`; leave `reference_id` null).
4. `UPDATE inventory SET available_quantity = next, last_updated = now()`.
5. `syncAlerts(client, businessId, productId)`.
6. Unless `skipAudit`: insert `audit_logs` (`action_type` `STOCK_ADDED` if `delta > 0` else `STOCK_REMOVED`; `entity_type` `PRODUCT`; `entity_id` = product id; `user_id`; `description` = `"<product name>  •  +50 units (New stock: 200)"` or `"<product name>  •  -10 units (New stock: 15)"`; `outcome` `SUCCESS`).
7. Return `{ previous, next, productName }`.
Controllers never touch `inventory` or `stock_movements` directly.

### `src/services/alert.service.js`: `syncAlerts(client, businessId, productId)`
Read quantity, `reorder_threshold`, and the business settings flags. Desired alert: quantity 0 gives `OUT_OF_STOCK`; `0 < quantity <= threshold` gives `LOW_STOCK`; otherwise none.
- Resolve (`status='RESOLVED'`, `resolved_at=now()`) any active alert of a different type.
- If an alert is desired and enabled (`business_settings.stock_alerts_enabled` and the type's own flag `low_stock_alerts_enabled` / `out_of_stock_alerts_enabled`), insert with `ON CONFLICT (business_id, product_id, alert_type) WHERE status = 'ACTIVE' DO NOTHING`, then update `current_quantity` and `reorder_threshold` on the active row.
- Call it after quantity or threshold changes and after deactivation (deactivation just resolves).

### Layering
`routes` → `controllers` (thin) → `services` (`product.service.js`, `inventory.service.js`, `stock.service.js`, `alert.service.js`) → `models` (SQL: `product.model.js`, `inventory.model.js`, `stockMovement.model.js`, `alert.model.js`, `audit.model.js`, `settings.model.js`). Validators: `product.validator.js`, `inventory.validator.js`. Routes: `product.routes.js`, `inventory.routes.js`.

## 6. SQL skeleton for the list query

```sql
SELECT p.product_id, p.product_name, p.category, p.unit, p.selling_price, p.cost_price, p.is_active,
       i.available_quantity, i.reorder_threshold, i.last_updated,
       la.quantity_change AS adj_change, la.created_at AS adj_at,
       COUNT(*) OVER() AS total_count
FROM products p
JOIN inventory i ON i.business_id = p.business_id AND i.product_id = p.product_id
LEFT JOIN LATERAL (
  SELECT m.quantity_change, m.created_at
  FROM stock_movements m
  WHERE m.business_id = p.business_id AND m.product_id = p.product_id
    AND m.source = 'MANUAL' AND m.movement_type IN ('MANUAL_ADJUSTMENT','CORRECTION','DAMAGE')
  ORDER BY m.created_at DESC LIMIT 1
) la ON TRUE
WHERE p.business_id = $1 AND p.is_active
  AND ($2::text IS NULL OR p.product_name ILIKE '%' || $2 || '%' ESCAPE '\')
  AND ($3::text IS NULL OR p.category = $3)
  AND ($4::text IS NULL OR (CASE WHEN i.available_quantity = 0 THEN 'out-of-stock'
                                 WHEN i.available_quantity <= i.reorder_threshold THEN 'low-stock'
                                 ELSE 'in-stock' END) = $4)
ORDER BY <whitelisted sort expression>, p.product_id
LIMIT $5 OFFSET $6;
```
`ORDER BY` comes from a fixed map (`newest` = `p.created_at DESC`, `name` = `LOWER(p.product_name)`, `price_asc`/`price_desc` = `p.selling_price`, `quantity` = `i.available_quantity`), never from user text. Compute `status` in JS from the row (or in SQL) with the same rule.

## 7. Tests (`node --test`, plus `supertest`; separate `TEST_DATABASE_URL`, tables truncated between tests)

- `stock.service`: add and remove; remove below 0 rejected and nothing written; ledger row has correct previous/change/new; `delta = 0` rejected; audit row text format.
- `alert.service`: LOW_STOCK created when quantity crosses to ≤ threshold; becomes OUT_OF_STOCK at 0; resolved when restocked above threshold; never two active alerts of the same type; flags in `business_settings` respected; deactivation resolves alerts.
- Products: create (with opening stock → one `SYSTEM` movement, no `lastAdjustment`); duplicate name 409; list filters (`status`, `category`, `search` with `%` in the text), sort orders, `limit=500`; PATCH quantity creates an adjustment; soft delete hides the product; summary counts match.
- Inventory PATCH: add/remove; exact-quantity form; over-removal 409; both-forms or neither body 400; `lastAdjustment` updates; history newest first.
- Tenant isolation: a second business cannot read, patch, adjust or delete the first one's products or alerts (404).
- Search: `parle g` finds `Parle-G`.

## 8. Build order and done-when checks

1. **Foundation (section 3).** Done when: `npm run migrate` applies the SQL to an empty database and can be rerun; `npm run seed:dev` prints a user id; with `DEV_USER_ID` set, `curl localhost:5000/api/v1/products` returns `{"success":true,"data":{"items":[...]}}`.
2. **Services and read endpoints** (`stock.service`, `alert.service`, list/detail/search/categories/summary/alerts). Done when: the list filters and sorts correctly from curl and `inventory/summary` counts match the list tabs; service tests pass.
3. **Write endpoints** (create, patch, delete, inventory PATCH, history). Done when: creating a product with quantity 5 and threshold 10 shows a LOW_STOCK alert in `/inventory/alerts`; `PATCH /inventory/:id {"type":"add","amount":20}` removes the alert and sets `lastAdjustment`; removing 100 returns 409; all tests pass.
4. **Frontend wiring (small, after the API is stable):** replace `InventoryContext`'s `localStorage` with these endpoints (map `adjustStock` to `PATCH /inventory/:id`, `deleteProduct` to `DELETE`, categories from `/products/categories`, alert modal from `/inventory/alerts`); keep component props unchanged; send `credentials: 'include'`.

## 9. Rules

No secrets in git (`.env` is ignored; never print it); stock quantities change only through `stock.service`; parameterised SQL only; the business id comes only from `req.businessId`; do not edit the existing SQL files (add a new numbered migration for any schema change); do not modify existing files unrelated to the inventory page.
