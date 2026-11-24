import { body } from "express-validator";

// The same choices as the business type list in Settings.
export const BUSINESS_TYPES = [
  "Retail",
  "Wholesale",
  "Manufacturing",
  "Food & Beverage",
  "Services",
  "Other"
];

const registerValidator = [
  body("firstName").trim().notEmpty().withMessage("First name is required.")
    .isLength({ max: 60 }).withMessage("First name must be 60 characters or fewer."),
  body("lastName").trim().notEmpty().withMessage("Last name is required.")
    .isLength({ max: 60 }).withMessage("Last name must be 60 characters or fewer."),
  body("email").trim().isEmail().withMessage("Enter a valid email address.")
    .isLength({ max: 150 }).withMessage("Email must be 150 characters or fewer."),
  body("whatsappNumber").trim()
    .matches(/^\+?[1-9]\d{7,14}$/).withMessage("Enter a valid WhatsApp number with country code."),
  body("password").isString().isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters."),
  body("business").isObject().withMessage("Business details are required."),
  body("business.name").trim().notEmpty().withMessage("Business name is required.")
    .isLength({ max: 150 }).withMessage("Business name must be 150 characters or fewer."),
  body("business.type").isIn(BUSINESS_TYPES).withMessage("Choose a business type."),
  body("business.address").trim().notEmpty().withMessage("Business address is required.")
    .isLength({ max: 500 }).withMessage("Business address must be 500 characters or fewer.")
];

// Sign in with an email, or with the WhatsApp number (the sign-in page sends whichever was typed).
const loginValidator = [
  body("email")
    .if(body("whatsappNumber").not().exists({ values: "falsy" }))
    .trim().isEmail().withMessage("Enter a valid email address."),
  body("whatsappNumber")
    .optional({ values: "falsy" })
    .customSanitizer((value) => (typeof value === "string" ? value.replace(/[\s()-]/g, "") : value))
    .trim().matches(/^\+?[1-9]\d{7,14}$/).withMessage("Enter a valid WhatsApp number with country code."),
  body("password").isString().notEmpty().withMessage("Password is required.")
];

// ---- WhatsApp number verification on the sign-up page --------------------------------------------
const whatsappNumberValidator = body("whatsappNumber").trim()
  .matches(/^\+?[1-9]\d{7,14}$/).withMessage("Enter a valid WhatsApp number with country code.");

const sendWhatsappOtpValidator = [whatsappNumberValidator];
const verifyWhatsappOtpValidator = [whatsappNumberValidator, body("otp").isString().trim().matches(/^\d{6}$/).withMessage("Enter the 6-digit OTP.")];

// ---- forgot password --------------------------------------------------------------------------
// Every step names where the OTP goes: { channel: "email", email } or { channel: "whatsapp", whatsappNumber }.
const resetTargetValidator = [
  body("channel").isIn(["email", "whatsapp"]).withMessage("Choose email or WhatsApp."),
  body("email")
    .if(body("channel").equals("email"))
    .trim().isEmail().withMessage("Enter a valid email address.")
    .isLength({ max: 150 }).withMessage("Email must be 150 characters or fewer."),
  body("whatsappNumber")
    .if(body("channel").equals("whatsapp"))
    .trim().matches(/^\+?[1-9]\d{7,14}$/).withMessage("Enter a valid WhatsApp number with country code.")
];

const otpValidator = body("otp").isString().trim()
  .matches(/^\d{6}$/).withMessage("Enter the 6-digit OTP.");

const forgotPasswordValidator = resetTargetValidator;
const verifyResetOtpValidator = [...resetTargetValidator, otpValidator];
const resetPasswordValidator = [
  body("resetToken").isString().trim().notEmpty().withMessage("Verify the OTP first."),
  // The same rule the password reset page shows: letters and numbers only, at least 8 characters.
  body("password").isString().isLength({ min: 8, max: 72 })
    .withMessage("Password must be between 8 and 72 characters.")
    .matches(/^[A-Za-z0-9]+$/).withMessage("Password can contain only letters and numbers.")
    .matches(/[A-Za-z]/).withMessage("Password must contain at least one letter.")
    .matches(/\d/).withMessage("Password must contain at least one number.")
];

export {
  registerValidator,
  loginValidator,
  sendWhatsappOtpValidator,
  verifyWhatsappOtpValidator,
  forgotPasswordValidator,
  verifyResetOtpValidator,
  resetPasswordValidator
};
