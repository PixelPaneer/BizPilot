import { createHmac, timingSafeEqual } from "node:crypto";
import { pool } from "../config/db.js";
import { whatsapp } from "../config/env.js";
import { callAi } from "./aiClient.js";

const MESSAGE_TTL_MS = 10 * 60 * 1000;
const SENDER_WINDOW_MS = 60 * 1000;
const SENDER_LIMIT = 10;
const MAX_CACHE_ENTRIES = 25_000;
const AI_RETRY_DELAY_MS = 250;

const UNSUPPORTED_MESSAGE_REPLY =
  "Please send your question as a text message.\nकृपया अपना सवाल टेक्स्ट संदेश के रूप में भेजें।";
const AI_UNAVAILABLE_REPLY =
  "Sorry, I could not check that right now. Please try again shortly.\nमाफ़ कीजिए, अभी जानकारी नहीं मिल सकी। कृपया थोड़ी देर बाद फिर कोशिश करें।";
const MESSAGE_TOO_LONG_REPLY =
  "Please keep your question under 1,000 characters.\nकृपया अपना सवाल 1,000 अक्षरों से छोटा रखें।";

function logSafely(logger, event, businessId, messageId, code) {
  logger({ event, businessId, messageId, code });
}

function pruneOldest(cache, isExpired, now) {
  for (const [key, value] of cache) {
    if (!isExpired(value, now)) break;
    cache.delete(key);
  }
}

