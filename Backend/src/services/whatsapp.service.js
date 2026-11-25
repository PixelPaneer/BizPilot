import { whatsapp } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

export function isWhatsappConfigured() {
  return Boolean(whatsapp.apiToken && whatsapp.phoneNumberId);
}

// Sends the OTP with the WhatsApp Cloud API, using an approved "authentication" message template
// (the template name is WHATSAPP_OTP_TEMPLATE). `to` is the number with country code, e.g. +919876543210.
export async function sendOtpWhatsApp(to, otp) {
  const { apiToken, phoneNumberId, otpTemplate, templateLanguage, apiVersion } = whatsapp;

  let response;
  try {
    response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: otpTemplate,
          language: { code: templateLanguage },
          components: [
            { type: "body", parameters: [{ type: "text", text: otp }] },
            // Authentication templates carry the code again in their "copy code" button.
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: otp }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("WhatsApp OTP request failed:", error.message);
    throw new ApiError(502, "We could not send the OTP on WhatsApp right now. Please try again.", [], "OTP_DELIVERY_FAILED");
  }

  if (!response.ok) {
    console.error("WhatsApp OTP rejected:", response.status, await response.text().catch(() => ""));
    throw new ApiError(502, "We could not send the OTP on WhatsApp right now. Please try again.", [], "OTP_DELIVERY_FAILED");
  }
}
