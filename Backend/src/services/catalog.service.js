import { searchActiveProducts } from "../models/catalog.model.js";
import { ApiError } from "../utils/ApiError.js";

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 10;

// Search text in the form the SQL compares against: lower case, punctuation that separates words
// ("Parle-G", "Parle_G", "Parle.G") turned into a space, runs of spaces collapsed. The SQL applies
// the same rules to the product names.
export function flatten(text) {
  return text
    .toLowerCase()
    .replace(/[-_./,()']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// LIKE treats % and _ and \ as wildcards; a customer typing them must only match them literally.
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, "\\$&");
}

// What a customer may be told about the products whose names resemble `q`: name, category, unit,
// selling price and a stock status (available, limited or out), best match first. Never the cost
// price and never the quantity.
export async function searchCatalog(businessId, { q, limit = DEFAULT_LIMIT }) {
  const normalized = flatten(q);

  if ([...normalized].length < 2) {
    throw new ApiError(
      400,
      "Search text needs at least 2 letters or digits.",
      [{ field: "q", message: "Search text needs at least 2 letters or digits." }],
      "VALIDATION_ERROR"
    );
  }

  const items = await searchActiveProducts(
    businessId,
    normalized,
    escapeLike(normalized),
    Math.min(limit, MAX_LIMIT)
  );
  return { items };
}
