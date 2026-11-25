import nodemailer from "nodemailer";
import { smtp } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

// Email verification at sign-up is still not built (the schema has no verification table), so
// nothing claims an email is verified. This file only sends the password reset OTP.

async function sendVerificationEmail() {
  throw new Error("Email verification is not configured in the current BizPilot schema.");
}

export function isEmailConfigured() {
  return Boolean(smtp.host && smtp.from);
}

let transporter;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return transporter;
}

async function sendPasswordResetOtpEmail(to, otp, { firstName, validMinutes }) {
  const name = firstName ? ` ${firstName}` : "";
  try {
    await getTransporter().sendMail({
      from: smtp.from,
      to,
      subject: "Your BizPilot password reset code",
      text:
        `Hi${name},\n\nYour BizPilot password reset code is ${otp}.\n` +
        `It is valid for ${validMinutes} minutes. If you did not ask for this, you can ignore this email.\n\n` +
        `Never share this code with anyone.`,
      html:
        `<p>Hi${name},</p><p>Your BizPilot password reset code is</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>` +
        `<p>It is valid for ${validMinutes} minutes. If you did not ask for this, you can ignore this email.</p>` +
        `<p>Never share this code with anyone.</p>`,
    });
  } catch (error) {
    console.error("Password reset email failed:", error.message);
    throw new ApiError(502, "We could not send the OTP email right now. Please try again.", [], "OTP_DELIVERY_FAILED");
  }
}

export { sendVerificationEmail, sendPasswordResetOtpEmail };
