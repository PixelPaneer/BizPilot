import { body, param } from "express-validator";

const faqBodyValidators = [
  body("question").trim().notEmpty().withMessage("Question is required.")
    .isLength({ max: 500 }).withMessage("Question cannot exceed 500 characters."),
  body("answer").trim().notEmpty().withMessage("Answer is required."),
  body("language").optional()
    .isString().matches(/^[a-z]{2}(-[A-Z]{2})?$/).withMessage("Invalid language code."),
];

export const createFaqValidator = faqBodyValidators;
export const updateFaqValidator = faqBodyValidators;
export const faqIdValidator = [
  param("faqId").isUUID(1).withMessage("Invalid FAQ ID."),
];
