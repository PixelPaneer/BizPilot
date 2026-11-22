# BizPilot AI service

Python (FastAPI) service that understands language for BizPilot: customer questions on WhatsApp and
stock drafts from a voice note or bill photo. It never touches the database. It reads shop data only
by calling the Node backend's `/internal/*` routes, and everything it says about a shop (prices,
availability) comes from those calls, never from the model.

What exists so far: the foundation (health check, service-token security in both directions, a client
for calling Node) and the customer-query flow (`POST /internal/customer-query`): a customer's message
in, a short reply in English, Hindi or Hinglish out. The voice and bill-photo flow comes later.

## Run it

```powershell
cd AI
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env          # then set SERVICE_JWT_SECRET (same value as in Backend/.env)
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Tests: `.\.venv\Scripts\python -m pytest` (no network or Gemini key needed; Gemini and Node are faked).

Try it by hand (needs Node running with the same `SERVICE_JWT_SECRET`, and a catalog in its database):
```powershell
.\.venv\Scripts\python scripts\check_gemini.py          # checks GEMINI_API_KEY and GEMINI_TEXT_MODEL
.\.venv\Scripts\python scripts\make_token.py <business_id>   # a 60-second token to call the service
```
Without `GEMINI_API_KEY` the service still starts and answers with its fixed replies (and a plain-code
reading of the message), which is a good way to check the Node and database side first.

## How the two services trust each other
Each call carries a short-lived token (JWT, HS256, 60 seconds at most) signed with
`SERVICE_JWT_SECRET`, which must be the same value in `AI/.env` and `Backend/.env`. The token names
the shop (`business_id`), so a request can only ever be about one shop, and the model never chooses
it.

| Direction | iss | aud |
|---|---|---|
| Node to AI | `bizpilot-node` | `bizpilot-ai` |
| AI to Node | `bizpilot-ai` | `bizpilot-node` |

A token with the wrong signature, issuer or audience, no `business_id`, no `iat`/`exp`, a lifetime
over 60 seconds, or another signing algorithm is refused with 401. Without the secret every protected
route answers 503. `GET /health` needs no token.

## Routes now
| Route | Who calls it | Purpose |
|---|---|---|
| `GET /health` | anyone | is the service up |
| `POST /internal/ping` | Node | foundation check, Node to AI |
| `GET /internal/check-node` | Node | foundation check, round trip: calls Node's `GET /internal/ping` |
| `POST /internal/customer-query` | Node | `{ message, shopName? }` in, `{ reply, language, matchedCount }` out |

Errors have the same shape as the Node backend's: `{ success: false, message, errors, code }`.

## Layout
```
app/
  main.py          the app; error handlers
  config.py        settings from environment variables (the only place that reads them)
  security.py      checking and signing service tokens
  errors.py        ApiError
  api/             HTTP routes only, no logic
  agents/
    customer/      the customer-query graph (understand, lookup, compose), prompts, schemas, a
                   plain-code fallback reading of a message
    inventory/     availability.py: from what a customer wrote to the shop's products (price and
                   status only); asks the model to choose only when no match is clear
  llm/             base.py (the client shape, so tests can fake it), gemini.py (the Gemini client)
  tools/           node_client.py: the only way to read business data
  shared/          logging.py (metadata only: never message text, audio, images or tokens),
                   reply_templates.py (fixed replies), reply_validator.py (checks a drafted reply)
scripts/           check_gemini.py, make_token.py
tests/
```

## How a customer message is answered
1. **understand**: the model reads the message and returns the intent, the product names (also in
   Latin letters) and the language. If the model fails, a plain-code reading is used instead.
2. **lookup** (Inventory Agent): Node's customer-safe search finds the products. A clear match needs
   no model. When nothing matches well, the model picks among at most 5 product names (names only).
   A named price or size narrows the variants.
3. **compose**: the model writes the reply from the facts (name, price, status) only. The wording is
   then checked: every number must be one of the prices, every product must be named, the status words
   must match, and nothing about cost or quantity is allowed. If it fails the check, or the model is
   down, a fixed template is used. Greetings, unrelated questions and "not found" use templates too.

The customer's message goes to the model only as the user turn of the first request; it is never in
the instructions, never in the writing request, never sent to Node as a whole, and never logged.
