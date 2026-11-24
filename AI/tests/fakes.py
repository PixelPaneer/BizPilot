"""Stand-ins for Gemini and for the Node catalog search, so the tests need no network."""

import difflib
import re

import httpx

from app.llm.base import LlmError

NODE = "http://node.test"


class FakeLlm:
    """Answers each kind of request (by its answer schema) with a function the test provides.

    handlers: { SchemaClass: function(user_text, system_text) -> schema instance }. A handler may
    raise LlmError to act as a failing model. A schema with no handler also fails.
    Every call is kept in `calls` so tests can see exactly what was sent to the model.
    """

    def __init__(self, handlers: dict | None = None):
        self.handlers = handlers or {}
        self.calls: list[dict] = []

    async def generate(self, *, system, user, schema, temperature=0.0):
        self.calls.append({"system": system, "user": user, "schema": schema, "temperature": temperature})
        handler = self.handlers.get(schema)
        if handler is None:
            raise LlmError("no handler for this request")
        return handler(user, system)

    def calls_for(self, schema) -> list[dict]:
        return [call for call in self.calls if call["schema"] is schema]


def _flat(text: str) -> str:
    return re.sub(r"[\W_]+", " ", text.lower()).strip()


class FakeCatalog:
    """Behaves like Node's /internal/catalog/search for a list of products.

    products: list of dicts with productId, name, price, status (category and unit optional).
    Every request it receives is kept in `requests`.
    """

    def __init__(self, products: list[dict]):
        self.products = products
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        q = _flat(request.url.params.get("q", ""))
        scored = []
        for product in self.products:
            name = _flat(product["name"])
            score = difflib.SequenceMatcher(None, q, name).ratio()
            if q and q in name:
                score = max(score, 0.9)
            if score > 0.25:
                scored.append((score, product))
        scored.sort(key=lambda pair: (-pair[0], pair[1]["name"]))
        limit = int(request.url.params.get("limit", 5))
        items = [
            {
                "productId": p["productId"],
                "name": p["name"],
                "category": p.get("category", "Snacks"),
                "unit": p.get("unit", "packet"),
                "price": p["price"],
                "status": p["status"],
                "similarity": round(score, 2),
            }
            for score, p in scored[:limit]
        ]
        return httpx.Response(200, json={"success": True, "data": {"items": items}})

    @property
    def queries(self) -> list[str]:
        return [request.url.params.get("q", "") for request in self.requests]
