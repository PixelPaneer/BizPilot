// Email delivery is intentionally a placeholder.
// The current 11-table schema has no email-verification token/OTP table.
// Do not claim that an email has been verified until a verification workflow is added.
async function sendVerificationEmail() {
  throw new Error("Email verification is not configured in the current BizPilot schema.");
}

export { sendVerificationEmail };
