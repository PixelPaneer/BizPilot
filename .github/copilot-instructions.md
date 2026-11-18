# BizPilot: instructions for GitHub Copilot

Current task: build the backend for the **Inventory page** of the BizPilot dashboard (React app in `Frontend/`, Express + PostgreSQL API in `Backend/`). Build only what the Inventory page needs.

## Read before coding

1. `docs/INVENTORY_BACKEND.md`: scope, endpoints, services, SQL, tests and build order. This is your only specification.
2. `docs/COPILOT_PROMPTS.md`: the step-by-step prompts the developer will give you.
3. `Backend/src/db/*.sql`: the database schema (read it; do not edit existing files; any schema change goes in a new numbered migration).

Do not implement anything that the brief does not list. Work one step at a time.

## Rules

- Stock quantities change only through `Backend/src/services/stock.service.js`.
- Tenant scoping: use `req.businessId` (set by `requireBusinessContext`). Never take a business id from a request body or query string. Every SQL statement is parameterised and filtered by `business_id`.
- Never commit `.env`, never print its contents, never hard-code secrets.
- Do not modify existing files that are unrelated to the inventory page.

## Stack and conventions

- Node API: Node 20+, ES modules, Express 4, `pg` with raw parameterised SQL (no ORM), `express-validator`.
- Responses: `{ success: true, data }` and `{ success: false, message, errors: [], code? }`. Throw `ApiError(statusCode, message, errors, code)`; wrap handlers in `asyncHandler`.
- Layout: controllers are thin; rules live in `services/`; SQL lives in `models/`; validators in `validators/`. Name new files like the existing ones (`product.controller.js`, `product.routes.js`, ...).
- JSON is camelCase; database columns are snake_case. Convert `NUMERIC` strings to numbers in mappers.
- Frontend: React 19, Vite, Tailwind 4, JavaScript. Keep component props stable when replacing `localStorage` with API calls.

## Commands

- Backend: `cd Backend`, `npm install`, `npm run migrate`, `npm run seed:dev`, `npm run dev`, `npm test`.
- Frontend: `cd Frontend`, `npm install`, `npm run dev`, `npm run lint`.

## Definition of done for any step

- Matches the endpoint shapes and error codes in `docs/INVENTORY_BACKEND.md` exactly.
- Has tests for the new behavior (brief section 7), and existing tests still pass.
- No secrets committed, no unrelated changes.
