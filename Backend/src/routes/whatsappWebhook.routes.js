import { Router } from "express";
import { whatsapp } from "../config/env.js";
import {
  createWhatsappWebhookProcessor,
  isValidWhatsappSignature,
} from "../services/whatsappWebhook.service.js";

export function createWhatsappWebhookRouter({
  verifyToken = whatsapp.verifyToken,
  appSecret = whatsapp.appSecret,
  processPayload = createWhatsappWebhookProcessor().processPayload,
  logger = (metadata) => console.error("WhatsApp webhook payload processing failed", metadata),
} = {}) {
  const router = Router();

  router.get("/", (req, res) => {
    if (!verifyToken) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp webhook verification is not configured.",
        errors: [],
        code: "WEBHOOK_NOT_CONFIGURED",
      });
    }

    if (
      req.query["hub.mode"] !== "subscribe" ||
      req.query["hub.verify_token"] !== verifyToken ||
      typeof req.query["hub.challenge"] !== "string"
    ) {
      return res.status(403).json({
        success: false,
        message: "Webhook verification failed.",
        errors: [],
        code: "WEBHOOK_VERIFICATION_FAILED",
      });
    }

    return res.status(200).type("text/plain").send(req.query["hub.challenge"]);
  });

  router.post("/", async (req, res) => {
    if (!appSecret) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp webhook signing is not configured.",
        errors: [],
        code: "WEBHOOK_NOT_CONFIGURED",
      });
    }

    const signature = req.get("X-Hub-Signature-256");
    if (!isValidWhatsappSignature(req.body, signature, appSecret)) {
      return res.status(403).json({
        success: false,
        message: "Webhook signature is invalid.",
        errors: [],
        code: "INVALID_WEBHOOK_SIGNATURE",
      });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({
        success: false,
        message: "Webhook payload is invalid.",
        errors: [],
        code: "INVALID_WEBHOOK_PAYLOAD",
      });
    }

    try {
      const handled = await processPayload(payload);
      if (handled === false) return res.sendStatus(503);
      return res.sendStatus(200);
    } catch {
      logger({
        event: "payload_processing_failed",
        code: "PAYLOAD_PROCESSING_FAILED",
      });
      return res.sendStatus(503);
    }
  });

  return router;
}

export default createWhatsappWebhookRouter();
