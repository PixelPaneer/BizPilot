from typing import Literal

from pydantic import BaseModel, Field


class AvailabilityItem(BaseModel):
    """What a customer may be told about one product: never a cost price, never a quantity."""

    product_id: str
    name: str
    category: str = ""
    unit: str = ""
    price: float
    status: Literal["available", "limited", "out"]
    similarity: float = 0.0

    @classmethod
    def from_node(cls, data: dict) -> "AvailabilityItem":
        """Builds one from an item of Node's /internal/catalog/search answer."""
        return cls(
            product_id=data["productId"],
            name=data["name"],
            category=data.get("category", ""),
            unit=data.get("unit", ""),
            price=float(data["price"]),
            status=data["status"],
            similarity=float(data.get("similarity", 0)),
        )

    def as_fact(self) -> dict:
        """The only form in which a product goes to the model or the templates."""
        return {"name": self.name, "price": self.price, "status": self.status}


class Choice(BaseModel):
    """The model's pick among close candidates."""

    product_ids: list[str] = Field(default_factory=list)
