export const ANALYTICS_PERIODS = ["7days", "30days", "90days", "custom"];
export const ANALYTICS_GROUPINGS = ["daily", "weekly", "monthly"];

export const MOVEMENT_TYPES = [
  "MANUAL_ADJUSTMENT",
  "CORRECTION",
  "DAMAGE",
  "SALE",
  "PURCHASE",
  "RETURN",
];
export const MOVEMENT_SOURCES = ["MANUAL", "SYSTEM", "VOICE", "OCR"];
// Where a sale or purchase entry came from (sales.source / purchase_batches.source).
export const BILL_SOURCES = ["MANUAL", "VOICE", "OCR"];
// How each source reads in the activity log, so a typed entry, a voice note and a bill photo can be told apart.
export const BILL_SOURCE_LABELS = { MANUAL: "typed", VOICE: "via voice", OCR: "via bill photo" };
export const UNITS = ["piece", "kg", "g", "L", "ml", "dozen", "packet"];
export const DEFAULT_CATEGORIES = [
  "Fruits",
  "Dairy",
  "Bakery",
  "Vegetables",
  "Meat",
  "Beverages",
];
export const STOCK_STATUS = ["in-stock", "low-stock", "out-of-stock"];