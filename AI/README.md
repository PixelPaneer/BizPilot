# BizPilot AI service

Python (FastAPI) service that understands language for BizPilot: customer questions on WhatsApp and
stock drafts from a voice note or bill photo. It never touches the database. It reads shop data only
by calling the Node backend's `/internal/*` routes, and everything it says about a shop (prices,
availability) comes from those calls, never from the model.

What exists so far (step 1, the foundation): health check, service-token security in both
directions, and a client for calling Node. The flows come in later steps.

## Run it

```powershell
cd AI
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env          # then set SERVICE_JWT_SECRET (same value as in Backend/.env)
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Tests: `.\.venv\Scripts\python -m pytest`

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

Errors have the same shape as the Node backend's: `{ success: false, message, errors, code }`.

## Layout
```
app/
  main.py          the app; error handlers
  config.py        settings from environment variables (the only place that reads them)
  security.py      checking and signing service tokens
  errors.py        ApiError
  api/             HTTP routes only, no logic
  tools/           node_client.py: the only way to read business data
  shared/          logging.py: logs metadata only, never message text, audio, images or tokens
tests/
```
The agents, the Gemini client and the flows are added in later steps.
