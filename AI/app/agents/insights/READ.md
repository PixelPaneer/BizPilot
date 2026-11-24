# Insights Agent

This agent supports two request modes using the same verified analytics data:

- `dashboard`: produce a short set of dashboard insights for a period.
- `question`: answer an owner's question using that period's analytics.

## Flow

`POST /internal/insights/ask` (Node -> AI)
-> verify the Node service token
-> retrieve category sales, top products, revenue comparison and slow movers from Node
-> calculate a small normalized facts object in Python
-> ask Gemini for a structured explanation
-> reject a generated answer if it introduces numbers absent from the facts
-> use a deterministic fallback if Gemini fails or validation fails

The agent does not query PostgreSQL and does not write business data.

## Example request

```json
{
  "mode": "question",
  "period": "last30",
  "question": "Which products generated the most revenue?"
}
```

Dashboard mode:

```json
{
  "mode": "dashboard",
  "period": "thisMonth"
}
```

The Node backend must add the four service-authenticated `/internal/analytics/*` endpoints described in `Backend/INTEGRATION.md` before this agent can retrieve real metrics.