function enforceCacheLimit(cache) {
  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

export function isValidWhatsappSignature(rawBody, signature, appSecret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !appSecret) {
    return false;
  }

  const expected = Buffer.from(
    `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`
  );
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function findBusinessByWhatsappNumber(phoneNumberId) {
  const result = await pool.query(
    `SELECT business_id, business_name
     FROM businesses
     WHERE whatsapp_phone_number_id = $1
     LIMIT 1`,
    [phoneNumberId]
  );

  const row = result.rows[0];
  return row
    ? { businessId: row.business_id, businessName: row.business_name }
    : null;
}

async function sendWhatsappText(phoneNumberId, recipient, text) {
  if (!whatsapp.accessToken) {
    const error = new Error("WhatsApp delivery is not configured.");
    error.code = "WHATSAPP_NOT_CONFIGURED";
    throw error;
  }

  let response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${whatsapp.webhookApiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsapp.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: text },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch {
    const error = new Error("WhatsApp delivery failed.");
    error.code = "WHATSAPP_SEND_FAILED";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("WhatsApp delivery failed.");
    error.code = "WHATSAPP_SEND_FAILED";
    throw error;
  }
}

export function createWhatsappWebhookProcessor({
  findBusiness = findBusinessByWhatsappNumber,
  askAi = callAi,
  sendMessage = sendWhatsappText,
  appSecret = whatsapp.appSecret,
  now = Date.now,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  logger = (metadata) => console.error("WhatsApp webhook processing failed", metadata),
} = {}) {
  const processedMessages = new Map();
  const senderWindows = new Map();
  const inFlightMessages = new Set();

  function wasProcessed(messageId, timestamp) {
    pruneOldest(processedMessages, (expiresAt, currentTime) => expiresAt <= currentTime, timestamp);
    const expiresAt = processedMessages.get(messageId);
    if (expiresAt && expiresAt > timestamp) return true;
    if (expiresAt) processedMessages.delete(messageId);
    return false;
  }

  function markProcessed(messageId, timestamp) {
    processedMessages.set(messageId, timestamp + MESSAGE_TTL_MS);
    enforceCacheLimit(processedMessages);
  }

  function reserveSenderMessage(sender, timestamp) {
    pruneOldest(
      senderWindows,
      (reservations, currentTime) =>
        reservations[reservations.length - 1].timestamp + SENDER_WINDOW_MS <= currentTime,
      timestamp
    );

    const senderHash = createHmac("sha256", appSecret).update(sender).digest("hex");
    const reservations = senderWindows.get(senderHash) || [];
    while (
      reservations.length &&
      reservations[0].timestamp <= timestamp - SENDER_WINDOW_MS
    ) {
      reservations.shift();
    }

    if (reservations.length >= SENDER_LIMIT) return null;

    const reservation = { id: Symbol(), timestamp };
    reservations.push(reservation);
    senderWindows.delete(senderHash);
    senderWindows.set(senderHash, reservations);
    enforceCacheLimit(senderWindows);
    return { senderHash, id: reservation.id };
  }

  function releaseSenderReservation(reservation) {
    if (!reservation) return;
    const reservations = senderWindows.get(reservation.senderHash);
    if (!reservations) return;

    const index = reservations.findIndex(({ id }) => id === reservation.id);
    if (index !== -1) reservations.splice(index, 1);
    if (reservations.length === 0) senderWindows.delete(reservation.senderHash);
  }

  async function getCustomerReply(message, business, messageId) {
    if (message.type !== "text" || typeof message.text?.body !== "string") {
      return UNSUPPORTED_MESSAGE_REPLY;
    }

    const text = message.text.body.trim();
    if (!text) return UNSUPPORTED_MESSAGE_REPLY;
    if (text.length > 1000) return MESSAGE_TOO_LONG_REPLY;

    const shopName = business.businessName?.slice(0, 100);
    const request = {
      method: "POST",
      body: {
        message: text,
        senderRole: "customer",
        ...(shopName ? { shopName } : {}),
      },
      timeoutMs: 35_000,
    };

    let result = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await askAi(business.businessId, "/internal/orchestrate", request);
        break;
      } catch (error) {
        if (attempt === 0 && error?.code === "AI_UNAVAILABLE") {
          await wait(AI_RETRY_DELAY_MS);
          continue;
        }

        logSafely(
          logger,
          "ai_orchestrator_failed",
          business.businessId,
          messageId,
          error?.code === "SERVICE_NOT_CONFIGURED"
            ? "SERVICE_NOT_CONFIGURED"
            : "AI_UNAVAILABLE"
        );
        return AI_UNAVAILABLE_REPLY;
      }
    }

    if (!result) {
      logSafely(logger, "invalid_ai_response", business.businessId, messageId, "INVALID_AI_RESPONSE");
      return AI_UNAVAILABLE_REPLY;
    }

    if (result.route !== "customer" && result.route !== "unavailable") {
      logSafely(logger, "unexpected_ai_route", business.businessId, messageId, "UNEXPECTED_AI_ROUTE");
      return AI_UNAVAILABLE_REPLY;
    }

    if (typeof result.reply !== "string" || !result.reply.trim()) {
      logSafely(logger, "invalid_ai_response", business.businessId, messageId, "INVALID_AI_RESPONSE");
      return AI_UNAVAILABLE_REPLY;
    }

    return result.reply.trim();
  }

  async function processMessage(message, phoneNumberId, business) {
    const messageId = message?.id;
    const recipient = message?.from;
    if (typeof messageId !== "string" || !messageId || typeof recipient !== "string" || !recipient) {
      return true;
    }

    const timestamp = now();
    if (wasProcessed(messageId, timestamp)) return true;
    if (inFlightMessages.has(messageId)) return false;

    const senderReservation = reserveSenderMessage(recipient, timestamp);
    if (!senderReservation) return true;
    if (inFlightMessages.size >= MAX_CACHE_ENTRIES) {
      releaseSenderReservation(senderReservation);
      return false;
    }

    inFlightMessages.add(messageId);
    let delivered = false;
    try {
      const reply = await getCustomerReply(message, business, messageId);
      try {
        await sendMessage(phoneNumberId, recipient, reply);
      } catch (error) {
        logSafely(
          logger,
          "reply_delivery_failed",
          business.businessId,
          messageId,
          error?.code === "WHATSAPP_NOT_CONFIGURED"
            ? "WHATSAPP_NOT_CONFIGURED"
            : "WHATSAPP_SEND_FAILED"
        );
        return false;
      }

      markProcessed(messageId, now());
      delivered = true;
      return true;
    } finally {
      inFlightMessages.delete(messageId);
      if (!delivered) releaseSenderReservation(senderReservation);
    }
  }

  async function processPayload(payload) {
    let allMessagesHandled = true;
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = Array.isArray(value?.messages) ? value.messages : [];
        if (typeof phoneNumberId !== "string" || messages.length === 0) continue;

        let business;
        try {
          business = await findBusiness(phoneNumberId);
        } catch {
          logSafely(logger, "business_lookup_failed", null, null, "BUSINESS_LOOKUP_FAILED");
          allMessagesHandled = false;
          continue;
        }
        if (!business?.businessId) continue;

        for (const message of messages) {
          try {
            if (!(await processMessage(message, phoneNumberId, business))) {
              allMessagesHandled = false;
            }
          } catch {
            logSafely(
              logger,
              "message_processing_failed",
              business.businessId,
              typeof message?.id === "string" ? message.id : null,
              "MESSAGE_PROCESSING_FAILED"
            );
            allMessagesHandled = false;
          }
        }
      }
    }
    return allMessagesHandled;
  }

  return { processPayload };
}

export { AI_UNAVAILABLE_REPLY, MESSAGE_TOO_LONG_REPLY, UNSUPPORTED_MESSAGE_REPLY };
