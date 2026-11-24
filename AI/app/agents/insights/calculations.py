"""Deterministic calculations over trusted analytics returned by Node."""

from typing import Any
import math


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    try:
        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (TypeError, ValueError):
        return None


def build_insights_facts(
    category_data: dict,
    top_data: dict,
    revenue_data: dict,
    slow_data: dict,
) -> dict:
    # The existing analytics service returns daily/weekly/monthly comparison series.
    # Use daily rows to calculate totals for the selected range.
    daily_rows = revenue_data.get("daily", [])
    current_revenue = sum(_number(row.get("selectedPeriodRevenue")) for row in daily_rows)
    previous_revenue = sum(_number(row.get("previousPeriodRevenue")) for row in daily_rows)

    change_percent = None
    if previous_revenue > 0:
        change_percent = round(
            ((current_revenue - previous_revenue) / previous_revenue) * 100, 2
        )

    return {
        "revenue": {
            "current_period": round(current_revenue, 2),
            "previous_period": round(previous_revenue, 2),
            "change_percent": change_percent,
        },
        "categories": category_data.get("categories", []),
        "top_products": top_data.get("products", []),
        "slow_movers": slow_data.get("products", []),
    }


def deterministic_fallback(facts: dict, period: str) -> dict:
    revenue = facts["revenue"]
    current = revenue["current_period"]
    previous = revenue["previous_period"]
    change = revenue["change_percent"]

    if change is None:
        summary = (
            f"Revenue for {period} was ₹{current:,.2f}. "
            "A percentage comparison is unavailable because previous-period revenue is zero."
        )
    else:
        direction = (
            "increased" if change > 0
            else "decreased" if change < 0
            else "remained unchanged"
        )
        summary = (
            f"Revenue for {period} was ₹{current:,.2f}, compared with "
            f"₹{previous:,.2f} in the previous matching period. "
            f"It {direction} by {abs(change):.2f}%."
        )

    insights = []
    top_products = facts.get("top_products") or []
    if top_products:
        product = top_products[0]
        insights.append({
            "title": "Top product by revenue",
            "observation": (
                f"{product.get('productName', 'A product')} generated "
                f"₹{_number(product.get('revenue')):,.2f} revenue."
            ),
            "recommendation": "Review its stock regularly to help meet customer demand.",
        })

    slow_movers = facts.get("slow_movers") or []
    if slow_movers:
        names = ", ".join(
            item.get("productName", "Unnamed product")
            for item in slow_movers[:3]
        )
        insights.append({
            "title": "Slow-moving products",
            "observation": f"The backend identified: {names}.",
            "recommendation": (
                "Review product placement, pricing, and future purchase quantities."
            ),
        })

    return {"summary": summary, "insights": insights}
