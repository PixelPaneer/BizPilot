# BizPilot

**B2B AI business assistant for small shops, retailers, and MSMEs, with WhatsApp customer bots.**

Team **NEXUS** · Project type: AI-native multi-agent business assistant

BizPilot helps small-business owners run day-to-day operations (inventory, orders, billing, and insights) from a simple web dashboard, while their customers talk only to a WhatsApp bot in Hindi, English, or Hinglish. The AI never invents business facts: prices, stock, totals, and taxes always come from verified records and deterministic backend code.

---

## Table of Contents

- [Why BizPilot](#why-bizpilot)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Data and Privacy](#data-and-privacy)
- [Security and AI Safeguards](#security-and-ai-safeguards)
- [Business Rules](#business-rules)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Risks and Open Decisions](#risks-and-open-decisions)
- [Project Documents](#project-documents)
- [Team](#team)

---

## Why BizPilot

Small-business owners in India often handle customer replies, stock tracking, invoicing, and sales analysis by hand. That leads to:

- Delayed or missed customer responses (lost sales)
- Inaccurate inventory (stockouts or dead stock)
- Manual invoice and tax errors
- Little visibility into sales trends
- English-first, complex software that is hard to adopt
- No budget to hire extra staff for repetitive work

BizPilot offers an affordable, conversational, safeguarded alternative.

## Key Features

**For business owners (web dashboard)**
- Owner authentication and business profile management
- Product, selling price, stock, and reorder-threshold management
- Low-stock alerts, reorder suggestions, and slow-moving stock insights
- Order review, invoice generation (with PDF output), and invoice history
- Daily and weekly sales summaries, best sellers, and stock-risk insights
- Pending-approval queue with explanations for blocked or flagged actions
- Activity and error views for authorized users

**For customers (WhatsApp only)**
- Product availability and price enquiries
- Configured FAQs (shop timings, return policy, etc.)
- Order requests with stock validation
- Replies in Hindi, English, or Hinglish
- No BizPilot account, login, or customer dashboard

## How It Works

### 1. Product enquiry
1. Customer messages the business's WhatsApp bot.
2. The webhook validates the provider event and resolves the business from the receiving number.
3. The Orchestrator routes the request to the Customer Agent.
4. The agent fetches recorded product, price, and stock data through authorized tools.
5. The backend validates the result and replies in a supported language.
6. Transient message context is discarded; no customer identity or message content is retained.

### 2. Order request and approval
1. Receive requested items and quantities via WhatsApp.
2. Validate products, quantities, and stock (reject or ask for clarification if insufficient).
3. Calculate totals with backend rules and create an order reference with no customer identity.
4. If required, hold the action for owner approval.
5. On approval, re-check stock and commit the order and inventory update safely; otherwise do nothing.
6. Record the outcome without customer-identifying details.

### 3. Invoice generation
1. Load the validated order and business details.
2. Check required invoice fields and verified tax inputs.
3. Compute line totals, discounts, taxes, and the grand total in deterministic backend code.
4. Hold for review if tax treatment or required information is unclear.
5. Store invoice number, order reference, totals, status, and timestamp; generate a readable invoice/PDF.

## Architecture

BizPilot is a **modular backend** with two separate interfaces (owner operations and the WhatsApp customer channel) and **tenant-isolated** business data.

```
Business Owner ─► Owner Dashboard ─► Backend API + Auth ─┐
                                                         ▼
                                     Orchestrator + Business Agents ─► Product / Stock Tools ─► Business Database
                                                         ▲                                      (no customer profiles)
Shop Customer ─► WhatsApp Bot / Business API ─► Webhook + Request Handler ┘
```

**Main components**
- Owner dashboard and backend API with authentication
- WhatsApp Business adapter and webhook validation
- Manager/Orchestrator Agent plus specialized **Customer**, **Inventory**, **Billing**, and **Insights** agents
- Authorized business tools with a validation/approval gate
- Business records database and redacted monitoring

**Agents**

| Agent | Responsibility |
|---|---|
| Manager / Orchestrator | Classifies intent, routes to agents, validates results, tracks execution |
| Customer | Availability, prices, FAQs, order requests (WhatsApp) |
| Inventory | Product records, stock updates, low-stock alerts, reorder suggestions |
| Billing | Invoices, deterministic calculations, verified tax application |
| Insights | Daily/weekly summaries, best sellers, trends, stock risk, profit estimates |

Each agent receives only the context and tools it needs, and structured outputs are validated before reaching business tools.

## Tech Stack

| Area | Technology |
|---|---|
| Owner frontend | React dashboard |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| AI orchestration | Python + FastAPI + LangGraph, Gemini |
| Messaging | WhatsApp Business Platform / approved provider |
| Invoice output | Backend PDF generation |

## Data and Privacy

BizPilot stores **business and operational records only**. There is intentionally **no CUSTOMER collection/table**.

| Record | Stored (customer identity excluded) |
|---|---|
| Business | `business_id`, name, `owner_user_id`, settings |
| Product / Inventory | `product_id`, `business_id`, name/SKU, selling price, quantity, reorder threshold |
| Order | `order_id`, `business_id`, items, quantities, transaction-time prices, total, status, timestamp |
| Invoice | `invoice_id`, `business_id`, order reference, invoice number, totals, tax breakdown, status, timestamp |
| Approval | `approval_id`, `business_id`, action reference, decision, approver, timestamp |
| Audit / Agent execution | business/request reference, action/tool outcome, latency, error code (no raw messages or customer identifiers) |

**Privacy rules**
- Sender identifiers and message text are processed only as transient input for the active request.
- Customer names, phone numbers, addresses, sender IDs, and raw message content are never persisted in storage, logs, analytics, or agent traces.
- Inputs sent to AI services are minimized and redacted; webhook payloads and traces are configured to avoid unnecessary retention.
- Any invoice/legal requirement that needs customer details must be confirmed before enabling it. The design excludes those fields by default.

## Security and AI Safeguards

- Owner authentication, role permissions, and tenant isolation enforced in the backend (not just the UI)
- Customer messages treated as **untrusted input**; prompts cannot override permissions or business rules
- Each agent limited to its purpose, tools, and required context
- Protected secrets (never committed to source control), webhook validation, rate limits, bounded retries, event deduplication, and idempotent operations
- Logs capture routing, outcomes, latency, and errors, never customer identity or raw messages
- Failure-safe behavior: if approval status, stock, tax rules, or another critical input can't be verified, high-risk actions are not silently executed
- Errors never expose credentials, internal prompts, or private business records

## Business Rules

- Do not oversell unless a separately authorized backorder flow exists.
- Low-stock alert when quantity is **at or below** the configured threshold.
- Line total = quantity × recorded unit selling price, subject to verified discounts and tax rules.
- Never guess a tax rate (including GST) or claim success after a failed operation.
- Use idempotency and safe retries to prevent duplicate orders and invoices.
- The database and deterministic tools are the source of truth; the LLM interprets requests and drafts explanations but never invents authoritative values.

## Testing

- Product answers match verified stock and price records
- Webhook authenticity, duplicate events, provider failures, and reply handling
- Inventory thresholds, stock rejection, approvals, invoice arithmetic, and missing tax inputs
- Automated checks that no customer identity or message content appears in the database, logs, analytics, or agent traces
- Access isolation, prompt injection, Hindi/English/Hinglish requests, and retry safety
- Evaluation dataset covering normal, ambiguous, unsupported, and adversarial queries

**Success metrics (pilot):** median and p95 response time, routing and stock/price accuracy, invoice error rate, unauthorized actions blocked, duplicate operations, owner time saved, and AI cost per conversation.

## Roadmap

**Initial rollout**
1. Prototype owner dashboard and business records with test data
2. Implement WhatsApp webhook and product enquiry path
3. Add order handling, inventory updates, approvals, and billing
4. Integrate the provider sandbox and complete privacy/security tests before pilot

**Future enhancements**
- Voice-based Hindi interaction
- Additional Indian languages and messaging platforms
- Supplier integrations and purchase-order workflows
- Advanced demand forecasting
- Automated recurring reports
- Multi-store inventory management
- Configurable analytics dashboards

**Out of scope:** autonomous supplier payments without owner approval, replacing a chartered accountant for complex tax decisions, guaranteeing tax/legal compliance without verified rules and review, lending or investment advice, and decisions based on fabricated or unverified data.

## Risks and Open Decisions

| Risk / decision | Mitigation / next step |
|---|---|
| Customer data leaking via provider payloads, logs, or AI traces | Audit every data path; add automated privacy tests |
| WhatsApp access, policies, and outages | Validate provider requirements; bounded retries and fallback |
| Tax/invoice rules conflicting with customer-data minimization | Confirm requirements before production billing |
| Incorrect inventory or tax data | Timestamped updates, validation, manual correction, review on ambiguity |
| AI hallucination and prompt injection | Verified data retrieval, output validation, backend-enforced permissions |
| High AI operating cost | Usage tracking, caching, model selection by task complexity |
| Approval thresholds, retention/backups, operational targets | To be confirmed with the project team |

## Project Documents

- **Software Requirements Specification (SRS):** `SRS_Final_2210.pdf`
- **Software Design Document (SDD):** `SDD_2210.pdf`

## Team

**Team NEXUS**
- SRS lead: Ankita Jaiswal
- SDD lead: Anwesha Arya (prepared by Team 2)

---

*Status: design and requirements phase. Setup, installation, and environment instructions will be added as implementation begins.*
