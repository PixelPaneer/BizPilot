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

const loginValidator = [
  body("email").trim().isEmail().withMessage("Enter a valid email address."),
  body("password").isString().notEmpty().withMessage("Password is required.")
];

export { registerValidator, loginValidator };
