
"""Deterministic calculations over trusted analytics returned by Node."""

import math
from typing import Any


def _number(value: Any) -> float | None:
    """
    Convert a value to a valid finite float.

    Returns None for missing, invalid, boolean, NaN, or infinite values.
    """
    if value is None or isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(number):
        return None

    return number


def build_insights_facts(
    category_data: dict,
    top_data: dict,
    revenue_data: dict,
    slow_data: dict,
) -> dict:
    """
    Build trusted facts from the analytics responses returned by Node.

    Revenue totals are calculated only when all daily rows contain
    valid current-period and previous-period revenue values.
    """

    daily_rows = revenue_data.get("daily")

    current_revenue = None
    previous_revenue = None
    change_percent = None
    revenue_available = False

    # Revenue data must be a non-empty list.
    if isinstance(daily_rows, list) and daily_rows:

        current_values = []
        previous_values = []
        valid_rows = True

        for row in daily_rows:

            if not isinstance(row, dict):
                valid_rows = False
                break

            current_value = _number(
                row.get("selectedPeriodRevenue")
            )

            previous_value = _number(
                row.get("previousPeriodRevenue")
            )

            # Do not calculate totals using incomplete or invalid rows.
            if current_value is None or previous_value is None:
                valid_rows = False
                break

            current_values.append(current_value)
            previous_values.append(previous_value)

        if valid_rows:
            current_revenue = round(sum(current_values), 2)
            previous_revenue = round(sum(previous_values), 2)

            revenue_available = True

            # Percentage change cannot be calculated when previous
            # period revenue is zero.
            if previous_revenue > 0:
                change_percent = round(
                    (
                        (current_revenue - previous_revenue)
                        / previous_revenue
                    ) * 100,
                    2,
                )

    return {
        "revenue": {
            "available": revenue_available,
            "current_period": current_revenue,
            "previous_period": previous_revenue,
            "change_percent": change_percent,
        },
        "categories": category_data.get("categories", []),
        "top_products": top_data.get("products", []),
        "slow_movers": slow_data.get("products", []),
    }


def deterministic_fallback(
    facts: dict,
    period: str,
    mode: str = "dashboard",
    question: str | None = None,
) -> dict:
    """
    Generate a deterministic response when the LLM is unavailable
    or its response fails validation.
    """

    revenue = facts["revenue"]

    current = revenue["current_period"]
    previous = revenue["previous_period"]
    change = revenue["change_percent"]
    available = revenue["available"]

    # Handle unavailable revenue separately from zero revenue.
    if not available:
        summary = (
            f"Revenue data for {period} is currently unavailable. "
            "A reliable revenue comparison cannot be generated."
        )

    elif change is None:
        summary = (
            f"Revenue for {period} was ₹{current:,.2f}. "
            "A percentage comparison is unavailable because "
            "previous-period revenue is zero."
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

    # Top-product insight.
    top_products = facts.get("top_products") or []

    if top_products:
        product = top_products[0]

        if isinstance(product, dict):
            product_name = product.get("productName") or "A product"
            product_revenue = _number(product.get("revenue"))

            if product_revenue is not None:
                observation = (
                    f"{product_name} generated "
                    f"₹{product_revenue:,.2f} revenue."
                )
            else:
                observation = (
                    f"{product_name} was identified among the "
                    "top products, but its revenue value is unavailable."
                )

            insights.append({
                "title": "Top product by revenue",
                "observation": observation,
                "recommendation": (
                    "Review its stock regularly to help meet "
                    "customer demand."
                ),
            })

    # Slow-moving product insight.
    slow_movers = facts.get("slow_movers") or []

    valid_slow_movers = [
        item for item in slow_movers[:3]
        if isinstance(item, dict)
    ]

    if valid_slow_movers:
        names = ", ".join(
            str(item.get("productName") or "Unnamed product")
            for item in valid_slow_movers
        )

        insights.append({
            "title": "Slow-moving products",
            "observation": f"The backend identified: {names}.",
            "recommendation": (
                "Review product placement, pricing, and future "
                "purchase quantities."
            ),
        })

    return {
        "summary": summary,
        "insights": insights,
    }
