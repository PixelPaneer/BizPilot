"""Typed tools for retrieving analytics data from the Node backend."""

from app.errors import ApiError


async def fetch_insights_snapshot(node, *, business_id: str, period: str) -> dict:
    """Fetch all analytics payloads needed to calculate one Insights snapshot."""
    category_data = await node.get(
        business_id,
        "/internal/analytics/categories",
        params={"period": period},
    )
    top_data = await node.get(
        business_id,
        "/internal/analytics/top-products",
        params={"period": period},
    )
    revenue_data = await node.get(
        business_id,
        "/internal/analytics/revenue",
        params={"period": period},
    )
    slow_data = await node.get(
        business_id,
        "/internal/analytics/slow-movers",
        params={"period": period},
    )

    snapshot = {
        "category_data": category_data,
        "top_data": top_data,
        "revenue_data": revenue_data,
        "slow_data": slow_data,
    }

    if not all(isinstance(value, dict) for value in snapshot.values()):
        raise ApiError(502, "The analytics backend returned invalid data.", "INVALID_NODE_DATA")

    return snapshot
