// Integer-based money helpers. Prices have 2 decimals and quantities up to 3, so every value
// is converted to whole units (paise / thousandths) before multiplying. This avoids floating
// point errors and matches the database's ROUND(quantity * price, 2) (halves round up).

export function toPaise(amount) {
  return Math.round(Number(amount) * 100);
}

export function toMilli(quantity) {
  return Math.round(Number(quantity) * 1000);
}

// quantity (thousandths) x unit price (paise) = line total in paise, half rounded up.
export function lineTotalPaise(quantity, unitPrice) {
  return Math.floor((toMilli(quantity) * toPaise(unitPrice) + 500) / 1000);
}

export function fromPaise(paise) {
  return paise / 100;
}

// Today's date in India, as YYYYMMDD (used in sale numbers).
export function istDateCompact(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts.replaceAll("-", "");
}
