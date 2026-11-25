
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

def _question_fallback(facts: dict, period: str, question: str) -> dict:
    q = question.lower()
    summary = ""
    insights = []

    if any(word in q for word in ("slow", "not selling", "unsold", "dead stock")):
        products = [
            p for p in (facts.get("slow_movers") or [])
            if isinstance(p, dict)
        ]
        if products:
            names = ", ".join(
                str(p.get("productName") or "Unnamed product")
                for p in products[:5]
            )
            summary = f"Slow-moving products for {period}: {names}."
        else:
            summary = "No slow-moving product data is available for this period."

    elif any(word in q for word in ("category", "categories")):
        categories = [
            c for c in (facts.get("categories") or [])
            if isinstance(c, dict)
        ]
        categories.sort(
            key=lambda c: _number(c.get("revenue")) or 0,
            reverse=True,
        )
        if categories:
            names = ", ".join(
                f"{c.get('category', 'Unnamed category')} "
                f"(₹{_number(c.get('revenue')):,.2f})"
                for c in categories[:3]
                if _number(c.get("revenue")) is not None
            )
            summary = f"Top categories by revenue for {period}: {names}."
        else:
            summary = "Category sales data is unavailable for this period."

    elif any(word in q for word in ("product", "item", "bestseller", "best seller")):
        products = [
            p for p in (facts.get("top_products") or [])
            if isinstance(p, dict)
        ]
        if products:
            names = ", ".join(
                f"{p.get('productName', 'Unnamed product')} "
                f"(₹{_number(p.get('revenue')):,.2f})"
                for p in products[:3]
                if _number(p.get("revenue")) is not None
            )
            summary = f"Top products by revenue for {period}: {names}."
        else:
            summary = "Top-product data is unavailable for this period."

    elif any(word in q for word in ("revenue", "earning", "sales", "growth")):
        revenue = facts.get("revenue", {})
        if revenue.get("available"):
            summary = (
                f"Revenue for {period} was "
                f"₹{revenue['current_period']:,.2f}. "
            )
            if revenue.get("previous_period") is not None:
                summary += (
                    f"Previous-period revenue was "
                    f"₹{revenue['previous_period']:,.2f}."
                )
                if revenue.get("change_percent") is not None:
                    summary += (
                        f" Change: {revenue['change_percent']:.2f}%."
                    )
        else:
            summary = f"Revenue data for {period} is unavailable."

    else:
        summary = (
            "I can answer questions about revenue, top products, "
            "category sales, and slow-moving products using the "
            "available business data. Please ask about one of these."
        )

    return {"summary": summary, "insights": insights}

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
    if mode == "question":
        return _question_fallback(facts, period, question or "")
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
