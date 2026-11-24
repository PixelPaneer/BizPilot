
const validateFaq = (req, res, next) => {
  const { question, answer, language } = req.body;

  // Check required fields
  if (
    typeof question !== "string" ||
    typeof answer !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Question and answer are required",
    });
  }

  // Check empty values
  if (!question.trim() || !answer.trim()) {
    return res.status(400).json({
      success: false,
      message: "Question and answer cannot be empty",
    });
  }

  // Check question length (database limit: 500)
  if (question.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: "Question cannot exceed 500 characters",
    });
  }

  // Check language
  if (
    language !== undefined &&
    (typeof language !== "string" ||
      !/^[a-z]{2}(-[A-Z]{2})?$/.test(language))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid language code. Example: en or hi",
    });
  }

  next();
};

// Validate FAQ ID
const validateFaqId = (req, res, next) => {
  const { faqId } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(faqId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid FAQ ID",
    });
  }

  next();
};

export {
  validateFaq,
  validateFaqId,
};
