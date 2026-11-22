import { ApiError } from "../utils/ApiError.js";
import { callAi } from "./aiClient.js";

// Longer than the usual AI call: the service transcribes the audio, or reads the image, and then matches.
const EXTRACT_TIMEOUT_MS = 60000;

const toLine = (line) => ({
  type: line.type ?? null, // this line's kind: SALE, PURCHASE, or null when the draft cannot tell
  rawText: line.raw_text,
  quantity: line.quantity,
  unit: line.unit,
  price: line.price,
  matchedProductId: line.matched_product_id,
  matchedProductName: line.matched_product_name,
  confidence: line.confidence,
  candidates: (line.candidates ?? []).map((candidate) => ({
    productId: candidate.product_id,
    name: candidate.name,
    price: candidate.price,
  })),
});

// A voice note or a photo of a bill in, an editable stock draft out. Nothing is stored and no stock changes here: the
// owner corrects the draft and then records it through POST /sales or POST /purchases.
export async function extractBillDraft(businessId, { file, mimeType, typeHint }) {
  const query = typeHint ? `?type=${encodeURIComponent(typeHint)}` : "";
  const draft = await callAi(businessId, `/internal/bills/extract${query}`, {
    method: "POST",
    rawBody: file,
    contentType: mimeType,
    timeoutMs: EXTRACT_TIMEOUT_MS,
  });

  if (!draft || !Array.isArray(draft.lines) || !Array.isArray(draft.warnings)) {
    throw new ApiError(502, "The AI service could not handle the request.", [], "AI_UNAVAILABLE");
  }

  const data = {
    type: draft.type ?? null,
    lines: draft.lines.map(toLine),
    warnings: draft.warnings,
  };
  // Only present while the AI service runs with its testing-only DEBUG_RETURN_TRANSCRIPT setting.
  if (typeof draft.transcript === "string") data.transcript = draft.transcript;
  return data;
}
