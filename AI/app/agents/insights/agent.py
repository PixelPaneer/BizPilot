"""Public entry point for the Insights Agent.

The Orchestrator can call InsightsAgent.run() later without knowing graph internals.
"""

import time

from app.agents.insights.calculations import build_insights_facts, deterministic_fallback
from app.agents.insights.graph import build_insights_graph
from app.agents.insights.schemas import InsightsRequest, InsightsResponse
from app.shared.logging import log_event
from app.tools.insights import fetch_insights_snapshot


class InsightsAgent:
    def __init__(self, llm, node):
        self._llm = llm
        self._node = node
        self._graph = build_insights_graph(llm)

    async def run(self, request: InsightsRequest, *, business_id: str) -> InsightsResponse:
        started = time.perf_counter()

        # Retrieval is deliberately performed through the typed Node tool.
        raw = await fetch_insights_snapshot(
            self._node, business_id=business_id, period=request.period
        )
        
        required_keys = {
        "category_data",
        "top_data",
        "revenue_data",
        "slow_data",
        }


        if not isinstance(raw, dict) or not required_keys.issubset(raw):
            raise ValueError("Invalid analytics snapshot")

        facts = build_insights_facts(
            raw["category_data"],
            raw["top_data"],
            raw["revenue_data"],
            raw["slow_data"],
        )

        result = await self._graph.ainvoke({
            "mode": request.mode,
            "period": request.period,
            "question": request.question,
            "facts": facts,
        })

        log_event(
            "insights_request",
            flow="insights",
            mode=request.mode,
            period=request.period,
            used_fallback=result["used_fallback"],
            duration_ms=round((time.perf_counter() - started) * 1000),
        )

        return InsightsResponse(
            mode=request.mode,
            period=request.period,
            summary=result["answer"]["summary"],
            insights=result["answer"].get("insights", []),
            used_fallback=result["used_fallback"],
        )
