"""Typed tool functions: the agent uses NodeClient, never direct HTTP or database access."""

from app.tools.node_client import NodeClient


async def fetch_insights_snapshot(
    node: NodeClient, *, business_id: str, period: str
) -> dict:
    params = {"period": period}

    category_data = await node.get(
        business_id, "/internal/analytics/category-sales", params
    )
    top_data = await node.get(
        business_id,
        "/internal/analytics/top-products",
        {**params, "limit": 5, "sort": "revenue"},
    )
    revenue_data = await node.get(
        business_id, "/internal/analytics/revenue-analysis", params
    )
    slow_data = await node.get(
        business_id,
        "/internal/analytics/slow-movers",
        {**params, "limit": 5, "sort": "units"},
    )

    datasets = {
    "category_data": category_data,
    "top_data": top_data,
    "revenue_data": revenue_data,
    "slow_data": slow_data,
    }

    for name, data in datasets.items():
        if not isinstance(data, dict):
            raise ValueError(
                f"Invalid analytics response: {name}"
            )

    return datasets
