// WhatsApp numbers are stored as +<country code><number>, e.g. +919876543210. A bare 10-digit
// number is taken to be Indian, as on the sign-in page.
export function canonicalWhatsapp(value) {
  const digits = String(value).replace(/\D/g, "");
  return `+${digits.length === 10 ? `91${digits}` : digits}`;
}

// Every spelling the same number may have been stored in.
export function whatsappVariants(value) {
  const canonical = canonicalWhatsapp(value);
  const digits = canonical.slice(1);
  return [...new Set([canonical, digits, digits.replace(/^91/, "")])];
}
